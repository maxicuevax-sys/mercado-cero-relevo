import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";
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
  const limited = enforceRateLimit(request, "order-patch", 60, 60_000);
  if (limited) return limited;

  let body: { action?: string; status?: string } | null;
  try {
    body = await readJsonLimited<{ action?: string; status?: string }>(
      request,
      MAX_SMALL_JSON_BYTES,
    );
  } catch (error) {
    return bodyErrorResponse(error);
  }

  if (body.action !== "fulfill" && body.status !== "fulfilled") {
    return Response.json({ error: "Acción no soportada." }, { status: 400 });
  }

  try {
    const { id } = await ctx.params;
    const order = fulfillOrder(id);
    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }
    return Response.json({ order });
  } catch (error) {
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo marcar el pedido.");
  }
}
