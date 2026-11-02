/**
 * Límites de paginación de la API. Un default acotado evita que una pestaña
 * abierta serialice toda la base; el tope evita que `?limit=999999` lo anule.
 */
export const DEFAULT_ORDERS_LIMIT = 50;
export const MAX_ORDERS_LIMIT = 200;
export const DEFAULT_CREDITS_LIMIT = 100;
export const MAX_CREDITS_LIMIT = 200;
export const DEFAULT_TASKS_LIMIT = 50;
export const MAX_TASKS_LIMIT = 200;
export const DEFAULT_DASHBOARD_ORDERS_LIMIT = 30;
export const MAX_DASHBOARD_ORDERS_LIMIT = 50;
export const DEFAULT_DASHBOARD_PENDING_LIMIT = 50;
export const MAX_DASHBOARD_PENDING_LIMIT = 100;
export const DEFAULT_DASHBOARD_CREDITS_LIMIT = 100;
export const MAX_DASHBOARD_CREDITS_LIMIT = 200;

function integerParam(
  params: URLSearchParams,
  name: string,
): number | null {
  const raw = params.get(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export function parseNamedLimit(
  params: URLSearchParams,
  name: string,
  fallback: number,
  max: number,
): number {
  const value = integerParam(params, name);
  if (value === null) return fallback;
  return Math.min(max, Math.max(1, value));
}

export function parseLimit(
  params: URLSearchParams,
  fallback: number,
  max: number,
): number {
  return parseNamedLimit(params, "limit", fallback, max);
}

export function parseNamedOffset(
  params: URLSearchParams,
  name: string,
): number {
  const value = integerParam(params, name);
  if (value === null) return 0;
  return Math.min(1_000_000, Math.max(0, value));
}

export function parseOffset(params: URLSearchParams): number {
  return parseNamedOffset(params, "offset");
}

export interface PageMeta {
  limit: number;
  offset: number;
  returned: number;
  total: number;
  hasMore: boolean;
}

export function pageMeta(
  limit: number,
  offset: number,
  returned: number,
  total: number,
): PageMeta {
  return {
    limit,
    offset,
    returned,
    total,
    hasMore: offset + returned < total,
  };
}
