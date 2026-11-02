import { z } from "zod";
import { CashCloseError, closeCash, getCashStatus } from "@/lib/cash";

const moneyCents = z
  .number({ error: "Escribe un monto válido en centavos." })
  .int("El monto debe estar en centavos enteros.")
  .min(0, "El monto no puede ser negativo.")
  .max(100_000_000, "El monto es demasiado grande.");

const closeSchema = z.object({
  openingCents: moneyCents,
  expensesCents: moneyCents,
  withdrawalsCents: moneyCents,
  countedCents: z
    .number({ error: "Escribe cuánto contaste." })
    .int("El monto debe estar en centavos enteros.")
    .min(1, "Escribe cuánto contaste. El total contado debe ser mayor que cero.")
    .max(100_000_000, "El monto es demasiado grande."),
  baseNextCents: moneyCents,
  reason: z
    .string({ error: "El motivo debe ser texto." })
    .trim()
    .max(280, "El motivo es demasiado largo; usa 280 caracteres o menos.")
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = closeSchema.parse(await request.json());
    const close = closeCash(body);
    return Response.json({ close, status: getCashStatus() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: error.issues[0]?.message ?? "Datos de corte inválidos.",
          code: "invalid_close",
          issues: error.issues,
        },
        { status: 400 },
      );
    }
    if (error instanceof CashCloseError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "No se pudo guardar el corte.";
    return Response.json({ error: message }, { status: 500 });
  }
}
