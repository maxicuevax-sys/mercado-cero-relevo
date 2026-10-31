import { z } from "zod";
import { recordCreditPayment } from "@/lib/orders";

const bodySchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(["codi", "card", "wallet", "cash", "mixed"]).default("cash"),
});

export async function POST(request: Request, ctx: RouteContext<"/api/credits/[id]/pay">) {
  try {
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const credit = recordCreditPayment(id, body.amountCents, body.method);
    return Response.json({ credit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Datos inválidos.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "No se pudo registrar el abono.";
    return Response.json({ error: message }, { status: 400 });
  }
}
