import { connection } from "next/server";
import { z } from "zod";
import { countOrders, listOrders } from "@/lib/db";
import { cachedJson } from "@/lib/http-cache";
import { createOrder } from "@/lib/orders";
import {
  DEFAULT_ORDERS_LIMIT,
  MAX_ORDERS_LIMIT,
  pageMeta,
  parseLimit,
  parseOffset,
} from "@/lib/pagination";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().positive(),
});

const createOrderSchema = z.object({
  items: z.array(itemSchema).min(1),
  cashCents: z.number().int().nonnegative().optional(),
  customerName: z.string().nullable().optional(),
  creditCents: z.number().int().nonnegative().optional(),
  paymentMethod: z.enum(["codi", "card", "wallet", "cash", "mixed"]).optional(),
});

export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
    const message = error instanceof Error ? error.message : "No se pudo crear la venta.";
    return Response.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
