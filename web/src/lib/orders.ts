import {
  audit,
  findOrCreateCustomer,
  getCredit,
  getDb,
  getOrder,
  getOrderByNumRef,
  getOrderRequestMatch,
  listPayments,
  newId,
  nowIso,
} from "./db";
import { MERCHANT, isDemoMode } from "./config";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { formatMxn } from "./format";
import { assertPaymentProvider, coveredStatus } from "./payment-rules";
import { requestPayloadHash } from "./request-hash";
import type {
  CreateOrderInput,
  Credit,
  Order,
  OrderStatus,
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

function isOrderVisibleInCurrentMode(row: Record<string, unknown>): boolean {
  if (isDemoMode()) return true;
  return (
    Number(row.demo) === 0 &&
    !String(row.id).startsWith("demo_") &&
    row.status !== "demo_paid"
  );
}

/**
 * Un requestId solo es idempotente si el payload es el mismo. Si la llave ya
 * existe con otro hash, responde 409 en lugar de devolver un pedido viejo.
 * Los pedidos migrados sin hash se aceptan como reintento (no conocemos su
 * payload original).
 *
 * La búsqueda se limita al modo actual. Un requestId demo no puede devolver
 * un pedido demo en real: si la llave existe en el otro modo, la respuesta es
 * 409 para no mezclar identidades ni permitir un cobro cruzado.
 */
function findOrderForRequest(
  requestId: string,
  requestHash: string,
): Order | null {
  const match = getOrderRequestMatch(requestId, MERCHANT.id);
  if (!match) {
    const database = getDb();
    const crossMode = database
      .prepare("SELECT * FROM orders WHERE request_id = ? AND merchant_id = ? LIMIT 1")
      .get(requestId, MERCHANT.id) as Record<string, unknown> | undefined;
    if (crossMode && !isOrderVisibleInCurrentMode(crossMode)) {
      throw new ConflictError(
        "Ese identificador de solicitud pertenece al otro modo (demo/real). No se creó otro pedido.",
        "request_id_conflict",
      );
    }
    return null;
  }
  if (match.requestHash !== null && match.requestHash !== requestHash) {
    throw new ConflictError(
      "Ese identificador de solicitud ya se usó con otros datos. No se creó otro pedido.",
      "request_id_conflict",
    );
  }
  return match.order;
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

  const requestHash = requestId
    ? requestPayloadHash({
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
        cashCents,
        creditCents,
        customerName,
      })
    : null;

  const database = getDb();

  // Reintento con la misma llave antes de abrir transacción: el caso normal
  // de un doble POST (o de una respuesta perdida) no vuelve a escribir nada.
  if (requestId && requestHash) {
    const existing = findOrderForRequest(requestId, requestHash);
    if (existing) return existing;
  }

  const id = newId("ord");
  const createdAt = nowIso();
  let committed = false;

  database.exec("BEGIN IMMEDIATE");
  try {
    // Otra petición pudo ganar entre la lectura y el lock.
    if (requestId && requestHash) {
      const raced = findOrderForRequest(requestId, requestHash);
      if (raced) {
        database.exec("COMMIT");
        committed = true;
        return raced;
      }
    }

    try {
      database
        .prepare(
          `INSERT INTO orders
           (id, merchant_id, status, total_cents, paid_cents, payment_method, customer_name, credit_cents, request_id, request_hash, demo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          MERCHANT.id,
          "confirmed",
          totalCents,
          cashCents,
          cashCents > 0 ? "cash" : null,
          customerName,
          creditCents,
          requestId,
          requestHash,
          isDemoMode() ? 1 : 0,
          createdAt,
          createdAt,
        );
    } catch (error) {
      // Carrera entre la comprobación de modo y el INSERT: el índice único
      // de (merchant_id, request_id) sigue siendo global. Se traduce a 409
      // en vez de filtrar un error de SQLite.
      if (error instanceof Error && /UNIQUE constraint failed: orders/i.test(error.message)) {
        throw new ConflictError(
          "Ese identificador de solicitud ya está en uso. No se creó otro pedido.",
          "request_id_conflict",
        );
      }
      throw error;
    }

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
          `INSERT INTO payments (id, order_id, provider, method, amount_cents, status, transaction_id, demo, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newId("pay"),
          id,
          "cash",
          "cash",
          cashCents,
          "paid",
          null,
          isDemoMode() ? 1 : 0,
          createdAt,
        );
    }

    let creditId: string | null = null;
    if (creditCents > 0) {
      const customer = findOrCreateCustomer(customerName || "Cliente");
      creditId = newId("cred");
      database
        .prepare(
          `INSERT INTO credits (id, customer_id, order_id, original_cents, balance_cents, status, due_date, demo, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          creditId,
          customer.id,
          id,
          creditCents,
          creditCents,
          "open",
          null,
          isDemoMode() ? 1 : 0,
          createdAt,
        );
      database
        .prepare("UPDATE orders SET credit_id = ?, customer_name = ? WHERE id = ?")
        .run(creditId, customer.name, id);
    }

    const digitalDue = totalCents - cashCents - creditCents;
    if (digitalDue <= 0) {
      // Un fiado no es una entrega. Si hay crédito abierto, el pedido queda
      // confirmado y la entrega se decide después, de forma explícita.
      database
        .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
        .run(creditCents > 0 ? "confirmed" : isDemoMode() ? "demo_paid" : "paid", nowIso(), id);
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

const COVERED_ORDER_STATUSES = new Set(["paid", "demo_paid", "fulfilled", "cancelled"]);

export function attachPaymentLink(
  orderId: string,
  link: { id: string; url: string },
  options?: { forceRefresh?: boolean },
): Order {
  const database = getDb();
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare(
        "SELECT status, total_cents, paid_cents, credit_cents, payment_url, payment_link_id FROM orders WHERE id = ?",
      )
      .get(orderId) as
      | {
          status: string;
          total_cents: number;
          paid_cents: number;
          credit_cents: number;
          payment_url: string | null;
          payment_link_id: string | null;
        }
      | undefined;
    if (!row) throw new NotFoundError("Pedido no encontrado.", "order_not_found");

    // Un cobro tardío no puede degradar un pedido ya pagado o entregado.
    // Se devuelve tal cual, sin escribir el link.
    if (COVERED_ORDER_STATUSES.has(row.status)) {
      database.exec("COMMIT");
      committed = true;
      const existing = getOrder(orderId);
      if (!existing) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      return existing;
    }

    // Si otro POST ganó la carrera, devolvemos el link ya adjunto.
    if (row.payment_url && !options?.forceRefresh) {
      database.exec("COMMIT");
      committed = true;
      const existing = getOrder(orderId);
      if (!existing) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      return existing;
    }

    // Solo se marca `payment_pending` si de verdad queda saldo por cobrar.
    // Un abono parcial no se degrada a "pendiente de pago": ya tiene dinero.
    const outstandingCents =
      Number(row.total_cents) - Number(row.paid_cents) - Number(row.credit_cents);
    const nextStatus =
      outstandingCents > 0 && row.status !== "partially_paid"
        ? "payment_pending"
        : row.status;
    database
      .prepare(
        "UPDATE orders SET payment_link_id = ?, payment_url = ?, status = ?, updated_at = ? WHERE id = ?",
      )
      .run(link.id, link.url, nextStatus, nowIso(), orderId);
    audit("payment_link.attached", "order", orderId, {
      ...link,
      status: nextStatus,
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

  const updated = getOrder(orderId);
  if (!updated) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
  return updated;
}

export function attachQr(
  orderId: string,
  qr: { id: string; qrString: string; qrImage: string | null; expiresAt?: string | null },
  numRef: string,
  options?: { forceRefresh?: boolean },
): Order {
  const database = getDb();
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare(
        "SELECT status, total_cents, paid_cents, credit_cents, qr_string, qr_expires_at FROM orders WHERE id = ?",
      )
      .get(orderId) as
      | {
          status: string;
          total_cents: number;
          paid_cents: number;
          credit_cents: number;
          qr_string: string | null;
          qr_expires_at: string | null;
        }
      | undefined;
    if (!row) throw new NotFoundError("Pedido no encontrado.", "order_not_found");

    // Igual que el link: nunca se revierte un pedido pagado o entregado.
    if (COVERED_ORDER_STATUSES.has(row.status)) {
      database.exec("COMMIT");
      committed = true;
      const existing = getOrder(orderId);
      if (!existing) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      return existing;
    }

    const isExpired = row.qr_expires_at ? Date.parse(row.qr_expires_at) <= Date.now() : false;
    const canReuse = row.qr_string && !options?.forceRefresh && !isExpired;
    if (canReuse) {
      database.exec("COMMIT");
      committed = true;
      const existing = getOrder(orderId);
      if (!existing) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      return existing;
    }

    // La colisión se decide dentro del lock: si otro pedido tomó el numRef
    // mientras hablábamos con pey, no se adjunta nada. `getOrderByNumRef`
    // filtra el modo actual: un numRef demo no bloquea uno real.
    const collision = getOrderByNumRef(numRef);
    if (collision && collision.id !== orderId) {
      throw new ConflictError(
        "Ese número de referencia ya está en uso. Intenta generar el QR de nuevo.",
        "num_ref_conflict",
      );
    }

    const outstandingCents =
      Number(row.total_cents) - Number(row.paid_cents) - Number(row.credit_cents);
    const nextStatus =
      outstandingCents > 0 && row.status !== "partially_paid"
        ? "payment_pending"
        : row.status;
    const expiresAt = qr.expiresAt ?? null;
    database
      .prepare(
        "UPDATE orders SET qr_id = ?, qr_string = ?, qr_image = ?, num_ref = ?, qr_expires_at = ?, status = ?, updated_at = ? WHERE id = ?",
      )
      .run(qr.id, qr.qrString, qr.qrImage, numRef, expiresAt, nextStatus, nowIso(), orderId);
    audit(row.qr_string ? "codi_qr.refreshed" : "codi_qr.attached", "order", orderId, {
      id: qr.id,
      numRef,
      expiresAt,
      status: nextStatus,
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

  const updated = getOrder(orderId);
  if (!updated) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
  return updated;
}

export function attachCodiPush(
  orderId: string,
  push: { id: string; phoneMasked: string; expiresAt: string },
  numRef: string,
): Order {
  const database = getDb();
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare(
        "SELECT status, total_cents, paid_cents, credit_cents FROM orders WHERE id = ?",
      )
      .get(orderId) as
      | {
          status: string;
          total_cents: number;
          paid_cents: number;
          credit_cents: number;
        }
      | undefined;
    if (!row) throw new NotFoundError("Pedido no encontrado.", "order_not_found");

    if (COVERED_ORDER_STATUSES.has(row.status)) {
      database.exec("COMMIT");
      committed = true;
      const existing = getOrder(orderId);
      if (!existing) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      return existing;
    }

    const collision = getOrderByNumRef(numRef);
    if (collision && collision.id !== orderId) {
      throw new ConflictError(
        "Ese número de referencia ya está en uso. Intenta de nuevo.",
        "num_ref_conflict",
      );
    }

    const outstandingCents =
      Number(row.total_cents) - Number(row.paid_cents) - Number(row.credit_cents);
    const nextStatus =
      outstandingCents > 0 && row.status !== "partially_paid"
        ? "payment_pending"
        : row.status;

    database
      .prepare(
        "UPDATE orders SET codi_push_id = ?, codi_phone_masked = ?, num_ref = ?, qr_expires_at = ?, status = ?, updated_at = ? WHERE id = ?",
      )
      .run(push.id, push.phoneMasked, numRef, push.expiresAt, nextStatus, nowIso(), orderId);

    audit("codi_push.created", "order", orderId, {
      id: push.id,
      phoneMasked: push.phoneMasked,
      numRef,
      expiresAt: push.expiresAt,
      status: nextStatus,
    });
    database.exec("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Ignorar si la transacción cerró
      }
    }
  }

  const updated = getOrder(orderId);
  if (!updated) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
  return updated;
}

export function attachCreditPaymentLink(
  creditId: string,
  link: { id: string; url: string },
): Credit {
  const database = getDb();
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare("SELECT balance_cents, status FROM credits WHERE id = ?")
      .get(creditId) as { balance_cents: number; status: string } | undefined;
    if (!row) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");

    database
      .prepare("UPDATE credits SET payment_link_id = ?, payment_url = ? WHERE id = ?")
      .run(link.id, link.url, creditId);

    audit("credit.payment_link.attached", "credit", creditId, link);
    database.exec("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Ignorar
      }
    }
  }
  const updated = getCredit(creditId);
  if (!updated) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");
  return updated;
}

export function attachCreditQr(
  creditId: string,
  qr: { id: string; qrString: string; qrImage: string | null; expiresAt?: string | null },
  numRef: string,
): Credit {
  const database = getDb();
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database
      .prepare("SELECT balance_cents, status FROM credits WHERE id = ?")
      .get(creditId) as { balance_cents: number; status: string } | undefined;
    if (!row) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");

    database
      .prepare(
        "UPDATE credits SET qr_id = ?, qr_string = ?, qr_image = ?, num_ref = ?, qr_expires_at = ? WHERE id = ?",
      )
      .run(qr.id, qr.qrString, qr.qrImage, numRef, qr.expiresAt ?? null, creditId);

    audit("credit.codi_qr.attached", "credit", creditId, { id: qr.id, numRef });
    database.exec("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Ignorar
      }
    }
  }
  const updated = getCredit(creditId);
  if (!updated) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");
  return updated;
}

export function recordVerifiedCreditPaymentFromPey(input: {
  creditId: string;
  amountCents: number;
  method: PaymentMethod;
  transactionId: string;
  rawEvent?: string | null;
}): {
  credit: Credit;
  appliedCents: number;
  balanceCents: number;
  duplicate: boolean;
} {
  const database = getDb();
  const txId = input.transactionId.trim();
  if (!txId) {
    throw new ValidationError("Falta transactionId para el abono verificado.");
  }
  const amountCents = Math.round(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new ValidationError("El abono debe ser mayor a cero.");
  }

  database.exec("SAVEPOINT credit_pey_record");
  let committed = false;
  try {
    if (database.prepare("SELECT 1 FROM payments WHERE transaction_id = ?").get(txId)) {
      throw new ConflictError("La transacción ya corresponde a una venta.", "credit_transaction_conflict");
    }
    // 1. Idempotencia estricta por transaction_id en credit_payments
    const existing = database
      .prepare(
        "SELECT id, credit_id, amount_cents FROM credit_payments WHERE transaction_id = ?",
      )
      .get(txId) as { id: string; credit_id: string; amount_cents: number } | undefined;

    if (existing) {
      if (existing.credit_id !== input.creditId || Number(existing.amount_cents) !== amountCents) {
        throw new ConflictError("La transacción ya corresponde a otro abono.", "credit_transaction_conflict");
      }
      const credit = getCredit(input.creditId);
      if (!credit) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");
      database.exec("RELEASE SAVEPOINT credit_pey_record");
      committed = true;
      return {
        credit,
        appliedCents: Number(existing.amount_cents),
        balanceCents: credit.balanceCents,
        duplicate: true,
      };
    }

    const credit = getCredit(input.creditId);
    if (!credit) throw new NotFoundError("Fiado no encontrado.", "credit_not_found");

    if (amountCents > credit.balanceCents) {
      throw new ConflictError("El abono verificado excede el saldo pendiente.", "credit_amount_mismatch");
    }
    const appliedCents = amountCents;
    const newBalance = Math.max(0, credit.balanceCents - appliedCents);
    const nextStatus = newBalance === 0 ? "settled" : "partial";

    database
      .prepare(
        `INSERT INTO credit_payments
         (id, credit_id, amount_cents, method, provider, transaction_id, raw_event, demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("cp"),
        input.creditId,
        appliedCents,
        input.method,
        "pey",
        txId,
        input.rawEvent ?? null,
        isDemoMode() ? 1 : 0,
        nowIso(),
      );

    database
      .prepare("UPDATE credits SET balance_cents = ?, status = ? WHERE id = ?")
      .run(newBalance, nextStatus, input.creditId);

    audit("credit.pey_payment", "credit", input.creditId, {
      amountCents: appliedCents,
      transactionId: txId,
      method: input.method,
      newBalance,
      status: nextStatus,
    });

    database.exec("RELEASE SAVEPOINT credit_pey_record");
    committed = true;

    const updated = getCredit(input.creditId);
    if (!updated) throw new Error("No pude leer el fiado actualizado.");

    return {
      credit: updated,
      appliedCents,
      balanceCents: newBalance,
      duplicate: false,
    };
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK TO SAVEPOINT credit_pey_record");
        database.exec("RELEASE SAVEPOINT credit_pey_record");
      } catch {
        // Ignorar
      }
    }
  }
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
  const provider = assertPaymentProvider(input.provider);
  const order = getOrder(orderId);
  if (!order) throw new NotFoundError("Pedido no encontrado.", "order_not_found");

  // Un reintento con la misma transacción no debe volver a insertar, pero sí
  // puede reparar una orden que quedó con `paid_cents` viejo por un fallo
  // anterior entre el INSERT del pago y el UPDATE de la orden.
  if (input.transactionId) {
    const existing = database
      .prepare("SELECT id FROM payments WHERE transaction_id = ?")
      .get(input.transactionId) as { id: string } | undefined;
    if (existing) return healOrderFromPayments(database, orderId, "duplicate_transaction");
  }

  const amountCents = Math.max(0, Math.round(input.amountCents));
  if (amountCents <= 0) return order;

  // SAVEPOINT funciona igual en autocommit que dentro de la transacción del
  // webhook: el INSERT del pago, el UPDATE de la orden y la auditoría son una
  // sola unidad. Si el UPDATE falla, el pago no queda huérfano.
  database.exec("SAVEPOINT payment_record");
  let released = false;
  try {
    if (input.transactionId && database.prepare("SELECT 1 FROM credit_payments WHERE transaction_id = ?").get(input.transactionId)) {
      throw new ConflictError("La transacción ya corresponde a un fiado.", "payment_transaction_conflict");
    }
    if (input.transactionId) {
      const raced = database
        .prepare("SELECT id FROM payments WHERE transaction_id = ?")
        .get(input.transactionId) as { id: string } | undefined;
      if (raced) {
        database.exec("RELEASE SAVEPOINT payment_record");
        released = true;
        return healOrderFromPayments(database, orderId, "duplicate_transaction");
      }
    }

    try {
      database
        .prepare(
          `INSERT INTO payments
           (id, order_id, provider, method, amount_cents, status, transaction_id, payment_link_id, raw_event, demo, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newId("pay"),
          orderId,
          provider,
          input.method,
          amountCents,
          "paid",
          input.transactionId,
          input.paymentLinkId ?? null,
          input.rawEvent ?? null,
          provider === "demo" || isDemoMode() ? 1 : 0,
          nowIso(),
        );
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        database.exec("ROLLBACK TO SAVEPOINT payment_record");
        database.exec("RELEASE SAVEPOINT payment_record");
        released = true;
        return healOrderFromPayments(database, orderId, "transaction_race");
      }
      throw error;
    }

    const totals = recalculateOrderTotals(database, orderId);
    audit("payment.recorded", "order", orderId, {
      amountCents,
      method: input.method,
      provider,
      transactionId: input.transactionId,
      status: totals.status,
    });

    database.exec("RELEASE SAVEPOINT payment_record");
    released = true;
  } finally {
    if (!released) {
      try {
        database.exec("ROLLBACK TO SAVEPOINT payment_record");
        database.exec("RELEASE SAVEPOINT payment_record");
      } catch {
        // Si SQLite ya cerró la transacción, conservamos el error original.
      }
    }
  }

  return getOrder(orderId)!;
}

/**
 * Recalcula `paid_cents`, método y estado desde la tabla `payments`. Se usa
 * para curar una orden cuyo pago sí quedó guardado pero cuyo UPDATE no llegó
 * a ejecutarse. Nunca degrada un pedido `fulfilled`.
 */
function recalculateOrderTotals(
  database: ReturnType<typeof getDb>,
  orderId: string,
): { paidCents: number; method: PaymentMethod; status: OrderStatus; changed: boolean } {
  const row = database
    .prepare(
      "SELECT total_cents, credit_cents, paid_cents, payment_method, status FROM orders WHERE id = ?",
    )
    .get(orderId) as
    | {
        total_cents: number;
        credit_cents: number;
        paid_cents: number;
        payment_method: PaymentMethod | null;
        status: OrderStatus;
      }
    | undefined;
  if (!row) throw new NotFoundError("Pedido no encontrado.", "order_not_found");

  const sum = database
    .prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE order_id = ? AND status = 'paid'",
    )
    .get(orderId) as { total: number };
  const paidCents = Number(sum.total);
  const methods = database
    .prepare(
      "SELECT DISTINCT method FROM payments WHERE order_id = ? AND status = 'paid'",
    )
    .all(orderId) as Array<{ method: string }>;
  const method =
    methods.length > 1
      ? "mixed"
      : ((methods[0]?.method as PaymentMethod) ?? row.payment_method ?? "unknown");

  const latestProvider = database
    .prepare(
      `SELECT provider, demo FROM payments
       WHERE order_id = ? AND status = 'paid'
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(orderId) as { provider: string; demo: number } | undefined;

  const coveredCents = paidCents + Number(row.credit_cents);
  let status: OrderStatus;
  if (row.status === "fulfilled") {
    status = "fulfilled";
  } else if (coveredCents >= Number(row.total_cents)) {
    // Nunca `fulfilled`: entregar sigue siendo una acción explícita. Una fila
    // con `demo=1` no es dinero real aunque su provider sea pey: el evento
    // firmado en demo se presenta como demo_paid, no como pagado.
    const isDemoPayment =
      latestProvider?.provider === "demo" || Number(latestProvider?.demo) === 1;
    status = coveredStatus(isDemoPayment ? "demo" : "pey");
  } else if (paidCents > 0) {
    status = "partially_paid";
  } else {
    status = row.status;
  }

  const changed =
    paidCents !== Number(row.paid_cents) ||
    method !== (row.payment_method ?? null) ||
    status !== row.status;
  if (changed) {
    database
      .prepare(
        "UPDATE orders SET paid_cents = ?, status = ?, payment_method = ?, updated_at = ? WHERE id = ?",
      )
      .run(paidCents, status, method, nowIso(), orderId);
  }

  return { paidCents, method, status, changed };
}

function healOrderFromPayments(
  database: ReturnType<typeof getDb>,
  orderId: string,
  reason: string,
): Order {
  database.exec("SAVEPOINT payment_heal");
  let released = false;
  try {
    const totals = recalculateOrderTotals(database, orderId);
    if (totals.changed) {
      audit("payment.reconciled", "order", orderId, {
        reason,
        paidCents: totals.paidCents,
        method: totals.method,
        status: totals.status,
      });
    }
    database.exec("RELEASE SAVEPOINT payment_heal");
    released = true;
  } finally {
    if (!released) {
      try {
        database.exec("ROLLBACK TO SAVEPOINT payment_heal");
        database.exec("RELEASE SAVEPOINT payment_heal");
      } catch {
        // Si SQLite ya cerró la transacción, conservamos el error original.
      }
    }
  }

  const healed = getOrder(orderId);
  if (!healed) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
  return healed;
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
  const cleanNote = note?.trim() || null;
  const requestHash = request
    ? requestPayloadHash({
        creditId,
        amountCents: requestedCents,
        method,
        note: cleanNote,
      })
    : null;

  database.exec("BEGIN IMMEDIATE");
  let committed = false;
  try {
    if (request && requestHash) {
      const existing = database
        .prepare(
          "SELECT credit_id, amount_cents, method, note, request_hash FROM credit_payments WHERE request_id = ?",
        )
        .get(request) as
        | {
            credit_id: string;
            amount_cents: number;
            method: string;
            note: string | null;
            request_hash: string | null;
          }
        | undefined;
      if (existing) {
        if (existing.credit_id !== creditId) {
          throw new CreditPaymentConflict(
            "request_id_conflict",
            "Ese requestId ya se usó en otro fiado. No se registró nada.",
            null,
          );
        }
        // Un requestId repetido solo es idempotente si el abono es el mismo.
        // Si cambió el monto, el método o la nota, es una llave reutilizada.
        const storedHash =
          existing.request_hash ??
          requestPayloadHash({
            creditId: existing.credit_id,
            amountCents: Number(existing.amount_cents),
            method: existing.method,
            note: existing.note ?? null,
          });
        if (storedHash !== requestHash) {
          throw new CreditPaymentConflict(
            "request_id_conflict",
            "Ese requestId ya se usó con otro monto o método. No se registró nada.",
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
    // Un abono digital no pasa por pey: se guarda como “declarado”.
    const provider = method === "cash" ? "cash" : "declared";

    database
      .prepare(
        `INSERT INTO credit_payments
         (id, credit_id, amount_cents, method, provider, note, request_id, request_hash, demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("cp"),
        creditId,
        appliedCents,
        method,
        provider,
        cleanNote,
        request,
        requestHash,
        isDemoMode() ? 1 : 0,
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
      provider,
      note: cleanNote,
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
  // Un pago simulado no es una entrega real. La UI no debe leer “Entregado”
  // sobre `demo_paid`; se deja explícito que esa transición no existe.
  if (order.status === "demo_paid") {
    throw new ConflictError(
      "Un pago demo no se puede marcar como entregado. Es una simulación.",
      "demo_not_deliverable",
    );
  }
  // La entrega no puede adelantarse a una deuda abierta. Se consulta por
  // `order_id` (no solo por `credit_id`) y sin el filtro de visibilidad de
  // `getCredit`: un crédito real puede apuntar a un cliente demo y aun así
  // debe bloquear la entrega hasta cobrarse.
  const database = getDb();
  const openCredit = database
    .prepare(
      `SELECT id, balance_cents FROM credits
       WHERE status != 'settled' AND balance_cents > 0
         AND (order_id = ? OR id = ?)
       LIMIT 1`,
    )
    .get(orderId, order.creditId ?? "") as
    | { id: string; balance_cents: number }
    | undefined;
  if (openCredit) {
    throw new ConflictError(
      "El fiado sigue abierto. Cóbralo antes de marcar la entrega.",
      "credit_open",
    );
  }
  const coveredCents = order.paidCents + order.creditCents;
  const canDeliver =
    order.status === "paid" ||
    (order.status === "confirmed" && coveredCents >= order.totalCents);
  if (!canDeliver) {
    throw new ConflictError(
      "Solo un pedido cubierto puede marcarse como entregado.",
      "order_not_covered",
    );
  }

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
