export type OrderStatus =
  | "draft"
  | "confirmed"
  | "payment_pending"
  | "partially_paid"
  | "paid"
  | "demo_paid"
  | "fulfilled"
  | "cancelled";

export type PaymentMethod = "codi" | "card" | "wallet" | "cash" | "mixed" | "unknown";

export type PaymentStatus = "pending" | "paid" | "failed";

export type CreditStatus = "open" | "partial" | "settled";

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Order {
  id: string;
  merchantId: string;
  status: OrderStatus;
  totalCents: number;
  paidCents: number;
  digitalPaidCents: number;
  paymentMethod: PaymentMethod | null;
  lastPaymentProvider: string | null;
  customerName: string | null;
  creditId: string | null;
  creditCents: number;
  paymentLinkId: string | null;
  paymentUrl: string | null;
  qrId: string | null;
  qrString: string | null;
  qrImage: string | null;
  numRef: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  method: PaymentMethod;
  amountCents: number;
  status: PaymentStatus;
  transactionId: string | null;
  paymentLinkId: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
}

export interface Credit {
  id: string;
  customerId: string;
  customerName?: string;
  orderId: string | null;
  originalCents: number;
  balanceCents: number;
  status: CreditStatus;
  dueDate: string | null;
  createdAt: string;
}

export interface CreditPayment {
  id: string;
  creditId: string;
  amountCents: number;
  /** `cash` o `declared`; nunca `pey`. */
  provider: string;
  method: PaymentMethod;
  requestId: string | null;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  /** Pagos confirmados por pey. */
  verifiedDigitalCents: number;
  /** Abonos digitales de fiado declarados por la comerciante. */
  declaredDigitalCents: number;
  /** Pagos digitales simulados (nunca dinero real). */
  demoDigitalCents: number;
  /** Efectivo simulado de la demo; nunca suma al efectivo real. */
  demoCashCents: number;
  cashCents: number;
  pendingCents: number;
  /** Saldo vivo de fiado. En demo incluye fixtures; en real los excluye. */
  creditCents: number;
  demoCreditCents: number;
  orderCount: number;
  paidOrderCount: number;
  methods: Record<string, number>;
}

export type ReconciliationStatus =
  | "ok"
  | "mismatch"
  | "not_found"
  | "not_paid"
  | "error"
  | "missing_transaction_id"
  | "not_pey";

export interface ReconciliationItem {
  orderId: string;
  transactionId: string | null;
  method: string;
  localCents: number;
  peyCents: number | null;
  status: ReconciliationStatus;
  reason?: string;
}

export interface ReconciliationReport {
  date: string;
  demoMode: boolean;
  reconciled: boolean | null;
  localDigitalCents: number;
  peyConfirmedCents: number;
  differenceCents: number;
  checked: number;
  ok: number;
  issues: number;
  items: ReconciliationItem[];
}

export interface ParsedSale {
  intent: "sale" | "query" | "credit_payment" | "unknown";
  items: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  cashCents: number;
  customerName: string | null;
  creditCents: number;
  creditMethod: "cash" | "codi" | "card" | null;
  query: string | null;
  confidence: number;
  reply: string;
}

export interface CreateOrderInput {
  items: ParsedSale["items"];
  cashCents?: number;
  customerName?: string | null;
  creditCents?: number;
  paymentMethod?: PaymentMethod;
  /** Llave de idempotencia opcional; repetirla devuelve el mismo pedido. */
  requestId?: string | null;
}

export type AnalyticsPeriod = "today" | "week" | "month";

export interface AnalyticsPoint {
  date: string;
  salesCents: number;
  orders: number;
}

export interface AnalyticsReport {
  period: AnalyticsPeriod;
  label: string;
  start: string;
  end: string;
  demoMode: boolean;
  salesCents: number;
  /** Cobrado real: efectivo + digital verificado + digital declarado. */
  collectedCents: number;
  /** Cobros simulados, siempre separados del dinero real. */
  demoCollectedCents: number;
  pendingCents: number;
  creditCents: number;
  demoCreditCents: number;
  orderCount: number;
  paidOrderCount: number;
  averageTicketCents: number;
  cashCents: number;
  /** Digital real: verificado por pey + abonos declarados. */
  digitalCents: number;
  verifiedDigitalCents: number;
  declaredDigitalCents: number;
  demoDigitalCents: number;
  demoCashCents: number;
  methods: Record<string, number>;
  comparison: {
    salesCents: number;
    orderCount: number;
    salesChangePct: number | null;
    ordersChangePct: number | null;
  };
  series: AnalyticsPoint[];
  bestDay: AnalyticsPoint | null;
  bestHour: number | null;
}

export interface CashClose {
  id: string;
  date: string;
  version: number;
  openingCents: number;
  cashSalesCents: number;
  cashCreditCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  expectedCents: number;
  countedCents: number;
  differenceCents: number;
  baseNextCents: number;
  withdrawalNextCents: number;
  /** Foto del efectivo cobrado (ventas + abonos de fiado) al cerrar. */
  snapshotCashCents: number;
  /** Foto del fiado pendiente total al cerrar. */
  snapshotCreditCents: number;
  /** Foto de lo pendiente de cobro digital al cerrar. */
  snapshotPendingDigitalCents: number;
  /** false en filas migradas: fiado/digital no se registraban al cerrar. */
  snapshotKnown: boolean;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface CashClosePreview {
  openingCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  countedCents: number;
  baseNextCents: number;
  cashSalesCents: number;
  cashCreditCents: number;
  expectedCents: number;
  differenceCents: number;
  withdrawalNextCents: number;
  /** Huella de cashSales/cashCredit/expected del preview. */
  fingerprint: string;
}

export interface CashStatus {
  date: string;
  openingCents: number;
  cashSalesCents: number;
  cashCreditCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  expectedCents: number;
  saved: CashClose | null;
  /** Versiones de hoy, la más reciente primero; máximo 6 (incluye v1). */
  history: CashClose[];
}

export type TaskStatus = "open" | "done" | "deleted";

export interface Task {
  id: string;
  title: string;
  note: string | null;
  status: TaskStatus;
  dueAt: string | null;
  postponedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

export interface Goal {
  id: string;
  /** Fixture de demo; nunca cuenta como meta real. */
  demo: boolean;
  title: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  status: string;
  createdAt: string;
  progressPct: number;
  remainingCents: number;
  weeksRemaining: number | null;
  weeklyNeededCents: number | null;
}
