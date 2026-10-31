import { z } from "zod";
import { closeCash, getCashStatus } from "@/lib/cash";

const closeSchema = z.object({
  openingCents: z.number().int().nonnegative(),
  expensesCents: z.number().int().nonnegative(),
  withdrawalsCents: z.number().int().nonnegative(),
  countedCents: z.number().int().nonnegative(),
  baseNextCents: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  try {
    const body = closeSchema.parse(await request.json());
    const close = closeCash(body);
    return Response.json({ close, status: getCashStatus() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Datos de corte inválidos.", issues: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "No se pudo guardar el corte.";
    return Response.json({ error: message }, { status: 500 });
  }
}
