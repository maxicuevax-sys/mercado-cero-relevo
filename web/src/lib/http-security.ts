/**
 * Defensas HTTP compartidas por las rutas y el Proxy de Next 16.
 *
 * Este archivo debe permanecer libre de APIs de Node para poder importarse
 * también desde `src/proxy.ts` (que corre en el runtime Node de Next, pero se
 * empaqueta aparte).
 */

import { AppError, appErrorResponse, unexpectedResponse } from "./errors";

export const MAX_WEBHOOK_BYTES = 64 * 1024;
export const MAX_VOICE_PARSE_BYTES = 8 * 1024;
export const MAX_TRANSCRIBE_BYTES = 12 * 1024 * 1024;
export const MAX_ORDERS_BYTES = 64 * 1024;
export const MAX_SMALL_JSON_BYTES = 8 * 1024;
export const MAX_RESET_BYTES = 1024;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAFE_FETCH_SITES = new Set(["same-origin", "none"]);

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 2048;
let limiterCalls = 0;

function firstHeaderValue(value: string | null): string | null {
  return (
    value
      ?.split(",")[0]
      ?.trim()
      .replace(/^\[|\]$/g, "") || null
  );
}

/**
 * Cloudflare escribe `CF-Connecting-IP` y no permite que el cliente la
 * sobrescriba cuando el tráfico pasa por el túnel. El fallback a
 * `x-forwarded-for` sirve para desarrollo local y para proxies propios.
 * Nunca se debe exponer el servidor directo a Internet sin Cloudflare Access:
 * fuera del proxy, cualquiera puede falsificar estas cabeceras.
 */
export function getClientIp(request: Request): string {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ??
    firstHeaderValue(request.headers.get("true-client-ip")) ??
    firstHeaderValue(request.headers.get("x-real-ip")) ??
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    "unknown"
  );
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const url = new URL(request.url);
  // Solo un proxy propio (Cloudflare Tunnel, nginx, etc.) puede reescribir
  // Host/Proto. Sin TRUST_PROXY=1, `X-Forwarded-Host` es una cabecera que el
  // cliente controla y permitirla dejaría pasar un CSRF con Origin ajeno.
  const trustProxy = process.env.TRUST_PROXY === "1";
  const forwardedHost = trustProxy
    ? firstHeaderValue(request.headers.get("x-forwarded-host"))
    : null;
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host")) ?? url.host;
  const forwardedProto = trustProxy
    ? firstHeaderValue(request.headers.get("x-forwarded-proto"))
    : null;
  const protocol = forwardedProto ?? url.protocol.replace(":", "");
  const requestOrigin = normalizeOrigin(`${protocol}://${host}`);
  if (requestOrigin) origins.add(requestOrigin);

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    const appOrigin = normalizeOrigin(appUrl);
    if (appOrigin) origins.add(appOrigin);
  }

  // Next dev/start puede enmascarar el host real del túnel detrás de un
  // loopback. Estos orígenes solo aplican al mismo puerto que la petición.
  if (url.port) {
    for (const loopback of ["localhost", "127.0.0.1", "[::1]"]) {
      const normalized = normalizeOrigin(`${url.protocol}//${loopback}:${url.port}`);
      if (normalized) origins.add(normalized);
    }
  }

  return origins;
}

/**
 * Rechaza mutaciones disparadas por otro origen. Es una defensa CSRF, no una
 * autenticación: el modo demo no tiene sesión y por eso además se exige
 * `DEMO_RESET_TOKEN` cuando está configurado.
 *
 * - `Origin` presente debe coincidir con el host de la petición o `APP_URL`.
 * - `Sec-Fetch-Site: cross-site` (o `same-site`) se rechaza siempre.
 * - Sin `Origin`/`Sec-Fetch-Site` se permite para clientes no navegador
 *   (curl, harness, webhooks). La ruta de reset además exige token si existe.
 */
export function isSameOriginMutation(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && !SAFE_FETCH_SITES.has(fetchSite)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  return allowedOrigins(request).has(normalized);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function configuredDemoResetToken(): string | null {
  const token = process.env.DEMO_RESET_TOKEN?.trim();
  return token ? token : null;
}

export function hasValidDemoResetToken(request: Request): boolean {
  const token = configuredDemoResetToken();
  if (!token) return true;

  const headerToken = request.headers.get("x-demo-token")?.trim();
  if (headerToken && safeEqual(headerToken, token)) return true;

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer && safeEqual(bearer, token)) return true;
  }

  return false;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.reset) buckets.delete(key);
  }
}

/**
 * Ventana fija por IP + ruta. El Map está acotado: al llegar a MAX_BUCKETS se
 * descarta la entrada más vieja (orden de inserción del Map) y cada 128
 * llamadas se limpian las ventanas vencidas.
 */
export function checkRateLimit(
  request: Request,
  route: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  limiterCalls += 1;
  if (limiterCalls % 128 === 0 || buckets.size >= MAX_BUCKETS) {
    pruneExpired(now);
  }

  const key = `${route}|${getClientIp(request)}`;
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + windowMs };
  }
  bucket.count += 1;

  // Refresca la posición LRU.
  buckets.delete(key);
  buckets.set(key, bucket);

  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.reset - now) / 1000)),
  };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfterSeconds),
        "x-ratelimit-remaining": "0",
      },
    },
  );
}

/** Devuelve una respuesta 429 o null si la petición puede continuar. */
export function enforceRateLimit(
  request: Request,
  route: string,
  limit: number,
  windowMs = 60_000,
): Response | null {
  const result = checkRateLimit(request, route, limit, windowMs);
  return result.allowed ? null : rateLimitResponse(result);
}

/** Error de lectura del cuerpo; comparte la API de `AppError`. */
export class BodyError extends AppError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = "BodyError";
  }
}

function declaredContentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function readBytesLimited(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = declaredContentLength(request);
  if (declared !== null && declared > maxBytes) {
    throw new BodyError(413, "body_too_large", "El cuerpo de la petición es demasiado grande.");
  }

  if (!request.body) return new Uint8Array(0);

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
        throw new BodyError(413, "body_too_large", "El cuerpo de la petición es demasiado grande.");
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // El stream ya pudo quedar cerrado tras cancel().
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readTextLimited(request: Request, maxBytes: number): Promise<string> {
  const bytes = await readBytesLimited(request, maxBytes);
  return new TextDecoder().decode(bytes);
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonLimited<T = unknown>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  const text = await readTextLimited(request, maxBytes);
  if (!text.trim()) {
    throw new BodyError(400, "invalid_json", "El cuerpo debe ser JSON válido.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BodyError(400, "invalid_json", "El cuerpo debe ser JSON válido.");
  }
}

export async function readOptionalJsonLimited<T>(
  request: Request,
  maxBytes: number,
  fallback: T,
): Promise<T> {
  const text = await readTextLimited(request, maxBytes);
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BodyError(400, "invalid_json", "El cuerpo debe ser JSON válido.");
  }
}

/**
 * Lee multipart con tope antes de parsear. Evita que `request.formData()`
 * materialice un cuerpo arbitrariamente grande en memoria.
 */
export async function readFormDataLimited(
  request: Request,
  maxBytes: number,
): Promise<FormData> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().includes("multipart/form-data")) {
    throw new BodyError(400, "invalid_form", "Envía el audio como multipart/form-data.");
  }
  const bytes = await readBytesLimited(request, maxBytes);
  try {
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return await new Response(arrayBuffer, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new BodyError(400, "invalid_form", "No se pudo leer el formulario.");
  }
}

export function bodyErrorResponse(error: unknown): Response {
  const known = appErrorResponse(error);
  if (known) return known;
  console.error("[http] error inesperado leyendo el cuerpo", error);
  return Response.json(
    { error: "No se pudo leer la petición.", code: "invalid_body" },
    { status: 400 },
  );
}

/** Mensaje genérico + log server-side para no filtrar errores internos. */
export function internalErrorResponse(scope: string, error: unknown, status = 500): Response {
  console.error(`[${scope}] error inesperado`, error);
  return unexpectedResponse(
    error,
    "No se pudo completar la operación. Intenta de nuevo.",
    status,
  );
}
