import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readdir, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import {
  bodyErrorResponse,
  enforceRateLimit,
  readJsonLimited,
} from "@/lib/http-security";
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
const MAX_CACHE_FILES = 512;

function cacheKey(text: string): string {
  return createHash("sha256")
    .update(`piper:es_MX-claude-high:${text}`)
    .digest("hex");
}

/**
 * El caché de voz es un archivo por frase. Sin tope, un demo largo o un
 * cliente curioso puede llenar el disco. Se conservan las 512 frases más
 * recientes y se borran las más viejas por mtime.
 */
async function pruneTtsCache(): Promise<void> {
  try {
    const entries = (await readdir(CACHE_DIR)).filter((name) => name.endsWith(".wav"));
    if (entries.length <= MAX_CACHE_FILES) return;

    const files = await Promise.all(
      entries.map(async (name) => {
        const filePath = path.join(CACHE_DIR, name);
        const info = await stat(filePath);
        return { filePath, mtimeMs: info.mtimeMs };
      }),
    );
    files.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const excess = files.length - MAX_CACHE_FILES;
    await Promise.all(
      files.slice(0, excess).map((file) => unlink(file.filePath).catch(() => undefined)),
    );
  } catch (error) {
    console.error("[tts] no se pudo podar el caché", error);
  }
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
  const limited = enforceRateLimit(request, "tts", 40, 60_000);
  if (limited) return limited;

  let body: { text?: unknown } | null;
  try {
    body = await readJsonLimited<{ text?: unknown }>(request, 4 * 1024);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 280) {
    return Response.json({ error: "Texto inválido." }, { status: 400 });
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
    void pruneTtsCache();
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
