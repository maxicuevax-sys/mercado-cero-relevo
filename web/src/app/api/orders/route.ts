import { z } from "zod";
import { listOrders } from "@/lib/db";
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
  try {
    const body = await request.json();
    const input = createOrderSchema.parse(body);
    const order = createOrder(input);
    return Response.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Datos de venta inválidos.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "No se pudo crear la venta.";
    return Response.json({ error: message }, { status: 400 });
  }
}
