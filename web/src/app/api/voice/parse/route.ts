import {
  bodyErrorResponse,
  enforceRateLimit,
  internalErrorResponse,
  MAX_VOICE_PARSE_BYTES,
  readJsonLimited,
} from "@/lib/http-security";
import { parseSale } from "@/lib/voice";

const MAX_TRANSCRIPT_CHARS = 2000;

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "voice-parse", 20, 60_000);
  if (limited) return limited;

  let body: { transcript?: unknown };
  try {
    body = await readJsonLimited<{ transcript?: unknown }>(request, MAX_VOICE_PARSE_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return Response.json({ error: "Falta la transcripción." }, { status: 400 });
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return Response.json(
      { error: "La transcripción es demasiado larga." },
      { status: 413 },
    );
  }

  try {
    const parsed = await parseSale(transcript);
    return Response.json(parsed);
  } catch (error) {
    return internalErrorResponse("voice parse", error);
  }
}
