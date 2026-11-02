import { z } from "zod";
import { previewCashClose } from "@/lib/cash";

const moneyCents = z
  .number({ error: "Escribe un monto válido en centavos." })
  .int("El monto debe estar en centavos enteros.")
  .min(0, "El monto no puede ser negativo.")
  .max(100_000_000, "El monto es demasiado grande.");

const previewSchema = z.object({
  openingCents: moneyCents,
  expensesCents: moneyCents,
  withdrawalsCents: moneyCents,
  countedCents: moneyCents,
  baseNextCents: moneyCents,
});

/**
 * Devuelve la diferencia calculada con los totales vivos del servidor.
 * No escribe nada: la confirmación del corte usa este resultado.
 */
export async function POST(request: Request) {
  try {
    const body = previewSchema.parse(await request.json());
    return Response.json(previewCashClose(body));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: error.issues[0]?.message ?? "Datos de corte inválidos.",
          code: "invalid_preview",
          issues: error.issues,
        },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "No se pudo calcular el corte.";
    return Response.json({ error: message }, { status: 500 });
  }
}
