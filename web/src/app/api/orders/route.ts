import { z } from "zod";
import { listOrders } from "@/lib/db";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import { MAX_JSON_BODY_BYTES, readJsonLimited } from "@/lib/http";
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

export async function GET() {
  return Response.json({ orders: listOrders(50) });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonLimited(request, MAX_JSON_BODY_BYTES);
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
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo crear la venta.");
  }
}
