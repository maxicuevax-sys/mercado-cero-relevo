import { getDb, getOrder, getOrderByNumRef, getOrderByPaymentLink } from "./db";
import { recordPayment } from "./orders";
import { mapPeyMethod, transactionBaseCents } from "./pey";
import type { Order } from "./types";

/**
 * Error de negocio del webhook. El status se devuelve tal cual al proveedor:
 * un 409/422 significa que el evento es válido pero no cuadra con la orden.
 */
export class PeyWebhookError extends Error {
  readonly status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "PeyWebhookError";
    this.status = status;
  }
}

export type PeyWebhookOutcome =
  | { result: "processed"; orderId: string; amountCents: number }
  | { result: "ignored"; reason: string };

interface PaymentLinkEvent {
  type: string;
  paymentLinkId?: unknown;
  status?: unknown;
  clientReferenceId?: unknown;
  currency?: unknown;
  transactions?: unknown;
}

interface CodiQrEvent {
  type: string;
  amount?: unknown;
  currency?: unknown;
  numRef?: unknown;
  transactionId?: unknown;
  metadata?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toCents(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function assertCurrency(value: unknown, context: string): void {
  if (value === undefined || value === null || value === "") return;
  if (String(value).toUpperCase() !== "MXN") {
    throw new PeyWebhookError(`${context}: la moneda no es MXN.`, 422);
  }
}

function existingTransactionIds(ids: string[]): Set<string> {
  if (ids.length === 0) return new Set();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(`SELECT transaction_id FROM payments WHERE transaction_id IN (${placeholders})`)
    .all(...ids) as Array<{ transaction_id: string }>;
  return new Set(rows.map((row) => row.transaction_id));
}

function resolvePaymentLinkOrder(event: PaymentLinkEvent): Order {
  const paymentLinkId = identifier(event.paymentLinkId);
  if (!paymentLinkId) {
    throw new PeyWebhookError("Falta paymentLinkId.", 422);
  }

  const clientReferenceId = identifier(event.clientReferenceId);
  const byClient = clientReferenceId ? getOrder(clientReferenceId) : null;
  const byLink = getOrderByPaymentLink(paymentLinkId);

  if (clientReferenceId && !byClient) {
    throw new PeyWebhookError("clientReferenceId no corresponde a un pedido.", 404);
  }
  if (!byLink) {
    throw new PeyWebhookError("paymentLinkId no corresponde a un pedido.", 404);
  }
  if (byClient && byClient.id !== byLink.id) {
    throw new PeyWebhookError("Las referencias del evento apuntan a pedidos distintos.", 409);
  }

  const order = byClient ?? byLink;
  if (!order.paymentLinkId) {
    throw new PeyWebhookError("El pedido no tiene link de pago.", 409);
  }
  if (order.paymentLinkId !== paymentLinkId) {
    throw new PeyWebhookError("El link de pago no pertenece al pedido.", 409);
  }
  return order;
}

function resolveQrOrder(event: CodiQrEvent): Order {
  const metadata = isRecord(event.metadata) ? event.metadata : {};
  const externalMetadata = isRecord(metadata.externalMetadata)
    ? metadata.externalMetadata
    : {};
  const metadataOrderId =
    identifier(metadata.orderId) || identifier(externalMetadata.orderId);
  const numRef = identifier(event.numRef);

  const byMetadata = metadataOrderId ? getOrder(metadataOrderId) : null;
  const byRef = numRef ? getOrderByNumRef(numRef) : null;

  if (metadataOrderId && !byMetadata) {
    throw new PeyWebhookError("metadata.orderId no corresponde a un pedido.", 404);
  }
  if (numRef && !byRef) {
    throw new PeyWebhookError("numRef no corresponde a un pedido.", 404);
  }
  if (byMetadata && byRef && byMetadata.id !== byRef.id) {
    throw new PeyWebhookError("Las referencias del QR apuntan a pedidos distintos.", 409);
  }

  const order = byMetadata ?? byRef;
  if (!order) {
    throw new PeyWebhookError("El evento no referencia un pedido.", 422);
  }
  if (order.numRef && numRef && order.numRef !== numRef) {
    throw new PeyWebhookError("El numRef no pertenece al pedido.", 409);
  }
  return order;
}

function assertExactAmount(order: Order, amountCents: number, context: string): void {
  const due = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
  if (due <= 0) {
    throw new PeyWebhookError("El pedido ya no tiene saldo pendiente.", 409);
  }
  if (amountCents !== due) {
    throw new PeyWebhookError(
      `${context}: el monto no coincide con el saldo pendiente (${amountCents} vs ${due} centavos).`,
      409,
    );
  }
}

function processPaymentLink(event: PaymentLinkEvent): PeyWebhookOutcome {
  const status = typeof event.status === "string" ? event.status.toLowerCase() : "";
  if (status !== "paid") {
    return { result: "ignored", reason: `estado ${status || "desconocido"}` };
  }

  const order = resolvePaymentLinkOrder(event);
  assertCurrency(event.currency, "Evento");

  const rawTransactions = Array.isArray(event.transactions) ? event.transactions : [];
  if (rawTransactions.length === 0) {
    throw new PeyWebhookError("El evento pagado no incluye transacciones.", 422);
  }

  const transactions = rawTransactions.map((raw) => {
    if (!isRecord(raw)) {
      throw new PeyWebhookError("Transacción inválida.", 422);
    }
    const transactionId = identifier(raw.transactionId);
    if (!transactionId) {
      throw new PeyWebhookError("Transacción sin transactionId.", 422);
    }
    const amountCents = transactionBaseCents(raw);
    if (amountCents === null) {
      throw new PeyWebhookError(`Transacción ${transactionId}: monto inválido.`, 422);
    }
    assertCurrency(raw.currency, `Transacción ${transactionId}`);
    return {
      transactionId,
      amountCents,
      paymentMethod:
        typeof raw.paymentMethod === "string" ? raw.paymentMethod : undefined,
    };
  });

  const uniqueIds = new Set(transactions.map((transaction) => transaction.transactionId));
  if (uniqueIds.size !== transactions.length) {
    throw new PeyWebhookError("El evento incluye transacciones duplicadas.", 422);
  }

  const existing = existingTransactionIds([...uniqueIds]);
  const fresh = transactions.filter(
    (transaction) => !existing.has(transaction.transactionId),
  );
  if (fresh.length === 0) {
    return { result: "ignored", reason: "transacciones ya registradas" };
  }

  const freshTotal = fresh.reduce((sum, transaction) => sum + transaction.amountCents, 0);
  assertExactAmount(order, freshTotal, "Link de pago");

  for (const transaction of fresh) {
    recordPayment(order.id, {
      provider: "pey",
      method: mapPeyMethod(transaction.paymentMethod),
      amountCents: transaction.amountCents,
      transactionId: transaction.transactionId,
      paymentLinkId: order.paymentLinkId,
      rawEvent: JSON.stringify(transaction),
    });
  }

  return { result: "processed", orderId: order.id, amountCents: freshTotal };
}

function processCodiQr(event: CodiQrEvent): PeyWebhookOutcome {
  const order = resolveQrOrder(event);
  assertCurrency(event.currency, "Evento QR");

  const amountCents = toCents(event.amount);
  if (amountCents === null) {
    throw new PeyWebhookError("El evento QR no incluye un monto válido.", 422);
  }

  const transactionId = identifier(event.transactionId);
  if (!transactionId) {
    throw new PeyWebhookError("El evento QR no incluye transactionId.", 422);
  }

  if (existingTransactionIds([transactionId]).has(transactionId)) {
    return { result: "ignored", reason: "transacción ya registrada" };
  }

  assertExactAmount(order, amountCents, "QR CoDi");
  recordPayment(order.id, {
    provider: "pey",
    method: "codi",
    amountCents,
    transactionId,
    rawEvent: JSON.stringify(event),
  });

  return { result: "processed", orderId: order.id, amountCents };
}

export function processPeyEvent(event: unknown): PeyWebhookOutcome {
  if (!isRecord(event) || typeof event.type !== "string") {
    throw new PeyWebhookError("Evento inválido: falta type.", 422);
  }

  if (event.type === "payment_link.status_updated") {
    return processPaymentLink(event as unknown as PaymentLinkEvent);
  }
  if (event.type === "codi.qr.payment_received") {
    return processCodiQr(event as unknown as CodiQrEvent);
  }

  return { result: "ignored", reason: `tipo no soportado: ${event.type}` };
}
