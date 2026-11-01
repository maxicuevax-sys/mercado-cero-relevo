"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  Link2,
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
  formatCompactMxn,
  formatLongDate,
  formatMxn,
  formatTime,
  initials,
  shortOrder,
} from "@/lib/format";
import type {
  AnalyticsReport,
  CashStatus,
  Credit,
  DailySummary,
  Goal,
  Order,
  ParsedSale,
  ReconciliationReport,
} from "@/lib/types";

type Tab = "caja" | "fiado" | "corte" | "meta";
type ToastTone = "ok" | "error" | "info";

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
  credits: Credit[];
}

interface DraftItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
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

function parseMoney(value: string): number {
  const clean = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const amount = Number(clean);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
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

function Money({ cents }: { cents: number }) {
  const [whole, decimals] = formatMxn(cents).split(".");
  return (
    <>
      {whole}
      <wbr />.{decimals}
    </>
  );
}

export default function CajaApp() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("caja");
  const [today, setToday] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [cashCents, setCashCents] = useState(0);
  const [creditCents, setCreditCents] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"link" | "qr">("link");

  const [paidOverlay, setPaidOverlay] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastTimer, setToastTimer] = useState<number | null>(null);

  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [creditPayId, setCreditPayId] = useState<string | null>(null);
  const [creditPayAmount, setCreditPayAmount] = useState("");
  const [creditPayMethod, setCreditPayMethod] = useState<"cash" | "codi">("cash");
  const [creditPayNote, setCreditPayNote] = useState("");
  const [creditPayError, setCreditPayError] = useState<string | null>(null);
  const [creditPaying, setCreditPaying] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const scrollPositions = useRef<Record<Tab, number>>({
    caja: 0,
    fiado: 0,
    corte: 0,
    meta: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((tone: ToastTone, text: string) => {
    setToast({ tone, text });
    if (toastTimer) window.clearTimeout(toastTimer);
    const timer = window.setTimeout(() => setToast(null), 3000);
    setToastTimer(timer);
  }, [toastTimer]);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const data = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar la caja.");
      setDashboard(data);
      window.dispatchEvent(new Event("mercado:refresh"));
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "No se pudo cargar la caja.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // La fecha se calcula después del montaje para no romper la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(formatLongDate());
    try {
      setMuted(window.localStorage.getItem("mercado-cero:muted") === "1");
    } catch {
      // Sin almacenamiento local, la voz queda activa.
    }
    void loadDashboard();
  }, [loadDashboard]);

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
    (next: Tab) => {
      scrollPositions.current[tab] = window.scrollY;
      setToast(null);
      setTab(next);
    },
    [tab],
  );

  useEffect(() => {
    const saved = scrollPositions.current[tab] ?? 0;
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, saved));
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

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

  const speak = useCallback((text: string) => {
    if (muted) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX";
    utterance.rate = 1.02;
    utterance.pitch = 1;
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.lang.toLowerCase().startsWith("es"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }, [muted]);

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
      const total = dashboard.summary.verifiedDigitalCents + dashboard.summary.cashCents;
      return `Hoy llevas ${formatMxn(total)} en ${dashboard.summary.paidOrderCount} ventas cobradas. ${formatMxn(
        dashboard.summary.verifiedDigitalCents,
      )} digitales verificados y ${formatMxn(dashboard.summary.cashCents)} en efectivo.`;
    },
    [dashboard],
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
          const lower = clean.toLowerCase();
          const credit = dashboard?.credits.find(
            (item) =>
              item.status !== "settled" &&
              item.customerName &&
              lower.includes(item.customerName.toLowerCase()),
          );
          if (!credit || parsed.creditCents <= 0) {
            setVoiceError("No encontré ese fiado. Dime el nombre del cliente y el monto.");
            return;
          }
          const payResponse = await fetch(`/api/credits/${credit.id}/pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amountCents: parsed.creditCents, method: "cash" }),
          });
          const payData = (await payResponse.json()) as { credit?: Credit; error?: string };
          if (!payResponse.ok || !payData.credit) {
            throw new Error(payData.error ?? "No pude registrar el abono.");
          }
          const message = `Abono de ${formatMxn(parsed.creditCents)} a ${credit.customerName}. Saldo: ${formatMxn(
            payData.credit.balanceCents,
          )}.`;
          speak(message);
          await loadDashboard();
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
          setCustomerName(parsed.customerName ?? "");
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
    [answerLocal, dashboard, loadDashboard, speak],
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
  }, [interpretText, listening, transcribing]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    mediaRecorderRef.current = null;
    setListening(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const draftTotal = useMemo(
    () =>
      draftItems.reduce(
        (sum, item) => sum + Math.round(Number(item.quantity) * Number(item.unitPriceCents)),
        0,
      ),
    [draftItems],
  );
  const digitalDue = Math.max(0, draftTotal - cashCents - creditCents);
  const overpay = cashCents + creditCents > draftTotal;
  const canCharge =
    draftItems.length > 0 &&
    draftTotal > 0 &&
    !overpay &&
    !savingOrder &&
    (creditCents === 0 || customerName.trim().length > 0);

  useEffect(() => {
    // Al corregir la venta, el error inline deja de aplicar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaleError(null);
  }, [draftItems, cashCents, creditCents, customerName]);

  const createOrder = useCallback(async () => {
    setSaleError(null);
    if (!canCharge) {
      if (creditCents > 0 && !customerName.trim()) {
        setSaleError("Para fiado necesito el nombre del cliente.");
        window.requestAnimationFrame(() => {
          document.getElementById("fiado-customer")?.focus();
        });
      } else if (overpay) {
        setSaleError("El efectivo y el fiado no pueden superar el total.");
      } else {
        setSaleError("Agrega al menos un producto con precio.");
      }
      return;
    }

    setSavingOrder(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: draftItems.map(({ description, quantity, unitPriceCents }) => ({
            description,
            quantity,
            unitPriceCents,
          })),
          cashCents,
          creditCents,
          customerName: customerName.trim() || null,
        }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error ?? "No pude crear la venta.");

      const order = data.order;
      setActiveOrder(order);
      setDraftItems([]);
      setCashCents(0);
      setCreditCents(0);
      setCustomerName("");
      setTranscript("");
      await loadDashboard();

      if (order.status === "paid" || order.status === "fulfilled") {
        if (order.status === "paid") {
          setActiveOrder(null);
          setDeliverError(null);
          setPaidOverlay(order);
          playChime();
          speak(`Venta cobrada. ${formatMxn(order.totalCents)}.`);
        } else {
          showToast(
            "ok",
            `Venta registrada. ${formatMxn(order.creditCents)} quedaron a fiado con ${order.customerName ?? "el cliente"}.`,
          );
        }
      }
    } catch (error) {
      setSaleError(friendlyError(error, "No pude crear la venta."));
    } finally {
      setSavingOrder(false);
    }
  }, [
    canCharge,
    cashCents,
    creditCents,
    customerName,
    draftItems,
    loadDashboard,
    overpay,
    playChime,
    showToast,
    speak,
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
        await loadDashboard();
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
        setActiveOrder(null);
        setDeliverError(null);
        setPaidOverlay(data.order);
        playChime();
        speak(`Pago recibido. ${formatMxn(data.order.totalCents)}. Pedido ${shortOrder(data.order.id)}.`);
        await loadDashboard();
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "No pude simular el pago.");
      } finally {
        setPaymentLoading(false);
      }
    },
    [activeOrder, loadDashboard, playChime, showToast, speak],
  );

  useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.status === "paid" || activeOrder.status === "fulfilled" || activeOrder.status === "cancelled") {
      return;
    }
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${activeOrder.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { order: Order };
        const order = data.order;
        if (order.status === "paid" || order.status === "fulfilled") {
          setActiveOrder(null);
          setDeliverError(null);
          setPaidOverlay(order);
          playChime();
          speak(`Pago recibido. ${formatMxn(order.totalCents)}. Pedido ${shortOrder(order.id)}.`);
          await loadDashboard();
        } else {
          setActiveOrder(order);
        }
      } catch {
        // El polling se recupera solo en el siguiente intento.
      }
    }, 3000);
    return () => window.clearInterval(interval);
    // El polling solo se reinicia cuando cambia el pedido o su estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id, activeOrder?.status, loadDashboard, playChime, speak]);

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
    [dashboard, speak, verifyId],
  );

  const payCredit = useCallback(
    async (credit: Credit) => {
      const amount = Math.round(Number(creditPayAmount) * 100);
      if (!Number.isFinite(amount) || amount <= 0) {
        setCreditPayError("Escribe un monto mayor a cero.");
        return;
      }
      setCreditPaying(true);
      setCreditPayError(null);
      try {
        const response = await fetch(`/api/credits/${credit.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: amount,
            method: creditPayMethod,
            note: creditPayNote.trim() || undefined,
          }),
        });
        const data = (await response.json()) as { credit?: Credit; error?: string };
        if (!response.ok || !data.credit) throw new Error(data.error ?? "No pude registrar el abono.");
        showToast(
          "ok",
          `Abono registrado. ${credit.customerName ?? "Cliente"} debe ${formatMxn(data.credit.balanceCents)}.`,
        );
        setCreditPayId(null);
        setCreditPayAmount("");
        setCreditPayNote("");
        await loadDashboard();
      } catch (error) {
        setCreditPayError(friendlyError(error, "No pude registrar el abono."));
      } finally {
        setCreditPaying(false);
      }
    },
    [creditPayAmount, creditPayMethod, creditPayNote, loadDashboard, showToast],
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
        onDone();
        await loadDashboard();
        showToast("ok", "Pedido entregado.");
      } catch (error) {
        setDeliverError(
          error instanceof Error ? error.message : "No pude marcar el pedido como entregado.",
        );
      } finally {
        setDelivering(false);
      }
    },
    [loadDashboard, showToast],
  );

  const deliverOrder = useCallback(
    () => fulfillOrder(paidOverlay?.id, () => setPaidOverlay(null)),
    [fulfillOrder, paidOverlay?.id],
  );

  const deliverActiveOrder = useCallback(
    () => fulfillOrder(activeOrder?.id, () => setActiveOrder(null)),
    [activeOrder?.id, fulfillOrder],
  );

  const resetDemo = useCallback(async () => {
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      if (!response.ok) throw new Error("No pude reiniciar la demo.");
      setActiveOrder(null);
      setPaidOverlay(null);
      setDraftItems([]);
      setCashCents(0);
      setCreditCents(0);
      setCustomerName("");
      setTranscript("");
      setVerifyResult(null);
      setVerifyId("");
      await loadDashboard();
      showToast("ok", "Demo reiniciada.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "No pude reiniciar la demo.");
    }
  }, [loadDashboard, showToast]);

  const merchant = dashboard?.merchant;
  const pendingCredits = dashboard?.credits.filter((credit) => credit.status !== "settled") ?? [];

  return (
    <div className="min-h-dvh bg-canvas">
      <AppSidebar
        tab={tab}
        onTab={selectTab}
        demoMode={dashboard?.demoMode ?? false}
        onHelp={() => setHelpOpen(true)}
        onDemo={() => setDemoOpen(true)}
      />

      <div className="md:pl-[220px] lg:pl-[240px]">
        <TopBar
          merchant={merchant}
          today={today}
          demoMode={dashboard?.demoMode ?? false}
          muted={muted}
          onToggleMuted={toggleMuted}
          onHelp={() => setHelpOpen(true)}
          onDemo={() => setDemoOpen(true)}
        />

        <main className="main-container mx-auto w-full max-w-[1200px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <div hidden={tab !== "caja"}>
            <div className="caja-layout">
              <section className="min-w-0">
                <ScreenHeading
                  title="Caja"
                  subtitle={
                    dashboard
                      ? `Hoy ${formatMxn(
                          dashboard.summary.cashCents +
                            dashboard.summary.verifiedDigitalCents +
                            dashboard.summary.pendingCents,
                        )} · Por cobrar ${formatMxn(dashboard.summary.pendingCents)} · Fiado ${formatMxn(
                          dashboard.summary.creditCents,
                        )}`
                      : "Cargando la caja…"
                  }
                  action={
                    <button
                      type="button"
                      onClick={() => setVerifyOpen(true)}
                      className="flex min-h-11 items-center gap-2 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:border-accent/40 hover:text-accent"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Verificar
                    </button>
                  }
                />
                <CajaPanel
                  listening={listening}
                  transcribing={transcribing}
                  recordingSeconds={recordingSeconds}
                  transcript={transcript}
                  textInput={textInput}
                  showTextInput={showTextInput}
                  draftItems={draftItems}
                  cashCents={cashCents}
                  creditCents={creditCents}
                  customerName={customerName}
                  draftTotal={draftTotal}
                  digitalDue={digitalDue}
                  overpay={overpay}
                  savingOrder={savingOrder}
                  saleError={saleError}
                  voiceError={voiceError}
                  onStart={startRecording}
                  onStop={stopRecording}
                  onTextInput={setTextInput}
                  onToggleText={() => setShowTextInput((value) => !value)}
                  onInterpret={() => void interpretText(textInput)}
                  onSample={(phrase) => {
                    setTextInput(phrase);
                    setShowTextInput(true);
                    void interpretText(phrase);
                  }}
                  onDraftItems={setDraftItems}
                  onCash={setCashCents}
                  onCredit={setCreditCents}
                  onCustomer={setCustomerName}
                  onCreate={() => void createOrder()}
                  onClear={() => {
                    setDraftItems([]);
                    setCashCents(0);
                    setCreditCents(0);
                    setCustomerName("");
                    setTranscript("");
                  }}
                />
              </section>

              <div className="caja-aside min-w-0">
                <ActivityList
                  orders={dashboard?.orders ?? []}
                  loading={loading}
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

          <section hidden={tab !== "fiado"} className="mx-auto max-w-[760px]">
              <ScreenHeading title="Fiado" subtitle="Lo que te deben, no dinero recibido." />
              <CreditList
                credits={pendingCredits}
                onStart={(credit) => {
                  setCreditPayId(credit.id);
                  setCreditPayAmount((credit.balanceCents / 100).toFixed(2));
                  setCreditPayMethod("cash");
                  setCreditPayNote("");
                  setCreditPayError(null);
                }}
              />
              <CreditPaySheet
                credit={pendingCredits.find((credit) => credit.id === creditPayId) ?? null}
                amount={creditPayAmount}
                method={creditPayMethod}
                note={creditPayNote}
                paying={creditPaying}
                error={creditPayError}
                onAmount={setCreditPayAmount}
                onMethod={setCreditPayMethod}
                onNote={setCreditPayNote}
                onClose={() => {
                  setCreditPayId(null);
                  setCreditPayError(null);
                }}
                onPay={() => {
                  const credit = pendingCredits.find((item) => item.id === creditPayId);
                  if (credit) void payCredit(credit);
                }}
              />
            </section>

          <section hidden={tab !== "corte"} className="mx-auto max-w-[1000px]">
              <ScreenHeading
                title="Corte de caja"
                subtitle="Cuenta el efectivo de hoy."
              />
              <div className="space-y-5">
                <CashCloseCard showToast={showToast} />
                <BusinessOverview
                  demoMode={dashboard?.demoMode ?? false}
                  onSpeak={(text) => {
                    showToast("info", text);
                    speak(text);
                  }}
                />
                <ReconcileCard demoMode={dashboard?.demoMode ?? false} />
              </div>
            </section>

          <section hidden={tab !== "meta"} className="mx-auto max-w-[760px]">
              <ScreenHeading title="Meta" subtitle="Una meta a la vez." />
              <GoalCard showToast={showToast} />
            </section>

          <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-separator pt-5 text-sm text-ink-2 sm:flex-row sm:items-center">
            <p>
              Mercado Cero · prototipo DevDay Exchange CDMX 2026 · pey + OpenAI ·{" "}
              <a href="/credits.txt" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-ink">
                Fotos: créditos
              </a>
            </p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-green" />
              Sin confirmación firmada no hay pagado.
            </p>
          </footer>
        </main>

        <MobileTabBar
          tab={tab}
          onTab={selectTab}
        />
      </div>

      <Sheet
        open={Boolean(activeOrder)}
        onClose={() => {
          if (paymentLoading) return;
          setActiveOrder(null);
          setDeliverError(null);
        }}
        title={activeOrder ? paymentSheetTitle(activeOrder) : "Cobro"}
        size="md"
      >
        <PaymentPanel
          order={activeOrder}
          demoMode={dashboard?.demoMode ?? false}
          loading={paymentLoading}
          mode={paymentMode}
          onGenerate={(mode) => void generatePayment(mode)}
          onDemoPay={(method) => void demoPay(method)}
          onClose={() => {
            if (paymentLoading) return;
            setActiveOrder(null);
            setDeliverError(null);
          }}
          onNew={() => {
            setActiveOrder(null);
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
        <HelpContent />
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
          demoMode={dashboard?.demoMode ?? false}
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
  cashCents: number;
  creditCents: number;
  customerName: string;
  draftTotal: number;
  digitalDue: number;
  overpay: boolean;
  savingOrder: boolean;
  saleError: string | null;
  voiceError: string | null;
  onStart: () => void;
  onStop: () => void;
  onTextInput: (value: string) => void;
  onToggleText: () => void;
  onInterpret: () => void;
  onSample: (phrase: string) => void;
  onDraftItems: (items: DraftItem[]) => void;
  onCash: (value: number) => void;
  onCredit: (value: number) => void;
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
    cashCents,
    creditCents,
    customerName,
    draftTotal,
    digitalDue,
    overpay,
    savingOrder,
    saleError,
    voiceError,
    onStart,
    onStop,
    onTextInput,
    onInterpret,
    onSample,
    onDraftItems,
    onCash,
    onCredit,
    onCustomer,
    onCreate,
    onClear,
  } = props;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-separator bg-surface p-4 shadow-card sm:p-6">
        <div>
          <h2 className="text-[1.375rem] font-semibold tracking-tight text-ink">¿Qué vendiste?</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            Habla o escribe; tú confirmas.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="flex w-20 shrink-0 flex-col items-center gap-1.5">
            <div className="relative flex h-16 w-16 items-center justify-center">
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
                  "on-accent relative flex h-16 w-16 touch-none select-none items-center justify-center rounded-full transition-colors disabled:opacity-60",
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
                  <Mic className="h-7 w-7" strokeWidth={1.8} />
                )}
              </button>
            </div>
            <span className="w-full break-words text-center text-xs font-medium text-ink-2" aria-live="polite">
              {listening
                ? `${recordingSeconds}s`
                : transcribing
                  ? "Interpretando…"
                  : "Mantén presionado"}
            </span>
          </div>

          <div className="min-w-[7rem] flex-1 pt-1">
            {transcript ? (
              <div className="rounded-xl border-l-4 border-accent bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink">
                {transcript}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-ink-2">
                {listening
                  ? "Di productos, cantidades y precios. Suelta para terminar."
                  : "Presiona y habla. Si hay ruido, escribe la venta."}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-2">La IA interpreta; tú confirmas.</p>
          </div>
        </div>

        <label htmlFor="sale-text" className="mt-4 block text-xs font-semibold text-ink-2">
          Escribe la venta
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="sale-text"
            value={textInput}
            onChange={(event) => onTextInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onInterpret();
            }}
            placeholder="Ej. 2 quesadillas $35"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-separator bg-surface-2 px-3 text-[1rem] text-ink outline-none placeholder:text-ink-2/70 focus:border-accent/40"
          />
          <button
            type="button"
            onClick={onInterpret}
            disabled={!textInput.trim() || transcribing}
            aria-busy={transcribing}
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-green transition hover:border-accent/40 disabled:opacity-50 sm:w-auto"
          >
            {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Interpretar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => onSample(phrase)}
              aria-label={phrase}
              className="inline-flex max-w-full min-h-11 shrink-0 items-center rounded-full border border-separator bg-surface px-3 text-left text-sm font-medium text-ink-2 transition hover:border-accent/40 hover:text-accent"
            >
              {SAMPLE_LABELS[phrase] ?? phrase}
            </button>
          ))}
        </div>

        {voiceError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger"
          >
            {voiceError}
          </p>
        ) : null}
      </section>

      <section id="pedido" className="scroll-mt-20 rounded-2xl border border-separator bg-surface p-5 shadow-card sm:p-6">
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
              onClick={onClear}
              className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-ink-2 transition hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar
            </button>
          ) : null}
        </div>

        {draftItems.length > 0 ? (
          <div className="mt-4 space-y-2.5">
            {draftItems.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-separator bg-surface-2 p-3">
                <div className="flex items-start gap-2">
                  <input
                    value={item.description}
                    onChange={(event) => {
                      const next = [...draftItems];
                      next[index] = { ...item, description: event.target.value };
                      onDraftItems(next);
                    }}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-[1rem] font-semibold text-ink outline-none focus:border-separator focus:bg-surface"
                    aria-label="Producto"
                  />
                  <button
                    type="button"
                    onClick={() => onDraftItems(draftItems.filter((candidate) => candidate.id !== item.id))}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface hover:text-danger"
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
                        onDraftItems(next);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-separator bg-surface text-ink-2"
                      aria-label="Menos cantidad"
                    >
                      <span className="text-lg leading-none">−</span>
                    </button>
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={item.quantity}
                      onChange={(event) => {
                        const next = [...draftItems];
                        next[index] = { ...item, quantity: Math.max(0.25, Number(event.target.value)) };
                        onDraftItems(next);
                      }}
                      className="tabular h-11 w-14 rounded-lg border border-transparent bg-transparent text-center text-[1rem] font-semibold text-ink outline-none focus:border-separator focus:bg-surface"
                      aria-label="Cantidad"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...draftItems];
                        next[index] = { ...item, quantity: item.quantity + 1 };
                        onDraftItems(next);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-separator bg-surface text-ink-2"
                      aria-label="Más cantidad"
                    >
                      <span className="text-lg leading-none">+</span>
                    </button>
                  </div>
                  <label className="flex items-center gap-1 text-sm font-medium text-ink-2">
                    $
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={(item.unitPriceCents / 100).toFixed(2)}
                      onChange={(event) => {
                        const next = [...draftItems];
                        next[index] = {
                          ...item,
                          unitPriceCents: Math.max(0, Math.round(Number(event.target.value) * 100)),
                        };
                        onDraftItems(next);
                      }}
                      className="tabular h-11 w-24 rounded-lg border border-transparent bg-transparent px-1 text-right text-[1rem] font-semibold text-ink outline-none focus:border-separator focus:bg-surface"
                      aria-label="Precio unitario"
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onDraftItems([
                  ...draftItems,
                  {
                    id: `draft_${Date.now()}`,
                    description: "Producto",
                    quantity: 1,
                    unitPriceCents: 0,
                  },
                ])
              }
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-separator text-sm font-semibold text-ink-2 transition hover:border-accent/40 hover:text-accent"
            >
              <Plus className="h-4 w-4" />
              Agregar producto
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-separator px-4 py-7 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-soft text-green">
              <ReceiptText className="h-5 w-5" />
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">La caja está lista</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-ink-2">
              Habla o escribe una venta. Si el cliente paga con tarjeta, CoDi o wallet, se genera un solo link.
            </p>
          </div>
        )}

        <div className="split-fields mt-4 grid gap-2.5">
          <label className="rounded-xl bg-surface-2 p-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
              <Banknote className="h-4 w-4" />
              Efectivo recibido
            </span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-ink-2">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={cashCents === 0 ? "" : (cashCents / 100).toFixed(2)}
                onChange={(event) => onCash(Math.max(0, Math.round(Number(event.target.value) * 100)))}
                placeholder="0.00"
                aria-label="Efectivo recibido en pesos"
                className="tabular min-h-11 w-full bg-transparent text-[1.125rem] font-semibold text-ink outline-none placeholder:text-ink-2/40"
              />
            </div>
          </label>

          <label className="rounded-xl bg-surface-2 p-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
              <NotebookPen className="h-4 w-4" />
              A fiado
            </span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-ink-2">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={creditCents === 0 ? "" : (creditCents / 100).toFixed(2)}
                onChange={(event) => onCredit(Math.max(0, Math.round(Number(event.target.value) * 100)))}
                placeholder="0.00"
                aria-label="Monto a fiado en pesos"
                className="tabular min-h-11 w-full bg-transparent text-[1.125rem] font-semibold text-ink outline-none placeholder:text-ink-2/40"
              />
            </div>
          </label>
        </div>

        {creditCents > 0 ? (
          <label className="mt-2.5 flex min-h-11 items-center gap-2 rounded-xl border border-attention/25 bg-terracotta-soft/60 px-3">
            <UserRound className="h-4 w-4 shrink-0 text-attention" />
            <input
              id="fiado-customer"
              value={customerName}
              onChange={(event) => onCustomer(event.target.value)}
              placeholder="¿Quién queda a deber? Ej. Juan"
              aria-label="Nombre del cliente para el fiado"
              aria-invalid={Boolean(saleError) && creditCents > 0 && !customerName.trim()}
              aria-describedby={saleError ? "sale-error" : undefined}
              className="min-w-0 flex-1 bg-transparent text-[1rem] font-semibold text-ink outline-none placeholder:text-ink-2/70"
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

        <div id="confirmar" className="mt-4 scroll-mt-20 flex flex-col gap-3 border-t border-separator pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="tabular text-[1.75rem] font-semibold leading-none tracking-tight text-ink">
              {formatMxn(draftTotal)}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {digitalDue > 0
                ? `${formatMxn(digitalDue)} por cobrar con link`
                : creditCents > 0
                  ? "Todo queda registrado como fiado"
                  : "Sin saldo digital pendiente"}
              {overpay ? " · revisa el efectivo/fiado" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            disabled={draftItems.length === 0 || draftTotal <= 0 || overpay || savingOrder}
            aria-busy={savingOrder}
            aria-describedby={saleError ? "sale-error" : undefined}
            className="on-accent flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            Confirmar venta
          </button>
        </div>
      </section>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                                  Cobro                                     */
/* -------------------------------------------------------------------------- */

function PaymentPanel(props: {
  order: Order | null;
  demoMode: boolean;
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
  const { order, demoMode, loading, mode, onGenerate, onDemoPay, onClose, onNew, onCopy, onShare, onDeliver, delivering, error } = props;

  if (!order) return null;

  const due = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
  const isPaid = order.status === "paid" || order.status === "fulfilled";
  const isCredit = order.creditCents > 0;
  const waiting = order.status === "payment_pending" || order.status === "confirmed";
  const qrValue = order.qrImage ? null : order.qrString ?? order.paymentUrl;

  if (isPaid || isCredit) {
    const truth = paymentTruth(order);
    const mixed = truth.hasCredit && truth.receivedCents > 0;
    const source = [
      truth.cashPaidCents > 0 ? `${formatMxn(truth.cashPaidCents)} en efectivo` : null,
      order.digitalPaidCents > 0
        ? `${formatMxn(order.digitalPaidCents)} ${truth.isDemo ? "demo" : "verificado por pey"}`
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
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
              truth.hasCredit || (truth.isDemo && !sourceMixed)
                ? "bg-terracotta-soft text-attention"
                : sourceMixed
                  ? truth.isDemo
                    ? "bg-terracotta-soft text-attention"
                    : "bg-green-soft text-green"
                  : truth.isCash
                    ? "bg-surface-2 text-ink"
                    : "bg-green-soft text-green",
            )}
          >
            {truth.hasCredit ? (
              <NotebookPen className="h-6 w-6" />
            ) : sourceMixed ? (
              truth.isDemo ? (
                <Sparkles className="h-6 w-6" />
              ) : (
                <Check className="h-6 w-6" />
              )
            ) : truth.isDemo ? (
              <Sparkles className="h-6 w-6" />
            ) : truth.isCash ? (
              <Banknote className="h-6 w-6" />
            ) : (
              <Check className="h-7 w-7" />
            )}
          </div>
          <p className="mt-4 text-sm font-semibold text-ink-2">
            {truth.hasCredit
              ? mixed
                ? "Cobro mixto"
                : "Venta a fiado"
              : sourceMixed
                ? truth.isDemo
                  ? "Efectivo + demo"
                  : "Efectivo + verificado"
                : truth.isDemo
                  ? "Pago simulado · demo"
                  : truth.isCash
                    ? "Cobrado en caja"
                    : "Pago verificado"}
          </p>
          <h2 className="mt-1 text-[1.625rem] font-semibold tracking-tight text-ink">
            {truth.hasCredit
              ? "Quedó anotado"
              : sourceMixed
                ? "Pago mixto"
                : truth.isDemo
                  ? "Pago simulado"
                  : truth.isCash
                    ? "Efectivo recibido"
                    : "Pedido pagado"}
          </h2>
          <p className="tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
            {formatMxn(
              truth.hasCredit || sourceMixed
                ? order.totalCents
                : truth.receivedCents || order.totalCents,
            )}
          </p>
          <p className="mt-2 text-sm text-ink-2">
            Pedido {shortOrder(order.id)} ·{" "}
            {truth.hasCredit
              ? mixed
                ? `${source} + ${formatMxn(order.creditCents)} a fiado`
                : `fiado con ${order.customerName ?? "el cliente"}`
              : sourceMixed
                ? source
                : truth.isDemo
                  ? "simulado en modo demo"
                  : truth.isCash
                    ? "recibido en efectivo, sin pasar por pey"
                    : "confirmado por pey"}
          </p>
          {truth.hasCredit ? (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm leading-relaxed text-ink-2">
              {mixed ? `Recibiste ${source}. ` : null}
              Saldo pendiente: <strong>{formatMxn(order.creditCents)}</strong>. Aparece en la
              libreta de fiado; no es dinero recibido.
            </p>
          ) : sourceMixed ? (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm leading-relaxed text-ink-2">
              Recibiste {formatMxn(truth.cashPaidCents)} en efectivo y{" "}
              {formatMxn(order.digitalPaidCents)}{" "}
              {truth.isDemo
                ? "en un pago simulado. El efectivo sí es dinero real; el digital es demo."
                : "verificados por pey."}
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
        </div>
        <div className="flex gap-2">
          {order.status === "paid" ? (
            <button
              type="button"
              onClick={onDeliver}
              disabled={delivering}
              aria-busy={delivering}
              className="on-accent flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-60"
            >
              {delivering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {delivering ? "Entregando…" : "Listo para entregar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="on-accent flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press"
            >
              {truth.hasCredit ? "Entendido" : "Cerrar"}
            </button>
          )}
          <button
            type="button"
            onClick={onNew}
            className="min-h-11 rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:text-ink"
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
            {formatMxn(due)}
          </p>
          <p className="mt-1.5 text-sm text-ink-2">
            {order.items.map((item) => `${item.quantity} ${item.description}`).join(" · ")}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {!order.paymentUrl && !order.qrString ? (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => onGenerate("link")}
            disabled={loading}
            className="on-accent flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-accent px-4 text-left text-white transition hover:bg-accent-press disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Link2 className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block break-words text-sm font-bold">Link de pago</span>
                <span className="block break-words text-sm text-white/90">CoDi + tarjeta + wallets</span>
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
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-separator bg-surface px-4 text-left text-ink transition hover:border-accent/40 disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-soft text-green">
                <QrCode className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block break-words text-sm font-bold">QR CoDi directo</span>
                <span className="block break-words text-sm text-ink-2">Solo transferencia CoDi</span>
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-2 transition hover:text-accent"
              aria-label="Copiar link"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onShare(order.paymentUrl ?? "")}
            className="on-accent flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press"
          >
            <Share2 className="h-4 w-4" />
            Compartir link
          </button>
          <a
            href={order.paymentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 transition hover:border-accent/40 hover:text-accent"
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
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-separator bg-surface px-2 text-sm font-semibold text-ink-2 transition hover:text-accent disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                Simular CoDi
              </button>
              <button
                type="button"
                onClick={() => onDemoPay("card")}
                disabled={loading}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-separator bg-surface px-2 text-sm font-semibold text-ink-2 transition hover:text-accent disabled:opacity-50"
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

      <button
        type="button"
        onClick={onClose}
        className="min-h-11 w-full rounded-xl py-2 text-center text-sm font-semibold text-ink-2 transition hover:text-ink"
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
        const data = (await response.json()) as AnalyticsReport & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el resumen.");
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
      `${report.label}: ${formatMxn(report.salesCents)} en ${report.orderCount} ventas. Cobrado ${formatMxn(
        report.collectedCents,
      )}. Por cobrar ${formatMxn(report.pendingCents)}.`,
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
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
                    "min-h-11 min-w-11 border-b-2 pb-1 text-center text-sm font-semibold transition",
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
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:text-green"
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
                <Money cents={report.salesCents} />
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-ink-2">
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
              { label: "Ticket promedio", value: report.averageTicketCents, note: `${report.orderCount} ventas` },
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
                  Mejor día: {report.bestDay.date.slice(5)} ·{" "}
                  {formatCompactMxn(report.bestDay.salesCents)}
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex h-24 items-end gap-1 border-b border-separator/60">
              {report.series.map((point) => (
                <div
                  key={point.date}
                  className="group relative h-full flex-1"
                  title={`${point.date}: ${formatMxn(point.salesCents)} · ${point.orders} ventas`}
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

function denominationLabel(cents: number): string {
  return cents >= 100
    ? `$${(cents / 100).toLocaleString("es-MX")}`
    : `$${(cents / 100).toFixed(2)}`;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cash", { cache: "no-store" });
      const data = (await response.json()) as CashStatus & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo leer la caja.");
      setStatus(data);
      setOpening((data.openingCents / 100).toFixed(2));
      setExpenses((data.expensesCents / 100).toFixed(2));
      setWithdrawals((data.withdrawalsCents / 100).toFixed(2));
      setBaseNext(
        ((data.saved?.baseNextCents ?? 40000) / 100).toFixed(2),
      );
      setCounted(
        data.saved ? (data.saved.countedCents / 100).toFixed(2) : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la caja.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial del corte; el formulario se llena una vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener("mercado:refresh", handler);
    return () => window.removeEventListener("mercado:refresh", handler);
  }, [load]);

  const openingCents = parseMoney(opening);
  const expensesCents = parseMoney(expenses);
  const withdrawalsCents = parseMoney(withdrawals);
  const countedCents = parseMoney(counted);
  const hasCounted = counted.trim() !== "";
  const expectedCents = status
    ? openingCents +
      status.cashSalesCents +
      status.cashCreditCents -
      expensesCents -
      withdrawalsCents
    : 0;
  const differenceCents = countedCents - expectedCents;
  const withdrawalNextCents = Math.max(0, countedCents - parseMoney(baseNext));
  const differenceLabel =
    differenceCents === 0 ? "Cuadra" : differenceCents > 0 ? "Sobra" : "Falta";
  const differenceAbsCents = Math.abs(differenceCents);

  function updateCount(denomination: number, quantity: number) {
    const next = { ...counts, [denomination]: Math.max(0, quantity) };
    setCounts(next);
    const total = DENOMINATIONS.reduce(
      (sum, value) => sum + value * (next[value] ?? 0),
      0,
    );
    setCounted((total / 100).toFixed(2));
  }

  async function saveClose() {
    if (!status) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/cash/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingCents,
          expensesCents,
          withdrawalsCents,
          countedCents,
          baseNextCents: parseMoney(baseNext),
        }),
      });
      const data = (await response.json()) as {
        close?: CashStatus["saved"];
        status?: CashStatus;
        error?: string;
      };
      if (!response.ok || !data.close || !data.status) {
        throw new Error(data.error ?? "No se pudo guardar el corte.");
      }
      setStatus(data.status);
      setSavedNotice(
        `Corte guardado: ${differenceLabel.toLowerCase()} ${formatMxn(differenceAbsCents)}.`,
      );
      setConfirmOpen(false);
      showToast(
        "ok",
        `Corte guardado. ${differenceLabel}: ${formatMxn(differenceAbsCents)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el corte.");
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    if (!status) return;
    if (!hasCounted) {
      setError("Escribe el total contado antes de guardar el corte.");
      return;
    }
    setError(null);
    if (differenceCents === 0) {
      void saveClose();
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <div className="rounded-2xl border border-separator bg-surface p-[20px] shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-2">Corte de caja</p>
          <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight text-ink">
            Cuenta el efectivo de hoy
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2 transition hover:text-ink disabled:opacity-50"
          title="Actualizar corte"
          aria-label="Actualizar corte"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {loading && !status ? (
        <div className="mt-4 space-y-2">
          <div className="shimmer h-10 rounded-xl" />
          <div className="shimmer h-10 rounded-xl" />
        </div>
      ) : error && !status ? (
        <p className="mt-4 rounded-xl bg-terracotta-soft px-4 py-3 text-sm text-attention">
          {error}
        </p>
      ) : status ? (
        <div className="mt-4 space-y-3">
          {savedNotice ? (
            <p role="status" className="rounded-xl border border-green/25 bg-green-soft/70 px-4 py-3 text-sm font-semibold text-green">
              {savedNotice} Queda registrado en el corte de hoy.
            </p>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Total contado</span>
            <div className="mt-1 flex items-center gap-1 rounded-xl border border-separator bg-surface-2 px-[12px] py-2">
              <span className="text-sm text-ink-2">$</span>
              <input
                value={counted}
                onChange={(event) => {
                  setCounted(event.target.value);
                  setCounts({});
                }}
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Total contado en pesos"
                className="tabular min-h-11 w-full bg-transparent text-lg font-bold text-ink outline-none placeholder:text-ink-2/40"
              />
            </div>
          </label>

          {hasCounted ? (
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
              <div>
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
              <p
                className={cn(
                  "tabular text-[1.5rem] font-semibold leading-none",
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
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
              Escribe el total contado para ver si cuadra.
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowCounts((value) => !value)}
            aria-expanded={showCounts}
            aria-controls="corte-denominaciones"
            className="min-h-11 text-left text-sm font-semibold text-green underline-offset-2 hover:underline"
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
                  <label key={denomination} className="block">
                    <span className="text-sm font-semibold text-ink-2">
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
                      className="tabular mt-1 min-h-11 w-full rounded-xl border border-separator bg-surface px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-green"
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
                { label: "Base inicial", value: openingCents, negative: false },
                { label: "Ventas en efectivo", value: status.cashSalesCents, negative: false },
                { label: "Abonos de fiado en efectivo", value: status.cashCreditCents, negative: false },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-ink-2">{row.label}</span>
                  <span className="tabular font-semibold text-ink">{formatMxn(row.value)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-ink-2">Gastos de caja</span>
                <div className="mt-1 flex items-center gap-1 rounded-xl border border-separator bg-surface-2 px-[10px] py-2">
                  <span className="text-sm text-ink-2">$</span>
                  <input
                    value={expenses}
                    onChange={(event) => setExpenses(event.target.value)}
                    inputMode="decimal"
                    aria-label="Gastos de caja en pesos"
                    className="tabular min-h-11 w-full bg-transparent text-sm text-ink outline-none"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-2">Retiros</span>
                <div className="mt-1 flex items-center gap-1 rounded-xl border border-separator bg-surface-2 px-[10px] py-2">
                  <span className="text-sm text-ink-2">$</span>
                  <input
                    value={withdrawals}
                    onChange={(event) => setWithdrawals(event.target.value)}
                    inputMode="decimal"
                    aria-label="Retiros en pesos"
                    className="tabular min-h-11 w-full bg-transparent text-sm text-ink outline-none"
                  />
                </div>
              </label>
            </div>
            <div className="flex items-end justify-between gap-3 border-t border-separator pt-2">
              <span className="font-semibold text-ink">Debería haber</span>
              <span className="tabular text-[1.375rem] font-semibold leading-none text-ink">
                {formatMxn(expectedCents)}
              </span>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-ink-2">Base para mañana</span>
            <div className="mt-1 flex items-center gap-1 rounded-xl border border-separator bg-surface-2 px-[10px] py-2">
              <span className="text-sm text-ink-2">$</span>
              <input
                value={baseNext}
                onChange={(event) => setBaseNext(event.target.value)}
                inputMode="decimal"
                aria-label="Base para mañana en pesos"
                className="tabular min-h-11 w-full bg-transparent text-sm text-ink outline-none"
              />
            </div>
          </label>
          {hasCounted ? (
            <p className="text-sm text-ink-2">
              Adicional a retirar:{" "}
              <span className="font-semibold text-ink">{formatMxn(withdrawalNextCents)}</span>
            </p>
          ) : null}

          {status.saved ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink-2">
              Último corte guardado: contado {formatMxn(status.saved.countedCents)} · diferencia{" "}
              {formatMxn(status.saved.differenceCents)}. Puedes volver a contar y guardar de nuevo.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={requestSave}
            disabled={saving}
            aria-busy={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Guardando…" : "Guardar corte"}
          </button>
          <p className="text-sm leading-relaxed text-ink-2">
            Los gastos y retiros se registran solo al guardar el corte. No se ajusta el efectivo automáticamente.
          </p>
        </div>
      ) : null}

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar corte"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-2">
            Revisa el conteo antes de guardar. El corte queda registrado con estos montos.
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-2">Total contado</dt>
              <dd className="tabular font-semibold text-ink">{formatMxn(countedCents)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-2">Debería haber</dt>
              <dd className="tabular font-semibold text-ink">{formatMxn(expectedCents)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-2">Base para mañana</dt>
              <dd className="tabular font-semibold text-ink">{formatMxn(parseMoney(baseNext))}</dd>
            </div>
          </dl>
          <div
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
              differenceCents === 0
                ? "border-green/25 bg-green-soft/60"
                : differenceCents < 0
                  ? "border-danger/25 bg-terracotta-soft/70"
                  : "border-attention/25 bg-terracotta-soft/70",
            )}
          >
            <p className="text-sm font-bold text-ink">{differenceLabel}</p>
            <p className="tabular text-[1.375rem] font-semibold text-ink">
              {formatMxn(differenceAbsCents)}
            </p>
          </div>
          {error ? (
            <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void saveClose()}
            disabled={saving}
            aria-busy={saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Guardando…" : "Guardar corte"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-separator bg-surface text-sm font-semibold text-ink-2 transition hover:text-ink"
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
    try {
      const response = await fetch("/api/goals", { cache: "no-store" });
      const data = (await response.json()) as { goals?: Goal[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo leer la meta.");
      setGoal(data.goals?.[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la meta.");
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
      const data = (await response.json()) as { goal?: Goal; error?: string };
      if (!response.ok || !data.goal) {
        throw new Error(data.error ?? "No se pudo registrar la aportación.");
      }
      setGoal(data.goal);
      setAmount("");
      showToast("ok", `Apartaste ${formatMxn(amountCents)} para ${data.goal.title}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la aportación.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !goal) {
    return <div className="shimmer h-64 rounded-2xl" />;
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
      <figure className="mb-4 overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
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

      <div className="rounded-2xl border border-separator bg-surface p-[20px] shadow-card sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-2">Mi camino</p>
            <h2 className="mt-0.5 text-[1.5rem] font-semibold tracking-tight text-ink">Una meta a la vez</h2>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-soft text-green">
            <Umbrella className="h-6 w-6" strokeWidth={1.6} />
          </div>
        </div>

        <div className="mt-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[1.25rem] font-semibold tracking-tight text-ink">{goal.title}</p>
            <p className="text-sm text-ink-2">
              {formatMxn(goal.savedCents)} de {formatMxn(goal.targetCents)}
            </p>
          </div>
          <p className="tabular text-[1.375rem] font-semibold text-green">{goal.progressPct}%</p>
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex min-h-11 flex-1 items-center gap-1 rounded-xl border border-separator bg-surface-2 px-3">
            <span className="text-sm text-ink-2">$</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="¿Cuánto apartaste?"
              aria-label="¿Cuánto apartaste?"
              className="tabular min-h-11 w-full bg-transparent text-[1rem] text-ink outline-none placeholder:text-ink-2/60"
            />
          </div>
          <button
            type="button"
            onClick={() => void contribute()}
            disabled={saving}
            aria-busy={saving}
            className="on-accent flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent-press disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Apartar
          </button>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <p className="text-sm leading-relaxed text-ink-2">
          Apartado declarado: no es una cuenta bancaria ni dinero custodiado. El efectivo sigue en tu
          resguardo.
        </p>
      </div>
      </div>
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
      const data = (await response.json()) as
        | ReconciliationReport
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "No se pudo conciliar la caja.",
        );
      }
      setReport(data as ReconciliationReport);
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
        <div>
          <p className="text-sm font-semibold text-ink-2">Conciliación</p>
          <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight text-ink">
            ¿Cuadra con pey?
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void reconcile()}
          disabled={loading || demoMode}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="mt-4 rounded-xl bg-surface/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
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
  loading,
  onSelect,
}: {
  orders: Order[];
  loading: boolean;
  onSelect: (order: Order) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleOrders = showAll ? orders : orders.slice(0, 5);

  return (
    <div className="rounded-2xl border border-separator bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-2">Actividad</p>
          <h2 className="mt-0.5 text-[1.25rem] font-semibold tracking-tight text-ink">
            Últimos movimientos
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
          {orders.length} pedidos
        </span>
      </div>

      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="shimmer h-14 rounded-xl" />
          ))
        ) : orders.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">
            Aún no hay ventas. Habla para crear la primera.
          </p>
        ) : (
          visibleOrders.map((order) => {
            const truth = paymentTruth(order);
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
                    : order.status === "paid" || order.status === "fulfilled"
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
                    truth.hasCredit || demo || pending
                      ? "bg-terracotta-soft text-attention"
                      : sourceMixed
                        ? truth.isDemo
                          ? "bg-terracotta-soft text-attention"
                          : "bg-green-soft text-green"
                        : cash
                          ? "bg-surface-2 text-ink"
                          : order.status === "paid" || order.status === "fulfilled"
                            ? "bg-green-soft text-green"
                            : "bg-surface-2 text-ink-2",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 basis-[10rem]">
                  <p className="break-words text-sm font-semibold text-ink">
                    {order.items.map((item) => `${item.quantity} ${item.description}`).join(" · ") ||
                      `Pedido ${shortOrder(order.id)}`}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-2">
                    <span>{formatTime(order.createdAt)}</span>
                    <span className="h-0.5 w-0.5 rounded-full bg-ink-2/50" />
                    <span
                      className={cn(
                        (truth.hasCredit || demo) && "font-semibold text-attention",
                      )}
                    >
                      {truth.hasCredit
                        ? mixed
                          ? "Pago mixto"
                          : "Fiado"
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
          })
        )}
      </div>
      {orders.length > 5 ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-green underline-offset-2 hover:underline"
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
  onStart,
}: {
  credits: Credit[];
  onStart: (credit: Credit) => void;
}) {
  const total = credits.reduce((sum, credit) => sum + credit.balanceCents, 0);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-separator bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-2">Saldo pendiente</p>
            <p className="tabular mt-1 text-[1.75rem] font-semibold leading-none tracking-tight text-ink">
              {formatMxn(total)}
            </p>
          </div>
          <p className="break-words text-sm text-ink-2">
            {credits.length} {credits.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Fiado es una libreta de deudas: no es dinero recibido ni una venta nueva.
        </p>
      </div>

      {credits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-separator bg-surface p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-terracotta-soft text-attention">
            <NotebookPen className="h-5 w-5" />
          </div>
          <p className="mt-2 text-sm font-semibold text-ink">Sin fiados pendientes</p>
          <p className="mt-1 text-sm text-ink-2">Cuando apuntes uno, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {credits.map((credit) => (
            <div key={credit.id} className="rounded-2xl border border-separator bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-soft text-sm font-bold text-attention">
                  {initials(credit.customerName ?? "Cliente")}
                </div>
                <div className="min-w-0 flex-1 basis-[6rem]">
                  <p className="break-words text-[1rem] font-semibold text-ink">
                    {credit.customerName ?? "Cliente"}
                  </p>
                  <p className="break-words text-sm text-ink-2">
                    {credit.status === "partial" ? "Abono parcial" : "Pendiente"} · desde{" "}
                    {formatTime(credit.createdAt)}
                  </p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className="tabular text-[1rem] font-semibold text-attention">
                    {formatMxn(credit.balanceCents)}
                  </p>
                  <p className="text-xs text-ink-2">saldo</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onStart(credit)}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-sm font-semibold text-ink-2 transition hover:bg-green-soft hover:text-green"
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
  method,
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
  method: "cash" | "codi";
  note: string;
  paying: boolean;
  error: string | null;
  onAmount: (value: string) => void;
  onMethod: (value: "cash" | "codi") => void;
  onNote: (value: string) => void;
  onClose: () => void;
  onPay: () => void;
}) {
  const amountCents = Math.round(Number(amount) * 100);
  const valid = Number.isFinite(amountCents) && amountCents > 0;
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialAmount = credit ? (credit.balanceCents / 100).toFixed(2) : "";
  const dirty =
    Boolean(credit) &&
    (amount !== initialAmount || note.trim().length > 0 || method !== "cash");

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
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-separator bg-surface text-sm font-semibold text-ink-2 transition hover:text-danger"
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
            <p className="mt-0.5 text-sm text-ink-2">
              Debe <strong className="text-attention">{formatMxn(credit.balanceCents)}</strong>
            </p>
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
                className="tabular min-h-11 w-full bg-transparent text-[1.125rem] font-semibold text-ink outline-none"
              />
            </div>
          </label>

          <fieldset>
            <legend className="text-sm font-semibold text-ink-2">¿Cómo lo recibiste?</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(
                [
                  { id: "cash", label: "Efectivo", icon: Banknote },
                  { id: "codi", label: "Digital", icon: Smartphone },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const selected = method === option.id;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition",
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
                    <Icon className="h-4 w-4" />
                    {option.label}
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
              className="mt-1 w-full rounded-xl border border-separator bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-2/60 focus:border-accent/40"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onPay}
            disabled={paying || !valid}
            aria-busy={paying}
            className="on-accent flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-50"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {paying ? "Registrando…" : "Registrar abono"}
          </button>
          <p className="text-sm leading-relaxed text-ink-2">
            Un abono reduce la deuda; no crea una venta nueva ni cuenta como dinero cobrado hoy.
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
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-separator bg-surface-2 px-3 text-[1rem] text-ink outline-none placeholder:text-ink-2/60 focus:border-accent/40"
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying || !value.trim()}
          aria-busy={verifying}
          className="on-accent flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-press disabled:opacity-50"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Verificar
        </button>
      </div>

      <button
        type="button"
        onClick={onFake}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-attention underline decoration-attention/30 underline-offset-4 transition hover:decoration-attention"
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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink"
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
    fulfilled: "bg-green-soft text-green",
    cancelled: "bg-surface-2 text-ink-2",
  };
  const icons: Record<Order["status"], typeof Clock3> = {
    draft: Clock3,
    confirmed: Clock3,
    payment_pending: Clock3,
    partially_paid: Clock3,
    paid: Check,
    fulfilled: Check,
    cancelled: CircleAlert,
  };
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1.5 break-words rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em]",
        styles[status],
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{statusLabel(status)}</span>
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
    isPaid: order.status === "paid" || order.status === "fulfilled",
  };
}

function paymentSheetTitle(order: Order): string {
  const truth = paymentTruth(order);
  if (truth.hasCredit) return truth.receivedCents > 0 ? "Pago mixto" : "Pedido a fiado";
  if (truth.isMixedSources) return truth.isDemo ? "Efectivo + demo" : "Efectivo + verificado";
  if (truth.isDemo) return "Pago simulado";
  if (truth.isCash) return "Efectivo recibido";
  if (truth.isVerified) return order.status === "fulfilled" ? "Pedido entregado" : "Pago verificado";
  if (order.status === "fulfilled") return "Pedido entregado";
  if (order.paymentUrl || order.qrString) return "Cobro pendiente";
  return `Cobrar ${formatMxn(order.totalCents)}`;
}

function ScreenHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h1
          data-sheet-fallback
          tabIndex={-1}
          className="min-w-0 text-[1.75rem] font-semibold leading-tight tracking-tight text-ink outline-none"
        >
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{subtitle}</p>
    </div>
  );
}

const TABS = [
  { id: "caja" as const, label: "Caja", icon: Mic },
  { id: "fiado" as const, label: "Fiado", icon: NotebookPen },
  { id: "corte" as const, label: "Corte", icon: ReceiptText },
  { id: "meta" as const, label: "Meta", icon: Sparkles },
];

function AppSidebar({
  tab,
  onTab,
  demoMode,
  onHelp,
  onDemo,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  demoMode: boolean;
  onHelp: () => void;
  onDemo: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-separator bg-surface px-5 py-6 md:flex lg:w-[240px]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-display text-xl font-bold text-white">
          0
        </div>
        <div className="min-w-0">
          <p className="break-words font-display text-xl leading-none tracking-tight text-ink">Mercado Cero</p>
          <p className="mt-1 text-xs font-medium text-ink-2">La caja que habla</p>
        </div>
      </div>

      <nav aria-label="Navegación principal" className="mt-8 space-y-1">
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition",
                active
                  ? "bg-green-soft text-green"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-separator pt-4">
        {demoMode ? (
          <button
            type="button"
            onClick={onDemo}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <RefreshCw className="h-5 w-5" />
            Modo demo
          </button>
        ) : null}
        <button
          type="button"
          onClick={onHelp}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink"
        >
          <CircleHelp className="h-5 w-5" />
          Ayuda
        </button>
      </div>
    </aside>
  );
}

function TopBar({
  merchant,
  today,
  demoMode,
  muted,
  onToggleMuted,
  onHelp,
  onDemo,
}: {
  merchant: DashboardData["merchant"] | undefined;
  today: string;
  demoMode: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onHelp: () => void;
  onDemo: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-separator bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="min-w-[8rem] flex-1">
          <p className="break-words text-sm font-semibold text-ink">
            {merchant?.name ?? "Antojitos de Lupita"}
          </p>
          <p className="break-words text-xs text-ink-2">
            {merchant?.address ?? "Coyoacán, CDMX"}
            <span className="hidden sm:inline"> · {today || "Hoy"}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {demoMode ? (
            <button
              type="button"
              onClick={onDemo}
              className="inline-flex min-h-11 items-center rounded-full border border-attention/30 bg-terracotta-soft/70 px-2.5 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-attention transition hover:border-attention/50"
            >
              Demo
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleMuted}
            aria-pressed={muted}
            aria-label={muted ? "Activar voz" : "Silenciar voz"}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onHelp}
            aria-label="Abrir guía"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <CircleHelp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileTabBar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <nav
      aria-label="Navegación inferior"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold transition",
                active ? "text-green" : "text-ink-2",
              )}
            >
              {active ? <span className="absolute inset-x-7 top-0 h-0.5 rounded-full bg-accent" /> : null}
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
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
          "sheet-in flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[20px] border border-separator bg-surface shadow-lift sm:rounded-[20px]",
          size === "sm" ? "sm:max-w-md" : "sm:max-w-[560px]",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-separator px-[18px] py-4 sm:px-5">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="min-w-0 flex-1 break-words text-[1.375rem] font-semibold leading-tight tracking-tight text-ink outline-none"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
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
  onClose,
  onDeliver,
  delivering,
  error,
}: {
  order: Order | null;
  onClose: () => void;
  onDeliver: () => void;
  delivering: boolean;
  error: string | null;
}) {
  if (!order) return null;
  const truth = paymentTruth(order);
  const mixed = truth.hasCredit && truth.receivedCents > 0;
  const source = [
    truth.cashPaidCents > 0 ? `${formatMxn(truth.cashPaidCents)} en efectivo` : null,
    order.digitalPaidCents > 0
      ? `${formatMxn(order.digitalPaidCents)} ${truth.isDemo ? "demo" : "verificado por pey"}`
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
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
            truth.hasCredit || (truth.isDemo && !sourceMixed)
              ? "bg-terracotta-soft text-attention"
              : sourceMixed
                ? truth.isDemo
                  ? "bg-terracotta-soft text-attention"
                  : "bg-green-soft text-green"
                : truth.isCash
                  ? "bg-surface-2 text-ink"
                  : "bg-green-soft text-green",
          )}
        >
          {truth.hasCredit ? (
            <NotebookPen className="h-7 w-7" />
          ) : sourceMixed ? (
            truth.isDemo ? (
              <Sparkles className="h-7 w-7" />
            ) : (
              <Check className="h-7 w-7" />
            )
          ) : truth.isDemo ? (
            <Sparkles className="h-7 w-7" />
          ) : truth.isCash ? (
            <Banknote className="h-7 w-7" />
          ) : (
            <Check className="h-8 w-8" />
          )}
        </div>
        <p className="mt-4 text-sm font-semibold text-ink-2">
          {truth.hasCredit
            ? mixed
              ? "Cobro mixto"
              : "Venta a fiado"
            : sourceMixed
              ? truth.isDemo
                ? "Efectivo + demo"
                : "Efectivo + verificado"
              : truth.isDemo
                ? "Pago simulado · demo"
                : truth.isCash
                  ? "Cobrado en caja"
                  : "Confirmado por el banco"}
        </p>
        <h2 className="mt-1 text-[1.75rem] font-semibold tracking-tight text-ink">
          {truth.hasCredit
            ? "Quedó anotado"
            : sourceMixed
              ? "Pago mixto"
              : truth.isDemo
                ? "Pago simulado"
                : truth.isCash
                  ? "Efectivo recibido"
                  : "Ya llegó"}
        </h2>
        <p className="tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
          {formatMxn(
            truth.hasCredit || sourceMixed
              ? order.totalCents
              : truth.receivedCents || order.totalCents,
          )}
        </p>
        <p className="mt-2 text-sm text-ink-2">
          Pedido {shortOrder(order.id)} ·{" "}
          {truth.hasCredit
            ? mixed
              ? `${source} + ${formatMxn(order.creditCents)} a fiado`
              : `fiado con ${order.customerName ?? "el cliente"}`
            : sourceMixed
              ? source
              : truth.isDemo
                ? "simulado en modo demo"
                : truth.isCash
                  ? "recibido en efectivo, sin pasar por pey"
                  : "confirmado por pey"}
        </p>
        <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm leading-relaxed text-ink-2">
          {truth.hasCredit ? (
            <>
              {mixed ? `Recibiste ${source}. ` : null}
              Saldo pendiente: <strong>{formatMxn(order.creditCents)}</strong>. Aparece en Fiado;
              no es dinero recibido.
            </>
          ) : sourceMixed ? (
            <>
              Recibiste {formatMxn(truth.cashPaidCents)} en efectivo y{" "}
              {formatMxn(order.digitalPaidCents)}{" "}
              {truth.isDemo
                ? "en un pago simulado. El efectivo sí es dinero real; el digital es demo."
                : "verificados por pey."}
            </>
          ) : truth.isDemo ? (
            "En producción, este estado solo se actualiza con la confirmación firmada de pey. No se movió dinero real."
          ) : truth.isCash ? (
            "Recibiste el efectivo en la caja. No pasó por pey ni es un pago verificado por el banco."
          ) : (
            "El pago fue confirmado con una confirmación firmada de pey. Puedes entregar el pedido."
          )}
        </p>
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

function HelpContent() {
  const [expanded, setExpanded] = useState<number | null>(0);
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
                aria-controls={panelId}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-semibold text-ink"
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
              Se borran ventas, fiado, corte y meta de la demo. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onReset}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-danger px-4 text-sm font-bold text-white"
              >
                Sí, reiniciar
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 text-sm font-semibold text-danger transition hover:bg-danger/5"
          >
            <RefreshCw className="h-4 w-4" />
            Reiniciar datos de demo
          </button>
        )
      ) : null}
    </div>
  );
}
