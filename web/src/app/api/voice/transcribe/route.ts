import { withPilotRoute } from "../../../../lib/auth/pilot-route";
import {
  bodyErrorResponse,
  enforceRateLimit,
  hasValidOperatorAccessToken,
  internalErrorResponse,
  isSameOriginMutation,
  MAX_TRANSCRIBE_BYTES,
  readFormDataLimited,
} from "@/lib/http-security";
import { transcribeAudio } from "@/lib/voice";

async function POSTImpl(request: Request) {
  // Esta ruta está fuera del matcher del Proxy para no bufferizar 12 MB:
  // conserva aquí la misma defensa CSRF y de operadora que el resto de mutadores.
  if (!isSameOriginMutation(request)) {
    return Response.json(
      { error: "El origen de la petición no está permitido.", code: "cross_origin" },
      { status: 403 },
    );
  }

  if (!hasValidOperatorAccessToken(request)) {
    const authLimited = enforceRateLimit(request, "operator-auth", 20, 60_000);
    if (authLimited) return authLimited;
    return Response.json(
      {
        error: "Se requiere acceso de operadora para usar la caja.",
        code: "operator_auth_required",
      },
      { status: 401 },
    );
  }

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

export const POST = withPilotRoute(POSTImpl);
