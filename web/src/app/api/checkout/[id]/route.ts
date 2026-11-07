import { getCheckoutData } from "@/lib/checkout";
import { cachedJson } from "@/lib/http-cache";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const checkout = getCheckoutData(id);
  if (!checkout) {
    return Response.json({ error: "Este cobro no existe." }, { status: 404 });
  }

  // ETag/304 para el polling del comprador: si el pago no cambió, no se
  // vuelve a mandar el payload ni se rehidrata la pantalla.
  return await cachedJson(request, checkout, "orders");
}
