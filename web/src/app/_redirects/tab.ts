import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirección HTTP 307 para los alias de Oleada A.
 * Conserva `ayuda=1` (hoja de ayuda) y descarta parámetros ajenos.
 * El hash lo conserva el navegador al no incluirlo en `Location`.
 */
export function tabRedirect(request: NextRequest, tab: string) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("tab", tab);
  if (request.nextUrl.searchParams.get("ayuda") === "1") {
    destination.searchParams.set("ayuda", "1");
  }
  return NextResponse.redirect(destination, 307);
}
