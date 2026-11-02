/**
 * Compatibilidad del carril de datos. La lectura real de cuerpos vive en
 * `http-security.ts`; aquí solo se conserva la constante y la firma que usaban
 * los endpoints originales, delegando en una sola implementación.
 */
import { readJsonLimited as readJsonLimitedSecure } from "./http-security";

/** Límite compartido por los POST que reciben JSON de la caja. */
export const MAX_JSON_BODY_BYTES = 32 * 1024;

export function readJsonLimited(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  return readJsonLimitedSecure(request, maxBytes);
}
