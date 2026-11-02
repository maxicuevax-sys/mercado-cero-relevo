import {
  bodyErrorResponse,
  enforceRateLimit,
  internalErrorResponse,
  MAX_TRANSCRIBE_BYTES,
  readFormDataLimited,
} from "@/lib/http-security";
import { transcribeAudio } from "@/lib/voice";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "voice-transcribe", 6, 60_000);
  if (limited) return limited;

  let form: FormData;
  try {
    // El tope incluye boundary/cabeceras; el archivo real se valida abajo.
    form = await readFormDataLimited(request, MAX_TRANSCRIBE_BYTES + 64 * 1024);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const audio = form.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "Falta el audio." }, { status: 400 });
    }

    if (audio.size > MAX_TRANSCRIBE_BYTES) {
      return Response.json(
        { error: "El audio es demasiado grande." },
        { status: 413 },
      );
    }

    const text = await transcribeAudio(audio);
    return Response.json({ text });
  } catch (error) {
    return internalErrorResponse("voice transcribe", error);
  }
}
