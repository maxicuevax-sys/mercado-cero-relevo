export type OrderStatus =
  | "draft"
  | "confirmed"
  | "payment_pending"
  | "partially_paid"
  | "paid"
  | "fulfilled"
  | "cancelled";

export type PaymentMethod = "codi" | "card" | "wallet" | "cash" | "mixed";

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
  method: PaymentMethod;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  verifiedDigitalCents: number;
  cashCents: number;
  pendingCents: number;
  creditCents: number;
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
  salesCents: number;
  collectedCents: number;
  pendingCents: number;
  creditCents: number;
  orderCount: number;
  paidOrderCount: number;
  averageTicketCents: number;
  cashCents: number;
  digitalCents: number;
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
  createdAt: string;
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
}

export interface Goal {
  id: string;
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
