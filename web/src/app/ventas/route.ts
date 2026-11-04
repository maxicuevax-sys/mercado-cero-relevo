import type { NextRequest } from "next/server";
import { tabRedirect } from "@/app/_redirects/tab";

export function GET(request: NextRequest) {
  return tabRedirect(request, "caja");
}
