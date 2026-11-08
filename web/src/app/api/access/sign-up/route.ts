/** Closed until tenant provisioning, quotas and joint recovery pass their gates. */
export async function POST() {
  return Response.json({ error: "El registro de pruebas todavía no está abierto.", code: "registration_not_open" }, { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "3600" } });
}
