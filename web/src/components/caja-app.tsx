"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatedAmount } from "@/components/animated-amount";
import { PendingPayments } from "@/components/pending-payments";
import { PendingTasksPanel } from "@/components/pending-tasks";
import {
  ArrowUpRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock3,
  Copy,
  CreditCard,
  FlaskConical,
  Link2,
  ListTodo,
  Loader2,
  Mic,
  NotebookPen,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
  Umbrella,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  cn,
  formatActivityDate,
  formatCompactMxn,
  formatLongDate,
  formatMxn,
  formatTime,
  initials,
  shortOrder,
} from "@/lib/format";
import { answerDebtQuery } from "@/lib/voice-debts";
import type {
  AnalyticsReport,
  CashClose,
  CashClosePreview,
  CashStatus,
  Credit,
  DailySummary,
  Goal,
  Order,
  ParsedSale,
  ReconciliationReport,
} from "@/lib/types";

type Tab = "caja" | "fiado" | "corte" | "meta" | "pendientes";
type ToastTone = "ok" | "error" | "info";
type TextSize = "normal" | "large" | "xlarge";
type ContrastMode = "normal" | "high";
type VoiceRate = "slow" | "normal" | "fast";

interface Toast {
  tone: ToastTone;
  text: string;
}

interface DashboardData {
  merchant: {
    id: string;
    name: string;
    owner: string;
    receiverName: string;
    receiverMask: string;
    address: string;
  };
  demoMode: boolean;
  summary: DailySummary;
  orders: Order[];
  pendingOrders?: Order[];
  credits: Credit[];
}

interface DraftItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

const DRAFT_STORAGE_KEY = "mercado-cero:draft:v1";
const DRAFT_VERSION = 1;
const PENDING_ORDER_KEY = "mercado-cero:pending-order:v1";
const PENDING_ORDER_VERSION = 1;

interface StoredDraft {
  version: number;
  items: DraftItem[];
  cashCents: number;
  creditCents: number;
  customerName: string;
  textInput: string;
  transcript: string;
  updatedAt: string;
}

interface StoredPendingOrder {
  version: number;
  orderId: string;
  updatedAt: string;
}

interface DraftItemError {
  message: string;
  field: "description" | "quantity" | "price";
}

interface DraftContent {
  items: DraftItem[];
  cashCents: number;
  creditCents: number;
  customerName: string;
  textInput: string;
  transcript: string;
}

interface OrderChange {
  orderId: string;
  cents: number;
}

interface VerifyResult {
  verified: boolean;
  reason?: string;
  message?: string;
  amountCents?: number;
  method?: string;
  orderId?: string;
  source?: string;
  transactionId?: string;
}

interface CreditPayResponse {
  credit?: Credit;
  appliedCents?: number;
  balanceCents?: number;
  overpayCents?: number;
  duplicate?: boolean;
  error?: string;
  code?: string;
}

const SAMPLE_PHRASES = [
  "Dos quesadillas de 35 y un agua de 20",
  "Juan me pagó 50 del fiado",
  "¿Cuánto vendí hoy?",
];

const SAMPLE_LABELS: Record<string, string> = {
  "Dos quesadillas de 35 y un agua de 20": "Quesadillas $90",
  "Juan me pagó 50 del fiado": "Juan pagó $50",
  "¿Cuánto vendí hoy?": "¿Cuánto vendí?",
};

// Frases fijas del demo, pre-renderizadas con Kokoro (Apache 2.0, voz em_santa).
// Si el texto no está aquí, /api/tts usa Piper (es_MX-claude-high).
// El ?v= invalida audios viejos que quedaron en la caché del navegador.
const TTS_FILES: Record<string, string> = {
  "Escuché 90.00 pesos. ¿Confirmas?": "/tts/son-90-genero-el-cobro.wav?v=2",
  "Venta cobrada. $90.00.": "/tts/venta-cobrada-90.wav?v=2",
  "Pago simulado. $90.00.": "/tts/pago-simulado-90.wav?v=2",
  "Pago verificado: $90.00.": "/tts/pago-verificado-90.wav?v=2",
  "Abono de $50.00 a Juan. Saldo: $0.00.": "/tts/abono-50-juan.wav?v=2",
  "Revisa el abono de $50.00 a Juan.": "/tts/revisa-abono-50-juan.wav?v=2",
  "Venta lista para confirmar.": "/tts/venta-lista.wav?v=2",
  "Comprobante verificado en la caja. En producción se valida contra pey.":
    "/tts/comprobante-verificado-demo.wav?v=2",
  "Ese comprobante no está verificado. No entregues el pedido.":
    "/tts/comprobante-no-verificado.wav?v=2",
};

function parseMoney(value: string): number {
  const clean = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const amount = Number(clean);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/**
 * Dinero mientras se teclea: el texto crudo manda. El campo se formatea a dos
 * decimales al salir, nunca en cada tecla (teclear 35 no debe dejar 0.01).
 */
function parseMoneyInput(value: string): number {
  const clean = value.trim().replace(",", ".");
  if (!clean) return 0;
  const amount = Number(clean);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function formatMoneyInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^\d*(?:[.,]\d*)?$/.test(trimmed) || trimmed === "." || trimmed === ",") {
    return value;
  }
  const amount = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(amount)) return value;
  return Math.max(0, amount).toFixed(2);
}

function countText(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const dayKeyFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
});

function formatDayKey(key: string): string {
  const date = new Date(`${key}T12:00:00-06:00`);
  if (Number.isNaN(date.getTime())) return key;
  return dayKeyFormatter.format(date).replace(/\.$/, "");
}

function friendlyError(error: unknown, fallback: string): string {
  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))
  ) {
    return `${fallback} Revisa tu conexión e intenta de nuevo.`;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

async function readJsonBody<T>(response: Response): Promise<T | null> {
  // Un 500 puede devolver texto plano; nunca exponemos el cuerpo crudo.
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function draftSignature(content: DraftContent): string {
  return JSON.stringify({
    items: content.items.map(({ id, description, quantity, unitPriceCents }) => ({
      id,
      description,
      quantity,
      unitPriceCents,
    })),
    cashCents: content.cashCents,
    creditCents: content.creditCents,
    customerName: content.customerName,
    textInput: content.textInput,
    transcript: content.transcript,
  });
}

function hasDraftContent(content: DraftContent): boolean {
  return (
    content.items.length > 0 ||
    content.cashCents > 0 ||
    content.creditCents > 0 ||
    content.customerName.trim().length > 0 ||
    content.textInput.trim().length > 0 ||
    content.transcript.trim().length > 0
  );
}

function safeCents(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

function newDraftItemId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function newRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function newCreditPayRequestId(): string {
  return newRequestId("cp");
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsName(text: string, name: string): boolean {
  const target = normalizeName(name);
  if (!target) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(target)}([^a-z0-9]|$)`);
  return pattern.test(normalizeName(text));
}

/**
 * Un abono por voz solo puede prellenar una hoja. Si el nombre del parser
 * coincide con más de un crédito abierto, no se elige uno al azar.
 */
function findOpenCreditCandidates(
  credits: Credit[],
  parsedName: string | null,
  transcript: string,
): Credit[] {
  const open = credits.filter(
    (credit) => credit.status !== "settled" && credit.balanceCents > 0,
  );
  const parserName = parsedName?.trim();
  if (parserName) {
    const target = normalizeName(parserName);
    return open.filter((credit) => normalizeName(credit.customerName ?? "") === target);
  }
  // Sin nombre del parser, solo aceptamos una mención completa en la frase.
  return open.filter((credit) =>
    credit.customerName ? mentionsName(transcript, credit.customerName) : false,
  );
}

function creditForOrder(order: Order, credits: Credit[]): Credit | null {
  if (!order.creditId) return null;
  return credits.find((credit) => credit.id === order.creditId) ?? null;
}

function isCreditSettled(credit: Credit | null): boolean {
  return Boolean(credit && (credit.status === "settled" || credit.balanceCents <= 0));
}

function readStoredDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (parsed.version !== DRAFT_VERSION || !Array.isArray(parsed.items)) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    const items = parsed.items
      .filter((item): item is DraftItem => Boolean(item) && typeof item === "object")
      .map((item) => ({
        id: typeof item.id === "string" && item.id ? item.id : newDraftItemId(),
        description: typeof item.description === "string" ? item.description : "",
        quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0,
        unitPriceCents: Number.isFinite(Number(item.unitPriceCents))
          ? Math.max(0, Math.round(Number(item.unitPriceCents)))
          : 0,
      }));
    const hasItems = items.length > 0;
    const content: DraftContent = {
      items,
      // Un draft sin productos no es pagable: nunca restauramos dinero suelto.
      cashCents: hasItems ? safeCents(parsed.cashCents) : 0,
      creditCents: hasItems ? safeCents(parsed.creditCents) : 0,
      customerName:
        hasItems && typeof parsed.customerName === "string" ? parsed.customerName : "",
      textInput: typeof parsed.textInput === "string" ? parsed.textInput : "",
      transcript: typeof parsed.transcript === "string" ? parsed.transcript : "",
    };
    if (!hasDraftContent(content)) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    const updatedAt =
      typeof parsed.updatedAt === "string" && !Number.isNaN(Date.parse(parsed.updatedAt))
        ? parsed.updatedAt
        : new Date().toISOString();
    return { version: DRAFT_VERSION, ...content, updatedAt };
  } catch {
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Sin almacenamiento no hay nada que limpiar.
    }
    return null;
  }
}

function readStoredPendingOrder(): StoredPendingOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPendingOrder>;
    if (
      parsed.version !== PENDING_ORDER_VERSION ||
      typeof parsed.orderId !== "string" ||
      !parsed.orderId
    ) {
      window.localStorage.removeItem(PENDING_ORDER_KEY);
      return null;
    }
    const updatedAt =
      typeof parsed.updatedAt === "string" && !Number.isNaN(Date.parse(parsed.updatedAt))
        ? parsed.updatedAt
        : new Date().toISOString();
    return { version: PENDING_ORDER_VERSION, orderId: parsed.orderId, updatedAt };
  } catch {
    try {
      window.localStorage.removeItem(PENDING_ORDER_KEY);
    } catch {
      // Sin almacenamiento no hay nada que limpiar.
    }
    return null;
  }
}

function writeStoredPendingOrder(orderId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PENDING_ORDER_KEY,
      JSON.stringify({
        version: PENDING_ORDER_VERSION,
        orderId,
        updatedAt: new Date().toISOString(),
      } satisfies StoredPendingOrder),
    );
  } catch {
    // Sin almacenamiento local, el cobro sigue disponible en Actividad.
  }
}

function clearStoredPendingOrder(orderId?: string) {
  if (typeof window === "undefined") return;
  if (orderId) {
    const stored = readStoredPendingOrder();
    if (!stored || stored.orderId !== orderId) return;
  }
  try {
    window.localStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Sin almacenamiento local no hay nada que limpiar.
  }
}

function isPendingOrderStatus(status: Order["status"]): boolean {
  return status === "confirmed" || status === "payment_pending" || status === "partially_paid";
}

function validateDraftItems(items: DraftItem[]): Map<string, DraftItemError> {
  const errors = new Map<string, DraftItemError>();
  for (const item of items) {
    const descriptionIssue = item.description.trim() ? null : "Escribe el producto.";
    const quantityIssue =
      Number.isFinite(item.quantity) && item.quantity > 0
        ? null
        : "La cantidad debe ser mayor a cero.";
    const priceIssue =
      Number.isFinite(item.unitPriceCents) && item.unitPriceCents > 0
        ? null
        : "El precio debe ser mayor a cero.";
    const messages = [descriptionIssue, quantityIssue, priceIssue].filter(Boolean);
    if (messages.length === 0) continue;
    errors.set(item.id, {
      message: messages.join(" "),
      field: descriptionIssue ? "description" : quantityIssue ? "quantity" : "price",
    });
  }
  return errors;
}

function focusDraftField(itemId: string, field: DraftItemError["field"]) {
  window.requestAnimationFrame(() => {
    document.getElementById(`draft-${field}-${itemId}`)?.focus();
  });
}

function restoredDraftLabel(iso: string): string {
  const updated = new Date(iso);
  const now = new Date();
  const sameDay =
    updated.getFullYear() === now.getFullYear() &&
    updated.getMonth() === now.getMonth() &&
    updated.getDate() === now.getDate();
  const time = formatTime(iso);
  if (sameDay) return `Recuperé tu venta de las ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    updated.getFullYear() === yesterday.getFullYear() &&
    updated.getMonth() === yesterday.getMonth() &&
    updated.getDate() === yesterday.getDate();
  if (wasYesterday) return `Recuperé tu venta de ayer a las ${time}`;
  const date = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit" }).format(
    updated,
  );
  return `Recuperé tu venta del ${date} a las ${time}`;
}

export default function CajaApp({ initialDemoMode }: { initialDemoMode: boolean }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [retryingDashboard, setRetryingDashboard] = useState(false);
  const [pendingCheckedAt, setPendingCheckedAt] = useState<string | null>(null);
  const [tasksResetKey, setTasksResetKey] = useState(0);
  const [cashCloseKey, setCashCloseKey] = useState(0);
  const [tab, setTab] = useState<Tab>("caja");
  const [tabWipe, setTabWipe] = useState(0);
  const [today, setToday] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>("normal");
  const [contrast, setContrast] = useState<ContrastMode>("normal");
  const [voiceRate, setVoiceRate] = useState<VoiceRate>("normal");

  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [cashCents, setCashCents] = useState(0);
  const [creditCents, setCreditCents] = useState(0);
  // Texto crudo de los campos de dinero: se formatea recién al salir.
  const [cashInput, setCashInput] = useState("");
  const [creditInput, setCreditInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [itemErrors, setItemErrors] = useState<Record<string, DraftItemError>>({});
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [resumableOrder, setResumableOrder] = useState<Order | null>(null);
  const [lastChange, setLastChange] = useState<OrderChange | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"link" | "qr">("link");

  const [paidOverlay, setPaidOverlay] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [creditPayId, setCreditPayId] = useState<string | null>(null);
  const [creditPayAmount, setCreditPayAmount] = useState("");
  const [creditPayInitialAmount, setCreditPayInitialAmount] = useState("");
  const [creditPayMethod, setCreditPayMethod] = useState<
    "cash" | "codi" | "card" | null
  >(null);
  const [creditPayInitialMethod, setCreditPayInitialMethod] = useState<
    "cash" | "codi" | "card" | null
  >(null);
  const [creditPayNote, setCreditPayNote] = useState("");
  const [creditPayError, setCreditPayError] = useState<string | null>(null);
  const [creditPayNotice, setCreditPayNotice] = useState<string | null>(null);
  const [creditPayRequestId, setCreditPayRequestId] = useState<string | null>(null);
  const [creditPaying, setCreditPaying] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const scrollPositions = useRef<Record<Tab, number>>({
    caja: 0,
    fiado: 0,
    corte: 0,
    meta: 0,
    pendientes: 0,
  });

  const lastSavedDraftRef = useRef("");
  const restoredDraftSignatureRef = useRef<string | null>(null);
  const creditPayLockRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const keyboardTabRef = useRef(false);
  const dashboardAbortRef = useRef<AbortController | null>(null);
  const dashboardInFlightRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const speechIdRef = useRef(0);
  const lastSpeechRef = useRef({ text: "", at: 0 });
  const mutedRef = useRef(muted);
  const voiceRateRef = useRef(
    voiceRate === "slow" ? 0.85 : voiceRate === "fast" ? 1.15 : 1,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const showToast = useCallback((tone: ToastTone, text: string) => {
    setToast({ tone, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToast(null);
    }, 3000);
  }, []);

  const changeCashInput = useCallback((value: string) => {
    setCashInput(value);
    setCashCents(parseMoneyInput(value));
  }, []);

  const blurCashInput = useCallback((value: string) => {
    setCashInput(formatMoneyInput(value));
    setCashCents(parseMoneyInput(value));
  }, []);

  const changeCreditInput = useCallback((value: string) => {
    setCreditInput(value);
    setCreditCents(parseMoneyInput(value));
  }, []);

  const blurCreditInput = useCallback((value: string) => {
    setCreditInput(formatMoneyInput(value));
    setCreditCents(parseMoneyInput(value));
  }, []);

  const loadDashboard = useCallback(
    async (options?: { broadcast?: boolean; force?: boolean }) => {
    const broadcast = options?.broadcast ?? true;
    // El refresco de fondo y el montaje se deduplican. Una mutación o un
    // reintento usan `force` y abortan la lectura vieja: su respuesta no puede
    // pisar el saldo que se acaba de cobrar.
    if (!options?.force && dashboardInFlightRef.current) return;
    if (options?.force) dashboardAbortRef.current?.abort();
    dashboardInFlightRef.current = true;
    const controller = new AbortController();
    dashboardAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 20_000);
    try {
      const response = await fetch("/api/dashboard", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        let detail = "";
        try {
          const body = (await response.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // Un 500 puede no traer JSON; no exponemos el cuerpo crudo.
        }
        throw new Error(detail || "No se pudo cargar la caja.");
      }
      const data = (await response.json()) as DashboardData;
      if (controller.signal.aborted) return;
      setDashboard(data);
      setDashboardError(null);
      setPendingCheckedAt(new Date().toISOString());
      // El refresco de fondo no debe reiniciar el conteo del corte ni otros
      // formularios: solo las mutaciones avisan a las demás superficies.
      if (broadcast) window.dispatchEvent(new Event("mercado:refresh"));
    } catch (error) {
      if (controller.signal.aborted) {
        if (controller.signal.reason === "timeout") {
          setDashboardError("La carga tardó demasiado. Revisa tu conexión y reintenta.");
        }
        return;
      }
      // El fallo se queda en un banner persistente; no hay reintento automático.
      setDashboardError(
        friendlyError(error, "No se pudo cargar la caja. No hay cifras nuevas para mostrar."),
      );
      // No borramos `dashboard`: los pendientes y su última comprobación siguen
      // visibles. El banner global es el único que ofrece Reintentar.
    } finally {
      window.clearTimeout(timeout);
      if (dashboardAbortRef.current === controller) {
        dashboardAbortRef.current = null;
        dashboardInFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      dashboardAbortRef.current?.abort();
      dashboardAbortRef.current = null;
      dashboardInFlightRef.current = false;
    };
  }, []);

  const retryDashboard = useCallback(async () => {
    setRetryingDashboard(true);
    try {
      await loadDashboard({ force: true });
    } finally {
      setRetryingDashboard(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    // La fecha se calcula después del montaje para no romper la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(formatLongDate());
    try {
      setMuted(window.localStorage.getItem("mercado-cero:muted") === "1");
      const storedSize = window.localStorage.getItem(
        "mercado-cero:text-size",
      ) as TextSize | null;
      if (storedSize === "large" || storedSize === "xlarge") {
        setTextSize(storedSize);
      }
      if (window.localStorage.getItem("mercado-cero:contrast") === "high") {
        setContrast("high");
      }
      const storedRate = window.localStorage.getItem(
        "mercado-cero:voice-rate",
      ) as VoiceRate | null;
      if (storedRate === "slow" || storedRate === "fast") {
        setVoiceRate(storedRate);
      }
    } catch {
      // Sin almacenamiento local, la voz queda activa.
    }
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    // Refresco al volver a la pestaña y polling ligero solo mientras es visible.
    // No abre hojas ni toca el borrador: una venta o un cobro en curso siguen.
    let pollTimer: number | null = null;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void loadDashboard({ broadcast: false });
      }
    };
    const stopPolling = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const startPolling = () => {
      if (pollTimer !== null || document.visibilityState !== "visible") return;
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void loadDashboard({ broadcast: false });
        }
      }, 45_000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshIfVisible();
        startPolling();
      } else {
        stopPolling();
      }
    };
    const onFocus = () => refreshIfVisible();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    startPolling();
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadDashboard]);

  useEffect(() => {
    // El borrador se restaura después del montaje para no romper la hidratación.
    const stored = readStoredDraft();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftItems(stored.items);
      setCashCents(stored.cashCents);
      setCreditCents(stored.creditCents);
      setCashInput(stored.cashCents > 0 ? (stored.cashCents / 100).toFixed(2) : "");
      setCreditInput(stored.creditCents > 0 ? (stored.creditCents / 100).toFixed(2) : "");
      setCustomerName(stored.customerName);
      setTextInput(stored.textInput);
      setTranscript(stored.transcript);
      setRestoredDraftAt(stored.items.length > 0 ? stored.updatedAt : null);
      restoredDraftSignatureRef.current = draftSignature(stored);
      lastSavedDraftRef.current = draftSignature(stored);
    } else {
      lastSavedDraftRef.current = draftSignature({
        items: [],
        cashCents: 0,
        creditCents: 0,
        customerName: "",
        textInput: "",
        transcript: "",
      });
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const hasItems = draftItems.length > 0;
    const content: DraftContent = {
      items: draftItems,
      // Un draft sin productos nunca guarda dinero ni cliente: no es pagable.
      cashCents: hasItems ? cashCents : 0,
      creditCents: hasItems ? creditCents : 0,
      customerName: hasItems ? customerName : "",
      textInput,
      transcript,
    };
    const signature = draftSignature(content);
    if (signature === lastSavedDraftRef.current) return;
    lastSavedDraftRef.current = signature;
    try {
      if (!hasDraftContent(content)) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            version: DRAFT_VERSION,
            ...content,
            updatedAt: new Date().toISOString(),
          } satisfies StoredDraft),
        );
      }
    } catch {
      // Sin almacenamiento local, la venta sigue en memoria.
    }
  }, [draftReady, draftItems, cashCents, creditCents, customerName, textInput, transcript]);

  useEffect(() => {
    // Reabre el pendiente solo como aviso; nunca abre el cobro ni crea órdenes.
    const stored = readStoredPendingOrder();
    if (!stored) return;
    let cancelled = false;
    const restore = async () => {
      try {
        const response = await fetch(`/api/orders/${stored.orderId}`, { cache: "no-store" });
        if (response.status === 404) {
          clearStoredPendingOrder(stored.orderId);
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as { order?: Order };
        const order = data.order;
        if (!order) {
          clearStoredPendingOrder(stored.orderId);
          return;
        }
        if (!isPendingOrderStatus(order.status)) {
          clearStoredPendingOrder(stored.orderId);
          if (!cancelled) {
            showToast(
              "info",
              order.status === "paid" ||
                order.status === "demo_paid" ||
                order.status === "fulfilled"
                ? "Ese cobro ya se pagó."
                : "Ese cobro ya no está pendiente.",
            );
          }
          return;
        }
        if (!cancelled) setResumableOrder(order);
      } catch {
        // Sin red, el aviso se reintenta al volver a abrir la caja.
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (!dashboard) return;

    // El fiado se saldó en otra pestaña o terminal: no cerramos la hoja en
    // silencio ni dejamos que el abono se intente contra un saldo que ya no existe.
    if (creditPayId && !creditPaying) {
      const credit = dashboard.credits.find((item) => item.id === creditPayId);
      const alreadySettled =
        !credit || credit.status === "settled" || credit.balanceCents <= 0;
      if (alreadySettled) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setCreditPayId(null);
        setCreditPayAmount("");
        setCreditPayInitialAmount("");
        setCreditPayInitialMethod(null);
        setCreditPayRequestId(null);
        setCreditPayError(null);
        setCreditPayNotice("Ese fiado ya está saldado. No se registró nada.");
        /* eslint-enable react-hooks/set-state-in-effect */
        showToast("info", "Ese fiado ya está saldado. No se registró nada.");
      }
    }

    // El aviso de cobro pendiente puede quedar viejo si la orden se pagó en
    // otra pestaña. Se limpia el aviso y la llave local; no se reabre la hoja.
    if (resumableOrder) {
      const order = dashboard.orders.find((item) => item.id === resumableOrder.id);
      if (order && !isPendingOrderStatus(order.status)) {
        clearStoredPendingOrder(order.id);
        setResumableOrder(null);
        showToast(
          "info",
          order.status === "paid" ||
            order.status === "demo_paid" ||
            order.status === "fulfilled"
            ? "Ese cobro ya se pagó."
            : "Ese cobro ya no está pendiente.",
        );
      }
    }
  }, [creditPayId, creditPaying, dashboard, resumableOrder, showToast]);

  const activeOrderId = activeOrder?.id;
  const activeOrderStatus = activeOrder?.status;

  useEffect(() => {
    if (!activeOrderId || !activeOrderStatus) return;
    if (isPendingOrderStatus(activeOrderStatus)) {
      writeStoredPendingOrder(activeOrderId);
    } else {
      clearStoredPendingOrder(activeOrderId);
    }
  }, [activeOrderId, activeOrderStatus]);

  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
    try {
      window.localStorage.setItem("mercado-cero:text-size", textSize);
    } catch {
      // La preferencia no es esencial.
    }
  }, [textSize]);

  useEffect(() => {
    document.documentElement.dataset.contrast = contrast;
    try {
      window.localStorage.setItem("mercado-cero:contrast", contrast);
    } catch {
      // La preferencia no es esencial.
    }
  }, [contrast]);

  useEffect(() => {
    voiceRateRef.current =
      voiceRate === "slow" ? 0.85 : voiceRate === "fast" ? 1.15 : 1;
    try {
      window.localStorage.setItem("mercado-cero:voice-rate", voiceRate);
    } catch {
      // La preferencia no es esencial.
    }
  }, [voiceRate]);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("mercado-cero:muted", next ? "1" : "0");
      } catch {
        // La preferencia no es esencial.
      }
      if (next && "speechSynthesis" in window) window.speechSynthesis.cancel();
      return next;
    });
  }, []);

  const selectTab = useCallback(
    (next: Tab, viaKeyboard = false) => {
      scrollPositions.current[tab] = window.scrollY;
      keyboardTabRef.current = viaKeyboard;
      setToast(null);
      if (next !== tab) setTabWipe((key) => key + 1);
      setTab(next);
    },
    [tab],
  );

  useEffect(() => {
    // Al volver a un tab con scroll guardado conservamos la posición solo si
    // la activación fue con puntero. Con teclado vamos arriba y enfocamos el
    // título: el foco nunca queda 800 px fuera de la pantalla.
    const restore = keyboardTabRef.current ? 0 : (scrollPositions.current[tab] ?? 0);
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(0, restore);
      if (keyboardTabRef.current) {
        document.getElementById(TAB_HEADINGS[tab])?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

  useEffect(() => {
    // El chrome fijo se mide de verdad: `scroll-padding` no puede adivinar el
    // alto de la tab bar cuando la raíz tipográfica crece al 200 %.
    const header = document.querySelector<HTMLElement>(".topbar");
    const tabs = document.querySelector<HTMLElement>(".mobile-tabs");
    const syncChrome = () => {
      const root = document.documentElement;
      root.style.setProperty(
        "--mc-chrome-top",
        `${Math.round(header?.getBoundingClientRect().height ?? 0)}px`,
      );
      const tabsVisible = tabs && getComputedStyle(tabs).display !== "none";
      root.style.setProperty(
        "--mc-chrome-bottom",
        `${tabsVisible ? Math.round(tabs.getBoundingClientRect().height) : 0}px`,
      );
    };
    syncChrome();
    const observer = new ResizeObserver(syncChrome);
    if (header) observer.observe(header);
    if (tabs) observer.observe(tabs);
    window.addEventListener("resize", syncChrome);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncChrome);
    };
  }, []);

  useEffect(() => {
    // Red de seguridad: el barrido debe desaparecer aunque `animationend` no
    // llegue (pestaña en segundo plano, reduced motion, animación cancelada).
    if (!tabWipe) return;
    const timer = window.setTimeout(() => setTabWipe(0), 1000);
    return () => window.clearTimeout(timer);
  }, [tabWipe]);

  useEffect(() => {
    // Al abrir otro pedido, el error de entrega anterior deja de aplicar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeliverError(null);
  }, [activeOrder?.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audioRef.current = null;
  }, []);

  const playAudio = useCallback(
    (src: string) => {
      window.speechSynthesis?.cancel();
      stopAudio();
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.playbackRate = voiceRateRef.current;
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
      };
      // Si el audio elegido no se puede reproducir, no caemos a la voz del
      // navegador: el texto sigue en pantalla. Nunca una voz distinta.
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
      };
      void audio.play().catch(() => {
        if (audioRef.current === audio) audioRef.current = null;
      });
    },
    [stopAudio],
  );

  const speakPiper = useCallback(
    async (text: string, speechId: number) => {
      const cached = audioCacheRef.current.get(text);
      if (cached) {
        playAudio(cached);
        return;
      }

      ttsAbortRef.current?.abort();
      const controller = new AbortController();
      ttsAbortRef.current = controller;
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("No se pudo generar la voz.");
        const blob = await response.blob();
        if (
          speechIdRef.current !== speechId ||
          mutedRef.current ||
          document.hidden
        ) {
          return;
        }
        const url = URL.createObjectURL(blob);
        audioCacheRef.current.set(text, url);
        playAudio(url);
      } catch (error) {
        if (controller.signal.aborted) return;
        // Sin fallback al navegador: preferimos silencio y texto en pantalla.
        console.warn("[tts] no se pudo reproducir la voz", error);
      }
    },
    [playAudio],
  );

  const speak = useCallback(
    (text: string, force = false) => {
      if (mutedRef.current) return;
      if (typeof window === "undefined") return;
      if (typeof document !== "undefined" && document.hidden) return;

      const now = Date.now();
      if (
        !force &&
        lastSpeechRef.current.text === text &&
        now - lastSpeechRef.current.at < 8000
      ) {
        return;
      }
      lastSpeechRef.current = { text, at: now };

      const speechId = ++speechIdRef.current;
      ttsAbortRef.current?.abort();

      const file = TTS_FILES[text];
      if (file) {
        playAudio(file);
        return;
      }

      void speakPiper(text, speechId);
    },
    [playAudio, speakPiper],
  );

  const readScreen = useCallback(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const parts = Array.from(
      main.querySelectorAll<HTMLElement>("h1, h2, [role='status'], [role='alert']"),
    )
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => element.innerText.trim())
      .filter(Boolean);
    const text = Array.from(new Set(parts)).join(". ").slice(0, 700);
    speak(text || "No hay texto para leer en esta pantalla.", true);
  }, [speak]);

  const repeatLast = useCallback(() => {
    speak(lastSpeechRef.current.text || "Todavía no he dicho nada.", true);
  }, [speak]);

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // La vibración no está disponible en este dispositivo.
    }
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted) {
      speechIdRef.current += 1;
      ttsAbortRef.current?.abort();
      stopAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [muted, stopAudio]);

  useEffect(() => {
    const stopSpeech = () => {
      speechIdRef.current += 1;
      ttsAbortRef.current?.abort();
      stopAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
    const onVisibility = () => {
      if (document.hidden) stopSpeech();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", stopSpeech);
    return () => {
      stopSpeech();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", stopSpeech);
    };
  }, [stopAudio]);

  const playChime = useCallback(() => {
    if (muted) return;
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    const context = new AudioContext();
    const now = context.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = now + index * 0.11;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.55);
    });
    window.setTimeout(() => void context.close(), 1200);
  }, [muted]);

  const answerLocal = useCallback(
    (text: string) => {
      if (!dashboard) return "Todavía no tengo el corte de hoy.";
      // Consultas de fiado: suma todas las deudas abiertas del cliente, no la
      // primera. Módulo puro, sin OpenAI.
      const debt = answerDebtQuery(text, dashboard.credits);
      if (debt) return debt.answer;
      const lower = text.toLowerCase();
      const credit = dashboard.credits.find(
        (item) =>
          item.status !== "settled" &&
          item.customerName &&
          lower.includes(item.customerName.toLowerCase()),
      );
      if (credit?.customerName) {
        return `${credit.customerName} te debe ${formatMxn(credit.balanceCents)}.`;
      }
      if (/(fiado|deben|deuda)/.test(lower)) {
        return `En fiado tienes ${formatMxn(dashboard.summary.creditCents)} pendientes.`;
      }
      if (/(pendiente|por cobrar|esperando)/.test(lower)) {
        return `Tienes ${formatMxn(dashboard.summary.pendingCents)} esperando confirmación.`;
      }
      const total =
        dashboard.summary.verifiedDigitalCents +
        dashboard.summary.demoDigitalCents +
        dashboard.summary.cashCents;
      const detail =
        dashboard.summary.demoDigitalCents > 0
          ? `${formatMxn(dashboard.summary.verifiedDigitalCents)} verificados por pey, ${formatMxn(
              dashboard.summary.demoDigitalCents,
            )} en demo y ${formatMxn(dashboard.summary.cashCents)} en efectivo.`
          : `${formatMxn(dashboard.summary.verifiedDigitalCents)} digitales verificados y ${formatMxn(
              dashboard.summary.cashCents,
            )} en efectivo.`;
      return `Hoy llevas ${formatMxn(total)} en ${countText(dashboard.summary.paidOrderCount, "venta", "ventas")}. ${detail}`;
    },
    [dashboard],
  );

  const openCreditPay = useCallback(
    (
      credit: Credit,
      amountCents?: number,
      method?: "cash" | "codi" | "card" | null,
    ) => {
      const cents = Math.max(0, Math.round(amountCents ?? credit.balanceCents));
      const amount = (cents / 100).toFixed(2);
      setCreditPayId(credit.id);
      setCreditPayAmount(amount);
      setCreditPayInitialAmount(amount);
      setCreditPayRequestId(newCreditPayRequestId());
      setCreditPayNotice(null);
      // Sin señal en la frase no se asume efectivo: la hoja exige elegir.
      setCreditPayMethod(method ?? null);
      setCreditPayInitialMethod(method ?? null);
      setCreditPayNote("");
      setCreditPayError(null);
    },
    [],
  );

  const interpretText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      setVoiceError(null);
      setTranscript(clean);
      setTranscribing(true);
      try {
        const response = await fetch("/api/voice/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: clean }),
        });
        const parsed = (await response.json()) as ParsedSale & { error?: string };
        if (!response.ok) throw new Error(parsed.error ?? "No pude interpretar la venta.");

        if (parsed.intent === "query") {
          const answer = answerLocal(clean);
          setTranscript(`${clean}\n\n${answer}`);
          speak(answer);
          return;
        }

        if (parsed.intent === "credit_payment") {
          if (parsed.creditCents <= 0) {
            setVoiceError("Dime el monto del abono. No registré nada.");
            return;
          }
          const candidates = findOpenCreditCandidates(
            dashboard?.credits ?? [],
            parsed.customerName,
            clean,
          );
          if (candidates.length === 0) {
            setVoiceError("No encontré un fiado abierto con ese nombre. No registré nada.");
            return;
          }
          if (candidates.length > 1) {
            const name = candidates[0]?.customerName ?? parsed.customerName ?? "Ese cliente";
            setVoiceError(
              `${name} tiene ${candidates.length} fiados abiertos. Elige la deuda en Fiado; no registré nada.`,
            );
            return;
          }
          const credit = candidates[0];
          // La voz solo propone: el POST ocurre al pulsar "Registrar abono".
          openCreditPay(credit, parsed.creditCents, parsed.creditMethod);
          const message = `Revisa el abono de ${formatMxn(parsed.creditCents)} a ${
            credit.customerName ?? "el cliente"
          }. Todavía no se registra.`;
          setTranscript(`${clean}\n\n${message}`);
          speak(
            `Revisa el abono de ${formatMxn(parsed.creditCents)} a ${
              credit.customerName ?? "el cliente"
            }.`,
          );
          return;
        }

        if (parsed.intent === "sale" && parsed.items.length > 0) {
          setDraftItems(
            parsed.items.map((item, index) => ({
              id: `draft_${Date.now()}_${index}`,
              description: item.description,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
            })),
          );
          setCashCents(parsed.cashCents);
          setCreditCents(parsed.creditCents);
          setCashInput(parsed.cashCents > 0 ? (parsed.cashCents / 100).toFixed(2) : "");
          setCreditInput(parsed.creditCents > 0 ? (parsed.creditCents / 100).toFixed(2) : "");
          setCustomerName(parsed.customerName ?? "");
          setTranscript(clean);
          // El parseo nuevo reemplaza al borrador recuperado: su banner ya no aplica.
          setRestoredDraftAt(null);
          setItemErrors({});
          setSaleError(null);
          setTab("caja");
          window.setTimeout(() => {
            document.getElementById("pedido")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 120);
          const message = parsed.reply || "Venta lista para confirmar.";
          speak(message);
          return;
        }

        setVoiceError(parsed.reply || "No entendí la venta. Intenta de nuevo.");
      } catch (error) {
        setVoiceError(error instanceof Error ? error.message : "No pude interpretar la venta.");
      } finally {
        setTranscribing(false);
      }
    },
    [answerLocal, dashboard, openCreditPay, speak],
  );

  const startRecording = useCallback(async () => {
    if (listening || transcribing) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Este navegador no tiene acceso al micrófono. Escribe la venta.");
      setShowTextInput(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (blob.size < 900) {
          setVoiceError("El audio salió vacío. Mantén presionado un poco más.");
          return;
        }
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "venta.webm");
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = (await response.json()) as { text?: string; error?: string };
          if (!response.ok || !data.text) throw new Error(data.error ?? "No pude transcribir el audio.");
          await interpretText(data.text);
        } catch (error) {
          setVoiceError(
            error instanceof Error
              ? `${error.message} Puedes escribir la venta abajo.`
              : "No pude transcribir el audio.",
          );
          setShowTextInput(true);
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      vibrate(20);
      mediaRecorderRef.current = recorder;
      setListening(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch {
      setVoiceError("No pude acceder al micrófono. Revisa los permisos o escribe la venta.");
      setShowTextInput(true);
    }
  }, [interpretText, listening, transcribing, vibrate]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    vibrate([12, 35, 12]);
    mediaRecorderRef.current = null;
    setListening(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [vibrate]);

  const draftTotal = useMemo(
    () =>
      draftItems.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const price = Number(item.unitPriceCents);
        if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
          return sum;
        }
        return sum + Math.round(quantity * price);
      }, 0),
    [draftItems],
  );
  const appliedCreditCents = Math.min(Math.max(0, creditCents), draftTotal);
  const appliedCashCents = Math.min(
    Math.max(0, cashCents),
    Math.max(0, draftTotal - appliedCreditCents),
  );
  const changeCents = Math.max(0, cashCents - appliedCashCents);
  const digitalDue = Math.max(0, draftTotal - appliedCashCents - appliedCreditCents);
  // El exceso de efectivo no bloquea: se devuelve como cambio. El fiado sí debe
  // caber dentro del total para no crear un crédito mayor que la venta.
  const overpay = creditCents > draftTotal;

  const clearDraft = useCallback(() => {
    setDraftItems([]);
    setCashCents(0);
    setCreditCents(0);
    setCashInput("");
    setCreditInput("");
    setCustomerName("");
    setTextInput("");
    setTranscript("");
    setItemErrors({});
    setSaleError(null);
    setVoiceError(null);
    setRestoredDraftAt(null);
    lastSavedDraftRef.current = draftSignature({
      items: [],
      cashCents: 0,
      creditCents: 0,
      customerName: "",
      textInput: "",
      transcript: "",
    });
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Sin almacenamiento local no hay borrador que limpiar.
    }
  }, []);

  const updateDraftItems = useCallback((items: DraftItem[]) => {
    setDraftItems(items);
    setItemErrors({});
    if (items.length === 0) {
      setCashCents(0);
      setCreditCents(0);
      setCashInput("");
      setCreditInput("");
      setCustomerName("");
      setRestoredDraftAt(null);
    }
  }, []);

  const discardRestoredDraft = useCallback(() => {
    const currentSignature = draftSignature({
      items: draftItems,
      cashCents,
      creditCents,
      customerName,
      textInput,
      transcript,
    });
    if (
      restoredDraftSignatureRef.current &&
      currentSignature !== restoredDraftSignatureRef.current
    ) {
      // La venta ya no es la recuperada: no la borramos desde un banner viejo.
      setRestoredDraftAt(null);
      showToast("info", "La venta cambió. Revisa y usa Limpiar si quieres descartarla.");
      return;
    }
    restoredDraftSignatureRef.current = null;
    clearDraft();
    window.requestAnimationFrame(() => {
      document.getElementById("draft-add-empty")?.focus();
    });
  }, [cashCents, clearDraft, creditCents, customerName, draftItems, showToast, textInput, transcript]);

  const keepRestoredDraft = useCallback(() => {
    restoredDraftSignatureRef.current = null;
    setRestoredDraftAt(null);
    const firstItem = draftItems[0];
    window.requestAnimationFrame(() => {
      const target = firstItem
        ? document.getElementById(`draft-description-${firstItem.id}`)
        : document.getElementById("draft-add-empty");
      target?.focus();
    });
  }, [draftItems]);

  const clearResumableIfMatches = useCallback((orderId: string) => {
    setResumableOrder((current) => (current?.id === orderId ? null : current));
  }, []);

  useEffect(() => {
    // Al corregir la venta, el error inline deja de aplicar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaleError(null);
  }, [draftItems, cashCents, creditCents, customerName]);

  const createOrder = useCallback(async () => {
    setSaleError(null);
    if (draftItems.length === 0) {
      setSaleError("Agrega al menos un producto.");
      return;
    }

    const issues = validateDraftItems(draftItems);
    if (issues.size > 0) {
      setItemErrors(Object.fromEntries(issues));
      setSaleError("Revisa los productos marcados.");
      const firstItem = draftItems.find((item) => issues.has(item.id));
      const issue = firstItem ? issues.get(firstItem.id) : undefined;
      if (firstItem && issue) focusDraftField(firstItem.id, issue.field);
      return;
    }

    if (overpay) {
      setSaleError("El fiado no puede superar el total de la venta.");
      window.requestAnimationFrame(() => {
        document.getElementById("fiado-amount")?.focus();
      });
      return;
    }

    if (creditCents > 0 && !customerName.trim()) {
      setSaleError("Para fiado necesito el nombre del cliente.");
      window.requestAnimationFrame(() => {
        document.getElementById("fiado-customer")?.focus();
      });
      return;
    }

    setSavingOrder(true);
    const changeForOrder = changeCents;
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: draftItems.map(({ description, quantity, unitPriceCents }) => ({
            description: description.trim(),
            quantity,
            unitPriceCents,
          })),
          cashCents: appliedCashCents,
          creditCents: appliedCreditCents,
          customerName: customerName.trim() || null,
        }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error ?? "No pude crear la venta.");

      const order = data.order;
      setLastChange(changeForOrder > 0 ? { orderId: order.id, cents: changeForOrder } : null);
      setActiveOrder(order);
      clearDraft();
      await loadDashboard({ force: true });

      if (order.status === "paid" || order.status === "demo_paid" || order.status === "fulfilled") {
        if (order.status === "paid") {
          clearStoredPendingOrder(order.id);
          clearResumableIfMatches(order.id);
          setActiveOrder(null);
          setDeliverError(null);
          setPaidOverlay(order);
          playChime();
          vibrate([30, 50, 30]);
          speak(`Venta cobrada. ${formatMxn(order.totalCents)}.`);
        } else {
          clearStoredPendingOrder(order.id);
          clearResumableIfMatches(order.id);
          const changeNote = changeForOrder > 0 ? ` Cambio ${formatMxn(changeForOrder)}.` : "";
          showToast(
            "ok",
            `Venta registrada. ${formatMxn(order.creditCents)} quedaron a fiado con ${order.customerName ?? "el cliente"}.${changeNote}`,
          );
        }
      }
    } catch (error) {
      setSaleError(friendlyError(error, "No pude crear la venta."));
    } finally {
      setSavingOrder(false);
    }
  }, [
    appliedCashCents,
    appliedCreditCents,
    changeCents,
    clearDraft,
    clearResumableIfMatches,
    creditCents,
    customerName,
    draftItems,
    loadDashboard,
    overpay,
    playChime,
    showToast,
    speak,
    vibrate,
  ]);

  const generatePayment = useCallback(
    async (mode: "link" | "qr") => {
      if (!activeOrder) return;
      setToast(null);
      setPaymentLoading(true);
      setPaymentMode(mode);
      try {
        const response = await fetch(`/api/orders/${activeOrder.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const data = (await response.json()) as { order?: Order; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error ?? "No pude generar el cobro.");
        setActiveOrder(data.order);
        await loadDashboard({ force: true });
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "No pude generar el cobro.");
      } finally {
        setPaymentLoading(false);
      }
    },
    [activeOrder, loadDashboard, showToast],
  );

  const demoPay = useCallback(
    async (method: "codi" | "card") => {
      if (!activeOrder) return;
      setPaymentLoading(true);
      try {
        const response = await fetch("/api/demo/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: activeOrder.id, method }),
        });
        const data = (await response.json()) as { order?: Order; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error ?? "No pude simular el pago.");
        clearStoredPendingOrder(data.order.id);
        clearResumableIfMatches(data.order.id);
        setActiveOrder(null);
        setDeliverError(null);
        setPaidOverlay(data.order);
        playChime();
        vibrate([30, 50, 30]);
        speak(
          data.order.creditCents > 0
            ? `Pago mixto. ${formatMxn(data.order.digitalPaidCents)} simulados y ${formatMxn(
                data.order.creditCents,
              )} a fiado.`
            : `Pago simulado. ${formatMxn(data.order.totalCents)}.`,
        );
        await loadDashboard({ force: true });
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "No pude simular el pago.");
      } finally {
        setPaymentLoading(false);
      }
    },
    [activeOrder, clearResumableIfMatches, loadDashboard, playChime, showToast, speak, vibrate],
  );

  useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.status === "paid" || activeOrder.status === "fulfilled" || activeOrder.status === "cancelled") {
      return;
    }
    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${activeOrder.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { order: Order };
        // Una respuesta vieja no debe reabrir la hoja después de cobrar.
        if (cancelled) return;
        const order = data.order;
        if (order.status === "paid" || order.status === "demo_paid" || order.status === "fulfilled") {
          clearStoredPendingOrder(order.id);
          clearResumableIfMatches(order.id);
          setActiveOrder(null);
          setDeliverError(null);
          setPaidOverlay(order);
          playChime();
          speak(
            order.creditCents > 0
              ? `Pago mixto. ${formatMxn(order.digitalPaidCents)} ${
                  order.lastPaymentProvider === "pey" ? "verificados" : "simulados"
                } y ${formatMxn(order.creditCents)} a fiado.`
              : order.lastPaymentProvider === "pey"
                ? `Pago verificado: ${formatMxn(order.totalCents)}.`
                : `Pago simulado. ${formatMxn(order.totalCents)}.`,
          );
          await loadDashboard({ force: true });
        } else {
          setActiveOrder(order);
        }
      } catch {
        // El polling se recupera solo en el siguiente intento.
      }
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // El polling solo se reinicia cuando cambia el pedido o su estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id, activeOrder?.status, clearResumableIfMatches, loadDashboard, playChime, speak]);

  const verify = useCallback(
    async (value?: string) => {
      const id = (value ?? verifyId).trim();
      if (!id) {
        setVerifyError("Escribe el ID de la transacción del comprobante.");
        return;
      }
      setVerifyId(id);
      setVerifyError(null);
      setVerifying(true);
      setVerifyResult(null);
      try {
        const response = await fetch(`/api/verify?transactionId=${encodeURIComponent(id)}`);
        const data = (await response.json()) as VerifyResult & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No pude verificar el comprobante.");
        setVerifyResult(data);
        vibrate(data.verified ? 25 : [15, 50, 15]);
        if (data.verified) {
          speak(
            dashboard?.demoMode
              ? "Comprobante verificado en la caja. En producción se valida contra pey."
              : "Comprobante verificado. El dinero sí llegó.",
          );
        } else {
          speak("Ese comprobante no está verificado. No entregues el pedido.");
        }
      } catch (error) {
        setVerifyError(friendlyError(error, "No pude verificar el comprobante."));
      } finally {
        setVerifying(false);
      }
    },
    [dashboard, speak, verifyId, vibrate],
  );

  const payCredit = useCallback(
    async (credit: Credit) => {
      const requested = Math.round(Number(creditPayAmount) * 100);
      if (!Number.isFinite(requested) || requested <= 0) {
        setCreditPayError("Escribe un monto mayor a cero.");
        return;
      }
      if (credit.status === "settled" || credit.balanceCents <= 0) {
        setCreditPayError("Ese fiado ya está saldado. No se registró nada.");
        return;
      }
      if (!creditPayMethod) {
        setCreditPayError("Elige cómo recibiste el abono. No se registró nada.");
        return;
      }
      const requestId = creditPayRequestId;
      if (!requestId) {
        setCreditPayError("Vuelve a abrir la hoja para generar una llave de abono.");
        return;
      }
      if (creditPayLockRef.current) return;
      // Candado síncrono: un doble clic no alcanza a mandar dos POST.
      creditPayLockRef.current = true;
      setCreditPaying(true);
      setCreditPayError(null);
      try {
        const response = await fetch(`/api/credits/${credit.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: requested,
            method: creditPayMethod,
            note: creditPayNote.trim() || undefined,
            requestId,
            expectedBalanceCents: credit.balanceCents,
          }),
        });
        const data = (await response.json()) as CreditPayResponse;
        if (!response.ok) {
          if (response.status === 409) {
            const message = data.error ?? "El saldo cambió. Revisa el monto y confirma de nuevo.";
            setCreditPayError(message);
            showToast("info", message);
            await loadDashboard({ force: true });
            return;
          }
          throw new Error(data.error ?? "No pude registrar el abono.");
        }
        if (
          !data.credit ||
          typeof data.appliedCents !== "number" ||
          typeof data.balanceCents !== "number"
        ) {
          throw new Error("El abono se registró pero no pude leer el saldo nuevo.");
        }
        const appliedCents = data.appliedCents;
        const overpayCents = data.duplicate
          ? 0
          : typeof data.overpayCents === "number"
            ? data.overpayCents
            : Math.max(0, requested - appliedCents);
        const returnedNote =
          !data.duplicate && overpayCents > 0
            ? ` Se aplicaron ${formatMxn(appliedCents)}; devuelve ${formatMxn(overpayCents)}.`
            : "";
        const duplicateNote = data.duplicate
          ? ` Se aplicaron ${formatMxn(appliedCents)}. No se duplicó.`
          : "";
        showToast(
          "ok",
          `${
            data.duplicate
              ? "Abono ya registrado"
              : "Abono registrado"
          }.${returnedNote}${duplicateNote} ${
            credit.customerName ?? "Cliente"
          } debe ${formatMxn(data.balanceCents)}.`,
        );
        setCreditPayId(null);
        setCreditPayAmount("");
        setCreditPayInitialAmount("");
        setCreditPayInitialMethod(null);
        setCreditPayRequestId(null);
        setCreditPayNote("");
        vibrate(30);
        await loadDashboard({ force: true });
      } catch (error) {
        setCreditPayError(friendlyError(error, "No pude registrar el abono."));
      } finally {
        creditPayLockRef.current = false;
        setCreditPaying(false);
      }
    },
    [
      creditPayAmount,
      creditPayMethod,
      creditPayNote,
      creditPayRequestId,
      loadDashboard,
      showToast,
      vibrate,
    ],
  );

  const fulfillOrder = useCallback(
    async (orderId: string | undefined, onDone: () => void) => {
      if (!orderId) return;
      setDelivering(true);
      setDeliverError(null);
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fulfill" }),
        });
        const data = (await response.json()) as { order?: Order; error?: string };
        if (!response.ok || !data.order) {
          throw new Error(data.error ?? "No pude marcar el pedido como entregado.");
        }
        clearStoredPendingOrder(orderId);
        clearResumableIfMatches(orderId);
        onDone();
        await loadDashboard({ force: true });
        showToast("ok", "Pedido entregado.");
      } catch (error) {
        setDeliverError(
          error instanceof Error ? error.message : "No pude marcar el pedido como entregado.",
        );
      } finally {
        setDelivering(false);
      }
    },
    [clearResumableIfMatches, loadDashboard, showToast],
  );

  const deliverOrder = useCallback(
    () => fulfillOrder(paidOverlay?.id, () => setPaidOverlay(null)),
    [fulfillOrder, paidOverlay?.id],
  );

  const deliverActiveOrder = useCallback(
    () => fulfillOrder(activeOrder?.id, () => setActiveOrder(null)),
    [activeOrder?.id, fulfillOrder],
  );

  const closeActiveOrder = useCallback(() => {
    setResumableOrder((current) => {
      if (!activeOrder) return current;
      if (isPendingOrderStatus(activeOrder.status)) return activeOrder;
      return current?.id === activeOrder.id ? null : current;
    });
    setActiveOrder(null);
    setDeliverError(null);
  }, [activeOrder]);

  const resumePendingOrder = useCallback(() => {
    if (!resumableOrder) return;
    setActiveOrder(resumableOrder);
    setResumableOrder(null);
    setTab("caja");
  }, [resumableOrder]);

  const discardPendingOrder = useCallback(() => {
    const pendingId = resumableOrder?.id;
    setResumableOrder(null);
    if (pendingId) clearStoredPendingOrder(pendingId);
    showToast("info", "El cobro sigue en Actividad.");
    window.requestAnimationFrame(() => {
      document.getElementById("caja-heading")?.focus();
    });
  }, [resumableOrder, showToast]);

  const resetDemo = useCallback(async () => {
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      if (!response.ok) throw new Error("No pude reiniciar la demo.");
      clearStoredPendingOrder();
      setResumableOrder(null);
      setLastChange(null);
      setActiveOrder(null);
      setPaidOverlay(null);
      clearDraft();
      setVerifyResult(null);
      setVerifyId("");
      setCreditPayId(null);
      setCreditPayNotice(null);
      // El panel de tareas está montado aunque esté oculto: sin remontarlo,
      // el reset del servidor dejaría tareas viejas en pantalla.
      setTasksResetKey((key) => key + 1);
      // El corte conserva un conteo local aunque el servidor reinicie. La key
      // descarta ese conteo no guardado y vuelve a leer la caja vacía.
      setCashCloseKey((key) => key + 1);
      await loadDashboard({ force: true });
      showToast("ok", "Demo reiniciada.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "No pude reiniciar la demo.");
    }
  }, [clearDraft, loadDashboard, showToast]);

  const merchant = dashboard?.merchant;
  const pendingCredits = dashboard?.credits.filter((credit) => credit.status !== "settled") ?? [];
  // El modo demo se conserva aunque /api/dashboard falle: nunca se oculta el
  // sello DEMO ni se finge que la app es real.
  const demoMode = dashboard?.demoMode ?? initialDemoMode;
  const merchantUnavailable = Boolean(dashboardError && !dashboard);

  return (
    <div className="app-shell min-h-dvh">
      {tabWipe > 0 ? (
        <div
          key={tabWipe}
          className="tab-wipe"
          aria-hidden="true"
          onAnimationEnd={() => setTabWipe(0)}
        />
      ) : null}
      <a
        href="#main"
        onClick={(event) => {
          // El skip link no solo salta: enfoca main para que el lector de
          // pantalla y el anillo de foco aterricen en el contenido.
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-accent focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
      >
        Saltar al contenido
      </a>
      <AppSidebar
        tab={tab}
        onTab={selectTab}
        demoMode={demoMode}
        onHelp={() => setHelpOpen(true)}
        onDemo={() => setDemoOpen(true)}
      />

      <div className="app-main">
        <div className="scroll-progress" aria-hidden="true" />
        <TopBar
          merchant={merchant}
          today={today}
          demoMode={demoMode}
          unavailable={merchantUnavailable}
          muted={muted}
          onToggleMuted={toggleMuted}
          onHelp={() => setHelpOpen(true)}
          onDemo={() => setDemoOpen(true)}
        />

        {/* La tab bar va antes de main en el DOM: el orden de Tab entra en la
            navegación y luego en el contenido. Es fixed, no cambia el dibujo. */}
        <MobileTabBar tab={tab} onTab={selectTab} />

        <main
          id="main"
          tabIndex={-1}
          className="main-container mx-auto w-full max-w-[1200px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10"
        >
          {dashboardError ? (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-attention/30 bg-terracotta-soft/70 px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-attention" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    No pudimos cargar los datos del negocio.
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
                    {dashboard
                      ? "Lo que ves es de la última carga. No hay una lectura nueva de ventas, fiados ni cobros."
                      : "No sabemos si hay ventas, fiados o cobros pendientes. No mostramos cifras inventadas."}{" "}
                    {dashboardError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void retryDashboard()}
                disabled={retryingDashboard}
                aria-busy={retryingDashboard}
                className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:text-ink disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", retryingDashboard && "animate-spin")} />
                {retryingDashboard ? "Reintentando…" : "Reintentar"}
              </button>
            </div>
          ) : null}
          <div hidden={tab !== "caja"} className="tab-panel">
            <div className="caja-layout">
              <section className="min-w-0">
                <ScreenHeading
                  title="Caja"
                  headingId="caja-heading"
                  subtitle={
                    dashboard
                      ? `Hoy ${formatMxn(
                          dashboard.summary.cashCents +
                            dashboard.summary.verifiedDigitalCents +
                            dashboard.summary.demoDigitalCents +
                            dashboard.summary.pendingCents,
                        )} · Por cobrar ${formatMxn(dashboard.summary.pendingCents)} · Fiado ${formatMxn(
                          dashboard.summary.creditCents,
                        )}`
                      : dashboardError
                        ? "No pudimos cargar los totales. No hay cifras nuevas."
                        : "Cargando la caja…"
                  }
                  action={
                    <button
                      type="button"
                      onClick={() => setVerifyOpen(true)}
                      aria-label="Verificar comprobante"
                      className="flex min-h-[48px] items-center gap-2 rounded-full border border-separator bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:border-accent/40 hover:text-accent"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span className="verify-label">Verificar</span>
                    </button>
                  }
                />
                {resumableOrder && !activeOrder ? (
                  <div
                    role="status"
                    className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-separator bg-surface-2 px-3 py-2 text-sm text-ink-2"
                  >
                    <p className="flex min-w-0 items-center gap-2 font-medium text-ink">
                      <Clock3 className="h-4 w-4 shrink-0 text-accent" />
                      <span>
                        Tienes un cobro pendiente de{" "}
                        {formatMxn(
                          Math.max(
                            0,
                            resumableOrder.totalCents -
                              resumableOrder.paidCents -
                              resumableOrder.creditCents,
                          ),
                        )}{" "}
                        · Pedido {shortOrder(resumableOrder.id)}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={resumePendingOrder}
                        aria-label="Continuar cobro pendiente"
                        className="flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-green transition hover:text-accent"
                      >
                        Continuar cobro
                      </button>
                      <button
                        type="button"
                        onClick={discardPendingOrder}
                        aria-label="Descartar aviso de cobro pendiente"
                        className="flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-ink-2 transition hover:text-danger"
                      >
                        Descartar aviso
                      </button>
                    </div>
                  </div>
                ) : null}
                {restoredDraftAt ? (
                  <div
                    role="status"
                    className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-separator bg-surface-2 px-3 py-2 text-sm text-ink-2"
                  >
                    <p className="flex min-w-0 items-center gap-2 font-medium text-ink">
                      <Clock3 className="h-4 w-4 shrink-0 text-accent" />
                      {restoredDraftLabel(restoredDraftAt)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={keepRestoredDraft}
                        aria-label="Continuar venta recuperada"
                        className="flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-green transition hover:text-accent"
                      >
                        Continuar venta
                      </button>
                      <button
                        type="button"
                        onClick={discardRestoredDraft}
                        aria-label="Descartar borrador de venta"
                        className="flex min-h-12 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-ink-2 transition hover:text-danger"
                      >
                        Descartar borrador
                      </button>
                    </div>
                  </div>
                ) : null}
                <CajaPanel
                  listening={listening}
                  transcribing={transcribing}
                  recordingSeconds={recordingSeconds}
                  transcript={transcript}
                  textInput={textInput}
                  showTextInput={showTextInput}
                  draftItems={draftItems}
                  creditCents={creditCents}
                  cashInput={cashInput}
                  creditInput={creditInput}
                  customerName={customerName}
                  draftTotal={draftTotal}
                  appliedCashCents={appliedCashCents}
                  appliedCreditCents={appliedCreditCents}
                  changeCents={changeCents}
                  digitalDue={digitalDue}
                  overpay={overpay}
                  itemErrors={itemErrors}
                  savingOrder={savingOrder}
                  saleError={saleError}
                  voiceError={voiceError}
                  onStart={startRecording}
                  onStop={stopRecording}
                  onVoiceHelp={() =>
                    speak(
                      "Mantén presionado el micrófono y di qué vendiste. También puedes escribir la venta y tocar Interpretar.",
                      true,
                    )
                  }
                  onTextInput={setTextInput}
                  onToggleText={() => setShowTextInput((value) => !value)}
                  onInterpret={() => void interpretText(textInput)}
                  onSample={(phrase) => {
                    setTextInput(phrase);
                    setShowTextInput(true);
                    void interpretText(phrase);
                  }}
                  onDraftItems={updateDraftItems}
                  onCash={changeCashInput}
                  onCashBlur={blurCashInput}
                  onCredit={changeCreditInput}
                  onCreditBlur={blurCreditInput}
                  onCustomer={setCustomerName}
                  onCreate={() => void createOrder()}
                  onClear={clearDraft}
                />
              </section>

              <div className="caja-aside min-w-0">
                {/* Cobros pendientes después de la venta: la acción principal
                    (registrar) no se empuja fuera del primer viewport a 200 %. */}
                {(dashboard?.pendingOrders?.length ?? 0) > 0 ? (
                  <div className="mb-4">
                    <PendingPayments
                      orders={dashboard?.pendingOrders ?? []}
                      lastCheckedAt={pendingCheckedAt}
                      error={dashboardError}
                      onOpen={(order) => {
                        setActiveOrder(order);
                        setTab("caja");
                      }}
                      onRetry={() => void loadDashboard({ force: true })}
                    />
                  </div>
                ) : null}
                <ActivityList
                  orders={dashboard?.orders ?? []}
                  credits={dashboard?.credits ?? []}
                  loading={loading}
                  error={dashboardError}
                  onSelect={(order) => {
                    setActiveOrder(order);
                    setTab("caja");
                  }}
                />
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-separator bg-surface p-3.5 text-sm leading-relaxed text-ink-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                  <p>
                    Ningún pedido se marca pagado sin la confirmación firmada de pey. Una
                    captura no cuenta.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <section hidden={tab !== "fiado"} className="tab-panel mx-auto max-w-[760px]">
              <ScreenHeading
                title="Fiado"
                headingId="fiado-heading"
                subtitle="Lo que te deben, no dinero recibido."
              />
              {creditPayNotice ? (
                <div
                  role="alert"
                  className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-attention/30 bg-terracotta-soft/70 px-4 py-3 text-sm text-ink"
                >
                  <p className="flex min-w-0 items-center gap-2 font-medium">
                    <CircleAlert className="h-4 w-4 shrink-0 text-attention" />
                    {creditPayNotice}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreditPayNotice(null)}
                    className="flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-ink-2 transition hover:text-ink"
                  >
                    Entendido
                  </button>
                </div>
              ) : null}
              <CreditList
                credits={pendingCredits}
                loading={loading}
                error={dashboardError}
                onStart={(credit) => openCreditPay(credit)}
              />
              <CreditPaySheet
                credit={pendingCredits.find((credit) => credit.id === creditPayId) ?? null}
                amount={creditPayAmount}
                initialAmount={creditPayInitialAmount}
                method={creditPayMethod}
                initialMethod={creditPayInitialMethod}
                note={creditPayNote}
                paying={creditPaying}
                error={creditPayError}
                onAmount={setCreditPayAmount}
                onMethod={setCreditPayMethod}
                onNote={setCreditPayNote}
                onClose={() => {
                  setCreditPayId(null);
                  setCreditPayInitialAmount("");
                  setCreditPayInitialMethod(null);
                  setCreditPayRequestId(null);
                  setCreditPayError(null);
                }}
                onPay={() => {
                  const credit = pendingCredits.find((item) => item.id === creditPayId);
                  if (credit) void payCredit(credit);
                }}
              />
            </section>

          <section hidden={tab !== "corte"} className="tab-panel mx-auto max-w-[1000px]">
              <ScreenHeading
                title="Corte de caja"
                headingId="corte-heading"
                subtitle="Compara lo contado con lo esperado."
              />
              <div className="space-y-5">
                <CashCloseCard key={cashCloseKey} showToast={showToast} />
                <BusinessOverview
                  demoMode={demoMode}
                  onSpeak={(text) => {
                    showToast("info", text);
                    speak(text);
                  }}
                />
                <ReconcileCard demoMode={demoMode} />
              </div>
            </section>

          <section hidden={tab !== "meta"} className="tab-panel mx-auto max-w-[760px]">
              <ScreenHeading
                title="Meta"
                headingId="meta-heading"
                subtitle="Una meta a la vez."
                compactSubtitle
              />
              <GoalCard showToast={showToast} />
            </section>

          <section hidden={tab !== "pendientes"} className="tab-panel mx-auto max-w-[820px]">
              <PendingTasksPanel key={tasksResetKey} headingId="pendientes-heading" />
            </section>

          <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-separator pt-5 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="min-w-0">
              Mercado Cero · prototipo DevDay Exchange CDMX 2026 · pey + OpenAI ·{" "}
              <a href="/credits.txt" className="inline-flex min-h-12 items-center underline underline-offset-2 hover:text-ink">
                Fotos: créditos
              </a>
            </p>
            <p className="flex min-w-0 items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-green" />
              Sin confirmación firmada no hay pagado.
            </p>
          </footer>
        </main>
      </div>

      <Sheet
        open={Boolean(activeOrder)}
        onClose={() => {
          if (paymentLoading) return;
          closeActiveOrder();
        }}
        title={activeOrder ? paymentSheetTitle(activeOrder) : "Cobro"}
        size="md"
      >
        <PaymentPanel
          order={activeOrder}
          credits={dashboard?.credits ?? []}
          demoMode={demoMode}
          changeCents={lastChange && lastChange.orderId === activeOrder?.id ? lastChange.cents : 0}
          loading={paymentLoading}
          mode={paymentMode}
          onGenerate={(mode) => void generatePayment(mode)}
          onDemoPay={(method) => void demoPay(method)}
          onClose={() => {
            if (paymentLoading) return;
            closeActiveOrder();
          }}
          onNew={() => {
            closeActiveOrder();
            setTab("caja");
          }}
          onDeliver={() => void deliverActiveOrder()}
          delivering={delivering}
          error={deliverError}
          onCopy={async (value) => {
            try {
              await navigator.clipboard.writeText(value);
              showToast("ok", "Link copiado.");
            } catch {
              showToast("error", "No pude copiar el link.");
            }
          }}
          onShare={async (value) => {
            if (typeof navigator.share === "function") {
              try {
                await navigator.share({
                  title: "Pago seguro · Mercado Cero",
                  text: "Abre este link para pagar tu pedido.",
                  url: value,
                });
                return;
              } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") return;
              }
            }
            try {
              await navigator.clipboard.writeText(value);
              showToast("ok", "Link copiado para compartir.");
            } catch {
              showToast("error", "No pude compartir el link.");
            }
          }}
        />
      </Sheet>

      <PaidSheet
        order={paidOverlay}
        credits={dashboard?.credits ?? []}
        changeCents={lastChange && lastChange.orderId === paidOverlay?.id ? lastChange.cents : 0}
        onClose={() => {
          setPaidOverlay(null);
          setDeliverError(null);
        }}
        onDeliver={() => void deliverOrder()}
        delivering={delivering}
        error={deliverError}
      />

      <Sheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Guía"
        size="md"
      >
        <HelpContent
          textSize={textSize}
          onTextSize={setTextSize}
          contrast={contrast}
          onContrast={setContrast}
          voiceRate={voiceRate}
          onVoiceRate={setVoiceRate}
          onReadScreen={readScreen}
          onRepeat={repeatLast}
        />
      </Sheet>

      <Sheet
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title="Verificar comprobante"
        size="sm"
      >
        <VerifyCard
          value={verifyId}
          result={verifyResult}
          error={verifyError}
          verifying={verifying}
          onChange={(value) => {
            setVerifyId(value);
            setVerifyError(null);
          }}
          onVerify={() => void verify()}
          onFake={() => void verify(`fake_${Date.now()}`)}
        />
      </Sheet>

      <Sheet
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        title="Modo demo"
        size="sm"
      >
        <DemoContent
          demoMode={demoMode}
          onReset={() => {
            setDemoOpen(false);
            void resetDemo();
          }}
        />
      </Sheet>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                                   Caja                                     */
/* -------------------------------------------------------------------------- */

function CajaPanel(props: {
  listening: boolean;
  transcribing: boolean;
  recordingSeconds: number;
  transcript: string;
  textInput: string;
  showTextInput: boolean;
  draftItems: DraftItem[];
  creditCents: number;
  cashInput: string;
  creditInput: string;
  customerName: string;
  draftTotal: number;
  appliedCashCents: number;
  appliedCreditCents: number;
  changeCents: number;
  digitalDue: number;
  overpay: boolean;
  itemErrors: Record<string, DraftItemError>;
  savingOrder: boolean;
  saleError: string | null;
  voiceError: string | null;
  onStart: () => void;
  onStop: () => void;
  onVoiceHelp: () => void;
  onTextInput: (value: string) => void;
  onToggleText: () => void;
  onInterpret: () => void;
  onSample: (phrase: string) => void;
  onDraftItems: (items: DraftItem[]) => void;
  onCash: (value: string) => void;
  onCashBlur: (value: string) => void;
  onCredit: (value: string) => void;
  onCreditBlur: (value: string) => void;
  onCustomer: (value: string) => void;
  onCreate: () => void;
  onClear: () => void;
}) {
  const {
    listening,
    transcribing,
    recordingSeconds,
    transcript,
    textInput,
    draftItems,
    creditCents,
    cashInput,
    creditInput,
    customerName,
    draftTotal,
    appliedCashCents,
    appliedCreditCents,
    changeCents,
    digitalDue,
    overpay,
    itemErrors,
    savingOrder,
    saleError,
    voiceError,
    onStart,
    onStop,
    onVoiceHelp,
    onTextInput,
    onInterpret,
    onSample,
    onDraftItems,
    onCash,
    onCashBlur,
    onCredit,
    onCreditBlur,
    onCustomer,
    onCreate,
    onClear,
  } = props;

  const [confirmingClear, setConfirmingClear] = useState(false);
  // El precio se guarda como texto crudo por producto mientras se teclea.
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    // Si la venta queda vacía por otra vía (recuperación, demo, descarte),
    // la confirmación de limpiar deja de aplicar.
    if (draftItems.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmingClear(false);
    }
  }, [draftItems.length]);

  const commitItems = (items: DraftItem[]) => {
    onDraftItems(items);
    setConfirmingClear(false);
  };

  const addDraftItem = () => {
    const id = newDraftItemId();
    commitItems([
      ...draftItems,
      { id, description: "", quantity: 1, unitPriceCents: 0 },
    ]);
    window.requestAnimationFrame(() => {
      document.getElementById(`draft-description-${id}`)?.focus();
    });
  };

  return (
    <div className="space-y-4">
      <section className="caja-panel paper-card rounded-2xl border border-separator bg-surface p-4 shadow-card sm:p-6">
        <div className="caja-card-header flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="caja-card-title text-[1.375rem] font-semibold tracking-tight text-ink">¿Qué vendiste?</h2>
            <p className="caja-card-subtitle mt-1 text-sm leading-relaxed text-ink-2">
              Habla o escribe; tú confirmas.
            </p>
          </div>
          <button
            type="button"
            onClick={onVoiceHelp}
            className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-full border border-separator bg-surface-2 px-3 text-sm font-semibold text-ink-2 transition hover:text-ink"
          >
            <Volume2 className="h-4 w-4" />
            Escuchar
          </button>
        </div>

        <div className="caja-entry">
        <div className="caja-voice mt-4 flex flex-wrap items-start gap-4">
          <div className="flex w-[144px] shrink-0 flex-col items-center gap-1.5">
            <div className="relative flex h-[80px] w-[80px] items-center justify-center">
              <span
                aria-hidden="true"
                className="mic-halo absolute -inset-2 rounded-full border border-dashed border-accent/25"
              />
              {listening ? (
                <>
                  <span className="mic-ring absolute inset-0 rounded-full bg-accent/15" />
                  <span className="mic-ring absolute inset-2 rounded-full bg-accent/10 [animation-delay:0.6s]" />
                </>
              ) : null}
              <button
                type="button"
                aria-label={listening ? "Soltar para terminar" : "Mantén presionado para hablar"}
                onPointerDown={(event) => {
                  event.preventDefault();
                  void onStart();
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  onStop();
                }}
                onPointerLeave={() => {
                  if (listening) onStop();
                }}
                onPointerCancel={() => {
                  if (listening) onStop();
                }}
                onKeyDown={(event) => {
                  if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                    event.preventDefault();
                    void onStart();
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    onStop();
                  }
                }}
                disabled={transcribing}
                className={cn(
                  "mic-button on-accent relative flex h-[80px] w-[80px] touch-none select-none items-center justify-center rounded-full transition-colors disabled:opacity-60",
                  listening
                    ? "bg-danger text-white ring-4 ring-danger/20"
                    : "bg-accent text-white hover:bg-accent-press",
                )}
              >
                {transcribing ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : listening ? (
                  <span className="flex items-end gap-1">
                    {[0, 1, 2, 3].map((bar) => (
                      <span
                        key={bar}
                        className="w-1 rounded-full bg-white/90"
                        style={{
                          height: `${10 + ((bar * 5 + recordingSeconds * 2) % 16)}px`,
                          animation: `blink ${0.7 + bar * 0.12}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <Mic className="h-8 w-8" strokeWidth={1.8} />
                )}
              </button>
            </div>
            <span
              aria-hidden="true"
              className="w-full text-center text-sm font-semibold text-ink-2"
            >
              {listening
                ? `${recordingSeconds}s`
                : transcribing
                  ? "Interpretando…"
                  : "Mantén y habla"}
            </span>
            <span role="status" className="sr-only">
              {listening ? "Grabando" : transcribing ? "Interpretando" : ""}
            </span>
          </div>

          <div className="min-w-[7rem] flex-1 pt-1">
            {transcript ? (
              <div className="rounded-xl border border-separator bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink">
                {transcript}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-ink-2">
                {listening
                  ? "Di productos, cantidades y precios. Suelta para terminar."
                  : "Mantén y habla. Si hay ruido, escribe la venta."}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-2">La IA interpreta; tú confirmas.</p>
          </div>
        </div>

        <div className="caja-text-entry">
        <label htmlFor="sale-text" className="mt-4 block text-xs font-semibold text-ink-2">
          Escribe la venta
        </label>
        <div className="sale-entry-row mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="sale-text"
            value={textInput}
            onChange={(event) => onTextInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onInterpret();
            }}
            placeholder="Ej. 2 quesadillas $35"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-separator bg-surface-2 px-3 text-[1rem] text-ink outline-none placeholder:text-placeholder focus:border-accent/40"
          />
          <button
            type="button"
            onClick={onInterpret}
            disabled={!textInput.trim() || transcribing}
            aria-busy={transcribing}
            data-chrome-critical
            className="interpret-button flex min-h-12 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-green transition hover:border-accent/40 disabled:opacity-50 sm:w-auto"
          >
            {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Interpretar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_PHRASES.map((phrase) => {
            const label = SAMPLE_LABELS[phrase] ?? phrase;
            return (
              <button
                key={phrase}
                type="button"
                onClick={() => onSample(phrase)}
                aria-label={`${label}: ${phrase}`}
                className="inline-flex max-w-full min-h-12 shrink-0 items-center rounded-full border border-separator bg-surface px-3 text-left text-sm font-medium text-ink-2 transition hover:border-accent/40 hover:text-accent"
              >
                {label}
              </button>
            );
          })}
        </div>

        {voiceError ? (
          <div className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2">
            <p role="alert" className="text-sm font-medium text-danger">
              {voiceError}
            </p>
            <button
              type="button"
              onClick={addDraftItem}
              className="mt-1 flex min-h-12 items-center gap-1.5 text-sm font-semibold text-danger underline underline-offset-2"
            >
              <Plus className="h-4 w-4" />
              Escribir productos
            </button>
          </div>
        ) : null}
        </div>
        </div>
      </section>

      <section id="pedido" className="paper-card scroll-mt-20 rounded-2xl border border-separator bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[1.375rem] font-semibold tracking-tight text-ink">Pedido en curso</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {draftItems.length > 0
                ? `${draftItems.length} ${draftItems.length === 1 ? "producto" : "productos"}`
                : "Todavía no hay productos"}
            </p>
          </div>
          {draftItems.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              aria-expanded={confirmingClear}
              aria-controls={confirmingClear ? "clear-confirmation" : undefined}
              className="flex min-h-12 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-ink-2 transition hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar
            </button>
          ) : null}
        </div>

        {confirmingClear && draftItems.length > 0 ? (
          <div
            id="clear-confirmation"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/25 bg-terracotta-soft px-3 py-2"
          >
            <p className="text-sm font-semibold text-ink">¿Descartar la venta sin confirmar?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="flex min-h-12 items-center rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingClear(false);
                  onClear();
                  window.requestAnimationFrame(() => {
                    document.getElementById("draft-add-empty")?.focus();
                  });
                }}
                className="flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger"
              >
                <Trash2 className="h-4 w-4" />
                Sí, limpiar
              </button>
            </div>
          </div>
        ) : null}

        {draftItems.length > 0 && transcript ? (
          <p
            role="status"
            className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold text-ink"
          >
            Escuché {formatMxn(draftTotal)}. ¿Confirmas?
          </p>
        ) : null}

        {draftItems.length > 0 ? (
          <div className="mt-4 space-y-2.5">
            {draftItems.map((item, index) => {
              const priceText =
                priceInputs[item.id] ??
                (item.unitPriceCents > 0 ? (item.unitPriceCents / 100).toFixed(2) : "");
              const itemError = itemErrors[item.id];
              return (
                <div
                  key={item.id}
                  className={cn(
                    "draft-item rounded-xl border bg-surface-2 p-3",
                    itemError ? "border-danger/50" : "border-separator",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      id={`draft-description-${item.id}`}
                      value={item.description}
                      onChange={(event) => {
                        const next = [...draftItems];
                        next[index] = { ...item, description: event.target.value };
                        commitItems(next);
                      }}
                      placeholder="Producto"
                      aria-invalid={itemError?.field === "description"}
                      aria-describedby={itemError ? `item-error-${item.id}` : undefined}
                      className="min-h-12 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-[1rem] font-semibold text-ink outline-none placeholder:text-placeholder focus:border-separator focus:bg-surface"
                      aria-label="Producto"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        commitItems(draftItems.filter((candidate) => candidate.id !== item.id))
                      }
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface hover:text-danger"
                      aria-label="Quitar producto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...draftItems];
                          next[index] = { ...item, quantity: Math.max(0.25, item.quantity - 1) };
                          commitItems(next);
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-lg border border-separator bg-surface text-ink-2"
                        aria-label="Menos cantidad"
                      >
                        <span className="text-lg leading-none">−</span>
                      </button>
                      <input
                        id={`draft-quantity-${item.id}`}
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={item.quantity}
                        onChange={(event) => {
                          const next = [...draftItems];
                          const value = Number(event.target.value);
                          next[index] = {
                            ...item,
                            quantity: Number.isFinite(value) ? Math.max(0.25, value) : 0.25,
                          };
                          commitItems(next);
                        }}
                        aria-invalid={itemError?.field === "quantity"}
                        aria-describedby={itemError ? `item-error-${item.id}` : undefined}
                        className="tabular h-12 w-14 rounded-lg border border-transparent bg-transparent text-center text-[1rem] font-semibold text-ink outline-none focus:border-separator focus:bg-surface"
                        aria-label="Cantidad"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...draftItems];
                          next[index] = { ...item, quantity: item.quantity + 1 };
                          commitItems(next);
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-lg border border-separator bg-surface text-ink-2"
                        aria-label="Más cantidad"
                      >
                        <span className="text-lg leading-none">+</span>
                      </button>
                    </div>
                    <label className="flex items-center gap-1 text-sm font-medium text-ink-2">
                      $
                      <input
                        id={`draft-price-${item.id}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={priceText}
                        placeholder="0.00"
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => {
                          const raw = event.target.value;
                          setPriceInputs((current) => ({ ...current, [item.id]: raw }));
                          const next = [...draftItems];
                          next[index] = {
                            ...item,
                            unitPriceCents: parseMoneyInput(raw),
                          };
                          commitItems(next);
                        }}
                        onBlur={(event) => {
                          const raw = event.target.value;
                          const cents = parseMoneyInput(raw);
                          setPriceInputs((current) => ({
                            ...current,
                            [item.id]: formatMoneyInput(raw),
                          }));
                          const next = [...draftItems];
                          next[index] = { ...item, unitPriceCents: cents };
                          if (cents !== item.unitPriceCents) commitItems(next);
                        }}
                        aria-invalid={itemError?.field === "price"}
                        aria-describedby={itemError ? `item-error-${item.id}` : undefined}
                        style={{ width: `${Math.max(7, priceText.length + 1)}ch` }}
                        className="tabular h-12 rounded-lg border border-transparent bg-transparent px-1 text-right text-[1rem] font-semibold text-ink outline-none placeholder:text-ink-2/40 focus:border-separator focus:bg-surface"
                        aria-label="Precio unitario"
                      />
                    </label>
                  </div>
                  {itemError ? (
                    <p
                      id={`item-error-${item.id}`}
                      role="alert"
                      className="mt-2 text-sm font-medium text-danger"
                    >
                      {itemError.message}
                    </p>
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              id="draft-add"
              onClick={addDraftItem}
              className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-separator text-sm font-semibold text-ink-2 transition hover:border-accent/40 hover:text-accent"
            >
              <Plus className="h-4 w-4" />
              Agregar producto
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-separator px-4 py-3 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-soft text-green">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 basis-[8rem]">
                <p className="text-sm font-semibold text-ink">La caja está lista</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
                  Habla o escribe arriba, o agrega un producto a mano.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="draft-add-empty"
              onClick={addDraftItem}
              className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-separator text-sm font-semibold text-ink-2 transition hover:border-accent/40 hover:text-accent"
            >
              <Plus className="h-4 w-4" />
              Agregar producto
            </button>
          </div>
        )}

        {draftItems.length > 0 ? (
          <>
            <div className="split-fields mt-4 grid gap-2.5">
              <label className="rounded-xl bg-surface-2 p-3">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
                  <Banknote className="h-4 w-4" />
                  Efectivo recibido
                </span>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-sm text-ink-2">$</span>
                  <input
                    id="cash-received"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={cashInput}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => onCash(event.target.value)}
                    onBlur={(event) => onCashBlur(event.target.value)}
                    placeholder="0.00"
                    aria-label="Efectivo recibido en pesos"
                    aria-describedby={changeCents > 0 ? "cash-change" : undefined}
                    className="tabular min-h-12 w-full bg-transparent text-[1.125rem] font-semibold text-ink outline-none placeholder:text-placeholder"
                  />
                </div>
                {changeCents > 0 ? (
                  <p id="cash-change" role="status" className="mt-1 text-sm font-semibold text-green">
                    Cambio {formatMxn(changeCents)}
                    <span className="mt-0.5 block text-xs font-normal leading-relaxed text-ink-2">
                      {appliedCashCents > 0
                        ? `Se aplican ${formatMxn(appliedCashCents)} al cobro.`
                        : "No se aplica efectivo al cobro."}
                    </span>
                  </p>
                ) : null}
              </label>

              <label className="rounded-xl bg-surface-2 p-3">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
                  <NotebookPen className="h-4 w-4" />
                  A fiado
                </span>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-sm text-ink-2">$</span>
                  <input
                    id="fiado-amount"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={creditInput}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => onCredit(event.target.value)}
                    onBlur={(event) => onCreditBlur(event.target.value)}
                    placeholder="0.00"
                    aria-label="Monto a fiado en pesos"
                    aria-invalid={overpay}
                    aria-describedby={overpay ? "fiado-overpay" : undefined}
                    className="tabular min-h-12 w-full bg-transparent text-[1.125rem] font-semibold text-ink outline-none placeholder:text-placeholder"
                  />
                </div>
              </label>
            </div>

            {overpay ? (
              <p id="fiado-overpay" role="alert" className="mt-1.5 text-sm font-medium text-danger">
                El fiado no puede superar el total de la venta.
              </p>
            ) : null}

            {creditCents > 0 ? (
              <label className="mt-2.5 flex min-h-12 items-center gap-2 rounded-xl border border-attention/25 bg-terracotta-soft/60 px-3">
                <UserRound className="h-4 w-4 shrink-0 text-attention" />
                <input
                  id="fiado-customer"
                  value={customerName}
                  onChange={(event) => onCustomer(event.target.value)}
                  placeholder="¿Quién queda a deber? Ej. Juan"
                  aria-label="Nombre del cliente para el fiado"
                  aria-invalid={Boolean(saleError) && creditCents > 0 && !customerName.trim()}
                  aria-describedby={saleError ? "sale-error" : undefined}
                  className="min-w-0 flex-1 bg-transparent text-[1rem] font-semibold text-ink outline-none placeholder:text-placeholder"
                />
              </label>
            ) : null}

            {saleError ? (
              <p
                id="sale-error"
                role="alert"
                className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger"
              >
                {saleError}
              </p>
            ) : null}

            <div id="confirmar" className="mt-4 scroll-mt-20 flex flex-col gap-3 border-t border-separator pt-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div>
                <p className="tabular text-[1.75rem] font-semibold leading-none tracking-tight text-ink">
                  <AnimatedAmount cents={draftTotal} />
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  {digitalDue > 0
                    ? `${formatMxn(digitalDue)} por cobrar con link`
                    : appliedCreditCents > 0
                      ? `${formatMxn(appliedCreditCents)} a fiado`
                      : "Sin saldo digital pendiente"}
                  {overpay ? " · el fiado supera el total" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onCreate}
                disabled={draftItems.length === 0 || savingOrder}
                aria-busy={savingOrder}
                aria-describedby={saleError ? "sale-error" : undefined}
                className="on-accent flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                Confirmar venta
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                                  Cobro                                     */
/* -------------------------------------------------------------------------- */

function OrderCreditNote({
  order,
  credit,
  settled,
  prefix,
  className,
}: {
  order: Order;
  credit: Credit | null;
  settled: boolean;
  prefix?: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm leading-relaxed text-ink-2", className)}>
      {prefix}
      {settled ? (
        <>
          Fiado <strong className="text-green">Saldado</strong> · original{" "}
          {formatMxn(order.creditCents)}. Ya no es dinero pendiente.
        </>
      ) : credit ? (
        <>
          Saldo vivo: <strong>{formatMxn(credit.balanceCents)}</strong> · original{" "}
          {formatMxn(order.creditCents)}. Aparece en Fiado; no es dinero recibido.
        </>
      ) : (
        <>
          Fiado original {formatMxn(order.creditCents)}. El saldo vivo no está disponible.
        </>
      )}
    </p>
  );
}

function PaymentPanel(props: {
  order: Order | null;
  credits: Credit[];
  demoMode: boolean;
  changeCents: number;
  loading: boolean;
  mode: "link" | "qr";
  onGenerate: (mode: "link" | "qr") => void;
  onDemoPay: (method: "codi" | "card") => void;
  onClose: () => void;
  onNew: () => void;
  onCopy: (value: string) => void;
  onShare: (value: string) => void;
  onDeliver: () => void;
  delivering: boolean;
  error: string | null;
}) {
  const { order, credits, demoMode, changeCents, loading, mode, onGenerate, onDemoPay, onClose, onNew, onCopy, onShare, onDeliver, delivering, error } = props;

  if (!order) return null;

  const due = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
  const isPaid = order.status === "paid" || order.status === "demo_paid" || order.status === "fulfilled";
  const isCredit = order.creditCents > 0;
  const credit = creditForOrder(order, credits);
  const creditSettled = isCreditSettled(credit);
  const waiting = order.status === "payment_pending" || order.status === "confirmed";
  const qrValue = order.qrImage ? null : order.qrString ?? order.paymentUrl;

  // Fiado + saldo digital: mientras quede remanente, se cobra aquí; el fiado
  // sigue en su libreta y no se presenta como si todo estuviera cubierto.
  if (isPaid || (isCredit && due <= 0)) {
    const truth = paymentTruth(order);
    const mixed = truth.hasCredit && truth.receivedCents > 0;
    const creditOnly = truth.hasCredit && !truth.hasDigital;
    const mixedDigital = truth.hasCredit && truth.hasDigital;
    const source = [
      truth.cashPaidCents > 0 ? `${formatMxn(truth.cashPaidCents)} en efectivo` : null,
      order.digitalPaidCents > 0
        ? `${formatMxn(order.digitalPaidCents)} ${
            truth.isDemo ? "demo" : truth.isVerified ? "verificado por pey" : "sin verificar"
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" + ");
    const sourceMixed = truth.isMixedSources && !truth.hasCredit;

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-separator bg-surface p-5 text-center">
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full result-in",
              creditOnly || (mixedDigital && truth.isDemo)
                ? "bg-terracotta-soft text-attention"
                : mixedDigital
                  ? "bg-green-soft text-green"
                  : sourceMixed
                    ? truth.isDemo
                      ? "bg-terracotta-soft text-attention"
                      : "bg-green-soft text-green"
                    : truth.isCash
                      ? "bg-surface-2 text-ink"
                      : "bg-green-soft text-green",
            )}
          >
            {creditOnly ? (
              <NotebookPen className="h-6 w-6" />
            ) : mixedDigital ? (
              truth.isDemo ? (
                <FlaskConical className="h-6 w-6" />
              ) : (
                <Check className="h-6 w-6" />
              )
            ) : sourceMixed ? (
              truth.isDemo ? (
                <FlaskConical className="h-6 w-6" />
              ) : (
                <Check className="h-6 w-6" />
              )
            ) : truth.isDemo ? (
              <FlaskConical className="h-6 w-6" />
            ) : truth.isCash ? (
              <Banknote className="h-6 w-6" />
            ) : (
              <Check className="h-7 w-7" />
            )}
          </div>
          <p className="mt-4 text-[1.625rem] font-semibold tracking-tight text-ink">
            {creditOnly
              ? "Quedó anotado"
              : mixedDigital
                ? "Pago mixto"
                : sourceMixed
                  ? "Pago mixto"
                  : truth.isDemo
                    ? "Pago simulado"
                    : truth.isCash
                      ? "Efectivo recibido"
                      : truth.isVerified
                        ? "Pago verificado"
                        : "Pago sin confirmar"}
          </p>
          <p className="tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
            <AnimatedAmount
              cents={
                truth.hasCredit || sourceMixed
                  ? order.totalCents
                  : truth.receivedCents || order.totalCents
              }
            />
          </p>
          <p className="mt-2 text-sm text-ink-2">
            Pedido {shortOrder(order.id)} ·{" "}
            {creditOnly
              ? mixed
                ? `${source} + ${formatMxn(order.creditCents)} original a fiado`
                : `fiado con ${order.customerName ?? "el cliente"} · original ${formatMxn(order.creditCents)}`
              : mixedDigital
                ? `${truth.cashPaidCents > 0 ? `${formatMxn(truth.cashPaidCents)} efectivo + ` : ""}Fiado ${formatMxn(
                    order.creditCents,
                  )} + ${formatMxn(order.digitalPaidCents)} ${
                    truth.isDemo
                      ? "demo"
                      : truth.isVerified
                        ? "verificado por pey"
                        : "sin verificar"
                  }`
                : sourceMixed
                  ? source
                  : truth.isDemo
                    ? "simulado en modo demo"
                    : truth.isCash
                      ? "recibido en efectivo, sin pasar por pey"
                      : truth.isVerified
                        ? "confirmado por pey"
                        : "sin confirmar"}
          </p>
          {truth.hasCredit ? (
            <OrderCreditNote
              order={order}
              credit={credit}
              settled={creditSettled}
              prefix={mixed ? `Recibiste ${source}. ` : null}
              className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-left"
            />
          ) : sourceMixed ? (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm leading-relaxed text-ink-2">
              Recibiste {formatMxn(truth.cashPaidCents)} en efectivo y{" "}
              {formatMxn(order.digitalPaidCents)}{" "}
              {truth.isDemo
                ? "en un pago simulado. El efectivo sí es dinero real; el digital es demo."
                : truth.isVerified ? "verificados por pey." : "sin verificar."}
            </p>
          ) : truth.isDemo ? (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm leading-relaxed text-ink-2">
              En producción, este estado solo se actualiza con la confirmación firmada de pey. No
              se movió dinero real.
            </p>
          ) : truth.isCash ? (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm leading-relaxed text-ink-2">
              Recibiste el efectivo en la caja. No pasó por pey ni es un pago verificado por el
              banco.
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm leading-relaxed text-ink-2">
              El pago fue confirmado con una confirmación firmada de pey. Puedes entregar el
              pedido.
            </p>
          )}
          {changeCents > 0 ? (
            <p
              role="status"
              className="mt-3 rounded-xl bg-green-soft px-3 py-2 text-left text-sm font-semibold text-green"
            >
              Cambio {formatMxn(changeCents)}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {order.status === "paid" || order.status === "demo_paid" ? (
            <button
              type="button"
              onClick={onDeliver}
              disabled={delivering}
              aria-busy={delivering}
              className="on-accent flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-60"
            >
              {delivering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {delivering ? "Entregando…" : "Listo para entregar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="on-accent flex min-h-12 flex-1 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press"
            >
              {truth.hasCredit ? "Entendido" : "Cerrar"}
            </button>
          )}
          <button
            type="button"
            onClick={onNew}
            className="min-h-12 rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:text-ink"
          >
            Nuevo cobro
          </button>
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-2">
            Cobro · Pedido {shortOrder(order.id)}
          </p>
          <p className="tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
            <AnimatedAmount cents={due} />
          </p>
          <p className="mt-1.5 text-sm text-ink-2">
            {order.items.map((item) => `${item.quantity} ${item.description}`).join(" · ")}
          </p>
          {changeCents > 0 ? (
            <p
              role="status"
              className="mt-2 rounded-xl bg-green-soft px-3 py-2 text-sm font-semibold text-green"
            >
              Cambio {formatMxn(changeCents)}
            </p>
          ) : null}
        </div>
        <StatusBadge status={order.status} />
      </div>

      {isCredit ? (
        <div
          role="status"
          className="rounded-xl border border-attention/25 bg-terracotta-soft/60 px-3 py-2.5 text-sm leading-relaxed text-ink-2"
        >
          <p className="font-semibold text-ink">
            Fiado {formatMxn(order.creditCents)} · Cobrado {formatMxn(order.paidCents)} ·
            Falta cobrar {formatMxn(due)}
          </p>
          <p className="mt-1">
            El fiado vive en la libreta y no se cuenta como dinero recibido. Cobra
            aquí solo el saldo digital.
          </p>
          <OrderCreditNote
            order={order}
            credit={credit}
            settled={creditSettled}
            className="mt-2"
          />
        </div>
      ) : null}

      {waiting ? (
        <p role="status" className="rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-2">
          Pago pendiente; aún no entregues.
        </p>
      ) : null}

      {!order.paymentUrl && !order.qrString ? (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => onGenerate("link")}
            disabled={loading}
            className="pay-option on-accent flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-accent px-4 text-left text-white transition hover:bg-accent-press disabled:opacity-60"
          >
            <span className="pay-option-main flex min-w-0 flex-1 items-start gap-3">
              <span className="pay-option-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Link2 className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">Link de pago</span>
                <span className="block text-sm text-white/90">CoDi + tarjeta + wallets</span>
              </span>
            </span>
            {loading && mode === "link" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onGenerate("qr")}
            disabled={loading}
            className="pay-option flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-separator bg-surface px-4 text-left text-ink transition hover:border-accent/40 disabled:opacity-60"
          >
            <span className="pay-option-main flex min-w-0 flex-1 items-start gap-3">
              <span className="pay-option-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-soft text-green">
                <QrCode className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">QR CoDi directo</span>
                <span className="block text-sm text-ink-2">Solo transferencia CoDi</span>
              </span>
            </span>
            {loading && mode === "qr" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      ) : null}

      {demoMode ? (
        order.paymentUrl || order.qrString ? (
          <div className="rounded-xl border border-dashed border-attention/40 bg-surface p-3.5">
            <p className="text-sm font-bold text-attention">Modo demo</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              Simula la confirmación para probar la demo. No se mueve dinero real.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onDemoPay("codi")}
                disabled={loading}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-separator bg-surface px-2 text-sm font-semibold text-ink-2 transition hover:text-accent disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                Simular CoDi
              </button>
              <button
                type="button"
                onClick={() => onDemoPay("card")}
                disabled={loading}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-separator bg-surface px-2 text-sm font-semibold text-ink-2 transition hover:text-accent disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                Simular tarjeta
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-ink-2">
            Genera el link o el QR para simular la confirmación del banco.
          </p>
        )
      ) : null}

      {order.paymentUrl ? (
        <div className="space-y-3">
          <div className="flex justify-center rounded-xl border border-separator bg-white p-4">
            <QrImage value={order.paymentUrl} className="h-[200px] w-[200px]" />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2">
            <Link2 className="ml-1.5 h-4 w-4 shrink-0 text-ink-2" />
            <p className="min-w-0 flex-1 truncate text-sm text-ink-2">{order.paymentUrl}</p>
            <button
              type="button"
              onClick={() => onCopy(order.paymentUrl ?? "")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-2 transition hover:text-accent"
              aria-label="Copiar link"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onShare(order.paymentUrl ?? "")}
            className="on-accent flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press"
          >
            <Share2 className="h-4 w-4" />
            Compartir link
          </button>
          <a
            href={order.paymentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:border-accent/40 hover:text-accent"
          >
            {demoMode ? "Abrir checkout de demostración" : "Abrir checkout de pey"}
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      ) : null}

      {order.qrString ? (
        <div className="space-y-3">
          <div className="flex justify-center rounded-xl border border-separator bg-white p-4">
            {order.qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.qrImage} alt="Código QR CoDi" className="h-[200px] w-[200px]" />
            ) : qrValue ? (
              <QrImage value={qrValue} className="h-[200px] w-[200px]" />
            ) : null}
          </div>
          <p className="text-center text-sm text-ink-2">
            Referencia {order.numRef ?? "—"} · expira en 10 minutos
          </p>
        </div>
      ) : null}

      {waiting && (order.paymentUrl || order.qrString) ? (
        <div className="rounded-xl border border-attention/25 bg-terracotta-soft/60 p-3.5" role="status">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-attention opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-attention" />
            </span>
            Esperando al banco
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            Esta pantalla se actualiza sola cuando pey confirma el pago. No entregues antes.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        className="min-h-12 w-full rounded-xl py-2 text-center text-sm font-semibold text-ink-2 transition hover:text-ink"
      >
        Cerrar cobro
      </button>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                                 Resumen                                    */
/* -------------------------------------------------------------------------- */

function BusinessOverview({
  onSpeak,
  demoMode,
}: {
  onSpeak: (message: string) => void;
  demoMode: boolean;
}) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshTick((value) => value + 1);
    window.addEventListener("mercado:refresh", handler);
    return () => window.removeEventListener("mercado:refresh", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Fetch on mount/period change; el estado de carga es intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/analytics?period=${period}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el resumen.");
        const data = await readJsonBody<AnalyticsReport>(response);
        if (!data) throw new Error("No se pudo cargar el resumen.");
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el resumen.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, refreshTick]);

  const comparison = report?.comparison.salesChangePct ?? null;
  const maxSeries = Math.max(...(report?.series.map((point) => point.salesCents) ?? [0]), 1);

  function speakReport() {
    if (!report) return;
    onSpeak(
      `${report.label}: ${formatMxn(report.salesCents)} en ${countText(
        report.orderCount,
        "venta",
        "ventas",
      )}. Cobrado ${formatMxn(
        report.collectedCents,
      )}. Por cobrar ${formatMxn(report.pendingCents)}.`,
    );
  }

  return (
    <div className="paper-card relative overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
      <div className="border-b border-separator bg-surface-2/50 px-[18px] py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink-2">Mi negocio</p>
              {demoMode ? (
                <span className="rounded-xl bg-terracotta-soft px-2 py-0.5 text-sm font-semibold text-attention">
                  Datos demo
                </span>
              ) : null}
            </div>
            <h2 className="mt-0.5 text-[1.375rem] font-semibold tracking-tight text-ink">
              Así va la caja
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {(["today", "week", "month"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={cn(
                    "min-h-12 min-w-12 border-b-2 pb-1 text-center text-sm font-semibold transition",
                    period === value
                      ? "border-green text-ink"
                      : "border-transparent text-ink-2 hover:text-ink",
                  )}
                >
                  {value === "today" ? "Hoy" : value === "week" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={speakReport}
              className="flex min-h-12 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:text-green"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Escuchar
            </button>
          </div>
        </div>
      </div>

      <div className="p-[20px] sm:p-6">
      {loading && !report ? (
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <div className="shimmer h-28 rounded-2xl" />
          <div className="shimmer h-28 rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-5 rounded-2xl border border-attention/20 bg-terracotta-soft px-4 py-3 text-sm text-attention">
          {error}
        </p>
      ) : report ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 max-w-full">
              <p className="tabular max-w-full break-words text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-ink">
                <AnimatedAmount cents={report.salesCents} />
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-2">
                Ventas registradas · {report.label}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {comparison === null ? (
                <span className="text-sm text-ink-2">Sin periodo anterior</span>
              ) : (
                <>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold",
                      comparison >= 0
                        ? "bg-green-soft text-green"
                        : "bg-terracotta-soft text-attention",
                    )}
                  >
                    <ArrowUpRight
                      className={cn("h-3.5 w-3.5", comparison < 0 && "rotate-90")}
                    />
                    {comparison >= 0 ? "+" : ""}
                    {comparison}%
                  </span>
                  <span className="text-sm text-ink-2">vs periodo anterior</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Cobrado", value: report.collectedCents, note: "De las ventas del periodo" },
              { label: "Por cobrar", value: report.pendingCents, note: "De las ventas del periodo" },
              { label: "Ticket promedio", value: report.averageTicketCents, note: countText(report.orderCount, "venta", "ventas") },
              { label: "Fiado", value: report.creditCents, note: "Saldo pendiente total" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-surface-2 px-3 py-3">
                <p className="text-sm font-semibold text-ink-2">{item.label}</p>
                <p className="tabular mt-1 break-words text-xl font-bold text-ink">{formatMxn(item.value)}</p>
                <p className="mt-0.5 text-sm text-ink-2">{item.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-separator/60 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-2">Cómo te pagaron</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-accent" />
                  Efectivo {formatMxn(report.cashCents)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-attention" />
                  Digital {formatMxn(report.digitalCents)}
                </span>
              </div>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden bg-line/60">
              <div
                className="bg-accent"
                style={{
                  width: `${
                    report.collectedCents > 0
                      ? (report.cashCents / report.collectedCents) * 100
                      : 0
                  }%`,
                }}
              />
              <div className="flex-1 bg-attention" />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-ink-2">
                {period === "month" ? "Últimos 30 días" : "Últimos 7 días"}
              </p>
              {report.bestDay ? (
                <p className="text-sm text-ink-2">
                  Mejor día: {formatDayKey(report.bestDay.date)} ·{" "}
                  {formatCompactMxn(report.bestDay.salesCents)}
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex h-24 items-end gap-1 border-b border-separator/60">
              {report.series.map((point) => (
                <div
                  key={point.date}
                  className="group relative h-full flex-1"
                  title={`${formatDayKey(point.date)}: ${formatMxn(point.salesCents)} · ${countText(point.orders, "venta", "ventas")}`}
                >
                  <div
                    className={cn(
                      "bar-grow w-full rounded-t-sm",
                      point.salesCents > 0
                        ? "bg-accent group-hover:bg-accent-press"
                        : "bg-line/60",
                    )}
                    style={{
                      height: `${Math.max(3, (point.salesCents / maxSeries) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1 text-xs text-ink-2">
              {report.series.map((point) => (
                <span key={point.date} className="flex-1 text-center">
                  {point.date.slice(8)}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
              <span>
                {report.bestHour !== null
                  ? `Mejor hora: ${String(report.bestHour).padStart(2, "0")}:00`
                  : "Sin datos por hora."}
              </span>
              <span>Mismo registro, sin doble conteo.</span>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Las ventas, cobros y pendientes salen del mismo registro. Un abono de fiado no cuenta como venta nueva.
          </p>
        </>
      ) : null}
      </div>
    </div>
  );
}

const DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

type MoneyField = "opening" | "expenses" | "withdrawals" | "counted" | "baseNext";

const MONEY_FIELD_LABEL: Record<MoneyField, string> = {
  opening: "La base inicial",
  expenses: "Los gastos",
  withdrawals: "Los retiros",
  counted: "El total contado",
  baseNext: "La base para mañana",
};

interface ClosePayload {
  openingCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  countedCents: number;
  baseNextCents: number;
}

function denominationLabel(cents: number): string {
  return cents >= 100
    ? `$${(cents / 100).toLocaleString("es-MX")}`
    : `$${(cents / 100).toFixed(2)}`;
}

function readCentsField(
  value: string,
  required = false,
): { cents: number; error: "required" | "invalid" | "negative" | null } {
  const trimmed = value.trim();
  if (!trimmed) return { cents: 0, error: required ? "required" : null };
  // Acepta 400, 400.5 y 400,50. Rechaza texto, negativos y más de dos decimales.
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(trimmed)) {
    return { cents: 0, error: "invalid" };
  }
  const amount = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(amount)) return { cents: 0, error: "invalid" };
  if (amount < 0) return { cents: 0, error: "negative" };
  return { cents: Math.round(amount * 100), error: null };
}

function moneyFieldMessage(
  field: MoneyField,
  error: "required" | "invalid" | "negative",
): string {
  if (field === "counted" && error === "required") {
    return "Escribe cuánto contaste. El total contado debe ser mayor que cero.";
  }
  const label = MONEY_FIELD_LABEL[field];
  if (error === "required") return `${label}: escribe un monto.`;
  if (error === "negative") return `${label}: escribe un monto de cero o más.`;
  return `${label} debe ser un número. Ejemplo: 400.00.`;
}

function differenceText(cents: number): string {
  if (cents === 0) return "Cuadra";
  return `${cents < 0 ? "Falta" : "Sobra"} ${formatMxn(Math.abs(cents))}`;
}

function CashCloseSummary({
  close,
  history,
}: {
  close: CashClose;
  history: CashClose[];
}) {
  return (
    <section
      aria-labelledby="corte-guardado"
      className="rounded-xl border border-green/30 bg-green-soft/50 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="corte-guardado" className="text-base font-bold text-green">
          Corte #{close.version}
        </h3>
        <p className="text-sm text-ink-2">{formatActivityDate(close.createdAt)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-ink-2">Efectivo del día</dt>
          <dd className="tabular font-semibold text-ink">
            {formatMxn(close.snapshotCashCents)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-ink-2">Fiado pendiente</dt>
          <dd className="tabular font-semibold text-ink">
            {close.snapshotKnown ? formatMxn(close.snapshotCreditCents) : "No registrado"}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-ink-2">Pendiente digital de hoy</dt>
          <dd className="tabular font-semibold text-ink">
            {close.snapshotKnown
              ? formatMxn(close.snapshotPendingDigitalCents)
              : "No registrado"}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-ink-2">Contado</dt>
          <dd className="tabular font-semibold text-ink">
            {formatMxn(close.countedCents)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-ink-2">Esperado con movimientos</dt>
          <dd className="tabular font-semibold text-ink">
            {formatMxn(close.expectedCents)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-ink-2">Retiros</dt>
          <dd className="tabular font-semibold text-ink">
            {formatMxn(close.withdrawalsCents)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-ink-2">Base para mañana</dt>
          <dd className="tabular font-semibold text-ink">
            {formatMxn(close.baseNextCents)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 sm:col-span-2">
          <dt className="text-ink-2">Diferencia</dt>
          <dd
            className={cn(
              "tabular font-semibold",
              close.differenceCents === 0
                ? "text-green"
                : close.differenceCents < 0
                  ? "text-danger"
                  : "text-attention",
            )}
          >
            {differenceText(close.differenceCents)}
          </dd>
        </div>
      </dl>
      {close.reason ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-ink-2">
          Motivo de la corrección: <span className="font-semibold text-ink">{close.reason}</span>
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Esta foto no cambia si hay ventas o cobros después del cierre.
      </p>
      {!close.snapshotKnown ? (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-ink-2">
          Este corte viene de una versión anterior: el fiado y el pendiente digital no se
          registraban al cerrar, por eso dicen “No registrado”.
        </p>
      ) : null}
      {history.length > 1 ? (
        <div className="mt-3 border-t border-green/20 pt-3">
          <h4 className="text-sm font-bold text-ink">Cierres de hoy</h4>
          {history.length > 5 ? (
            <p className="mt-1 text-sm text-ink-2">
              Se muestran las últimas 5 versiones y la primera.
            </p>
          ) : null}
          <ul className="mt-2 space-y-2">
            {history.slice(0, 6).map((item) => (
              <li key={item.id} className="rounded-lg bg-surface px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">Corte #{item.version}</span>
                  <span className="text-ink-2">{formatTime(item.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-ink-2">
                  Contado {formatMxn(item.countedCents)} · {differenceText(item.differenceCents)}
                </p>
                {item.reason ? (
                  <p className="mt-0.5 text-ink-2">
                    Motivo: <span className="text-ink">{item.reason}</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function CashCloseCard({
  showToast,
}: {
  showToast: (tone: ToastTone, text: string) => void;
}) {
  const [status, setStatus] = useState<CashStatus | null>(null);
  const [opening, setOpening] = useState("");
  const [expenses, setExpenses] = useState("");
  const [withdrawals, setWithdrawals] = useState("");
  const [baseNext, setBaseNext] = useState("");
  const [counted, setCounted] = useState("");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [showCounts, setShowCounts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{
    field: MoneyField;
    message: string;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [stale, setStale] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<CashClosePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewIssues, setPreviewIssues] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<ClosePayload | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [applyPreviousWithdrawal, setApplyPreviousWithdrawal] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const openingRef = useRef<HTMLInputElement>(null);
  const expensesRef = useRef<HTMLInputElement>(null);
  const withdrawalsRef = useRef<HTMLInputElement>(null);
  const countedRef = useRef<HTMLInputElement>(null);
  const baseRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const dirtyRef = useRef(false);
  const statusRef = useRef<CashStatus | null>(null);
  const previewTokenRef = useRef(0);

  const fillFromStatus = useCallback((data: CashStatus) => {
    setOpening((data.openingCents / 100).toFixed(2));
    setExpenses((data.expensesCents / 100).toFixed(2));
    setWithdrawals((data.withdrawalsCents / 100).toFixed(2));
    setBaseNext(
      ((data.saved?.baseNextCents ?? data.openingCents) / 100).toFixed(2),
    );
    setCounted(data.saved ? (data.saved.countedCents / 100).toFixed(2) : "");
    setCounts({});
    setApplyPreviousWithdrawal(false);
  }, []);

  const load = useCallback(
    async (options?: { preserveDraft?: boolean }): Promise<boolean> => {
      const preserve = Boolean(options?.preserveDraft);
      if (preserve) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch("/api/cash", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo leer la caja.");
        const data = await readJsonBody<CashStatus>(response);
        if (!data) throw new Error("No se pudo leer la caja.");
        setStatus(data);
        statusRef.current = data;

        // Carrera: el usuario empezó a contar mientras resolvía el fetch.
        // Se actualizan los totales, pero nunca sus campos.
        if (!preserve && dirtyRef.current) {
          setStale(true);
          return true;
        }

        if (!preserve) {
          fillFromStatus(data);
          dirtyRef.current = false;
          setDirty(false);
          setStale(false);
          setSavedNotice(null);
        } else {
          setStale(false);
        }
        return true;
      } catch (err) {
        setError(
          friendlyError(err, "No se pudo leer la caja. Revisa tu conexión."),
        );
        if (statusRef.current) setStale(true);
        return false;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fillFromStatus],
  );

  useEffect(() => {
    // Carga inicial del corte; el formulario se llena una vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      // Una venta o un refresco no deben borrar un conteo sin guardar.
      if (dirty) {
        setStale(true);
        return;
      }
      void load();
    };
    window.addEventListener("mercado:refresh", handler);
    return () => window.removeEventListener("mercado:refresh", handler);
  }, [dirty, load]);

  const openingField = readCentsField(opening);
  const expensesField = readCentsField(expenses);
  const withdrawalsField = readCentsField(withdrawals);
  const countedField = readCentsField(counted);
  const baseNextField = readCentsField(baseNext);
  const openingCents = openingField.cents;
  const expensesCents = expensesField.cents;
  const withdrawalsCents = withdrawalsField.cents;
  const countedCents = countedField.cents;
  const baseNextCents = baseNextField.cents;
  const hasCounted = counted.trim() !== "";
  // Un campo inválido se lee como 0: no mostramos una diferencia calculada
  // sobre un cero que la persona no escribió.
  const hasMoneyInputError = [
    openingField.error,
    expensesField.error,
    withdrawalsField.error,
    countedField.error,
    baseNextField.error,
  ].some(Boolean);
  const canShowDifference = hasCounted && !hasMoneyInputError;
  const previousWithdrawalCents = status?.saved?.withdrawalNextCents ?? 0;
  const appliedPreviousWithdrawalCents = applyPreviousWithdrawal
    ? previousWithdrawalCents
    : 0;
  const effectiveWithdrawalsCents =
    withdrawalsCents + appliedPreviousWithdrawalCents;
  const expectedCents = status
    ? openingCents +
      status.cashSalesCents +
      status.cashCreditCents -
      expensesCents -
      effectiveWithdrawalsCents
    : 0;
  const differenceCents = countedCents - expectedCents;
  const withdrawalNextCents = Math.max(0, countedCents - baseNextCents);
  const differenceLabel =
    differenceCents === 0 ? "Cuadra" : differenceCents > 0 ? "Sobra" : "Falta";
  const differenceAbsCents = Math.abs(differenceCents);
  const baseExceedsCounted =
    hasCounted && countedCents > 0 && baseNextCents > countedCents;

  function markDirty() {
    dirtyRef.current = true;
    setDirty(true);
    setFieldError(null);
    setError(null);
  }

  function updateCount(denomination: number, quantity: number) {
    // Un input numérico vacío o inválido no debe convertir el total en NaN.
    const safeQuantity = Number.isFinite(quantity)
      ? Math.max(0, Math.floor(quantity))
      : 0;
    const next = { ...counts, [denomination]: safeQuantity };
    setCounts(next);
    const total = DENOMINATIONS.reduce(
      (sum, value) => sum + value * (next[value] ?? 0),
      0,
    );
    setCounted((total / 100).toFixed(2));
    markDirty();
  }

  function validateDraft(): ClosePayload | null {
    setFieldError(null);
    setError(null);

    const fields: Array<{
      field: MoneyField;
      parsed: ReturnType<typeof readCentsField>;
      ref: HTMLInputElement | null;
      positive?: boolean;
    }> = [
      { field: "opening", parsed: readCentsField(opening), ref: openingRef.current },
      { field: "expenses", parsed: readCentsField(expenses), ref: expensesRef.current },
      {
        field: "withdrawals",
        parsed: readCentsField(withdrawals),
        ref: withdrawalsRef.current,
      },
      {
        field: "counted",
        parsed: readCentsField(counted, true),
        ref: countedRef.current,
        positive: true,
      },
      { field: "baseNext", parsed: readCentsField(baseNext), ref: baseRef.current },
    ];

    for (const field of fields) {
      if (field.parsed.error || (field.positive && field.parsed.cents <= 0)) {
        const message = field.parsed.error
          ? moneyFieldMessage(field.field, field.parsed.error)
          : "Escribe cuánto contaste. El total contado debe ser mayor que cero.";
        setFieldError({ field: field.field, message });
        field.ref?.focus();
        return null;
      }
    }

    const baseCents = readCentsField(baseNext).cents;
    const countedTotal = readCentsField(counted).cents;
    if (baseCents > countedTotal) {
      const message = `La base para mañana (${formatMxn(baseCents)}) no puede ser mayor que el total contado (${formatMxn(countedTotal)}). Baja la base o corrige el conteo.`;
      setFieldError({ field: "baseNext", message });
      baseRef.current?.focus();
      return null;
    }

    return {
      openingCents,
      expensesCents,
      withdrawalsCents: effectiveWithdrawalsCents,
      countedCents: countedTotal,
      baseNextCents: baseCents,
    };
  }

  function closeConfirm() {
    previewTokenRef.current += 1;
    setConfirmOpen(false);
    setReasonError(null);
    setPreviewLoading(false);
  }

  async function fetchPreview(payload: ClosePayload) {
    const token = previewTokenRef.current + 1;
    previewTokenRef.current = token;
    setPreview(null);
    setPreviewIssues(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const response = await fetch("/api/cash/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJsonBody<{
        preview?: CashClosePreview;
        issues?: Array<{ code: string; message: string }>;
        error?: string;
      }>(response);
      if (token !== previewTokenRef.current) return;
      if (!response.ok || !data?.preview) {
        throw new Error(data?.error ?? "No se pudo calcular el corte.");
      }
      setPreview(data.preview);
      setPreviewIssues(data.issues?.[0]?.message ?? null);
    } catch (err) {
      if (token !== previewTokenRef.current) return;
      setPreviewError(
        friendlyError(err, "No se pudo calcular el corte con el servidor."),
      );
    } finally {
      if (token === previewTokenRef.current) setPreviewLoading(false);
    }
  }

  function requestSave() {
    if (!status || saving) return;
    const payload = validateDraft();
    if (!payload) return;
    setPendingPayload(payload);
    setPendingRequestId(newRequestId("close"));
    setReasonError(null);
    setError(null);
    setConfirmOpen(true);
    void fetchPreview(payload);
  }

  async function saveClose() {
    if (!status || saving || !pendingPayload || !pendingRequestId) return;
    if (status.saved && !reason.trim()) {
      setReasonError("Escribe el motivo de la corrección. No se puede guardar sin motivo.");
      reasonRef.current?.focus();
      return;
    }
    const usedPreviousWithdrawal = applyPreviousWithdrawal
      ? previousWithdrawalCents
      : 0;
    setSaving(true);
    setError(null);
    setReasonError(null);
    try {
      const response = await fetch("/api/cash/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingPayload,
          reason: status.saved ? reason.trim() : undefined,
          requestId: pendingRequestId,
          expectedVersion: status.saved?.version ?? 0,
        }),
      });
      const data = await readJsonBody<{
        close?: CashClose;
        status?: CashStatus;
        error?: string;
        code?: string;
      }>(response);
      if (!response.ok || !data?.close || !data.status) {
        if (data?.code === "reason_required" || data?.code === "version_conflict") {
          const message =
            data.code === "reason_required"
              ? "Alguien guardó un corte antes. Actualiza los totales y escribe el motivo de la corrección."
              : "Otro corte se guardó antes. Actualicé los totales; revisa y vuelve a intentar.";
          setPendingRequestId(null);
          // Si la otra pestaña cambió el cierre, el retiro del corte anterior
          // ya no es el mismo; no arrastrar el checkbox marcado.
          setApplyPreviousWithdrawal(false);
          closeConfirm();
          showToast("error", message);
          void load({ preserveDraft: true }).then((ok) => {
            if (ok) setError(message);
          });
          return;
        }
        throw new Error(data?.error ?? "No se pudo guardar el corte.");
      }
      const close = data.close;
      setStatus(data.status);
      statusRef.current = data.status;
      setOpening((close.openingCents / 100).toFixed(2));
      setExpenses((close.expensesCents / 100).toFixed(2));
      setWithdrawals((close.withdrawalsCents / 100).toFixed(2));
      setCounted((close.countedCents / 100).toFixed(2));
      setBaseNext((close.baseNextCents / 100).toFixed(2));
      setApplyPreviousWithdrawal(false);
      dirtyRef.current = false;
      setDirty(false);
      setStale(false);
      setPendingPayload(null);
      setPendingRequestId(null);
      setReason("");
      closeConfirm();
      const baseNotice = `Corte #${close.version} guardado. ${differenceText(close.differenceCents)}.`;
      const notice =
        usedPreviousWithdrawal > 0
          ? `${baseNotice} Se sumó el retiro previo de ${formatMxn(usedPreviousWithdrawal)} a retiros.`
          : baseNotice;
      setSavedNotice(notice);
      showToast(close.differenceCents === 0 ? "ok" : "info", notice);
    } catch (err) {
      setError(
        friendlyError(err, "No se pudo guardar el corte. Revisa tu conexión."),
      );
    } finally {
      setSaving(false);
    }
  }

  function fieldErrorText(field: MoneyField) {
    if (fieldError?.field !== field) return null;
    return (
      <p
        id={`corte-${field}-error`}
        role="alert"
        className="mt-1 text-sm font-semibold text-danger"
      >
        {fieldError.message}
      </p>
    );
  }

  return (
    <div className="paper-card rounded-2xl border border-separator bg-surface p-[20px] shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 text-[1.375rem] font-semibold tracking-tight text-ink">
          Cuenta el efectivo de hoy
        </h2>
        <button
          type="button"
          onClick={() => void load({ preserveDraft: dirty })}
          disabled={loading || refreshing}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2 transition hover:text-ink disabled:opacity-50"
          title={dirty ? "Actualizar totales sin borrar el conteo" : "Actualizar corte"}
          aria-label={
            dirty ? "Actualizar totales sin borrar el conteo" : "Actualizar corte"
          }
        >
          <RefreshCw
            className={cn("h-4 w-4", (loading || refreshing) && "animate-spin")}
          />
        </button>
      </div>

      {loading && !status ? (
        <div className="mt-4 space-y-2">
          <div className="shimmer h-10 rounded-xl" />
          <div className="shimmer h-10 rounded-xl" />
        </div>
      ) : error && !status ? (
        <div className="mt-4 rounded-xl bg-terracotta-soft px-4 py-3 text-sm text-attention">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 flex min-h-12 items-center justify-center rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:text-ink"
          >
            Reintentar
          </button>
        </div>
      ) : status ? (
        <div className="mt-4 space-y-3">
          {dirty ? (
            <div
              role="status"
              className="rounded-xl border border-attention/30 bg-terracotta-soft/60 px-4 py-3"
            >
              <p className="text-sm font-bold text-attention">Hay cambios sin guardar.</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
                {stale
                  ? "Los totales del servidor pueden haber cambiado. No borré tu conteo."
                  : "Puedes actualizar solo los totales del servidor sin borrar tu conteo."}
              </p>
              <button
                type="button"
                onClick={() => {
                  void load({ preserveDraft: true }).then((ok) => {
                    if (ok) {
                      showToast(
                        "info",
                        "Totales actualizados. Tu conteo sigue igual.",
                      );
                    }
                  });
                }}
                disabled={refreshing}
                className="mt-2 flex min-h-12 items-center justify-center rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:text-ink disabled:opacity-60"
              >
                {refreshing ? "Actualizando…" : "Actualizar totales"}
              </button>
            </div>
          ) : null}

          {savedNotice ? (
            <p
              role="status"
              className="rounded-xl border border-green/25 bg-green-soft/70 px-4 py-3 text-sm font-semibold text-green"
            >
              {savedNotice}
            </p>
          ) : null}

          {status.saved ? (
            <CashCloseSummary close={status.saved} history={status.history} />
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Total contado</span>
            <div
              className={cn(
                "mt-1 flex items-center gap-1 rounded-xl border bg-surface-2 px-[12px] py-2",
                fieldError?.field === "counted" ? "border-danger" : "border-separator",
              )}
            >
              <span className="text-sm text-ink-2">$</span>
              <input
                ref={countedRef}
                id="corte-contado"
                value={counted}
                onChange={(event) => {
                  setCounted(event.target.value);
                  setCounts({});
                  markDirty();
                }}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                aria-label="Total contado en pesos"
                aria-invalid={fieldError?.field === "counted"}
                aria-describedby={
                  fieldError?.field === "counted" ? "corte-counted-error" : undefined
                }
                className="tabular min-h-12 w-full min-w-0 bg-transparent text-lg font-bold text-ink placeholder:text-placeholder"
              />
            </div>
            {fieldErrorText("counted")}
          </label>

          {canShowDifference ? (
            <div
              role="status"
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3",
                differenceCents === 0
                  ? "border-green/25 bg-green-soft/60"
                  : differenceCents < 0
                    ? "border-danger/25 bg-terracotta-soft/70"
                    : "border-attention/25 bg-terracotta-soft/70",
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-bold",
                    differenceCents === 0
                      ? "text-green"
                      : differenceCents < 0
                        ? "text-danger"
                        : "text-attention",
                  )}
                >
                  {differenceLabel}
                </p>
                <p className="mt-0.5 text-sm text-ink-2">
                  {differenceCents === 0
                    ? "El efectivo cuadra con lo esperado."
                    : differenceCents < 0
                      ? "Falta dinero en la caja."
                      : "Hay más dinero del esperado."}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
                  Diferencia estimada
                </p>
                <p
                  className={cn(
                    "tabular mt-1 text-[1.5rem] font-semibold leading-none",
                    differenceCents === 0
                      ? "text-green"
                      : differenceCents < 0
                        ? "text-danger"
                        : "text-attention",
                  )}
                >
                  {formatMxn(differenceAbsCents)}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
              {hasMoneyInputError
                ? "Corrige los montos marcados para calcular la diferencia."
                : "Escribe el total contado para ver si cuadra."}
            </p>
          )}
          <p className="text-xs leading-relaxed text-ink-2">
            La diferencia exacta se calcula otra vez en el servidor al confirmar.
          </p>

          <button
            type="button"
            onClick={() => setShowCounts((value) => !value)}
            aria-expanded={showCounts}
            aria-controls={showCounts ? "corte-denominaciones" : undefined}
            className="min-h-12 text-left text-sm font-semibold text-green underline-offset-2 hover:underline"
          >
            {showCounts ? "Ocultar conteo por billetes y monedas" : "Contar por billetes y monedas"}
          </button>

          {showCounts ? (
            <div id="corte-denominaciones" className="space-y-2">
              <p className="text-sm text-ink-2">
                El conteo por billetes reemplaza el total contado.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-3">
                {DENOMINATIONS.map((denomination) => (
                  <label key={denomination} className="block min-w-0">
                    <span className="block text-sm font-semibold text-ink-2">
                      {denominationLabel(denomination)}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={counts[denomination] ?? 0}
                      onChange={(event) =>
                        updateCount(denomination, Number(event.target.value))
                      }
                      aria-label={`Cantidad de ${denominationLabel(denomination)}`}
                      className="tabular mt-1 min-h-12 w-full rounded-xl border border-separator bg-surface px-2 py-1.5 text-center text-sm text-ink focus:border-green"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl border border-separator bg-surface px-[16px] py-3">
            <p className="text-sm font-semibold text-ink">De dónde sale el esperado</p>
            <div className="space-y-1.5 text-sm">
              {[
                { label: "Ventas en efectivo", value: status.cashSalesCents },
                { label: "Abonos de fiado en efectivo", value: status.cashCreditCents },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <span className="min-w-0 text-ink-2">{row.label}</span>
                  <span className="tabular shrink-0 font-semibold text-ink">
                    {formatMxn(row.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label className="block min-w-0">
                <span className="text-sm font-semibold text-ink-2">Base inicial</span>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 rounded-xl border bg-surface-2 px-[10px] py-2",
                    fieldError?.field === "opening" ? "border-danger" : "border-separator",
                  )}
                >
                  <span className="text-sm text-ink-2">$</span>
                  <input
                    ref={openingRef}
                    id="corte-opening"
                    value={opening}
                    onChange={(event) => {
                      setOpening(event.target.value);
                      markDirty();
                    }}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="Base inicial en pesos"
                    aria-invalid={fieldError?.field === "opening"}
                    aria-describedby={
                      fieldError?.field === "opening" ? "corte-opening-error" : undefined
                    }
                    className="tabular min-h-12 w-full min-w-0 bg-transparent text-sm text-ink"
                  />
                </div>
                {fieldErrorText("opening")}
              </label>
              <label className="block min-w-0">
                <span className="text-sm font-semibold text-ink-2">Gastos de caja</span>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 rounded-xl border bg-surface-2 px-[10px] py-2",
                    fieldError?.field === "expenses" ? "border-danger" : "border-separator",
                  )}
                >
                  <span className="text-sm text-ink-2">$</span>
                  <input
                    ref={expensesRef}
                    id="corte-expenses"
                    value={expenses}
                    onChange={(event) => {
                      setExpenses(event.target.value);
                      markDirty();
                    }}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="Gastos de caja en pesos"
                    aria-invalid={fieldError?.field === "expenses"}
                    aria-describedby={
                      fieldError?.field === "expenses" ? "corte-expenses-error" : undefined
                    }
                    className="tabular min-h-12 w-full min-w-0 bg-transparent text-sm text-ink"
                  />
                </div>
                {fieldErrorText("expenses")}
              </label>
              <label className="block min-w-0">
                <span className="text-sm font-semibold text-ink-2">Retiros</span>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 rounded-xl border bg-surface-2 px-[10px] py-2",
                    fieldError?.field === "withdrawals" ? "border-danger" : "border-separator",
                  )}
                >
                  <span className="text-sm text-ink-2">$</span>
                  <input
                    ref={withdrawalsRef}
                    id="corte-withdrawals"
                    value={withdrawals}
                    onChange={(event) => {
                      setWithdrawals(event.target.value);
                      markDirty();
                    }}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="Retiros en pesos"
                    aria-invalid={fieldError?.field === "withdrawals"}
                    aria-describedby={
                      fieldError?.field === "withdrawals"
                        ? "corte-withdrawals-error"
                        : undefined
                    }
                    className="tabular min-h-12 w-full min-w-0 bg-transparent text-sm text-ink"
                  />
                </div>
                {fieldErrorText("withdrawals")}
              </label>
            </div>
            {status.saved && previousWithdrawalCents > 0 ? (
              <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-separator bg-surface px-3 py-2">
                <input
                  type="checkbox"
                  checked={applyPreviousWithdrawal}
                  onChange={(event) => {
                    setApplyPreviousWithdrawal(event.target.checked);
                    markDirty();
                  }}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-green)]"
                />
                <span className="min-w-0 text-sm leading-relaxed">
                  <span className="font-semibold text-ink">
                    Ya retiré {formatMxn(previousWithdrawalCents)} del corte #
                    {status.saved.version}
                  </span>
                  <span className="mt-0.5 block text-ink-2">
                    Súmalo a retiros y al esperado para no marcar un faltante falso.
                  </span>
                </span>
              </label>
            ) : null}
            {applyPreviousWithdrawal && previousWithdrawalCents > 0 ? (
              <p className="text-sm text-ink-2">
                Retiros para el corte:{" "}
                <span className="font-semibold text-ink">
                  {formatMxn(effectiveWithdrawalsCents)}
                </span>{" "}
                (incluye {formatMxn(previousWithdrawalCents)} del corte previo).
              </p>
            ) : null}
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-separator pt-2">
              <span className="min-w-0 font-semibold text-ink">Debería haber</span>
              <span className="tabular text-[1.375rem] font-semibold leading-none text-ink">
                {formatMxn(expectedCents)}
              </span>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Base para mañana</span>
            <div
              className={cn(
                "mt-1 flex items-center gap-1 rounded-xl border bg-surface-2 px-[10px] py-2",
                fieldError?.field === "baseNext" || baseExceedsCounted
                  ? "border-danger"
                  : "border-separator",
              )}
            >
              <span className="text-sm text-ink-2">$</span>
              <input
                ref={baseRef}
                id="corte-base-next"
                value={baseNext}
                onChange={(event) => {
                  setBaseNext(event.target.value);
                  markDirty();
                }}
                inputMode="decimal"
                autoComplete="off"
                aria-label="Base para mañana en pesos"
                aria-invalid={
                  fieldError?.field === "baseNext" || baseExceedsCounted
                }
                aria-describedby={
                  fieldError?.field === "baseNext"
                    ? "corte-baseNext-error"
                    : baseExceedsCounted
                      ? "corte-base-warning"
                      : undefined
                }
                className="tabular min-h-12 w-full bg-transparent text-sm text-ink"
              />
            </div>
            {fieldErrorText("baseNext")}
            {baseExceedsCounted && fieldError?.field !== "baseNext" ? (
              <p
                id="corte-base-warning"
                role="alert"
                className="mt-1 text-sm font-semibold text-danger"
              >
                La base para mañana no puede ser mayor que el total contado. Baja la base o
                corrige el conteo.
              </p>
            ) : null}
          </label>
          {canShowDifference ? (
            <p className="text-sm text-ink-2">
              Adicional a retirar:{" "}
              <span className="font-semibold text-ink">
                {formatMxn(withdrawalNextCents)}
              </span>
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={requestSave}
            disabled={saving || baseExceedsCounted}
            aria-busy={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status.saved ? (
              <NotebookPen className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {saving
              ? "Guardando…"
              : status.saved
                ? "Corregir corte"
                : "Guardar corte"}
          </button>
          <p className="corte-note text-sm leading-relaxed text-ink-2">
            El corte no se guarda solo. Gastos, retiros y base se registran cuando tú
            confirmas.
          </p>
        </div>
      ) : null}

      <Sheet
        open={confirmOpen}
        onClose={() => {
          if (saving) return;
          closeConfirm();
        }}
        title={status?.saved ? "Corregir corte" : "Confirmar corte"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-2">
            {status?.saved
              ? `El corte #${status.saved.version} no se borra. Se guarda una versión nueva con el motivo.`
              : "Revisa el conteo antes de guardar. El corte queda registrado con estos montos."}
          </p>

          {previewLoading ? (
            <div className="space-y-2" role="status">
              <div className="shimmer h-8 rounded-lg" />
              <div className="shimmer h-8 rounded-lg" />
              <p className="text-sm text-ink-2">Calculando la diferencia con el servidor…</p>
            </div>
          ) : previewError ? (
            <div
              role="alert"
              className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger"
            >
              <p>{previewError}</p>
              <button
                type="button"
                onClick={() => {
                  if (pendingPayload) void fetchPreview(pendingPayload);
                }}
                className="mt-2 flex min-h-12 items-center justify-center rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:text-ink"
              >
                Reintentar
              </button>
            </div>
          ) : preview ? (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <dt className="text-ink-2">Gastos de caja</dt>
                  <dd className="tabular font-semibold text-ink">
                    {formatMxn(preview.expensesCents)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <dt className="text-ink-2">Retiros</dt>
                  <dd className="tabular font-semibold text-ink">
                    {formatMxn(preview.withdrawalsCents)}
                  </dd>
                </div>
                {applyPreviousWithdrawal && previousWithdrawalCents > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <dt className="text-ink-2">
                      Incluye retiro previo del corte #{status?.saved?.version}
                    </dt>
                    <dd className="tabular font-semibold text-ink">
                      {formatMxn(previousWithdrawalCents)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-2">
                  <dt className="text-ink-2">Debería haber</dt>
                  <dd className="tabular font-semibold text-ink">
                    {formatMxn(preview.expectedCents)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <dt className="text-ink-2">Total contado</dt>
                  <dd className="tabular font-semibold text-ink">
                    {formatMxn(preview.countedCents)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <dt className="text-ink-2">Base para mañana</dt>
                  <dd className="tabular font-semibold text-ink">
                    {formatMxn(preview.baseNextCents)}
                  </dd>
                </div>
              </dl>
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  preview.differenceCents === 0
                    ? "border-green/25 bg-green-soft/60"
                    : preview.differenceCents < 0
                      ? "border-danger/25 bg-terracotta-soft/70"
                      : "border-attention/25 bg-terracotta-soft/70",
                )}
              >
                <p className="text-sm font-bold text-ink">
                  {preview.differenceCents === 0
                    ? "Cuadra"
                    : preview.differenceCents < 0
                      ? "Falta"
                      : "Sobra"}
                </p>
                <p className="tabular text-[1.375rem] font-semibold text-ink">
                  {formatMxn(Math.abs(preview.differenceCents))}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-ink-2">
                Diferencia calculada por el servidor con los movimientos de ahora.
              </p>
              {previewIssues ? (
                <p
                  role="alert"
                  className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger"
                >
                  {previewIssues}
                </p>
              ) : null}
            </>
          ) : null}

          {status?.saved ? (
            <label className="block">
              <span className="text-sm font-semibold text-ink">
                Motivo de la corrección (obligatorio)
              </span>
              <textarea
                ref={reasonRef}
                id="corte-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(null);
                }}
                maxLength={280}
                rows={3}
                aria-invalid={Boolean(reasonError)}
                aria-describedby={reasonError ? "corte-reason-error" : undefined}
                placeholder="Ejemplo: conté de nuevo y faltaba un billete."
                className="mt-1 min-h-24 w-full rounded-xl border border-separator bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-placeholder focus:border-green"
              />
              {reasonError ? (
                <p
                  id="corte-reason-error"
                  role="alert"
                  className="mt-1 text-sm font-semibold text-danger"
                >
                  {reasonError}
                </p>
              ) : null}
            </label>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void saveClose()}
            disabled={
              saving ||
              previewLoading ||
              Boolean(previewError) ||
              Boolean(previewIssues)
            }
            aria-busy={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {saving
              ? "Guardando…"
              : status?.saved
                ? "Guardar corrección"
                : "Guardar corte"}
          </button>
          <button
            type="button"
            onClick={closeConfirm}
            disabled={saving}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-separator bg-surface text-sm font-semibold text-ink-2 transition hover:text-ink disabled:opacity-60"
          >
            Volver a contar
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function GoalCard({
  showToast,
}: {
  showToast: (tone: ToastTone, text: string) => void;
}) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/goals", { cache: "no-store" });
      if (!response.ok) throw new Error("No pudimos cargar la meta.");
      const data = await readJsonBody<{ goals?: Goal[] }>(response);
      if (!data) throw new Error("No pudimos cargar la meta.");
      setGoal(data.goals?.[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar la meta.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de la meta; se actualiza al aportar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function contribute() {
    if (!goal) return;
    const amountCents = parseMoney(amount);
    if (amountCents <= 0) {
      setError("Escribe un monto mayor a cero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/goals/${goal.id}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, note: "Aportación desde la caja" }),
      });
      if (!response.ok) throw new Error("No pude aportar.");
      const data = await readJsonBody<{ goal?: Goal }>(response);
      if (!data?.goal) throw new Error("No pude aportar.");
      setGoal(data.goal);
      setAmount("");
      showToast("ok", `Apartaste ${formatMxn(amountCents)} para ${data.goal.title}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude aportar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !goal) {
    return <div className="shimmer h-64 rounded-2xl" />;
  }

  if (error && !goal) {
    return (
      <div role="alert" className="rounded-2xl border border-attention/30 bg-terracotta-soft p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-attention">
          <CircleAlert className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">No pudimos cargar la meta</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mt-3 inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:text-ink disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Reintentar
        </button>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="rounded-2xl border border-dashed border-separator bg-surface p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-soft text-green">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">Aún no hay una meta</p>
        <p className="mt-1 text-sm text-ink-2">La primera puede ser algo concreto para tu puesto.</p>
      </div>
    );
  }

  return (
    <>
      <div className="goal-card paper-card rounded-2xl border border-separator bg-surface p-[20px] shadow-card sm:p-5">
        <div className="goal-card-header flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-ink-2">Mi camino</p>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-green-soft text-green">
            <Umbrella className="h-6 w-6" strokeWidth={1.6} />
          </div>
        </div>

        <div className="goal-body mt-4 space-y-3">
        <div className="min-w-0">
          <h2 className="goal-card-title text-[1.25rem] font-semibold tracking-tight text-ink">{goal.title}</h2>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm text-ink-2">
              {formatMxn(goal.savedCents)} de {formatMxn(goal.targetCents)}
            </p>
            <p className="tabular shrink-0 text-[1.375rem] font-semibold text-green">{goal.progressPct}%</p>
          </div>
        </div>

        <div className="goal-action-row flex flex-col gap-2 sm:flex-row">
          <div className="flex min-h-12 flex-1 items-center gap-1 rounded-xl border border-separator bg-surface-2 px-3">
            <span className="text-sm text-ink-2">$</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="Monto"
              aria-label="¿Cuánto apartaste?"
              className="tabular min-h-12 w-full bg-transparent text-[1rem] text-ink outline-none placeholder:text-placeholder"
            />
          </div>
          <button
            type="button"
            onClick={() => void contribute()}
            disabled={saving}
            aria-busy={saving}
            data-chrome-critical
            className="on-accent flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent-press disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Apartar
          </button>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={goal.progressPct}
          aria-label={`Progreso de ${goal.title}`}
          className="h-2.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, Math.max(0, goal.progressPct))}%` }}
          />
        </div>

        <p className="text-sm text-ink-2">
          {goal.weeksRemaining !== null
            ? `${goal.weeksRemaining} semanas para la meta`
            : "Sin fecha límite"}
        </p>

        {error ? (
          <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="text-xs text-ink-2">Falta</p>
            <p className="tabular mt-0.5 text-[1rem] font-semibold text-ink">{formatMxn(goal.remainingCents)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="text-xs text-ink-2">Por semana</p>
            <p className="tabular mt-0.5 text-[1rem] font-semibold text-ink">
              {goal.weeklyNeededCents ? formatMxn(goal.weeklyNeededCents) : "—"}
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink-2">
          Apartado declarado: no es una cuenta bancaria ni dinero custodiado. El efectivo sigue en tu
          resguardo.
        </p>
      </div>
      </div>

      <figure className="mt-4 overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
        <div className="relative h-[160px] bg-surface-2 sm:h-44">
          <Image
            src="/puesto-flores.jpg"
            alt="Puesto de flores en un tianguis de la Ciudad de México"
            fill
            sizes="(max-width: 1024px) 100vw, 420px"
            className="object-cover"
          />
        </div>
        <figcaption className="px-4 py-2.5 text-xs leading-relaxed text-ink-2">
          Lo que estás construyendo · Foto: Ehécatl Cabrera / CC BY-SA 4.0.
        </figcaption>
      </figure>
    </>
  );
}


function ReconcileCard({ demoMode }: { demoMode: boolean }) {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reconcile() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reconcile", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo conciliar la caja.");
      const data = await readJsonBody<ReconciliationReport>(response);
      if (!data) throw new Error("No se pudo conciliar la caja.");
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo conciliar la caja.",
      );
    } finally {
      setLoading(false);
    }
  }

  const issues = report?.items.filter((item) => item.status !== "ok") ?? [];

  return (
    <div className="rounded-2xl bg-surface-2 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="reconcile-eyebrow text-sm font-semibold text-ink-2">Conciliación</p>
          <h2 className="reconcile-title mt-1 min-w-0 text-[1.375rem] font-semibold tracking-tight text-ink">
            ¿Cuadra con pey?
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void reconcile()}
          disabled={loading || demoMode}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? "Consultando" : "Conciliar"}
        </button>
      </div>

      {demoMode ? (
        <p className="reconcile-note mt-4 rounded-xl bg-surface/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
          En modo demo no hay transacciones reales de pey. La conciliación se
          activa con la conexión real de pey.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-xl bg-terracotta-soft px-4 py-3 text-sm text-attention">
          {error}
        </p>
      ) : !report ? (
        <p className="mt-4 rounded-xl bg-surface/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
          Compara los pagos digitales del día contra las transacciones de pey.
          No corrige nada: solo muestra si cuadran.
        </p>
      ) : report.checked === 0 ? (
        <p className="mt-4 rounded-xl bg-surface/60 px-4 py-3 text-sm text-ink-2">
          No hay pagos digitales hoy.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-3",
              report.reconciled
                ? "bg-green-soft text-green"
                : "bg-terracotta-soft text-attention",
            )}
          >
            {report.reconciled ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <CircleAlert className="h-4 w-4" />
            )}
            <p className="text-sm font-semibold">
              {report.reconciled
                ? "Cuadra: cada pago digital existe en pey."
                : `${report.issues} diferencia${report.issues === 1 ? "" : "s"} por revisar.`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl bg-surface/60 p-3">
              <p className="text-sm font-semibold text-ink-2">
                Local
              </p>
              <p className="tabular mt-1 text-base font-bold text-ink">
                {formatMxn(report.localDigitalCents)}
              </p>
            </div>
            <div className="rounded-xl bg-surface/60 p-3">
              <p className="text-sm font-semibold text-ink-2">
                pey
              </p>
              <p className="tabular mt-1 text-base font-bold text-ink">
                {formatMxn(report.peyConfirmedCents)}
              </p>
            </div>
          </div>

          {report.differenceCents !== 0 ? (
            <p className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-semibold text-ink-2">
              Diferencia: {formatMxn(report.differenceCents)}
            </p>
          ) : null}

          {issues.slice(0, 3).map((item) => (
            <div
              key={`${item.orderId}-${item.transactionId ?? "sin-tx"}`}
              className="rounded-xl bg-surface/60 px-3 py-2"
            >
              <p className="text-sm font-semibold text-ink">
                Pedido {shortOrder(item.orderId)} · {item.method}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
                {item.reason ?? item.status}
              </p>
            </div>
          ))}

          <p className="text-sm leading-relaxed text-ink-2">
            Consulta de solo lectura. No corrige pagos automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Actividad                                  */
/* -------------------------------------------------------------------------- */

function ActivityList({
  orders,
  credits,
  loading,
  error,
  onSelect,
}: {
  orders: Order[];
  credits: Credit[];
  loading: boolean;
  error: string | null;
  onSelect: (order: Order) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleOrders = showAll ? orders : orders.slice(0, 5);
  const failedWithoutData = Boolean(error) && orders.length === 0;

  return (
    <div className="activity-list view-reveal paper-card rounded-2xl border border-separator bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-2">Actividad</p>
          <h2 className="mt-0.5 text-[1.25rem] font-semibold tracking-tight text-ink">
            Últimos movimientos
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
          {failedWithoutData ? "Sin datos" : countText(orders.length, "pedido", "pedidos")}
        </span>
      </div>

      <div className="motion-list mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
        {loading && orders.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="shimmer h-14 rounded-xl" />
          ))
        ) : failedWithoutData ? (
          <div role="alert" className="rounded-xl bg-terracotta-soft px-4 py-4 text-sm text-attention">
            <p className="font-semibold">No pudimos cargar la actividad.</p>
            <p className="mt-1 leading-relaxed">
              No sabemos si hay ventas. Reintenta desde el aviso superior.
            </p>
          </div>
        ) : orders.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">
            Aún no hay ventas. Habla para crear la primera.
          </p>
        ) : (
          <>
            {error ? (
              <p
                role="status"
                className="mb-1 rounded-xl bg-terracotta-soft px-3 py-2 text-sm text-attention"
              >
                No pudimos actualizar la actividad. Estos son los últimos datos cargados.
              </p>
            ) : null}
            {visibleOrders.map((order) => {
            const truth = paymentTruth(order);
            const credit = creditForOrder(order, credits);
            const creditSettled = isCreditSettled(credit);
            const creditLabel = creditSettled
              ? "Saldado"
              : credit
                ? `saldo ${formatMxn(credit.balanceCents)}`
                : `original ${formatMxn(order.creditCents)}`;
            const mixed = truth.hasCredit && truth.receivedCents > 0;
            const sourceMixed = !truth.hasCredit && truth.isMixedSources;
            const demo = !truth.hasCredit && !sourceMixed && truth.isDemo;
            const cash = !truth.hasCredit && !sourceMixed && truth.isCash;
            const pending = !truth.hasCredit && !demo && !cash && !sourceMixed && order.status === "payment_pending";
            const Icon = truth.hasCredit
              ? NotebookPen
              : sourceMixed
                ? truth.isDemo
                  ? Sparkles
                  : Check
                : demo
                  ? Sparkles
                  : cash
                    ? Banknote
                    : order.status === "paid" || order.status === "demo_paid" || order.status === "fulfilled"
                      ? Check
                      : pending
                        ? Clock3
                        : ReceiptText;
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelect(order)}
                className="group flex min-h-14 w-full flex-wrap items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    truth.hasCredit
                      ? creditSettled
                        ? "bg-green-soft text-green"
                        : "bg-terracotta-soft text-attention"
                      : demo || pending
                        ? "bg-terracotta-soft text-attention"
                        : sourceMixed
                          ? truth.isDemo
                            ? "bg-terracotta-soft text-attention"
                            : "bg-green-soft text-green"
                          : cash
                            ? "bg-surface-2 text-ink"
                            : order.status === "paid" || order.status === "demo_paid" || order.status === "fulfilled"
                              ? "bg-green-soft text-green"
                              : "bg-surface-2 text-ink-2",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 basis-[10rem]">
                  <p className="text-sm font-semibold text-ink">
                    {order.items.map((item) => `${item.quantity} ${item.description}`).join(" · ") ||
                      `Pedido ${shortOrder(order.id)}`}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-2">
                    <time dateTime={order.createdAt}>{formatActivityDate(order.createdAt)}</time>
                    <span className="h-0.5 w-0.5 rounded-full bg-ink-2/50" />
                    <span
                      className={cn(
                        truth.hasCredit
                          ? creditSettled
                            ? "font-semibold text-green"
                            : "font-semibold text-attention"
                          : demo && "font-semibold text-attention",
                      )}
                    >
                      {truth.hasCredit
                        ? `${mixed ? "Pago mixto" : "Fiado"} · ${creditLabel}`
                        : sourceMixed
                          ? truth.isDemo
                            ? "Efectivo + demo"
                            : "Efectivo + pey"
                          : demo
                            ? "Demo"
                            : cash
                              ? "Efectivo"
                              : statusLabel(order.status)}
                    </span>
                  </p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-ink">{formatMxn(order.totalCents)}</p>
                  <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-ink-2/60 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
          </>
        )}
      </div>
      {orders.length > 5 ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-green underline-offset-2 hover:underline"
        >
          {showAll ? "Ver menos" : `Ver todo (${orders.length})`}
        </button>
      ) : null}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                                   Fiado                                    */
/* -------------------------------------------------------------------------- */

function CreditList({
  credits,
  loading,
  error,
  onStart,
}: {
  credits: Credit[];
  loading: boolean;
  error: string | null;
  onStart: (credit: Credit) => void;
}) {
  const total = credits.reduce((sum, credit) => sum + credit.balanceCents, 0);
  const customerCount = new Set(credits.map((credit) => credit.customerId)).size;
  const failedWithoutData = Boolean(error) && credits.length === 0;

  if (failedWithoutData) {
    return (
      <div role="alert" className="rounded-2xl border border-attention/30 bg-terracotta-soft p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface text-attention">
          <CircleAlert className="h-5 w-5" />
        </div>
        <p className="mt-2 text-sm font-semibold text-ink">No pudimos cargar los fiados.</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          No sabemos si te deben dinero. Reintenta desde el aviso superior.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="credit-list-card paper-card rounded-2xl border border-separator bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-2">Saldo pendiente</p>
            <p className="tabular mt-1 text-[1.75rem] font-semibold leading-none tracking-tight text-ink">
              {formatMxn(total)}
            </p>
          </div>
          <p className="text-sm text-ink-2">
            {customerCount} {customerCount === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Fiado es una libreta de deudas: no es dinero recibido ni una venta nueva.
        </p>
      </div>

      {error ? (
        <p role="status" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm text-attention">
          No pudimos actualizar el fiado. El saldo y la lista son de la última carga.
        </p>
      ) : null}

      {loading && credits.length === 0 ? (
        <div className="space-y-2.5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="shimmer h-36 rounded-2xl" />
          ))}
        </div>
      ) : credits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-separator bg-surface p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-terracotta-soft text-attention">
            <NotebookPen className="h-5 w-5" />
          </div>
          <p className="mt-2 text-sm font-semibold text-ink">Sin fiados pendientes</p>
          <p className="mt-1 text-sm text-ink-2">Cuando apuntes uno, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="motion-list space-y-2.5">
          {credits.map((credit) => (
            <div key={credit.id} className="credit-row rounded-2xl border border-separator bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-soft text-sm font-bold text-attention">
                  {initials(credit.customerName ?? "Cliente")}
                </div>
                <div className="min-w-0 flex-1 basis-[6rem]">
                  <p className="text-[1rem] font-semibold text-ink">
                    {credit.customerName ?? "Cliente"}
                  </p>
                  <p className="text-sm text-ink-2">
                    {credit.status === "partial" ? "Abono parcial" : "Pendiente"} · desde{" "}
                    {formatActivityDate(credit.createdAt)}
                    {credit.orderId ? ` · Pedido ${shortOrder(credit.orderId)}` : " · sin pedido"}
                  </p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className="tabular text-[1rem] font-semibold text-attention">
                    {formatMxn(credit.balanceCents)}
                  </p>
                  <p className="text-xs text-ink-2">
                    {credit.balanceCents < credit.originalCents
                      ? `original ${formatMxn(credit.originalCents)}`
                      : "saldo"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onStart(credit)}
                data-chrome-critical
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-sm font-semibold text-ink-2 transition hover:bg-green-soft hover:text-green"
              >
                <Banknote className="h-4 w-4" />
                Registrar abono
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                              Abono de fiado                                */
/* -------------------------------------------------------------------------- */

function CreditPaySheet({
  credit,
  amount,
  initialAmount,
  method,
  initialMethod,
  note,
  paying,
  error,
  onAmount,
  onMethod,
  onNote,
  onClose,
  onPay,
}: {
  credit: Credit | null;
  amount: string;
  initialAmount: string;
  method: "cash" | "codi" | "card" | null;
  initialMethod: "cash" | "codi" | "card" | null;
  note: string;
  paying: boolean;
  error: string | null;
  onAmount: (value: string) => void;
  onMethod: (value: "cash" | "codi" | "card") => void;
  onNote: (value: string) => void;
  onClose: () => void;
  onPay: () => void;
}) {
  const amountCents = Math.round(Number(amount) * 100);
  const settled = credit ? credit.status === "settled" || credit.balanceCents <= 0 : false;
  const requestedCents = Number.isFinite(amountCents) ? Math.max(0, amountCents) : 0;
  const appliedCents = credit ? Math.min(requestedCents, credit.balanceCents) : 0;
  const returnedCents = Math.max(0, requestedCents - appliedCents);
  const valid =
    !settled && requestedCents > 0 && appliedCents > 0 && method !== null;
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty =
    Boolean(credit) &&
    (amount !== initialAmount ||
      note.trim().length > 0 ||
      method !== initialMethod);

  useEffect(() => {
    // Al abrir otro fiado, la confirmación de descarte deja de aplicar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDiscardOpen(false);
  }, [credit?.id]);

  function requestClose() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  return (
    <Sheet
      open={Boolean(credit)}
      onClose={requestClose}
      title="Registrar abono"
      size="sm"
    >
      {credit ? (
        discardOpen ? (
          <div className="space-y-4">
            <p role="alert" className="rounded-xl bg-terracotta-soft px-4 py-3 text-sm leading-relaxed text-ink">
              Tienes un abono sin guardar. Si cierras ahora se pierden el monto y la nota.
            </p>
            <button
              type="button"
              onClick={() => setDiscardOpen(false)}
              autoFocus
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press"
            >
              Seguir editando
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-separator bg-surface text-sm font-semibold text-ink-2 transition hover:text-danger"
            >
              Descartar abono
            </button>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              {credit.customerName ?? "Cliente"}
            </p>
            {settled ? (
              <p className="mt-0.5 text-sm text-ink-2">
                <strong className="text-green">Saldado</strong> · original{" "}
                {formatMxn(credit.originalCents)}
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-sm text-ink-2">
                  Saldo vivo:{" "}
                  <strong className="text-attention">{formatMxn(credit.balanceCents)}</strong>
                </p>
                <p className="text-xs text-ink-2">
                  original {formatMxn(credit.originalCents)}
                  {credit.originalCents > credit.balanceCents
                    ? ` · abonado ${formatMxn(credit.originalCents - credit.balanceCents)}`
                    : ""}
                </p>
              </>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Monto del abono</span>
            <div className="mt-1 flex min-h-12 items-center gap-1 rounded-xl border border-separator bg-surface-2 px-3">
              <span className="text-sm text-ink-2">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={amount}
                onChange={(event) => onAmount(event.target.value)}
                inputMode="decimal"
                aria-label="Monto del abono en pesos"
                className="tabular min-h-12 w-full bg-transparent text-[1.125rem] font-semibold text-ink outline-none"
              />
            </div>
          </label>

          {!settled && requestedCents > 0 ? (
            <div
              role="status"
              className={cn(
                "rounded-xl border px-3 py-2 text-sm leading-relaxed",
                returnedCents > 0
                  ? "border-attention/25 bg-terracotta-soft/60 text-ink-2"
                  : "border-green/20 bg-green-soft/50 text-ink-2",
              )}
            >
              <p>
                Se aplican <strong className="text-ink">{formatMxn(appliedCents)}</strong> al
                saldo vivo.
              </p>
              {returnedCents > 0 ? (
                <p className="mt-1">
                  Recibiste {formatMxn(requestedCents)}: devuelve{" "}
                  <strong className="text-ink">{formatMxn(returnedCents)}</strong>. El saldo no
                  queda negativo.
                </p>
              ) : null}
            </div>
          ) : null}

          <fieldset>
            <legend className="text-sm font-semibold text-ink-2">¿Cómo lo recibiste?</legend>
            {method === null ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Elige un método para registrar el abono.
              </p>
            ) : null}
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { id: "cash", label: "Efectivo", icon: Banknote },
                  { id: "codi", label: "Digital", icon: Smartphone },
                  { id: "card", label: "Tarjeta", icon: CreditCard },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const selected = method === option.id;
                return (
                  <label
                    key={option.id}
                    data-selected={selected ? "true" : "false"}
                    className={cn(
                      "flex min-h-12 cursor-pointer flex-wrap items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-accent/40",
                      selected
                        ? "border-accent/40 bg-green-soft text-green"
                        : "border-separator bg-surface text-ink-2 hover:border-accent/30",
                    )}
                  >
                    <input
                      type="radio"
                      name="credit-pay-method"
                      value={option.id}
                      checked={selected}
                      onChange={() => onMethod(option.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      data-selected={selected ? "true" : "false"}
                      className={cn(
                        "radio-dot flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-green bg-green text-white"
                          : "border-ink-2/40 bg-surface",
                      )}
                    >
                      {selected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <Icon className="h-4 w-4" />
                    {option.label}
                    {selected ? (
                      <span className="text-xs font-bold uppercase tracking-wide text-green">
                        Elegido
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Nota (opcional)</span>
            <textarea
              value={note}
              onChange={(event) => onNote(event.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Ej. abonó la mitad, queda para el viernes"
              className="mt-1 w-full rounded-xl border border-separator bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-placeholder focus:border-accent/40"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-[18px] mt-1 border-t border-separator bg-surface px-[18px] pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:-mx-5 sm:px-5">
            <button
              type="button"
              onClick={onPay}
              disabled={paying || !valid || settled}
              aria-busy={paying}
              className="on-accent flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-50"
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {paying ? "Registrando…" : "Registrar abono"}
            </button>
          </div>
          <p className="text-sm leading-relaxed text-ink-2">
            Se registra el monto aplicado, no el billete completo. Un abono reduce la deuda; no
            crea una venta nueva ni cuenta como dinero cobrado hoy.
          </p>
        </div>
        )
      ) : null}
    </Sheet>
  );
}


/* -------------------------------------------------------------------------- */
/*                                Verificación                                */
/* -------------------------------------------------------------------------- */

function VerifyCard({
  value,
  result,
  error,
  verifying,
  onChange,
  onVerify,
  onFake,
}: {
  value: string;
  result: VerifyResult | null;
  error: string | null;
  verifying: boolean;
  onChange: (value: string) => void;
  onVerify: () => void;
  onFake: () => void;
}) {
  const isDemoResult = result?.source === "demo";
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result && !error) return;
    const timer = window.setTimeout(() => feedbackRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [result, error]);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-2">
        Pega el ID de la transacción. Si no existe en la cuenta de pey, no es un pago
        verificable.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onVerify();
          }}
          placeholder="Ej. 01HXYZTXN1234567890RSTUVWX"
          aria-label="ID de la transacción a verificar"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-separator bg-surface-2 px-3 text-[1rem] text-ink outline-none placeholder:text-placeholder focus:border-accent/40"
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying || !value.trim()}
          aria-busy={verifying}
          className="on-accent flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-50"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Verificar
        </button>
      </div>

      <button
        type="button"
        onClick={onFake}
        className="inline-flex min-h-12 items-center text-sm font-semibold text-attention underline decoration-attention/30 underline-offset-4 transition hover:decoration-attention"
      >
        Probar con un comprobante falso
      </button>

      {error ? (
        <div
          ref={feedbackRef}
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-terracotta-soft/60 p-4 outline-none"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-danger" />
            <p className="text-sm font-bold text-ink">No se pudo verificar</p>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{error}</p>
        </div>
      ) : null}

      {result ? (
        <div
          ref={feedbackRef}
          role={result.verified ? "status" : "alert"}
          aria-live="polite"
          tabIndex={-1}
          className={cn(
            "rounded-xl border p-4 outline-none",
            result.verified
              ? isDemoResult
                ? "border-info/25 bg-blue-soft/60"
                : "border-green/25 bg-green-soft/70"
              : "border-danger/25 bg-terracotta-soft/60",
          )}
        >
          <div className="flex items-center gap-2">
            {result.verified ? (
              <ShieldCheck className={cn("h-4 w-4", isDemoResult ? "text-info" : "text-green")} />
            ) : (
              <ShieldAlert className="h-4 w-4 text-danger" />
            )}
            <p className="text-sm font-bold text-ink">
              {result.verified
                ? isDemoResult
                  ? "Verificado en la demo"
                  : "Comprobante verificado"
                : "No verificado"}
            </p>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            {result.verified
              ? `${formatMxn(result.amountCents ?? 0)} · ${result.method ?? "pago"} · pedido ${
                  result.orderId ? shortOrder(result.orderId) : "—"
                }`
              : result.message ?? "Ese comprobante no corresponde a un pago confirmado."}
          </p>
          {!result.verified ? (
            <p className="mt-2 text-sm font-bold text-danger">No entregues el pedido.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                                  Overlay                                   */
/* -------------------------------------------------------------------------- */

function Toast({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  if (!toast) return null;

  const tone = {
    ok: {
      icon: CheckCircle2,
      className: "border-green/25 text-green",
    },
    error: {
      icon: CircleAlert,
      className: "border-danger/25 text-danger",
    },
    info: {
      icon: Sparkles,
      className: "border-info/25 text-info",
    },
  }[toast.tone];
  const Icon = tone.icon;
  const role = toast.tone === "error" ? "alert" : "status";

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[80] flex justify-center px-4">
      <div
        role={role}
        className={cn(
          "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-2.5 shadow-lift",
          tone.className,
        )}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="flex-1 text-sm font-semibold leading-relaxed text-ink">{toast.text}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function QrImage({ value, className }: { value: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((module) =>
        module.default.toDataURL(value, {
          width: 640,
          margin: 1,
          color: { dark: "#143D2F", light: "#FFFFFF" },
        }),
      )
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) {
    return <div className={cn("shimmer rounded-2xl", className)} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Código QR para pagar" className={className} />
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Badge                                     */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: Order["status"] }) {
  const styles: Record<Order["status"], string> = {
    draft: "bg-surface-2 text-ink-2",
    confirmed: "bg-terracotta-soft text-attention",
    payment_pending: "bg-terracotta-soft text-attention",
    partially_paid: "bg-terracotta-soft text-attention",
    paid: "bg-green-soft text-green",
    demo_paid: "bg-terracotta-soft text-attention",
    fulfilled: "bg-green-soft text-green",
    cancelled: "bg-surface-2 text-ink-2",
  };
  const icons: Record<Order["status"], typeof Clock3> = {
    draft: Clock3,
    confirmed: Clock3,
    payment_pending: Clock3,
    partially_paid: Clock3,
    paid: Check,
    demo_paid: FlaskConical,
    fulfilled: Check,
    cancelled: CircleAlert,
  };
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em]",
        styles[status],
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">{statusLabel(status)}</span>
    </span>
  );
}

function statusLabel(status: Order["status"]): string {
  const labels: Record<Order["status"], string> = {
    draft: "Borrador",
    confirmed: "Por cobrar",
    payment_pending: "Esperando al banco",
    partially_paid: "Pago parcial",
    paid: "Pagado",
    demo_paid: "Pago demo",
    fulfilled: "Entregado",
    cancelled: "Cancelado",
  };
  return labels[status];
}

/**
 * Fuente real del dinero de un pedido. No infiere demo del flag global:
 * demo, efectivo, pey y fiado son estados distintos.
 */
function paymentTruth(order: Order) {
  const cashPaidCents = Math.max(0, order.paidCents - order.digitalPaidCents);
  const receivedCents = Math.min(order.totalCents, order.paidCents);
  const provider = order.lastPaymentProvider;
  return {
    cashPaidCents,
    receivedCents,
    provider,
    hasCredit: order.creditCents > 0,
    hasCash: cashPaidCents > 0,
    hasDigital: order.digitalPaidCents > 0,
    isMixedSources: cashPaidCents > 0 && order.digitalPaidCents > 0,
    isDemo: provider === "demo",
    isCash: provider === "cash",
    isVerified: provider === "pey",
    isPaid:
      order.status === "paid" ||
      order.status === "demo_paid" ||
      order.status === "fulfilled",
  };
}

function paymentSheetTitle(order: Order): string {
  const truth = paymentTruth(order);
  const due = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
  if (order.status === "fulfilled") {
    // `fulfilled` también cierra ventas con fiado/demo; no afirmar entrega
    // cuando el pedido solo quedó cobrado o anotado.
    if (order.creditCents > 0) {
      return order.digitalPaidCents > 0 ? "Pago mixto" : "Quedó anotado";
    }
    return "Pedido entregado";
  }
  if (due > 0) {
    return order.paymentUrl || order.qrString
      ? "Cobro pendiente"
      : `Cobrar ${formatMxn(due)}`;
  }
  if (
    truth.hasCredit ||
    truth.isMixedSources ||
    truth.isDemo ||
    truth.isCash ||
    truth.isVerified
  ) {
    return "Resultado del cobro";
  }
  return `Cobrar ${formatMxn(order.totalCents)}`;
}

function ScreenHeading({
  title,
  subtitle,
  action,
  headingId,
  compactSubtitle = false,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  headingId?: string;
  compactSubtitle?: boolean;
}) {
  return (
    <div className="screen-heading-block mb-5 min-w-0">
      <div className="screen-heading">
        <h1
          id={headingId}
          data-sheet-fallback
          tabIndex={-1}
          className="screen-heading__title heading-in text-[1.75rem] font-semibold leading-tight tracking-tight text-ink"
        >
          {title}
        </h1>
        {action ? <div className="screen-heading__action">{action}</div> : null}
      </div>
      <p
        className={cn(
          "screen-heading__subtitle text-[0.9375rem] leading-relaxed text-ink-2",
          compactSubtitle && "screen-heading__subtitle--optional",
        )}
      >
        {subtitle}
      </p>
    </div>
  );
}

const TAB_HEADINGS: Record<Tab, string> = {
  caja: "caja-heading",
  fiado: "fiado-heading",
  corte: "corte-heading",
  meta: "meta-heading",
  pendientes: "pendientes-heading",
};

const TABS = [
  { id: "caja" as const, label: "Caja", mobileLabel: "Caja", icon: Mic },
  { id: "fiado" as const, label: "Fiado", mobileLabel: "Fiado", icon: NotebookPen },
  { id: "corte" as const, label: "Corte", mobileLabel: "Corte", icon: ReceiptText },
  { id: "meta" as const, label: "Meta", mobileLabel: "Meta", icon: Sparkles },
  {
    id: "pendientes" as const,
    label: "Pendientes",
    mobileLabel: "Tareas",
    icon: ListTodo,
  },
];

function AppSidebar({
  tab,
  onTab,
  demoMode,
  onHelp,
  onDemo,
}: {
  tab: Tab;
  onTab: (tab: Tab, viaKeyboard?: boolean) => void;
  demoMode: boolean;
  onHelp: () => void;
  onDemo: () => void;
}) {
  return (
    <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-separator bg-surface px-4 py-6 lg:flex">
      <div className="flex flex-wrap items-center gap-3">
        <div className="brand-mark flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-accent font-display text-xl font-bold text-white">
          0
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl leading-none tracking-tight text-ink">Mercado Cero</p>
          <p className="brand-tagline mt-1 text-xs font-medium text-ink-2">La caja que habla</p>
        </div>
      </div>

      <nav aria-label="Navegación principal" className="mt-6 space-y-1">
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={(event) => onTab(item.id, event.detail === 0)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[48px] w-full items-center gap-2 rounded-xl px-2.5 text-left text-sm font-semibold transition",
                active
                  ? "bg-green-soft text-green"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="min-w-0">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-keepsake mt-auto" aria-hidden="true">
        <span className="sidebar-keepsake__rule" />
        <p className="font-display text-[1.05rem] italic leading-snug text-ink-2">
          “El mercado no necesita más apps. Necesita certeza.”
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-2/70">
          Cuaderno de mercado
        </p>
      </div>

      <div className="mt-2 space-y-1 border-t border-separator pt-4">
        {demoMode ? (
          <button
            type="button"
            onClick={onDemo}
            className="flex min-h-[48px] w-full items-center gap-2 rounded-xl px-2.5 text-left text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <RefreshCw className="h-5 w-5 shrink-0" />
            <span className="min-w-0">Modo demo</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onHelp}
          className="flex min-h-[48px] w-full items-center gap-2 rounded-xl px-2.5 text-left text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink"
        >
          <CircleHelp className="h-5 w-5 shrink-0" />
          <span className="min-w-0">Ayuda y accesibilidad</span>
        </button>
      </div>
    </aside>
  );
}

function TopBar({
  merchant,
  today,
  demoMode,
  unavailable,
  muted,
  onToggleMuted,
  onHelp,
  onDemo,
}: {
  merchant: DashboardData["merchant"] | undefined;
  today: string;
  demoMode: boolean;
  unavailable: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onHelp: () => void;
  onDemo: () => void;
}) {
  return (
    <header className="topbar sticky top-0 z-30 border-b border-separator bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1 basis-[8rem]">
          <p className="topbar-merchant text-sm font-semibold text-ink" title={merchant?.name}>
            {merchant?.name ?? (unavailable ? "Negocio sin datos" : "Cargando el negocio…")}
          </p>
          <p className="topbar-address text-xs text-ink-2">
            {merchant?.address ?? (unavailable ? "No pudimos consultarlo" : "Un momento…")}
            <span className="hidden sm:inline"> · {today || "Hoy"}</span>
          </p>
        </div>

        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
          {demoMode ? (
            <button
              type="button"
              onClick={onDemo}
              className="demo-stamp inline-flex min-h-[48px] items-center rounded-full border border-attention/30 bg-terracotta-soft/70 px-2.5 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-attention transition hover:border-attention/50"
            >
              Demo
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleMuted}
            aria-pressed={muted}
            aria-label={muted ? "Activar voz" : "Silenciar voz"}
            title={muted ? "Activar voz" : "Silenciar voz"}
            className="flex h-[48px] w-[48px] items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onHelp}
            aria-label="Abrir guía"
            title="Ayuda y accesibilidad"
            className="flex h-[48px] w-[48px] items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <CircleHelp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileTabBar({
  tab,
  onTab,
}: {
  tab: Tab;
  onTab: (tab: Tab, viaKeyboard?: boolean) => void;
}) {
  return (
    <nav
      aria-label="Navegación inferior"
      className="mobile-tabs fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={(event) => onTab(item.id, event.detail === 0)}
              aria-current={active ? "page" : undefined}
              aria-label={
                item.mobileLabel === item.label
                  ? item.label
                  : `${item.mobileLabel} (${item.label})`
              }
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-xs font-semibold transition",
                active ? "text-green" : "text-ink-2",
              )}
            >
              {active ? (
                <span className="tab-marker absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" />
              ) : null}
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="mobile-tab-label max-w-full text-center leading-tight">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Sheet({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () => {
      const root = panelRef.current;
      if (!root) return [];
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      return [titleRef.current, ...nodes].filter(
        (element): element is HTMLElement => Boolean(element),
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      // Trap every Tab/Shift+Tab, not only the first and last nodes. The
      // title is programmatically focusable and sits before the close button.
      const current = document.activeElement as HTMLElement | null;
      const index = current ? items.indexOf(current) : -1;
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? index <= 0
          ? items.length - 1
          : index - 1
        : index === -1 || index === items.length - 1
          ? 0
          : index + 1;
      items[nextIndex].focus();
    };

    const timer = window.setTimeout(() => titleRef.current?.focus(), 30);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const target = previousFocus.current;
      if (
        target &&
        target !== document.body &&
        target.isConnected &&
        !target.hasAttribute("disabled") &&
        target.getClientRects().length > 0
      ) {
        target.focus();
      } else {
        document.querySelector<HTMLElement>("[data-sheet-fallback]")?.focus();
      }
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="sheet-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "sheet-panel sheet-in flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[20px] border border-separator bg-surface shadow-lift sm:rounded-[20px]",
          size === "sm" ? "sm:max-w-md" : "sm:max-w-[560px]",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-separator px-[18px] py-4 sm:px-5">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="sheet-title min-w-0 flex-1 text-[1.25rem] font-semibold leading-tight tracking-tight text-ink outline-none sm:text-[1.375rem]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-[18px] py-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:px-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PaidSheet({
  order,
  credits,
  changeCents,
  onClose,
  onDeliver,
  delivering,
  error,
}: {
  order: Order | null;
  credits: Credit[];
  changeCents: number;
  onClose: () => void;
  onDeliver: () => void;
  delivering: boolean;
  error: string | null;
}) {
  if (!order) return null;
  const truth = paymentTruth(order);
  const credit = creditForOrder(order, credits);
  const creditSettled = isCreditSettled(credit);
  const mixed = truth.hasCredit && truth.receivedCents > 0;
  const creditOnly = truth.hasCredit && !truth.hasDigital;
  const mixedDigital = truth.hasCredit && truth.hasDigital;
  const source = [
    truth.cashPaidCents > 0 ? `${formatMxn(truth.cashPaidCents)} en efectivo` : null,
    order.digitalPaidCents > 0
      ? `${formatMxn(order.digitalPaidCents)} ${
            truth.isDemo ? "demo" : truth.isVerified ? "verificado por pey" : "sin verificar"
          }`
      : null,
  ]
    .filter(Boolean)
    .join(" + ");
  const sourceMixed = truth.isMixedSources && !truth.hasCredit;

  return (
    <Sheet open={Boolean(order)} onClose={onClose} title={paymentSheetTitle(order)} size="sm">
      <div className="text-center" aria-live="polite">
        <div
          className={cn(
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full result-in",
            creditOnly || (mixedDigital && truth.isDemo) || (truth.isDemo && !sourceMixed && !mixedDigital)
              ? "bg-terracotta-soft text-attention"
              : mixedDigital
                ? "bg-green-soft text-green"
                : sourceMixed
                  ? truth.isDemo
                    ? "bg-terracotta-soft text-attention"
                    : "bg-green-soft text-green"
                  : truth.isCash
                    ? "bg-surface-2 text-ink"
                    : "bg-green-soft text-green",
          )}
        >
          {creditOnly ? (
            <NotebookPen className="h-7 w-7" />
          ) : mixedDigital ? (
            truth.isDemo ? (
              <FlaskConical className="h-7 w-7" />
            ) : (
              <Check className="h-7 w-7" />
            )
          ) : sourceMixed ? (
            truth.isDemo ? (
              <FlaskConical className="h-7 w-7" />
            ) : (
              <Check className="h-7 w-7" />
            )
          ) : truth.isDemo ? (
            <FlaskConical className="h-7 w-7" />
          ) : truth.isCash ? (
            <Banknote className="h-7 w-7" />
          ) : (
            <Check className="h-8 w-8" />
          )}
        </div>
        <p className="mt-4 text-[1.75rem] font-semibold tracking-tight text-ink">
          {creditOnly
            ? "Quedó anotado"
            : mixedDigital
              ? "Pago mixto"
              : sourceMixed
                ? "Pago mixto"
                : truth.isDemo
                  ? "Pago simulado"
                  : truth.isCash
                    ? "Efectivo recibido"
                    : truth.isVerified
                      ? "Pago verificado"
                      : "Pago sin confirmar"}
        </p>
        <p className="tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
          <AnimatedAmount
            cents={
              truth.hasCredit || sourceMixed
                ? order.totalCents
                : truth.receivedCents || order.totalCents
            }
          />
        </p>
        <p className="mt-2 text-sm text-ink-2">
          Pedido {shortOrder(order.id)} ·{" "}
          {creditOnly
            ? mixed
              ? `${source} + ${formatMxn(order.creditCents)} original a fiado`
              : `fiado con ${order.customerName ?? "el cliente"} · original ${formatMxn(order.creditCents)}`
            : mixedDigital
              ? `${truth.cashPaidCents > 0 ? `${formatMxn(truth.cashPaidCents)} efectivo + ` : ""}Fiado ${formatMxn(
                  order.creditCents,
                )} + ${formatMxn(order.digitalPaidCents)} ${
                  truth.isDemo
                    ? "demo"
                    : truth.isVerified
                      ? "verificado por pey"
                      : "sin verificar"
                }`
              : sourceMixed
                ? source
                : truth.isDemo
                  ? "simulado en modo demo"
                  : truth.isCash
                    ? "recibido en efectivo, sin pasar por pey"
                    : truth.isVerified
                      ? "confirmado por pey"
                      : "sin confirmar"}
        </p>
        {changeCents > 0 ? (
          <p className="mt-3 rounded-xl bg-green-soft px-3 py-2 text-sm font-semibold text-green">
            Cambio {formatMxn(changeCents)}
          </p>
        ) : null}
        {truth.hasCredit ? (
          <OrderCreditNote
            order={order}
            credit={credit}
            settled={creditSettled}
            prefix={mixed ? `Recibiste ${source}. ` : null}
            className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-left"
          />
        ) : (
          <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm leading-relaxed text-ink-2">
            {sourceMixed ? (
              <>
                Recibiste {formatMxn(truth.cashPaidCents)} en efectivo y{" "}
                {formatMxn(order.digitalPaidCents)}{" "}
                {truth.isDemo
                  ? "en un pago simulado. El efectivo sí es dinero real; el digital es demo."
                  : truth.isVerified ? "verificados por pey." : "sin verificar."}
              </>
            ) : truth.isDemo ? (
              "En producción, este estado solo se actualiza con la confirmación firmada de pey. No se movió dinero real."
            ) : truth.isCash ? (
              "Recibiste el efectivo en la caja. No pasó por pey ni es un pago verificado por el banco."
            ) : (
              "El pago fue confirmado con una confirmación firmada de pey. Puedes entregar el pedido."
            )}
          </p>
        )}
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2 text-left text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={truth.hasCredit ? onClose : onDeliver}
          disabled={delivering}
          aria-busy={delivering}
          className="on-accent mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-70"
        >
          {delivering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {truth.hasCredit ? "Entendido" : delivering ? "Entregando…" : "Listo para entregar"}
        </button>
      </div>
    </Sheet>
  );
}

function HelpContent({
  textSize,
  onTextSize,
  contrast,
  onContrast,
  voiceRate,
  onVoiceRate,
  onReadScreen,
  onRepeat,
}: {
  textSize: TextSize;
  onTextSize: (value: TextSize) => void;
  contrast: ContrastMode;
  onContrast: (value: ContrastMode) => void;
  voiceRate: VoiceRate;
  onVoiceRate: (value: VoiceRate) => void;
  onReadScreen: () => void;
  onRepeat: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const textOptions: Array<{ id: TextSize; label: string }> = [
    { id: "normal", label: "Normal" },
    { id: "large", label: "Grande" },
    { id: "xlarge", label: "Muy grande" },
  ];
  const rateOptions: Array<{ id: VoiceRate; label: string }> = [
    { id: "slow", label: "Lenta" },
    { id: "normal", label: "Normal" },
    { id: "fast", label: "Rápida" },
  ];
  const faqs = [
    ["¿Cómo cobro?", "Dicta o escribe la venta, confirma el total y genera un link o QR. El cliente paga desde su banco o wallet."],
    ["¿Cuándo está pagado?", "Solo cuando la app muestra “Pago confirmado” después de un webhook firmado de pey. Mientras diga pendiente, no entregues el pedido."],
    ["¿Puedo cobrar en efectivo?", "Sí. El efectivo se registra como declarado; no es una confirmación bancaria. El corte separa efectivo, digital verificado y fiado."],
    ["¿Qué es el fiado?", "Es una libreta de deudas y abonos. Un abono reduce el saldo, pero no cuenta como venta nueva ni como pago bancario verificado."],
    ["¿La cuenta es de mi hija?", "La app muestra únicamente los cobros generados por el negocio. No accede al saldo ni a los movimientos personales del titular."],
    ["¿Qué es el corte?", "Base inicial más ventas en efectivo y abonos de fiado, menos gastos y retiros. Si lo contado no coincide, se muestra la diferencia; no se ajusta sola."],
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-separator bg-surface p-4">
        <p className="text-base font-bold text-ink">Accesibilidad</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Ajusta el texto, el contraste y la voz. Se guarda en este dispositivo.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink">Tamaño del texto</p>
            <div role="group" aria-label="Tamaño del texto" className="option-grid mt-1.5">
              {textOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={textSize === option.id}
                  onClick={() => onTextSize(option.id)}
                  className={cn(
                    "min-h-12 rounded-xl border px-2 text-sm font-semibold transition",
                    textSize === option.id
                      ? "border-accent bg-accent text-white"
                      : "border-separator bg-surface-2 text-ink-2 hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">Contraste</p>
            <button
              type="button"
              aria-pressed={contrast === "high"}
              onClick={() =>
                onContrast(contrast === "high" ? "normal" : "high")
              }
              className={cn(
                "mt-1.5 flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                contrast === "high"
                  ? "border-accent bg-accent text-white"
                  : "border-separator bg-surface-2 text-ink-2 hover:text-ink",
              )}
            >
              Alto contraste
              <span aria-hidden="true">{contrast === "high" ? "Activado" : "Desactivado"}</span>
            </button>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">Velocidad de la voz</p>
            <div role="group" aria-label="Velocidad de la voz" className="option-grid mt-1.5">
              {rateOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={voiceRate === option.id}
                  onClick={() => onVoiceRate(option.id)}
                  className={cn(
                    "min-h-12 rounded-xl border px-2 text-sm font-semibold transition",
                    voiceRate === option.id
                      ? "border-accent bg-accent text-white"
                      : "border-separator bg-surface-2 text-ink-2 hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onReadScreen}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-separator bg-surface-2 px-3 text-sm font-semibold text-ink-2 transition hover:text-ink"
            >
              <Volume2 className="h-4 w-4" />
              Leer esta pantalla
            </button>
            <button
              type="button"
              onClick={onRepeat}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-separator bg-surface-2 px-3 text-sm font-semibold text-ink-2 transition hover:text-ink"
            >
              <RefreshCw className="h-4 w-4" />
              Repetir último aviso
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-green-soft p-4 text-green">
        <p className="text-sm font-semibold">Primeros pasos</p>
        <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
          <li>1. Dicta o escribe una venta.</li>
          <li>2. Genera el link o QR y compártelo.</li>
          <li>3. Espera el webhook firmado: solo entonces está pagado.</li>
          <li>4. Al final del día, cuenta tu efectivo y cierra caja.</li>
        </ol>
      </div>

      <div className="space-y-2">
        {faqs.map(([question, answer], index) => {
          const open = expanded === index;
          const panelId = `help-panel-${index}`;
          return (
            <div key={question} className="rounded-xl border border-separator bg-surface">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : index)}
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-semibold text-ink"
              >
                {question}
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-ink-2 transition-transform", open && "rotate-90")} />
              </button>
              {open ? (
                <p id={panelId} className="px-3.5 pb-3 text-sm leading-relaxed text-ink-2">
                  {answer}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-sm leading-relaxed text-ink-2">
        Las respuestas son fijas y verificadas. La app no usa el modelo para decidir si un pago llegó.
      </p>
    </div>
  );
}

function DemoContent({ demoMode, onReset }: { demoMode: boolean; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-attention/25 bg-terracotta-soft/60 p-4">
        <p className="text-sm font-bold text-attention">{demoMode ? "Estás en modo demo" : "Modo real"}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          {demoMode
            ? "Los pagos se simulan y se marcan como demo. No se mueve dinero real. Úsalo para probar el flujo completo."
            : "La app está conectada a pey. Los pagos reales solo se confirman con el webhook firmado."}
        </p>
      </div>
      {demoMode ? (
        confirming ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">¿Reiniciar los datos de demo?</p>
            <p className="text-sm leading-relaxed text-ink-2">
              Se borran ventas, fiado, corte, meta y pendientes de la demo. También se
              pierde el conteo no guardado. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onReset}
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-danger px-4 text-sm font-bold text-white"
              >
                Sí, reiniciar
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-12 rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 text-sm font-semibold text-danger transition hover:bg-danger/5"
          >
            <RefreshCw className="h-4 w-4" />
            Reiniciar datos de demo
          </button>
        )
      ) : null}
    </div>
  );
}
