import { z } from "zod";
import { listOrders } from "@/lib/db";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_ORDERS_BYTES,
  readJsonLimited,
} from "@/lib/http-security";
import { createOrder } from "@/lib/orders";

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

export async function GET() {
  return Response.json({ orders: listOrders(50) });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "orders-create", 60, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_ORDERS_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const input = createOrderSchema.parse(body);
    const order = createOrder(input);
    return Response.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Datos de venta inválidos.", issues: error.issues },
        { status: 400 },
      );
    }
    console.error("[orders create] error inesperado", error);
    return Response.json(
      { error: "No se pudo crear la venta.", code: "order_create_failed" },
      { status: 400 },
    );
  }
}
