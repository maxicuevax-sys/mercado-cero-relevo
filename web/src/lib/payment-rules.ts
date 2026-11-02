import type { OrderStatus } from "./types";

export type PaymentProvider = "pey" | "demo";

/**
 * Allowlist de proveedores que pueden escribir dinero.
 *
 * - `pey` es el único que confirma un pago real (webhook firmado → `paid`).
 * - `demo` solo simula (`demo_paid`).
 * - Cualquier otro valor es un error de programación o un intento de saltarse
 *   la verdad del pago; se lanza y no se escribe nada.
 */
export function assertPaymentProvider(provider: string): PaymentProvider {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "pey" || normalized === "demo") {
    return normalized;
  }
  throw new Error(
    `Proveedor de pago no permitido: ${provider || "(vacío)"}. Solo pey o demo.`,
  );
}

/** Estado de un pedido cubierto. Nunca `fulfilled`: entregar es otra acción. */
export function coveredStatus(provider: PaymentProvider): OrderStatus {
  return provider === "demo" ? "demo_paid" : "paid";
}
