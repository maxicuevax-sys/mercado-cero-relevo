import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { connection } from "next/server";
import { z } from "zod";
import { countOrders, getOrderByRequestId, listOrders } from "@/lib/db";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import { MAX_JSON_BODY_BYTES } from "@/lib/http";
import { cachedJson } from "@/lib/http-cache";
import {
  bodyErrorResponse,
  enforceRateLimit,
  readJsonLimited,
} from "@/lib/http-security";
import {
  MAX_CUSTOMER_NAME_CHARS,
  MAX_ITEM_DESCRIPTION_CHARS,
  MAX_ITEM_QUANTITY,
  MAX_ORDER_ITEMS,
  MAX_ORDER_TOTAL_CENTS,
  MAX_REQUEST_ID_CHARS,
  MAX_UNIT_PRICE_CENTS,
  createOrder,
} from "@/lib/orders";
import {
  DEFAULT_ORDERS_LIMIT,
  MAX_ORDERS_LIMIT,
  pageMeta,
  parseLimit,
  parseOffset,
} from "@/lib/pagination";

const itemSchema = z.object({
  description: z.string().trim().min(1).max(MAX_ITEM_DESCRIPTION_CHARS),
  quantity: z.number().positive().max(MAX_ITEM_QUANTITY),
  unitPriceCents: z.number().int().positive().max(MAX_UNIT_PRICE_CENTS),
});

const createOrderSchema = z.object({
  items: z.array(itemSchema).min(1).max(MAX_ORDER_ITEMS),
  cashCents: z.number().int().nonnegative().max(MAX_ORDER_TOTAL_CENTS).optional(),
  customerName: z
    .string()
    .trim()
    .max(MAX_CUSTOMER_NAME_CHARS)
    .nullable()
    .optional(),
  creditCents: z.number().int().nonnegative().max(MAX_ORDER_TOTAL_CENTS).optional(),
  paymentMethod: z.enum(["codi", "card", "wallet", "cash", "mixed"]).optional(),
  requestId: z.string().trim().max(MAX_REQUEST_ID_CHARS).optional(),
});

async function GETImpl(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const requestId = params.get("requestId")?.trim();
  if (requestId) {
    if (requestId.length > MAX_REQUEST_ID_CHARS) {
      return Response.json(
        { error: "El identificador de la solicitud no es válido.", code: "request_id_invalid" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const order = getOrderByRequestId(requestId);
    if (!order) {
      return Response.json(
        { error: "No se encontró una venta con esa llave.", code: "order_not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { order },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const limit = parseLimit(params, DEFAULT_ORDERS_LIMIT, MAX_ORDERS_LIMIT);
  const offset = parseOffset(params);
  const orders = listOrders(limit, offset);
  const total = countOrders();
  const meta = pageMeta(limit, offset, orders.length, total);
  return await cachedJson(
    request,
    {
      orders,
      limit,
      offset,
      total,
      hasMore: meta.hasMore,
      pagination: meta,
    },
    "orders",
  );
}

async function POSTImpl(request: Request) {
  const limited = enforceRateLimit(request, "orders-create", 60, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_JSON_BODY_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const input = createOrderSchema.parse(body);
    const order = createOrder(input);
    return Response.json(
      { order },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Datos de venta inválidos.", issues: error.issues },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const known = appErrorResponse(error);
    if (known) return known;
    const response = unexpectedResponse(error, "No se pudo crear la venta.");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export const GET = withPilotRoute(GETImpl);
export const POST = withPilotRoute(POSTImpl);
