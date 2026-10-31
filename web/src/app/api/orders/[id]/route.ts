import { getOrderDetail } from "@/lib/orders";

export async function GET(_request: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const detail = getOrderDetail(id);
  if (!detail) {
    return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
  }
  return Response.json(detail);
}
