import { z } from "zod";
import { CreditPaymentConflict, recordCreditPayment } from "@/lib/orders";

const bodySchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(["codi", "card", "wallet", "cash", "mixed"]).default("cash"),
  note: z.string().trim().max(280).optional(),
  requestId: z.string().trim().min(1).max(128).optional(),
  expectedBalanceCents: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/credits/[id]/pay">) {
  try {
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const result = recordCreditPayment(
      id,
      body.amountCents,
      body.method,
      body.note ?? null,
      body.requestId ?? null,
      body.expectedBalanceCents ?? null,
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Datos inválidos.", issues: error.issues }, { status: 400 });
    }
    if (error instanceof CreditPaymentConflict) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          credit: error.credit,
          appliedCents: error.appliedCents,
          balanceCents: error.balanceCents,
          overpayCents: error.overpayCents,
          duplicate: error.duplicate,
        },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "No se pudo registrar el abono.";
    return Response.json({ error: message }, { status: 400 });
  }
}
