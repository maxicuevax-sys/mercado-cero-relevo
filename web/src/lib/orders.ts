import {
  audit,
  findOrCreateCustomer,
  getCredit,
  getDb,
  getOrder,
  getOrderByRequestId,
  listPayments,
  newId,
  nowIso,
} from "./db";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { formatMxn } from "./format";
import type {
  CreateOrderInput,
  Credit,
  Order,
  Payment,
  PaymentMethod,
} from "./types";

export const MAX_ORDER_ITEMS = 50;
export const MAX_ITEM_DESCRIPTION_CHARS = 160;
export const MAX_ITEM_QUANTITY = 999;
export const MAX_UNIT_PRICE_CENTS = 10_000_000;
export const MAX_ORDER_TOTAL_CENTS = 100_000_000;
export const MAX_CUSTOMER_NAME_CHARS = 120;
export const MAX_REQUEST_ID_CHARS = 128;

function normalizeRequestId(value: string | null | undefined): string | null {
  const requestId = (value ?? "").trim();
  if (!requestId) return null;
  if (requestId.length > MAX_REQUEST_ID_CHARS) {
    throw new ValidationError(
      `El identificador de la solicitud no puede pasar de ${MAX_REQUEST_ID_CHARS} caracteres.`,
      "request_id_too_long",
    );
  }
  return requestId;
}

export interface OrderDetail {
  order: Order;
  payments: Payment[];
  credit: Credit | null;
}

export function createOrder(input: CreateOrderInput): Order {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ValidationError("La venta necesita al menos un producto.");
  }
  if (input.items.length > MAX_ORDER_ITEMS) {
    throw new ValidationError(
      `Una venta no puede tener más de ${MAX_ORDER_ITEMS} productos.`,
      "too_many_items",
    );
  }

  const requestId = normalizeRequestId(input.requestId);

  const items = input.items.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError("Cantidad inválida.");
    }
    if (quantity > MAX_ITEM_QUANTITY) {
      throw new ValidationError(
        `La cantidad no puede pasar de ${MAX_ITEM_QUANTITY}.`,
        "quantity_too_large",
      );
    }

    const rawUnitPrice = Number(item.unitPriceCents);
    const unitPriceCents = Math.round(rawUnitPrice);
    if (!Number.isFinite(rawUnitPrice) || unitPriceCents <= 0) {
      throw new ValidationError("Precio inválido.");
    }
    if (unitPriceCents > MAX_UNIT_PRICE_CENTS) {
      throw new ValidationError(
        `El precio unitario no puede pasar de ${formatMxn(MAX_UNIT_PRICE_CENTS)}.`,
        "price_too_large",
      );
    }

    const description = String(item.description ?? "").trim();
    if (!description) {
      throw new ValidationError("Escribe el producto.");
    }
    if (description.length > MAX_ITEM_DESCRIPTION_CHARS) {
      throw new ValidationError(
        `La descripción no puede pasar de ${MAX_ITEM_DESCRIPTION_CHARS} caracteres.`,
        "description_too_long",
      );
    }

    const itemTotalCents = Math.round(quantity * unitPriceCents);
    if (!Number.isSafeInteger(itemTotalCents) || itemTotalCents <= 0) {
      throw new ValidationError("El total del producto es inválido.");
    }

    return {
      id: newId("itm"),
      description,
      quantity,
      unitPriceCents,
      totalCents: itemTotalCents,
    };
  });

  const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new ValidationError("La venta debe tener un total mayor a cero.");
  }
  if (totalCents > MAX_ORDER_TOTAL_CENTS) {
    throw new ValidationError(
      `El total de la venta no puede pasar de ${formatMxn(MAX_ORDER_TOTAL_CENTS)}.`,
      "total_too_large",
    );
  }

  const rawCash = Number(input.cashCents ?? 0);
  if (!Number.isFinite(rawCash)) {
    throw new ValidationError("El efectivo recibido es inválido.");
  }
  const cashCents = Math.min(Math.max(0, Math.round(rawCash)), totalCents);

  const rawCredit = Number(input.creditCents ?? 0);
  if (!Number.isFinite(rawCredit)) {
    throw new ValidationError("El monto a fiado es inválido.");
  }
  const creditCents = Math.min(
    Math.max(0, Math.round(rawCredit)),
    Math.max(0, totalCents - cashCents),
  );

  const rawCustomerName = String(input.customerName ?? "").trim();
  if (rawCustomerName.length > MAX_CUSTOMER_NAME_CHARS) {
    throw new ValidationError(
      `El nombre del cliente no puede pasar de ${MAX_CUSTOMER_NAME_CHARS} caracteres.`,
      "customer_name_too_long",
    );
  }
  const customerName = rawCustomerName || null;

  const database = getDb();

  // Reintento con la misma llave antes de abrir transacción: el caso normal
  // de un doble POST (o de una respuesta perdida) no vuelve a escribir nada.
  if (requestId) {
    const existing = getOrderByRequestId(requestId);
    if (existing) return existing;
  }

  const id = newId("ord");
  const createdAt = nowIso();
  let committed = false;

  database.exec("BEGIN IMMEDIATE");
  try {
    // Otra petición pudo ganar entre la lectura y el lock.
    if (requestId) {
      const raced = getOrderByRequestId(requestId);
      if (raced) {
        database.exec("COMMIT");
        committed = true;
        return raced;
      }
    }

    database
      .prepare(
        `INSERT INTO orders
         (id, merchant_id, status, total_cents, paid_cents, payment_method, customer_name, credit_cents, request_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        "lupita",
        "confirmed",
        totalCents,
        cashCents,
        cashCents > 0 ? "cash" : null,
        customerName,
        creditCents,
        requestId,
        createdAt,
        createdAt,
      );

    const insertItem = database.prepare(
      `INSERT INTO order_items (id, order_id, description, quantity, unit_price_cents, total_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const item of items) {
      insertItem.run(
        item.id,
        id,
        item.description,
        item.quantity,
        item.unitPriceCents,
        item.totalCents,
      );
    }

    if (cashCents > 0) {
      database
        .prepare(
          `INSERT INTO payments (id, order_id, provider, method, amount_cents, status, transaction_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(newId("pay"), id, "cash", "cash", cashCents, "paid", null, createdAt);
    }

    let creditId: string | null = null;
    if (creditCents > 0) {
      const customer = findOrCreateCustomer(customerName || "Cliente");
      creditId = newId("cred");
      database
        .prepare(
          `INSERT INTO credits (id, customer_id, order_id, original_cents, balance_cents, status, due_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(creditId, customer.id, id, creditCents, creditCents, "open", null, createdAt);
      database
        .prepare("UPDATE orders SET credit_id = ?, customer_name = ? WHERE id = ?")
        .run(creditId, customer.name, id);
    }

    const digitalDue = totalCents - cashCents - creditCents;
    if (digitalDue <= 0) {
      database
        .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
        .run(creditCents > 0 ? "fulfilled" : "paid", nowIso(), id);
    }

    audit("order.created", "order", id, {
      totalCents,
      cashCents,
      creditCents,
      creditId,
      requestId,
    });

    database.exec("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Si SQLite ya cerró la transacción, conservamos el error original.
      }
    }
  }

  const created = getOrder(id);
  if (!created) {
    throw new Error("No pude leer el pedido recién creado.");
  }
  return created;
}

export function attachPaymentLink(
  orderId: string,
  link: { id: string; url: string },
): Order {
  const database = getDb();
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare("SELECT payment_url, payment_link_id FROM orders WHERE id = ?")
      .get(orderId) as
      | { payment_url: string | null; payment_link_id: string | null }
      | undefined;
    if (!row) throw new NotFoundError("Pedido no encontrado.", "order_not_found");

    // Si otro POST ganó la carrera, devolvemos el link ya adjunto.
    if (row.payment_url) {
      database.exec("COMMIT");
      committed = true;
      const existing = getOrder(orderId);
      if (!existing) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      return existing;
    }

    database
      .prepare(
        "UPDATE orders SET payment_link_id = ?, payment_url = ?, status = 'payment_pending', updated_at = ? WHERE id = ?",
      )
      .run(link.id, link.url, nowIso(), orderId);
    audit("payment_link.attached", "order", orderId, link);
    database.exec("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Si SQLite ya cerró la transacción, conservamos el error original.
      }
    }
  }

  const updated = getOrder(orderId);
  if (!updated) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
  return updated;
}

export function attachQr(
  orderId: string,
  qr: { id: string; qrString: string; qrImage: string | null },
  numRef: string,
): Order {
  const database = getDb();
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare("SELECT qr_string FROM orders WHERE id = ?")
      .get(orderId) as { qr_string: string | null } | undefined;
    if (!row) throw new NotFoundError("Pedido no encontrado.", "order_not_found");

    if (row.qr_string) {
      database.exec("COMMIT");
      committed = true;
      const existing = getOrder(orderId);
      if (!existing) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      return existing;
    }

    // La colisión se decide dentro del lock: si otro pedido tomó el numRef
    // mientras hablábamos con pey, no se adjunta nada.
    const collision = database
      .prepare("SELECT id FROM orders WHERE num_ref = ? AND id != ? LIMIT 1")
      .get(numRef, orderId) as { id: string } | undefined;
    if (collision) {
      throw new ConflictError(
        "Ese número de referencia ya está en uso. Intenta generar el QR de nuevo.",
        "num_ref_conflict",
      );
    }

    database
      .prepare(
        "UPDATE orders SET qr_id = ?, qr_string = ?, qr_image = ?, num_ref = ?, status = 'payment_pending', updated_at = ? WHERE id = ?",
      )
      .run(qr.id, qr.qrString, qr.qrImage, numRef, nowIso(), orderId);
    audit("codi_qr.attached", "order", orderId, { id: qr.id, numRef });
    database.exec("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Si SQLite ya cerró la transacción, conservamos el error original.
      }
    }
  }

  const updated = getOrder(orderId);
  if (!updated) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
  return updated;
}

export function recordPayment(
  orderId: string,
  input: {
    provider: string;
    method: PaymentMethod;
    amountCents: number;
    transactionId: string | null;
    paymentLinkId?: string | null;
    rawEvent?: string | null;
  },
): Order {
  const database = getDb();
  const order = getOrder(orderId);
  if (!order) throw new Error("Pedido no encontrado.");

  if (input.transactionId) {
    const existing = database
      .prepare("SELECT id FROM payments WHERE transaction_id = ?")
      .get(input.transactionId) as { id: string } | undefined;
    if (existing) return order;
  }

  const amountCents = Math.max(0, Math.round(input.amountCents));
  if (amountCents <= 0) return order;

  try {
    database
      .prepare(
        `INSERT INTO payments
         (id, order_id, provider, method, amount_cents, status, transaction_id, payment_link_id, raw_event, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("pay"),
        orderId,
        input.provider,
        input.method,
        amountCents,
        "paid",
        input.transactionId,
        input.paymentLinkId ?? null,
        input.rawEvent ?? null,
        nowIso(),
      );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return order;
    }
    throw error;
  }

  const sum = database
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE order_id = ? AND status = 'paid'")
    .get(orderId) as { total: number };
  const paidCents = Number(sum.total);
  const methods = database
    .prepare("SELECT DISTINCT method FROM payments WHERE order_id = ? AND status = 'paid'")
    .all(orderId) as Array<{ method: string }>;
  const method = methods.length > 1 ? "mixed" : (methods[0]?.method as PaymentMethod) ?? input.method;

  const coveredCents = paidCents + order.creditCents;
  const status =
    coveredCents >= order.totalCents
      ? order.creditCents > 0
        ? "fulfilled"
        : input.provider === "demo"
          ? "demo_paid"
          : "paid"
      : "partially_paid";
  database
    .prepare(
      "UPDATE orders SET paid_cents = ?, status = ?, payment_method = ?, updated_at = ? WHERE id = ?",
    )
    .run(paidCents, status, method, nowIso(), orderId);

  audit("payment.recorded", "order", orderId, {
    amountCents,
    method: input.method,
    transactionId: input.transactionId,
    status,
  });

  return getOrder(orderId)!;
}

export type CreditPaymentConflictCode =
  | "credit_settled"
  | "balance_changed"
  | "request_id_conflict";

export class CreditPaymentConflict extends Error {
  readonly code: CreditPaymentConflictCode;
  readonly credit: Credit | null;
  readonly appliedCents: number;
  readonly balanceCents: number;
  readonly overpayCents: number;
  readonly duplicate = false;

  constructor(
    code: CreditPaymentConflictCode,
    message: string,
    credit: Credit | null,
    options: { appliedCents?: number; overpayCents?: number } = {},
  ) {
    super(message);
    this.name = "CreditPaymentConflict";
    this.code = code;
    this.credit = credit;
    this.appliedCents = options.appliedCents ?? 0;
    this.balanceCents = credit?.balanceCents ?? 0;
    this.overpayCents = options.overpayCents ?? 0;
  }
}

export interface CreditPaymentResult {
  credit: Credit;
  appliedCents: number;
  balanceCents: number;
  overpayCents: number;
  duplicate: boolean;
}

/**
 * Registra un abono en una sola transacción y con idempotencia durable.
 *
 * - `requestId` es opcional; si ya existe, devuelve el abono existente sin
 *   insertar otro (`duplicate: true`).
 * - `expectedBalanceCents` permite que una hoja abierta con un saldo viejo
 *   reciba 409 en lugar de escribir sobre un saldo que cambió.
 * - El monto pedido puede superar el saldo: se aplica el saldo y se reporta
 *   `overpayCents`; nunca se recorta en silencio.
 */
export function recordCreditPayment(
  creditId: string,
  amountCents: number,
  method: PaymentMethod = "cash",
  note: string | null = null,
  requestId: string | null = null,
  expectedBalanceCents: number | null = null,
): CreditPaymentResult {
  const database = getDb();
  const requestedCents = Math.round(amountCents);
  if (!Number.isFinite(requestedCents) || requestedCents <= 0) {
    throw new ValidationError("El abono debe ser mayor a cero.");
  }
  const request = requestId?.trim() || null;

  database.exec("BEGIN IMMEDIATE");
  let committed = false;
  try {
    if (request) {
      const existing = database
        .prepare(
          "SELECT credit_id, amount_cents FROM credit_payments WHERE request_id = ?",
        )
        .get(request) as { credit_id: string; amount_cents: number } | undefined;
      if (existing) {
        if (existing.credit_id !== creditId) {
          throw new CreditPaymentConflict(
            "request_id_conflict",
            "Ese requestId ya se usó en otro fiado. No se registró nada.",
            null,
          );
        }
        const credit = getCredit(creditId);
        if (!credit) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");
        const applied = Number(existing.amount_cents);
        const result: CreditPaymentResult = {
          credit,
          appliedCents: applied,
          balanceCents: credit.balanceCents,
          // No guardamos el monto pedido original. En un reintento no hubo
          // un nuevo cambio que devolver, así que no inventamos overpay.
          overpayCents: 0,
          duplicate: true,
        };
        database.exec("COMMIT");
        committed = true;
        return result;
      }
    }

    const credit = getCredit(creditId);
    if (!credit) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");
    if (credit.status === "settled" || credit.balanceCents <= 0) {
      throw new CreditPaymentConflict(
        "credit_settled",
        "Ese fiado ya está saldado. No se registró nada.",
        credit,
      );
    }
    if (
      expectedBalanceCents !== null &&
      Number.isFinite(expectedBalanceCents) &&
      credit.balanceCents !== expectedBalanceCents
    ) {
      throw new CreditPaymentConflict(
        "balance_changed",
        `El saldo cambió a ${formatMxn(credit.balanceCents)}. Revisa el monto y confirma de nuevo.`,
        credit,
      );
    }

    const appliedCents = Math.min(requestedCents, credit.balanceCents);
    if (appliedCents <= 0) {
      throw new CreditPaymentConflict(
        "credit_settled",
        "Ese fiado ya está saldado. No se registró nada.",
        credit,
      );
    }
    const overpayCents = requestedCents - appliedCents;
    const newBalance = credit.balanceCents - appliedCents;

    database
      .prepare(
        `INSERT INTO credit_payments
         (id, credit_id, amount_cents, method, note, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("cp"),
        creditId,
        appliedCents,
        method,
        note?.trim() || null,
        request,
        nowIso(),
      );

    database
      .prepare("UPDATE credits SET balance_cents = ?, status = ? WHERE id = ?")
      .run(newBalance, newBalance === 0 ? "settled" : "partial", creditId);

    audit("credit.payment", "credit", creditId, {
      amount: appliedCents,
      requestedCents,
      overpayCents,
      method,
      note: note?.trim() || null,
      requestId: request,
      newBalance,
    });

    const updated = getCredit(creditId);
    if (!updated) throw new Error("No pude leer el fiado actualizado.");
    const result: CreditPaymentResult = {
      credit: updated,
      appliedCents,
      balanceCents: newBalance,
      overpayCents,
      duplicate: false,
    };
    database.exec("COMMIT");
    committed = true;
    return result;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Si la transacción no llegó a abrirse o ya se cerró, no hay nada que deshacer.
      }
    }
  }
}


export function fulfillOrder(orderId: string): Order | null {
  const order = getOrder(orderId);
  if (!order) return null;
  if (order.status === "fulfilled") return order;
  if (order.status !== "paid" && order.status !== "demo_paid") {
    throw new ConflictError(
      "Solo un pedido pagado puede marcarse como entregado.",
      "order_not_paid",
    );
  }

  const database = getDb();
  database
    .prepare("UPDATE orders SET status = 'fulfilled', updated_at = ? WHERE id = ?")
    .run(nowIso(), orderId);
  audit("order.fulfilled", "order", orderId, { previousStatus: order.status });
  return getOrder(orderId);
}

export function getOrderDetail(orderId: string): OrderDetail | null {
  const order = getOrder(orderId);
  if (!order) return null;
  return {
    order,
    payments: listPayments(orderId),
    credit: order.creditId ? getCredit(order.creditId) : null,
  };
}
