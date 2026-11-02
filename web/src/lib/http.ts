import { PayloadTooLargeError, ValidationError } from "./errors";

/** Límite compartido por los POST que reciben JSON de la caja. */
export const MAX_JSON_BODY_BYTES = 32 * 1024;

/**
 * Lee JSON con un techo real de bytes. Revisa `content-length` y, si el
 * cliente usa chunked, corta el stream antes de bufferizar el cuerpo completo.
 */
export async function readJsonLimited(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes) {
      throw new PayloadTooLargeError();
    }
  }

  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) return {};

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError("El cuerpo no es JSON válido.", "invalid_json");
  }
}
