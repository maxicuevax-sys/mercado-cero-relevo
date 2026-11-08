/** Fail closed until identity is bound to isolated business data. No body is
 * read, credential logged, session issued or business database opened here. */
export async function POST() {
  return Response.json(
    { error: "El acceso de prueba todavía no está abierto.", code: "access_not_open" },
    { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "3600" } },
  );
}
