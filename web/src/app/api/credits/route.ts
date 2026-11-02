import { connection } from "next/server";
import { countCredits, listCredits } from "@/lib/db";
import { cachedJson } from "@/lib/http-cache";
import {
  DEFAULT_CREDITS_LIMIT,
  MAX_CREDITS_LIMIT,
  pageMeta,
  parseLimit,
  parseOffset,
} from "@/lib/pagination";

export async function GET(request: Request) {
  // El saldo vivo no puede servirse desde un snapshot de build.
  await connection();
  const params = new URL(request.url).searchParams;
  const limit = parseLimit(params, DEFAULT_CREDITS_LIMIT, MAX_CREDITS_LIMIT);
  const offset = parseOffset(params);
  const credits = listCredits(limit, offset);
  const total = countCredits();
  const meta = pageMeta(limit, offset, credits.length, total);
  return await cachedJson(
    request,
    {
      credits,
      limit,
      offset,
      total,
      hasMore: meta.hasMore,
      pagination: meta,
    },
    "credits",
  );
}
