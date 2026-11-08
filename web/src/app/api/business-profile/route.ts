import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { getBusinessProfile, isBusinessType, setBusinessProfile } from "@/lib/business-profile";
import { unexpectedResponse } from "@/lib/errors";
import { bodyErrorResponse, isSameOriginMutation, readJsonLimited } from "@/lib/http-security";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
function privateResponse(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(privateHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

async function GETImpl() {
  try {
    return Response.json({ profile: getBusinessProfile() }, { headers: privateHeaders });
  } catch (error) {
    return privateResponse(unexpectedResponse(error, "No se pudo consultar el perfil del negocio."));
  }
}

async function PUTImpl(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: "El origen de la petición no está permitido.", code: "cross_origin" }, { status: 403, headers: privateHeaders });
  }
  let body: unknown;
  try {
    body = await readJsonLimited(request, 1024);
  } catch (error) {
    return privateResponse(bodyErrorResponse(error));
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !("businessType" in body) || !isBusinessType(body.businessType)) {
    return Response.json({ error: "Elige un giro válido.", code: "invalid_business_type" }, { status: 400, headers: privateHeaders });
  }
  try {
    return Response.json({ profile: setBusinessProfile(body.businessType) }, { headers: privateHeaders });
  } catch (error) {
    return privateResponse(unexpectedResponse(error, "No se pudo guardar el perfil del negocio."));
  }
}

export const GET = withPilotRoute(GETImpl);
export const PUT = withPilotRoute(PUTImpl);
