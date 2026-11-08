import { isDemoMode } from "./config";
import { getDb } from "./db";
import { formatMxn } from "./format";
import { getOrderDetail } from "./orders";
import type {
  Credit,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "./types";

/**
 * Lectura del historial de movimientos CoDi.
 *
 * Este módulo NO escribe nada ni cambia estados: compone una vista de solo
 * lectura sobre `orders` y `payments`. No crea un estado nuevo en la base:
 * los estados que muestra son una lectura de los campos existentes
 * (`status`, `qr_*`, `payment_url`, `payments`) y se documentan aquí para que
 * la UI no invente dinero.
 *
 * Reglas de verdad:
 * - Un QR o un link son una solicitud de cobro: nunca suman como ingreso.
 * - El dinero recibido real es efectivo (provider `cash`, demo = 0) o un pago
 *   verificado por pey (provider `pey`, demo = 0).
 * - Cualquier pago con `provider = 'demo'` o `demo = 1` es simulación.
 * - El fiado (`credit_cents`) es deuda, no dinero recibido.
 */

export const MOVEMENTS_PAGE_SIZE = 20;

/**
 * `lib/pey.ts` pide el QR CoDi con `expiration: 600` (10 minutos). El contrato
 * local no guarda un `expires_at`, así que "QR vencido" se deriva de la última
 * actualización del pedido. La derivación es conservadora: `updated_at` nunca
 * es anterior a la generación del QR, por lo que si ya pasaron 10 minutos
 * desde `updated_at`, con más razón pasaron desde el QR. Puede haber falsos
 * negativos (si otra acción actualizó el pedido después), nunca falsos
 * positivos. No cancela la solicitud ni bloquea un pago tardío.
 */
export const CODI_QR_VALIDITY_MS = 10 * 60 * 1000;

export type MovementFilter = "todos" | "pendientes" | "pagados";

export type MovementState =
  | "created"
  | "awaiting"
  | "expired"
  | "paid"
  | "partial"
  | "demo_paid"
  | "cancelled";

export type MovementTone = "demo" | "pending" | "expired" | "ok" | "neutral";

export type MovementPayment = Pick<
  Payment,
  | "id"
  | "orderId"
  | "provider"
  | "method"
  | "amountCents"
  | "status"
  | "transactionId"
  | "demo"
  | "createdAt"
>;

/**
 * Forma mínima de un pedido que necesita el historial. Es compatible con
 * `Order` para poder reutilizar `getOrderDetail` sin duplicar consultas.
 * `demo` sí viaja en la fila cruda, pero `Order` no lo expone; se agrega aquí.
 */
export interface MovementOrder {
  id: string;
  status: OrderStatus;
  totalCents: number;
  paidCents: number;
  creditCents: number;
  qrId: string | null;
  qrString: string | null;
  paymentUrl: string | null;
  paymentLinkId: string | null;
  numRef: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  demo: boolean;
}

export interface MovementSummary {
  paidTotalCents: number;
  realPaidCents: number;
  verifiedPaidCents: number;
  cashRealCents: number;
  digitalRealCents: number;
  demoPaidCents: number;
  demoCashCents: number;
  demoDigitalCents: number;
  dueCents: number;
  creditCents: number;
  hasPayment: boolean;
  hasRealPayment: boolean;
  hasDemoPayment: boolean;
  hasQr: boolean;
  hasLink: boolean;
}

export interface Movement {
  order: MovementOrder;
  payments: MovementPayment[];
  summary: MovementSummary;
  state: MovementState;
  stateLabel: string;
  stateTone: MovementTone;
  stateDetail: string;
  requestLabel: string;
  requestDetail: string;
  moneyLabel: string;
  isCodi: boolean;
}

export interface MovementCounts {
  todos: number;
  pendientes: number;
  pagados: number;
}

export interface MovementSummaryTotals {
  total: number;
  openCount: number;
  openDueCents: number;
  realPaidCents: number;
  demoPaidCents: number;
  cancelledCount: number;
}

export interface CodiMovementsPage {
  movements: Movement[];
  total: number;
  page: number;
  pageCount: number;
  counts: MovementCounts;
}

export interface CodiMovementDetail {
  movement: Movement;
  credit: Credit | null;
  /** PNG base64 del QR cuando está guardado; el listado no lo carga. */
  qrImage: string | null;
}

const DEMO_VISIBLE_CLAUSE =
  "o.demo = 0 AND o.id NOT LIKE 'demo_%' AND o.status != 'demo_paid'";

/**
 * Pagos por pedido. Agrupa una sola vez por página/consulta en lugar de
 * lanzar una consulta por pedido.
 */
const PAYMENT_ROLLUP = `(
  SELECT order_id,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END), 0) AS paid_total,
         COALESCE(SUM(CASE WHEN status = 'paid' AND (provider = 'demo' OR demo = 1) THEN amount_cents ELSE 0 END), 0) AS demo_total,
         COALESCE(SUM(CASE WHEN status = 'paid' AND provider = 'pey' AND demo = 0 THEN amount_cents ELSE 0 END), 0) AS verified_total,
         COALESCE(SUM(CASE WHEN status = 'paid' AND method = 'cash' AND provider != 'demo' AND demo = 0 THEN amount_cents ELSE 0 END), 0) AS cash_real_total
  FROM payments
  GROUP BY order_id
) p ON p.order_id = o.id`;

/**
 * Un pedido entra al historial CoDi cuando:
 * - tiene un QR o un link de cobro (solicitud digital), o
 * - tiene un pago CoDi registrado (aunque el QR/link no se conserve), o
 * - sigue abierto con saldo por cobrar (solicitud creada, todavía sin QR).
 *
 * Quedan fuera las ventas de efectivo cerradas y los pagos de tarjeta/wallet
 * sin solicitud digital: no son movimientos CoDi. El detalle por id aplica la
 * misma condición con `isCodiMovement`.
 */
const CODI_SELECTION = `(
  o.qr_string IS NOT NULL
  OR o.qr_id IS NOT NULL
  OR o.payment_url IS NOT NULL
  OR o.payment_link_id IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM payments p_codi
    WHERE p_codi.order_id = o.id
      AND p_codi.status = 'paid'
      AND p_codi.method = 'codi'
  )
  OR (
    o.status IN ('confirmed', 'payment_pending', 'partially_paid')
    AND MAX(o.total_cents - COALESCE(p.paid_total, 0) - o.credit_cents, 0) > 0
  )
)`;

function demoVisibilityClause(): string {
  return isDemoMode() ? "" : ` AND ${DEMO_VISIBLE_CLAUSE}`;
}

function dueSql(alias = "o", paidColumn = "p.paid_total"): string {
  return `MAX(${alias}.total_cents - COALESCE(${paidColumn}, 0) - ${alias}.credit_cents, 0)`;
}

export function parseMovementFilter(value: string | undefined): MovementFilter {
  if (value === "pendientes" || value === "pagados") return value;
  return "todos";
}

export function movementFilterLabel(filter: MovementFilter): string {
  if (filter === "pendientes") return "Pendientes";
  if (filter === "pagados") return "Pagados";
  return "Todos";
}

export function movementFilterHref(filter: MovementFilter, page = 1): string {
  const params = new URLSearchParams();
  if (filter !== "todos") params.set("filtro", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/movimientos?${query}` : "/movimientos";
}

export function toMovementOrder(order: Order, demo: boolean): MovementOrder {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    paidCents: order.paidCents,
    creditCents: order.creditCents,
    qrId: order.qrId,
    qrString: order.qrString,
    paymentUrl: order.paymentUrl,
    paymentLinkId: order.paymentLinkId,
    numRef: order.numRef,
    customerName: order.customerName,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items,
    demo,
  };
}

export function toMovementPayments(payments: Payment[]): MovementPayment[] {
  return payments.map((payment) => ({
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    method: payment.method,
    amountCents: payment.amountCents,
    status: payment.status,
    transactionId: payment.transactionId,
    demo: payment.demo,
    createdAt: payment.createdAt,
  }));
}

export function summarizeMovement(
  order: Pick<MovementOrder, "totalCents" | "creditCents" | "qrId" | "qrString" | "paymentUrl" | "paymentLinkId">,
  payments: MovementPayment[],
): MovementSummary {
  let paidTotalCents = 0;
  let demoPaidCents = 0;
  let demoCashCents = 0;
  let verifiedPaidCents = 0;
  let cashRealCents = 0;

  for (const payment of payments) {
    if (payment.status !== "paid") continue;
    const amount = Math.max(0, Math.round(payment.amountCents));
    if (amount <= 0) continue;
    paidTotalCents += amount;
    const isDemo = payment.demo || payment.provider === "demo";
    if (isDemo) {
      demoPaidCents += amount;
      if (payment.method === "cash") demoCashCents += amount;
      continue;
    }
    if (payment.method === "cash") cashRealCents += amount;
    if (payment.provider === "pey") verifiedPaidCents += amount;
  }

  const demoDigitalCents = demoPaidCents - demoCashCents;
  const realPaidCents = cashRealCents + verifiedPaidCents;
  const dueCents = Math.max(
    0,
    Math.round(order.totalCents) - paidTotalCents - Math.max(0, Math.round(order.creditCents)),
  );
  const hasQr = Boolean(order.qrId || order.qrString);
  const hasLink = Boolean(order.paymentUrl || order.paymentLinkId);

  return {
    paidTotalCents,
    realPaidCents,
    verifiedPaidCents,
    cashRealCents,
    digitalRealCents: verifiedPaidCents,
    demoPaidCents,
    demoCashCents,
    demoDigitalCents,
    dueCents,
    creditCents: Math.max(0, Math.round(order.creditCents)),
    hasPayment: paidTotalCents > 0,
    hasRealPayment: realPaidCents > 0,
    hasDemoPayment: demoPaidCents > 0,
    hasQr,
    hasLink,
  };
}

/**
 * Referencia temporal del QR. `updated_at` se escribe al adjuntar el QR y solo
 * puede moverse hacia adelante por acciones posteriores, así que la edad de
 * `updated_at` es una cota inferior conservadora de la edad del QR.
 */
export function qrAgeMs(
  order: Pick<MovementOrder, "updatedAt" | "createdAt">,
  now = Date.now(),
): number | null {
  const updated = Date.parse(order.updatedAt);
  const created = Date.parse(order.createdAt);
  const reference = Number.isFinite(updated) ? updated : created;
  if (!Number.isFinite(reference)) return null;
  return Math.max(0, now - reference);
}

export function isQrExpired(
  order: Pick<MovementOrder, "qrId" | "qrString" | "updatedAt" | "createdAt">,
  now = Date.now(),
): boolean {
  if (!order.qrId && !order.qrString) return false;
  const age = qrAgeMs(order, now);
  return age !== null && age > CODI_QR_VALIDITY_MS;
}

export function movementState(
  order: Pick<MovementOrder, "status" | "qrId" | "qrString" | "updatedAt" | "createdAt">,
  summary: Pick<MovementSummary, "paidTotalCents" | "realPaidCents" | "dueCents" | "hasQr" | "hasLink">,
  now = Date.now(),
): MovementState {
  if (order.status === "cancelled") return "cancelled";
  if (summary.paidTotalCents > 0) {
    if (summary.realPaidCents > 0) {
      return summary.dueCents > 0 ? "partial" : "paid";
    }
    return "demo_paid";
  }
  if (summary.hasQr && isQrExpired(order, now)) return "expired";
  if (summary.hasQr || summary.hasLink) return "awaiting";
  return "created";
}

const STATE_COPY: Record<MovementState, { label: string; tone: MovementTone }> = {
  created: { label: "Solicitud creada", tone: "neutral" },
  awaiting: { label: "Esperando pago", tone: "pending" },
  expired: { label: "QR vencido", tone: "expired" },
  paid: { label: "Pago recibido", tone: "ok" },
  partial: { label: "Pago parcial", tone: "pending" },
  demo_paid: { label: "Pago demo", tone: "demo" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

function stateDetail(state: MovementState, summary: MovementSummary): string {
  switch (state) {
    case "created":
      return "Todavía no se generó QR ni link de cobro.";
    case "awaiting":
      return summary.hasQr && summary.hasLink
        ? "QR y link generados. El pago todavía no se registra."
        : summary.hasQr
          ? "QR generado. El pago todavía no se registra."
          : "Link generado. El pago todavía no se registra.";
    case "expired":
      return "El QR venció a los 10 min y no hay pago. La solicitud sigue abierta.";
    case "paid":
      return summary.creditCents > 0
        ? "El pago ya está registrado; el fiado sigue siendo deuda."
        : "El pago ya está registrado. Revisa su fuente abajo.";
    case "partial":
      return `Se recibió una parte; faltan ${formatMxn(summary.dueCents)}.`;
    case "demo_paid":
      return summary.dueCents > 0
        ? `Pago demo (simulado); faltan ${formatMxn(summary.dueCents)} por cobrar.`
        : "Pago demo: simulación, no es dinero real.";
    case "cancelled":
      return summary.hasPayment
        ? "Cancelada, pero tiene pagos registrados; revisa su fuente abajo."
        : "Esta solicitud no cuenta como cobro.";
  }
}

function requestLabels(summary: MovementSummary): { label: string; detail: string } {
  if (summary.hasQr && summary.hasLink) {
    return {
      label: "QR y link generados",
      detail: "La solicitud tiene QR y link. Ninguno es un pago.",
    };
  }
  if (summary.hasQr) {
    return {
      label: "QR generado",
      detail: "El QR es una solicitud de cobro, no un ingreso.",
    };
  }
  if (summary.hasLink) {
    return {
      label: "Link generado",
      detail: "El link es una solicitud de cobro, no un ingreso.",
    };
  }
  if (summary.hasPayment) {
    return {
      label: "Sin QR guardado",
      detail: "El pago está registrado, pero no se guardó el QR ni el link.",
    };
  }
  return {
    label: "Sin QR ni link",
    detail: "La solicitud existe, pero todavía no tiene cobro digital generado.",
  };
}

function moneyLabel(summary: MovementSummary): string {
  const { realPaidCents, verifiedPaidCents, cashRealCents, demoPaidCents } = summary;

  if (realPaidCents > 0) {
    if (verifiedPaidCents > 0 && cashRealCents > 0) {
      return `Efectivo ${formatMxn(cashRealCents)} + verificado ${formatMxn(verifiedPaidCents)}`;
    }
    if (verifiedPaidCents > 0) {
      return `Verificado por pey ${formatMxn(verifiedPaidCents)}`;
    }
    return `Efectivo recibido ${formatMxn(cashRealCents)}`;
  }

  if (demoPaidCents > 0) {
    if (summary.demoCashCents > 0 && summary.demoDigitalCents > 0) {
      return `Demo ${formatMxn(demoPaidCents)} (simulado)`;
    }
    if (summary.demoCashCents > 0) {
      return `Efectivo demo ${formatMxn(demoPaidCents)} (simulado)`;
    }
    return `Pago demo ${formatMxn(demoPaidCents)} (simulado)`;
  }

  return "Sin pago registrado";
}

/**
 * La misma condición que `CODI_SELECTION`, en TypeScript, para validar el
 * detalle por id y no mostrar una venta de efectivo bajo /movimientos.
 */
export function isCodiMovement(
  order: Pick<
    MovementOrder,
    | "status"
    | "qrId"
    | "qrString"
    | "paymentUrl"
    | "paymentLinkId"
    | "totalCents"
    | "creditCents"
  >,
  payments: MovementPayment[],
  summary: MovementSummary = summarizeMovement(order, payments),
): boolean {
  if (summary.hasQr || summary.hasLink) return true;
  if (
    payments.some(
      (payment) => payment.status === "paid" && payment.method === "codi",
    )
  ) {
    return true;
  }
  return (
    ["confirmed", "payment_pending", "partially_paid"].includes(order.status) &&
    summary.dueCents > 0
  );
}

export function describeMovement(
  order: MovementOrder,
  payments: MovementPayment[],
  now = Date.now(),
): Movement {
  const summary = summarizeMovement(order, payments);
  const state = movementState(order, summary, now);
  const copy = STATE_COPY[state];
  const request = requestLabels(summary);

  return {
    order,
    payments,
    summary,
    state,
    stateLabel: copy.label,
    stateTone: copy.tone,
    stateDetail: stateDetail(state, summary),
    requestLabel: request.label,
    requestDetail: request.detail,
    moneyLabel: moneyLabel(summary),
    isCodi: isCodiMovement(order, payments, summary),
  };
}

export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case "codi":
      return "CoDi";
    case "card":
      return "Tarjeta";
    case "wallet":
      return "Wallet";
    case "cash":
      return "Efectivo";
    case "mixed":
      return "Mixto";
    default:
      return "Método no registrado";
  }
}

export function paymentProviderLabel(provider: string, demo: boolean): string {
  if (demo || provider === "demo") return "Demo";
  if (provider === "pey") return "pey";
  if (provider === "cash") return "Caja";
  if (provider === "declared") return "Declarado";
  return "Registrado";
}

export function paymentStatusLabel(status: PaymentStatus): string {
  if (status === "paid") return "Registrado";
  if (status === "pending") return "Pendiente";
  return "Fallido";
}

export function movementPaymentBadge(payment: MovementPayment): {
  label: string;
  tone: "demo" | "ok" | "neutral";
} {
  if (payment.demo || payment.provider === "demo") {
    return { label: "Demo", tone: "demo" };
  }
  if (payment.provider === "pey") return { label: "Verificado", tone: "ok" };
  if (payment.method === "cash") return { label: "Efectivo", tone: "ok" };
  return { label: "Registrado", tone: "neutral" };
}

interface MovementRow {
  id: string;
  status: string;
  total_cents: number;
  paid_cents: number;
  credit_cents: number;
  qr_id: string | null;
  qr_string: string | null;
  payment_url: string | null;
  payment_link_id: string | null;
  num_ref: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
  demo: number;
}

function mapMovementOrder(row: Record<string, unknown>): MovementOrder {
  return {
    id: String(row.id),
    status: row.status as OrderStatus,
    totalCents: Number(row.total_cents),
    paidCents: Number(row.paid_cents),
    creditCents: Number(row.credit_cents ?? 0),
    qrId: (row.qr_id as string) ?? null,
    qrString: (row.qr_string as string) ?? null,
    paymentUrl: (row.payment_url as string) ?? null,
    paymentLinkId: (row.payment_link_id as string) ?? null,
    numRef: (row.num_ref as string) ?? null,
    customerName: (row.customer_name as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    items: [],
    demo: Number(row.demo ?? 0) === 1,
  };
}

function loadItems(ids: string[]): Map<string, OrderItem[]> {
  const byOrder = new Map<string, OrderItem[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return byOrder;
  const rows = getDb()
    .prepare(
      `SELECT id, order_id, description, quantity, unit_price_cents, total_cents
       FROM order_items
       WHERE order_id IN (${ids.map(() => "?").join(", ")})
       ORDER BY rowid ASC`,
    )
    .all(...ids) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const list = byOrder.get(String(row.order_id));
    if (!list) continue;
    list.push({
      id: String(row.id),
      description: String(row.description),
      quantity: Number(row.quantity),
      unitPriceCents: Number(row.unit_price_cents),
      totalCents: Number(row.total_cents),
    });
  }
  return byOrder;
}

function loadPayments(ids: string[]): Map<string, MovementPayment[]> {
  const byOrder = new Map<string, MovementPayment[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return byOrder;
  const rows = getDb()
    .prepare(
      `SELECT id, order_id, provider, method, amount_cents, status, transaction_id, demo, created_at
       FROM payments
       WHERE order_id IN (${ids.map(() => "?").join(", ")})
       ORDER BY created_at ASC, rowid ASC`,
    )
    .all(...ids) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const list = byOrder.get(String(row.order_id));
    if (!list) continue;
    list.push({
      id: String(row.id),
      orderId: String(row.order_id),
      provider: String(row.provider),
      method: row.method as PaymentMethod,
      amountCents: Number(row.amount_cents),
      status: row.status as PaymentStatus,
      transactionId: (row.transaction_id as string) ?? null,
      demo: Number(row.demo ?? 0) === 1,
      createdAt: String(row.created_at),
    });
  }
  return byOrder;
}

function countsForScope(): MovementCounts {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS todos,
         COALESCE(SUM(CASE WHEN o.status != 'cancelled' AND COALESCE(p.paid_total, 0) = 0 THEN 1 ELSE 0 END), 0) AS pendientes,
         COALESCE(SUM(CASE WHEN COALESCE(p.paid_total, 0) > 0 THEN 1 ELSE 0 END), 0) AS pagados
       FROM orders o
       LEFT JOIN ${PAYMENT_ROLLUP}
       WHERE ${CODI_SELECTION}${demoVisibilityClause()}`,
    )
    .get() as { todos: number; pendientes: number; pagados: number };
  return {
    todos: Number(row.todos),
    pendientes: Number(row.pendientes),
    pagados: Number(row.pagados),
  };
}

export function getCodiMovementsSummary(): MovementSummaryTotals {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status != 'cancelled' AND due > 0 THEN 1 ELSE 0 END), 0) AS open_count,
         COALESCE(SUM(CASE WHEN status != 'cancelled' AND due > 0 THEN due ELSE 0 END), 0) AS open_due,
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN real_paid ELSE 0 END), 0) AS real_paid,
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN demo_paid ELSE 0 END), 0) AS demo_paid,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
       FROM (
         SELECT
           o.id,
           o.status,
           ${dueSql()} AS due,
           COALESCE(p.cash_real_total, 0) + COALESCE(p.verified_total, 0) AS real_paid,
           COALESCE(p.demo_total, 0) AS demo_paid
         FROM orders o
         LEFT JOIN ${PAYMENT_ROLLUP}
         WHERE ${CODI_SELECTION}${demoVisibilityClause()}
       ) scope`,
    )
    .get() as {
    total: number;
    open_count: number;
    open_due: number;
    real_paid: number;
    demo_paid: number;
    cancelled: number;
  };

  return {
    total: Number(row.total),
    openCount: Number(row.open_count),
    openDueCents: Number(row.open_due),
    realPaidCents: Number(row.real_paid),
    demoPaidCents: Number(row.demo_paid),
    cancelledCount: Number(row.cancelled),
  };
}

function filterClause(filter: MovementFilter): string {
  if (filter === "pendientes") {
    return " AND o.status != 'cancelled' AND COALESCE(p.paid_total, 0) = 0";
  }
  if (filter === "pagados") {
    return " AND COALESCE(p.paid_total, 0) > 0";
  }
  return "";
}

export function listCodiMovements(options: {
  filter?: MovementFilter;
  page?: number;
} = {}): CodiMovementsPage {
  const filter = options.filter ?? "todos";
  const requestedPage =
    Number.isFinite(options.page) && (options.page ?? 0) > 0
      ? Math.floor(options.page as number)
      : 1;
  const counts = countsForScope();
  const total =
    filter === "pendientes"
      ? counts.pendientes
      : filter === "pagados"
        ? counts.pagados
        : counts.todos;
  const pageCount = Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const offset = (page - 1) * MOVEMENTS_PAGE_SIZE;

  const rows = getDb()
    .prepare(
      `SELECT o.id, o.status, o.total_cents, o.paid_cents, o.credit_cents,
              o.qr_id, o.qr_string, o.payment_url, o.payment_link_id, o.num_ref,
              o.customer_name, o.created_at, o.updated_at, o.demo
       FROM orders o
       LEFT JOIN ${PAYMENT_ROLLUP}
       WHERE ${CODI_SELECTION}${filterClause(filter)}${demoVisibilityClause()}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(MOVEMENTS_PAGE_SIZE, offset) as unknown as MovementRow[];

  const ids = rows.map((row) => row.id);
  const itemsByOrder = loadItems(ids);
  const paymentsByOrder = loadPayments(ids);
  const now = Date.now();

  const movements = rows.map((row) => {
    const order = mapMovementOrder(row as unknown as Record<string, unknown>);
    order.items = itemsByOrder.get(order.id) ?? [];
    return describeMovement(order, paymentsByOrder.get(order.id) ?? [], now);
  });

  return { movements, total, page, pageCount, counts };
}

/**
 * Detalle de un movimiento CoDi por id. Devuelve null tanto si el pedido no
 * existe en el modo actual como si no es un movimiento CoDi (por ejemplo,
 * una venta de efectivo cerrada).
 */
export function getCodiMovementDetail(id: string): CodiMovementDetail | null {
  const detail = getOrderDetail(id);
  if (!detail) return null;

  const row = getDb()
    .prepare("SELECT demo FROM orders WHERE id = ?")
    .get(id) as { demo: number } | undefined;
  const order = toMovementOrder(detail.order, Number(row?.demo ?? 0) === 1);
  const payments = toMovementPayments(detail.payments);
  const movement = describeMovement(order, payments);
  if (!movement.isCodi) return null;

  return { movement, credit: detail.credit, qrImage: detail.order.qrImage };
}
