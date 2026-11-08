import { currentTenantDatabase } from "./auth/tenant-scope";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

/**
 * Perfiles de caché para lecturas. Son `private` porque la caja es de una sola
 * comerciante y no debe quedar en un CDN compartido. El ETag se calcula del
 * payload completo: si cambia un saldo, un pedido o un abono, cambia el hash.
 */
const CACHE_PROFILES = {
  dashboard: "private, max-age=5, stale-while-revalidate=30",
  orders: "private, max-age=10, stale-while-revalidate=30",
  credits: "private, max-age=10, stale-while-revalidate=30",
  analytics: "private, max-age=30, stale-while-revalidate=60",
  tasks: "private, max-age=5, stale-while-revalidate=15",
} as const;

export type CacheProfile = keyof typeof CACHE_PROFILES;

function etagFor(body: string): string {
  const digest = crypto.createHash("sha256").update(body).digest("base64url");
  return `"${digest.slice(0, 27)}"`;
}

function ifNoneMatchMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  const candidates = header.split(",").map((value) => value.trim());
  return candidates.some((candidate) => {
    if (candidate === "*") return true;
    const normalized = candidate.startsWith("W/") ? candidate.slice(2) : candidate;
    return normalized === etag;
  });
}

/**
 * Devuelve JSON con ETag/304 y Cache-Control. Las mutaciones no pasan por
 * aquí: cada POST/PATCH sigue sin cabeceras cacheables.
 */
const gzipAsync = promisify(gzip);
const GZIP_MIN_BYTES = 512;

export async function cachedJson(
  request: Request,
  payload: unknown,
  profile: CacheProfile,
): Promise<Response> {
  const tenant = Boolean(currentTenantDatabase());
  const body = JSON.stringify(payload);
  const etag = etagFor(body);
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": tenant ? "private, no-store" : CACHE_PROFILES[profile],
    ETag: etag,
    Vary: tenant ? "Accept-Encoding, Cookie" : "Accept-Encoding",
  });

  if (tenant) headers.delete("ETag");
  if (!tenant && ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }

  const uncompressed = Buffer.from(body, "utf8");
  const acceptsGzip = /\bgzip\b/i.test(
    request.headers.get("accept-encoding") ?? "",
  );
  if (acceptsGzip && uncompressed.byteLength >= GZIP_MIN_BYTES) {
    const compressed = await gzipAsync(uncompressed);
    headers.set("Content-Encoding", "gzip");
    headers.set("Content-Length", String(compressed.byteLength));
    return new Response(compressed, { status: 200, headers });
  }

  headers.set("Content-Length", String(uncompressed.byteLength));
  return new Response(body, { status: 200, headers });
}
