import { PULSO_STEPS, type PulsoStep } from "./pulso-timeline";

/**
 * Efecto de un webhook pey ya verificado. No crea cobros.
 * La misma orden solo descuenta inventario una vez.
 */

interface Statement {
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
  run(...args: unknown[]): { changes?: number | bigint };
}

export interface PulsoDb {
  prepare(sql: string): Statement;
}

export interface PulsoApplyResult {
  started: boolean;
  duplicate: boolean;
  decremented: number;
}

export interface StallProductRow {
  id: string;
  name: string;
  stock: number;
  priceCents: number;
}

export interface TimelineEventRow {
  orderId: string;
  step: string;
  at: string;
  detail: string | null;
}

const STALL_ID = "lupita";

export function noteTimeline(
  database: PulsoDb,
  input: { orderId: string; step: PulsoStep; detail: string; webhookId?: string | null; at?: string },
): void {
  database
    .prepare(
      `INSERT OR IGNORE INTO order_timeline (id, order_id, step, at, detail, webhook_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `tl_${input.orderId}_${input.step}`,
      input.orderId,
      input.step,
      input.at ?? new Date().toISOString(),
      input.detail,
      input.webhookId ?? null,
    );
}

export function applyPulsoAfterVerifiedPayment(
  database: PulsoDb,
  input: { orderId: string; webhookId: string; at?: string },
): PulsoApplyResult {
  const at = input.at ?? new Date().toISOString();
  const started = database
    .prepare("SELECT 1 AS ok FROM order_timeline WHERE order_id = ? AND step = 'fulfillment.started'")
    .get(input.orderId) as { ok: number } | undefined;
  if (started) return { started: false, duplicate: true, decremented: 0 };

  const paid = database
    .prepare(
      `SELECT COUNT(*) AS n FROM payments
       WHERE order_id = ? AND provider = 'pey' AND demo = 0 AND status = 'paid'`,
    )
    .get(input.orderId) as { n: number } | undefined;
  const order = database
    .prepare("SELECT status FROM orders WHERE id = ?")
    .get(input.orderId) as { status: string } | undefined;
  if (!order || order.status === "demo_paid" || !paid || Number(paid.n) < 1) {
    return { started: false, duplicate: false, decremented: 0 };
  }

  noteTimeline(database, {
    orderId: input.orderId,
    step: "pey.webhook.verified",
    detail: "Firma verificada.",
    webhookId: input.webhookId,
    at,
  });
  noteTimeline(database, {
    orderId: input.orderId,
    step: "payment.received",
    detail: "Pago pey registrado. Un webhook-id repetido no suma otra vez.",
    webhookId: input.webhookId,
    at,
  });

  const decremented = decrementOnce(database, input.orderId, input.webhookId, at);
  noteTimeline(database, {
    orderId: input.orderId,
    step: "fulfillment.started",
    detail: "Comanda en el puesto. El inventario de este pedido bajó una vez.",
    webhookId: input.webhookId,
    at,
  });
  return { started: true, duplicate: false, decremented };
}

function decrementOnce(database: PulsoDb, orderId: string, webhookId: string, at: string): number {
  const items = database
    .prepare("SELECT description, quantity FROM order_items WHERE order_id = ?")
    .all(orderId) as Array<{ description: string; quantity: number }>;
  const products = database
    .prepare("SELECT id, name, stock FROM stall_products WHERE stall_id = ?")
    .all(STALL_ID) as Array<{ id: string; name: string; stock: number }>;
  let decremented = 0;
  for (const item of items) {
    const product = products.find((candidate) => namesMatch(item.description, candidate.name));
    if (!product) continue;
    const quantity = Math.max(0, Math.round(Number(item.quantity)));
    if (quantity <= 0) continue;
    const inserted = database
      .prepare(
        `INSERT OR IGNORE INTO inventory_moves
         (id, order_id, product_id, quantity, webhook_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(`mov_${orderId}_${product.id}`, orderId, product.id, quantity, webhookId, at);
    if (Number(inserted.changes ?? 0) !== 1) continue;
    database
      .prepare("UPDATE stall_products SET stock = MAX(0, stock - ?) WHERE id = ? AND stall_id = ?")
      .run(quantity, product.id, STALL_ID);
    decremented += quantity;
  }
  return decremented;
}

export function namesMatch(description: string, productName: string): boolean {
  const left = fold(description);
  const right = fold(productName);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function listStallProducts(database: PulsoDb): StallProductRow[] {
  const rows = database
    .prepare(
      "SELECT id, name, stock, price_cents FROM stall_products WHERE stall_id = ? ORDER BY name ASC",
    )
    .all(STALL_ID) as Array<{ id: string; name: string; stock: number; price_cents: number }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    stock: Number(row.stock),
    priceCents: Number(row.price_cents),
  }));
}

export function listTimelineEvents(database: PulsoDb, orderIds: string[]): TimelineEventRow[] {
  if (orderIds.length === 0) return [];
  const placeholders = orderIds.map(() => "?").join(", ");
  const rows = database
    .prepare(
      `SELECT order_id, step, at, detail FROM order_timeline
       WHERE order_id IN (${placeholders})
       ORDER BY at ASC`,
    )
    .all(...orderIds) as Array<{ order_id: string; step: string; at: string; detail: string | null }>;
  return rows
    .filter((row) => (PULSO_STEPS as readonly string[]).includes(row.step))
    .map((row) => ({
      orderId: row.order_id,
      step: row.step,
      at: row.at,
      detail: row.detail,
    }));
}

export function listProducingOrders(database: PulsoDb, orderIds: string[]): string[] {
  if (orderIds.length === 0) return [];
  const placeholders = orderIds.map(() => "?").join(", ");
  const rows = database
    .prepare(
      `SELECT order_id FROM order_timeline
       WHERE step = 'fulfillment.started' AND order_id IN (${placeholders})`,
    )
    .all(...orderIds) as Array<{ order_id: string }>;
  return rows.map((row) => row.order_id);
}
