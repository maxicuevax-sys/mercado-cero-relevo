import { fulfillOrder, getOrderDetail } from "@/lib/orders";

export async function GET(_request: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const detail = getOrderDetail(id);
  if (!detail) {
    return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
  }
  return Response.json(detail);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as
    | { action?: string; status?: string }
    | null;

  if (body?.action !== "fulfill" && body?.status !== "fulfilled") {
    return Response.json({ error: "Acción no soportada." }, { status: 400 });
  }

  try {
    const order = fulfillOrder(id);
    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }
    return Response.json({ order });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo marcar el pedido." },
      { status: 409 },
    );
  }
}
