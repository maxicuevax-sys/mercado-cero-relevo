import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import path from "node:path";
import { toSpeechText } from "@/lib/speech";

const ROOT = process.cwd();
const PIPER_DIR = process.env.PIPER_DIR ?? path.join(ROOT, "data", "piper");
const PIPER_BIN = process.env.PIPER_BIN ?? path.join(PIPER_DIR, "piper.exe");
const PIPER_MODEL =
  process.env.PIPER_MODEL ?? path.join(PIPER_DIR, "es_MX-claude-high.onnx");
const CACHE_DIR = path.join(ROOT, "data", "tts-cache");
const PUBLIC_TTS = path.join(ROOT, "public", "tts");

/**
 * Frases fijas que conservan la voz Kokoro em_santa aunque lleguen por la ruta
 * dinámica. Las claves están normalizadas para voz: sin "$" ni ".00", porque
 * los motores TTS leen "$50.00" como "cincuenta punto cero cero".
 */
const FIXED_KOKORO: Record<string, string> = {
  "Revisa el abono de 50 pesos a Juan.": "revisa-abono-50-juan.wav",
  "Abono de 50 pesos a Juan. Saldo: cero pesos.": "abono-50-juan.wav",
};

const inflight = new Map<string, Promise<string>>();
const buckets = new Map<string, { count: number; reset: number }>();

function cacheKey(text: string): string {
  return createHash("sha256")
    .update(`piper:es_MX-claude-high:${text}`)
    .digest("hex");
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  buckets.set(ip, bucket);
  return bucket.count > 40;
}

async function generate(text: string, key: string): Promise<string> {
  if (
    !existsSync(/* turbopackIgnore: true */ PIPER_BIN) ||
    !existsSync(/* turbopackIgnore: true */ PIPER_MODEL)
  ) {
    throw new Error("Piper no está instalado.");
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const out = path.join(CACHE_DIR, `${key}.wav`);
  if (existsSync(/* turbopackIgnore: true */ out)) return out;

  await new Promise<void>((resolve, reject) => {
    const tmp = `${out}.${process.pid}.${Date.now()}.tmp.wav`;
    const child = spawn(/* turbopackIgnore: true */ PIPER_BIN, ["-m", PIPER_MODEL, "-f", tmp, "-q"], {
      cwd: PIPER_DIR,
      windowsHide: true,
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Tiempo de espera de Piper."));
    }, 15_000);

    child.stdin.on("error", () => {
      // El proceso puede cerrar stdin antes de que terminemos de escribir.
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `Piper terminó con código ${code}.`));
        return;
      }
      rename(tmp, out).then(resolve).catch(reject);
    });

    child.stdin.write(text, "utf8");
    child.stdin.end();
  });

  return out;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { text?: unknown }
    | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 280) {
    return Response.json({ error: "Texto inválido." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "Demasiadas solicitudes." }, { status: 429 });
  }

  const speech = toSpeechText(text);
  const key = cacheKey(speech);
  try {
    const fixed = FIXED_KOKORO[speech];
    if (fixed) {
      const audio = await readFile(
        /* turbopackIgnore: true */ path.join(PUBLIC_TTS, fixed),
      );
      return new Response(new Uint8Array(audio), {
        headers: {
          "content-type": "audio/wav",
          "cache-control": "public, max-age=0, must-revalidate",
        },
      });
    }

    let job = inflight.get(key);
    if (!job) {
      job = generate(speech, key).finally(() => inflight.delete(key));
      inflight.set(key, job);
    }
    const file = await job;
    const audio = await readFile(/* turbopackIgnore: true */ file);
    return new Response(new Uint8Array(audio), {
      headers: {
        "content-type": "audio/wav",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[tts] no se pudo generar la voz", error);
    return Response.json(
      { error: "La voz no está disponible." },
      { status: 503 },
    );
  }
}
