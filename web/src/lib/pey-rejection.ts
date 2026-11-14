/**
 * Traduce un 4xx de pey a una respuesta de caja.
 * No reenvía el cuerpo de pey: puede traer identificadores de la petición.
 * Un 5xx sigue siendo un fallo interno.
 */
export function peyRejectionResponse(error: unknown): Response | null {
  if (!(error instanceof Error)) return null;
  const match = /^pey (\d{3}):/.exec(error.message);
  if (!match) return null;
  const status = Number(match[1]);
  if (status < 400 || status >= 500) return null;
  return Response.json(
    {
      error: "pey no aceptó este cobro. El pedido sigue sin pagar.",
      code: "pey_rejected",
    },
    { status: 422 },
  );
}
