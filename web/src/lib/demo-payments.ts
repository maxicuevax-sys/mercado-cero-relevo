import { MERCHANT, isDemoMode } from "./config";
import { getDb, getOrder, newId, nowIso } from "./db";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "./errors";
import { MAX_REQUEST_ID_CHARS, recordPayment } from "./orders";
import { requestPayloadHash } from "./request-hash";
import type { Order } from "./types";

export type DemoPaymentMethod = "codi" | "card" | "wallet";

export interface DemoPaymentResult {
  order: Order;
  transactionId: string | null;
  duplicate: boolean;
  alreadySettled: boolean;
}

interface OrderRow {
  id: string;
  demo: number;
  status: string;
  total_cents: number;
  credit_cents: number;
  payment_link_id: string | null;
}

interface EventRow {
  id: string;
  provider: string;
  idempotency_key: string;
  payload: string;
  payload_hash: string | null;
  result: string | null;
}

interface PaymentRow {
  order_id: string;
  amount_cents: number;
  status: string;
  provider: string;
}

interface DemoPaymentPayload {
  v: 1;
  key: string;
  orderId: string;
  method: DemoPaymentMethod;
  amountCents: number;
  requestId: string | null;
  transactionId: string;
}

type Database = ReturnType<typeof getDb>;

const KEY_PREFIX = "demo:pay:v1";
const EVENT_PROVIDER = "demo";
const EVENT_TYPE = "demo.payment";

function normalizeRequestId(value: string | null | undefined): string | null {
  const requestId = (value ?? "").trim();
  if (!requestId) return null;
  if (requestId.length > MAX_REQUEST_ID_CHARS) {
    throw new ValidationError(
      `El requestId no puede pasar de ${MAX_REQUEST_ID_CHARS} caracteres.`,
      "request_id_invalid",
    );
  }
  return requestId;
}

function requestKey(requestId: string): string {
  return `${KEY_PREFIX}:req:${MERCHANT.id}:${requestId}`;
}

function autoKey(orderId: string, amountCents: number): string {
  return `${KEY_PREFIX}:auto:${MERCHANT.id}:${orderId}:${amountCents}`;
}

function transactionIdFor(key: string): string {
  return `demo_txn_${requestPayloadHash({ key }).slice(0, 40)}`;
}

function isDemoMethod(value: unknown): value is DemoPaymentMethod {
  return value === "codi" || value === "card" || value === "wallet";
}

function isBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY|database is locked|database table is locked|busy/i.test(
    message,
  );
}

function busyError(): AppError {
  return new AppError(
    503,
    "demo_pay_busy",
    "El cobro está ocupado. Reintenta en un momento.",
  );
}

function findEvent(database: Database, key: string): EventRow | undefined {
  return database
    .prepare(
      `SELECT id, provider, idempotency_key, payload, payload_hash, result
       FROM payment_events
       WHERE idempotency_key = ?
       LIMIT 1`,
    )
    .get(key) as EventRow | undefined;
}

/**
 * Busca por `transaction_id` sin filtrar `status`: un pago `pending`/`failed`
 * con la llave determinista también debe bloquear un segundo intento.
 */
function findPayment(
  database: Database,
  transactionId: string,
): PaymentRow | undefined {
  return database
    .prepare(
      `SELECT order_id, amount_cents, status, provider
       FROM payments
       WHERE transaction_id = ?
       LIMIT 1`,
    )
    .get(transactionId) as PaymentRow | undefined;
}

function payloadHash(payload: DemoPaymentPayload): string {
  return requestPayloadHash(payload as unknown as Record<string, unknown>);
}

function parsePayload(event: EventRow): DemoPaymentPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.payload) as unknown;
  } catch {
    throw new ConflictError(
      "El evento de idempotencia está corrupto.",
      "idempotency_incomplete",
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConflictError(
      "El evento de idempotencia está incompleto.",
      "idempotency_incomplete",
    );
  }

  const record = parsed as Record<string, unknown>;
  const amountCents = record.amountCents;

  if (
    record.v !== 1 ||
    typeof record.key !== "string" ||
    record.key !== event.idempotency_key ||
    typeof record.orderId !== "string" ||
    !isDemoMethod(record.method) ||
    typeof amountCents !== "number" ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    !(record.requestId === null || typeof record.requestId === "string") ||
    typeof record.transactionId !== "string" ||
    record.transactionId !== transactionIdFor(event.idempotency_key)
  ) {
    throw new ConflictError(
      "El evento de idempotencia está incompleto.",
      "idempotency_incomplete",
    );
  }

  return {
    v: 1,
    key: record.key,
    orderId: record.orderId,
    method: record.method,
    amountCents,
    requestId: record.requestId,
    transactionId: record.transactionId,
  };
}

function replayPayment(
  database: Database,
  event: EventRow,
  row: OrderRow,
  method: DemoPaymentMethod,
  dueCents: number,
): DemoPaymentResult {
  if (event.provider !== EVENT_PROVIDER) {
    throw new ConflictError(
      "Ese identificador de pago pertenece a otro proveedor.",
      "idempotency_conflict",
    );
  }

  const payload = parsePayload(event);
  const expectedHash = payloadHash(payload);
  if (event.payload_hash !== null && event.payload_hash !== expectedHash) {
    throw new ConflictError(
      "El evento de idempotencia no coincide con su hash.",
      "idempotency_conflict",
    );
  }

  if (payload.orderId !== row.id) {
    throw new ConflictError(
      "Ese requestId ya se usó en otro pedido.",
      "idempotency_conflict",
    );
  }

  // La llave automática identifica "este pedido + este importe"; el método es
  // informativo. La llave de requestId sí tiene identidad de método.
  if (
    event.idempotency_key.startsWith(`${KEY_PREFIX}:req:`) &&
    payload.method !== method
  ) {
    throw new ConflictError(
      "Ese requestId ya se usó con otro método.",
      "idempotency_conflict",
    );
  }

  if (event.result === "rejected" || event.result === "ignored") {
    throw new ConflictError(
      "Ese evento no es aplicable a un pago demo.",
      "idempotency_conflict",
    );
  }

  const transactionId = transactionIdFor(event.idempotency_key);
  const payment = findPayment(database, transactionId);

  if (payment) {
    if (
      payment.order_id !== row.id ||
      Number(payment.amount_cents) !== payload.amountCents ||
      payment.status !== "paid" ||
      payment.provider !== EVENT_PROVIDER
    ) {
      throw new ConflictError(
        "El pago existente no coincide con el pedido o el importe del evento.",
        "idempotency_incomplete",
      );
    }

    if (event.result !== "processed") {
      database
        .prepare(
          "UPDATE payment_events SET result = 'processed', error = NULL WHERE id = ?",
        )
        .run(event.id);
    }

    // `recordPayment` detecta el transactionId existente y cura la orden si
    // `paid_cents`/status quedaron viejos. No inserta otro pago.
    const healed = recordPayment(row.id, {
      provider: EVENT_PROVIDER,
      method: payload.method,
      amountCents: payload.amountCents,
      transactionId,
      paymentLinkId: row.payment_link_id,
      rawEvent: JSON.stringify({
        demo: true,
        replayed: true,
        idempotencyKey: event.idempotency_key,
      }),
    });

    return {
      order: healed,
      transactionId,
      duplicate: true,
      alreadySettled: false,
    };
  }

  if (event.result === "processed") {
    throw new ConflictError(
      "El evento figura procesado pero no tiene pago. No se registró dinero.",
      "idempotency_incomplete",
    );
  }

  if (dueCents <= 0 || dueCents !== payload.amountCents) {
    throw new ConflictError(
      "El saldo del pedido cambió desde la primera solicitud. Usa un requestId nuevo.",
      "idempotency_state_changed",
    );
  }

  // Evento sin pago con el mismo importe: se falla cerrado. No se crea dinero
  // a partir de un evento que pudo quedar incompleto o manipulado.
  throw new ConflictError(
    "La operación quedó sin pago y no se completó. No se registró dinero.",
    "idempotency_incomplete",
  );
}

/**
 * Pago demo idempotente y atómico.
 *
 * El lock `BEGIN IMMEDIATE` se toma antes de leer el pedido: dos procesos no
 * pueden decidir el saldo con la misma foto vieja. El evento, el pago, la
 * orden y la auditoría viven en la misma transacción; si algo falla, no queda
 * evento sin pago ni pago sin evento. La función es síncrona a propósito: no
 * debe haber `await` entre `BEGIN IMMEDIATE` y `COMMIT`.
 */
export function recordDemoPayment(input: {
  orderId: string;
  method: DemoPaymentMethod;
  requestId?: string | null;
}): DemoPaymentResult {
  if (!isDemoMode()) {
    throw new AppError(
      403,
      "demo_disabled",
      "El modo demo está desactivado.",
    );
  }

  const requestId = normalizeRequestId(input.requestId);
  const database = getDb();

  try {
    database.exec("BEGIN IMMEDIATE");
  } catch (error) {
    if (isBusyError(error)) throw busyError();
    throw error;
  }

  let committed = false;
  try {
    const row = database
      .prepare(
        `SELECT id, demo, status, total_cents, credit_cents, payment_link_id
         FROM orders
         WHERE id = ? AND merchant_id = ?
         LIMIT 1`,
      )
      .get(input.orderId, MERCHANT.id) as OrderRow | undefined;

    if (!row) {
      throw new NotFoundError("Pedido no encontrado.", "order_not_found");
    }
    if (Number(row.demo) !== 1) {
      throw new ConflictError(
        "Este pedido no es de demo. La simulación solo aplica a pedidos demo.",
        "demo_order_required",
      );
    }
    if (row.status === "cancelled") {
      throw new ConflictError(
        "El pedido está cancelado; no se puede simular un pago.",
        "order_cancelled",
      );
    }

    // `payments` es la fuente de verdad del saldo; no confiamos en un
    // `orders.paid_cents` que pudo quedar viejo por un fallo anterior.
    const paidRow = database
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS total
         FROM payments
         WHERE order_id = ? AND status = 'paid'`,
      )
      .get(row.id) as { total: number } | undefined;
    const paidCents = Number(paidRow?.total ?? 0);
    const dueCents = Math.max(
      0,
      Math.round(
        Number(row.total_cents) - paidCents - Number(row.credit_cents),
      ),
    );

    const requestedKey = requestId ? requestKey(requestId) : null;
    if (requestedKey) {
      const event = findEvent(database, requestedKey);
      if (event) {
        const replay = replayPayment(
          database,
          event,
          row,
          input.method,
          dueCents,
        );
        database.exec("COMMIT");
        committed = true;
        return replay;
      }
    }

    if (dueCents <= 0) {
      const current = getOrder(row.id);
      if (!current) {
        throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      }
      database.exec("COMMIT");
      committed = true;
      return {
        order: current,
        transactionId: null,
        duplicate: false,
        alreadySettled: true,
      };
    }

    const key = requestedKey ?? autoKey(row.id, dueCents);
    if (!requestedKey) {
      const event = findEvent(database, key);
      if (event) {
        const replay = replayPayment(
          database,
          event,
          row,
          input.method,
          dueCents,
        );
        database.exec("COMMIT");
        committed = true;
        return replay;
      }
    }

    // Un pedido marcado como cubierto no puede recibir un pago nuevo si aún
    // conserva saldo. Un replay de una operación ya registrada sí pasó antes:
    // devuelve su resultado, no crea dinero.
    if (
      dueCents > 0 &&
      (row.status === "paid" || row.status === "demo_paid")
    ) {
      throw new ConflictError(
        "El pedido ya está marcado como cubierto pero conserva saldo. No se registró otro pago.",
        "order_state_inconsistent",
      );
    }

    const transactionId = transactionIdFor(key);
    if (findPayment(database, transactionId)) {
      throw new ConflictError(
        "La operación tiene un pago sin evento. No se registró otro; requiere revisión.",
        "idempotency_incomplete",
      );
    }

    const payload: DemoPaymentPayload = {
      v: 1,
      key,
      orderId: row.id,
      method: input.method,
      amountCents: dueCents,
      requestId,
      transactionId,
    };
    const eventId = newId("evt");

    database
      .prepare(
        `INSERT INTO payment_events
         (id, provider, event_type, idempotency_key, payload, payload_hash,
          signature_valid, processed_at, result, error)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'received', NULL)`,
      )
      .run(
        eventId,
        EVENT_PROVIDER,
        EVENT_TYPE,
        key,
        JSON.stringify(payload),
        payloadHash(payload),
        nowIso(),
      );

    const updated = recordPayment(row.id, {
      provider: EVENT_PROVIDER,
      method: input.method,
      amountCents: dueCents,
      transactionId,
      paymentLinkId: row.payment_link_id,
      rawEvent: JSON.stringify({
        demo: true,
        method: input.method,
        requestId,
        idempotencyKey: key,
      }),
    });

    database
      .prepare(
        "UPDATE payment_events SET result = 'processed', error = NULL WHERE id = ?",
      )
      .run(eventId);

    database.exec("COMMIT");
    committed = true;

    return {
      order: updated,
      transactionId,
      duplicate: false,
      alreadySettled: false,
    };
  } catch (error) {
    if (isBusyError(error)) throw busyError();
    throw error;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // SQLite pudo haber cerrado la transacción sola; conservamos el error
        // original.
      }
    }
  }
}
