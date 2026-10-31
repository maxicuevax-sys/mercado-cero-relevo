"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Umbrella,
  UserRound,
  Volume2,
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

function parseMoney(value: string): number {
  const clean = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const amount = Number(clean);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export default function CajaApp() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("caja");
  const [today, setToday] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

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
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastTimer, setToastTimer] = useState<number | null>(null);

  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [creditPayId, setCreditPayId] = useState<string | null>(null);
  const [creditPayAmount, setCreditPayAmount] = useState("");
  const [creditPaying, setCreditPaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((tone: ToastTone, text: string) => {
    setToast({ tone, text });
    if (toastTimer) window.clearTimeout(toastTimer);
    const timer = window.setTimeout(() => setToast(null), 4000);
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
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const speak = useCallback((text: string) => {
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
  }, []);

  const playChime = useCallback(() => {
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
  }, []);

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
          showToast("info", answer);
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
            showToast("error", "No encontré ese fiado. Dime el nombre del cliente y el monto.");
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
          showToast("ok", message);
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
          const message = parsed.reply || "Venta lista para confirmar.";
          showToast("ok", message);
          speak(message);
          return;
        }

        showToast("error", parsed.reply || "No entendí la venta. Intenta de nuevo.");
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "No pude interpretar la venta.");
      } finally {
        setTranscribing(false);
      }
    },
    [answerLocal, dashboard, loadDashboard, showToast, speak],
  );

  const startRecording = useCallback(async () => {
    if (listening || transcribing) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      showToast("error", "Este navegador no tiene acceso al micrófono. Escribe la venta.");
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
          showToast("error", "El audio salió vacío. Mantén presionado un poco más.");
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
          showToast(
            "error",
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
      showToast("error", "No pude acceder al micrófono. Revisa los permisos o escribe la venta.");
      setShowTextInput(true);
    }
  }, [interpretText, listening, showToast, transcribing]);

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

  const createOrder = useCallback(async () => {
    if (!canCharge) {
      if (creditCents > 0 && !customerName.trim()) {
        showToast("error", "Para fiado necesito el nombre del cliente.");
      } else if (overpay) {
        showToast("error", "El efectivo y el fiado no pueden superar el total.");
      } else {
        showToast("error", "Agrega al menos un producto con precio.");
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
      window.setTimeout(() => {
        document.getElementById("cobro")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 140);
      setDraftItems([]);
      setCashCents(0);
      setCreditCents(0);
      setCustomerName("");
      setTranscript("");
      await loadDashboard();

      if (order.status === "paid" || order.status === "fulfilled") {
        if (order.status === "paid") {
          setPaidOverlay(order);
          playChime();
          speak(`Venta cobrada. ${formatMxn(order.totalCents)}.`);
        } else {
          showToast(
            "ok",
            `Venta registrada. ${formatMxn(order.creditCents)} quedaron a fiado con ${order.customerName ?? "el cliente"}.`,
          );
        }
      } else {
        showToast("ok", "Venta confirmada. Ahora genera el cobro.");
      }
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "No pude crear la venta.");
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
        setActiveOrder(data.order);
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
          setActiveOrder(order);
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
        showToast("error", "Escribe el ID de la transacción del comprobante.");
        return;
      }
      setVerifyId(id);
      setVerifying(true);
      setVerifyResult(null);
      try {
        const response = await fetch(`/api/verify?transactionId=${encodeURIComponent(id)}`);
        const data = (await response.json()) as VerifyResult & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No pude verificar el comprobante.");
        setVerifyResult(data);
        if (data.verified) {
          showToast(
            "ok",
            dashboard?.demoMode
              ? "Comprobante verificado en el historial de la demo."
              : "Comprobante verificado con pey.",
          );
          speak(
            dashboard?.demoMode
              ? "Comprobante verificado en la caja. En producción se valida contra pey."
              : "Comprobante verificado. El dinero sí llegó.",
          );
        } else {
          showToast("error", data.message ?? "Ese comprobante no está verificado.");
          speak("Ese comprobante no está verificado. No entregues el pedido.");
        }
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "No pude verificar el comprobante.");
      } finally {
        setVerifying(false);
      }
    },
    [dashboard, showToast, speak, verifyId],
  );

  const payCredit = useCallback(
    async (credit: Credit) => {
      const amount = Math.round(Number(creditPayAmount) * 100);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast("error", "Escribe un monto válido.");
        return;
      }
      setCreditPaying(true);
      try {
        const response = await fetch(`/api/credits/${credit.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents: amount, method: "cash" }),
        });
        const data = (await response.json()) as { credit?: Credit; error?: string };
        if (!response.ok || !data.credit) throw new Error(data.error ?? "No pude registrar el abono.");
        showToast(
          "ok",
          `Abono registrado. ${credit.customerName ?? "Cliente"} debe ${formatMxn(data.credit.balanceCents)}.`,
        );
        setCreditPayId(null);
        setCreditPayAmount("");
        await loadDashboard();
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "No pude registrar el abono.");
      } finally {
        setCreditPaying(false);
      }
    },
    [creditPayAmount, loadDashboard, showToast],
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
    <div className="grain relative min-h-screen overflow-x-hidden">
      <div className="relative z-10">
        <header className="mx-auto flex max-w-7xl flex-col gap-4 border-b border-line/70 px-4 pb-4 pt-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-green text-paper">
              <Store className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-display text-[1.65rem] leading-none tracking-tight text-ink">
                Mercado Cero
              </p>
              <p className="mt-1 text-sm font-medium text-muted">
                La caja que habla · Coyoacán
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[4px] border border-line bg-card py-1.5 pl-1.5 pr-3 sm:max-w-[16rem] sm:flex-none sm:pr-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-terracotta-soft text-sm font-bold text-terracotta-deep">
                {merchant ? initials(merchant.owner) : "L"}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-ink">
                  {merchant?.name ?? "Antojitos de Lupita"}
                </p>
                <p className="truncate text-sm text-muted">
                  {merchant?.address ?? "Coyoacán, CDMX"}
                </p>
              </div>
            </div>

            {dashboard?.demoMode ? (
              <button
                type="button"
                onClick={resetDemo}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border border-line bg-card text-muted transition hover:text-ink"
                title="Reiniciar demo"
                aria-label="Reiniciar demo"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-[3px] border border-line bg-card px-3 text-sm font-semibold text-muted transition hover:text-ink sm:justify-start"
              aria-label="Abrir guía"
            >
              <CircleHelp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guía</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <section className="rise mb-7 grid gap-6 lg:grid-cols-[1.05fr_0.72fr] lg:items-stretch">
            <div className="flex flex-col justify-between">
              <div>
                <h1 className="max-w-2xl font-display text-[2.15rem] leading-[0.98] tracking-[-0.03em] text-ink sm:text-[3.3rem]">
                  Cobra hablando.
                  <br />
                  El banco confirma.
                </h1>
                <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
                  CoDi, tarjeta o efectivo. Nada está pagado hasta que pey firma.
                </p>
                <a
                  href="#caja"
                  className="mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-[3px] bg-green px-4 py-3 text-sm font-bold text-paper transition hover:bg-green-deep"
                >
                  Cobrar ahora
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-3 text-sm text-muted">
                {merchant?.receiverName
                  ? `Cuenta receptora: ${merchant.receiverName} ${merchant.receiverMask}`
                  : "Cobros del día"}{" "}
                · {merchant?.address ?? "Coyoacán, CDMX"} · {today || "Hoy"} ·{" "}
                {dashboard?.demoMode ? "Modo demo" : "pey conectado"}
              </p>
            </div>

            <div className="relative min-h-[280px] overflow-hidden rounded-[4px] lg:min-h-full">
              <div className="halftone absolute inset-0">
                <Image
                  src="/tianguis-metepequense.jpg"
                  alt="Pasillo de un tianguis con frutas y verduras"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-transparent" />
              <div className="stamp absolute left-3 top-3 bg-paper/90 px-3 py-1.5 text-sm">
                Mercado Cero
              </div>
              <div className="absolute bottom-4 right-4 flex h-20 w-20 rotate-[-8deg] items-center justify-center rounded-full border-[3px] border-terracotta bg-paper/95 font-display text-5xl leading-none text-terracotta-deep">
                0
              </div>
              <p className="absolute bottom-3 left-3 max-w-[68%] text-[0.8rem] leading-tight text-paper/85">
                Tianguis, Estado de México. Foto: Álvaro de la Paz Franco / CC BY-SA 4.0.
              </p>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <div className="min-w-0 space-y-5">
              <section id="caja" className="scroll-mt-24">
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
                  canCharge={canCharge}
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

              <section id="actividad" className="scroll-mt-24">
                <ActivityList
                  orders={dashboard?.orders ?? []}
                  loading={loading}
                  onSelect={(order) => {
                    setActiveOrder(order);
                    setTab("caja");
                    window.setTimeout(() => {
                      document.getElementById("cobro")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 80);
                  }}
                />
              </section>
            </div>

            <div className="min-w-0 space-y-5">
              <section id="cobro" className="scroll-mt-24">
                <PaymentPanel
                  order={activeOrder}
                  demoMode={dashboard?.demoMode ?? false}
                  loading={paymentLoading}
                  mode={paymentMode}
                  onGenerate={(mode) => void generatePayment(mode)}
                  onDemoPay={(method) => void demoPay(method)}
                  onClose={() => setActiveOrder(null)}
                  onNew={() => {
                    setActiveOrder(null);
                    setTab("caja");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onCopy={async (value) => {
                    try {
                      await navigator.clipboard.writeText(value);
                      showToast("ok", "Link copiado.");
                    } catch {
                      showToast("error", "No pude copiar el link.");
                    }
                  }}
                />
              </section>

              <section id="fiado" className="scroll-mt-24">
                <CreditList
                  credits={pendingCredits}
                  payingId={creditPayId}
                  amount={creditPayAmount}
                  paying={creditPaying}
                  onStart={(credit) => {
                    setCreditPayId(credit.id);
                    setCreditPayAmount((credit.balanceCents / 100).toFixed(2));
                  }}
                  onCancel={() => {
                    setCreditPayId(null);
                    setCreditPayAmount("");
                  }}
                  onAmount={setCreditPayAmount}
                  onPay={(credit) => void payCredit(credit)}
                />
              </section>

              <section id="verificar" className="scroll-mt-24">
                <VerifyCard
                  value={verifyId}
                  result={verifyResult}
                  verifying={verifying}
                  onChange={setVerifyId}
                  onVerify={() => void verify()}
                  onFake={() => void verify(`fake_${Date.now()}`)}
                />
              </section>
            </div>
          </div>

          <section id="corte" className="mt-7 scroll-mt-24">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="space-y-5">
                <BusinessOverview
                  demoMode={dashboard?.demoMode ?? false}
                  onSpeak={(text) => {
                    showToast("info", text);
                    speak(text);
                  }}
                />
                <CashCloseCard showToast={showToast} />
              </div>
              <div className="space-y-5">
                <section id="meta" className="scroll-mt-24">
                  <GoalCard showToast={showToast} />
                </section>
                <ReconcileCard demoMode={dashboard?.demoMode ?? false} />
              </div>
            </div>
          </section>

          <section className="relative mt-8 overflow-hidden rounded-[4px]">
            <div className="halftone relative h-52 sm:h-64">
              <Image
                src="/tianguis-zitacuaro.jpg"
                alt="Tianguis en Zitácuaro, Michoacán"
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-green-deep/60" />
            <div className="absolute inset-0 flex flex-col justify-center px-6 text-paper sm:px-10">
              <p className="max-w-xl font-display text-2xl leading-tight tracking-tight sm:text-3xl">
                El mercado no necesita más apps. Necesita certeza.
              </p>
              <p className="mt-2 max-w-md text-sm text-paper/75">
                Cobrar, confirmar y cerrar. Sin depender de otra persona.
              </p>
            </div>
            <p className="absolute bottom-2 right-3 text-[0.8rem] text-paper/60">
              Foto: Letstown / CC0, vía Wikimedia Commons.
            </p>
          </section>

          <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-line pt-5 text-sm text-muted sm:flex-row sm:items-center">
            <p>
              Mercado Cero · prototipo para DevDay Exchange CDMX 2026 · pey + OpenAI ·{" "}
              <a
                href="/credits.txt"
                className="underline underline-offset-2 transition hover:text-ink"
              >
                Fotos: créditos
              </a>
            </p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-green" />
              En producción, ningún pago se confirma sin webhook firmado.
            </p>
          </footer>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-green/15 bg-paper lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {[
              { id: "caja" as const, label: "Caja", icon: Mic },
              { id: "fiado" as const, label: "Fiado", icon: NotebookPen },
              { id: "corte" as const, label: "Corte", icon: ReceiptText },
              { id: "meta" as const, label: "Camino", icon: Sparkles },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => {
                  setToast(null);
                  setTab(item.id);
                }}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-3 text-sm font-semibold transition",
                  tab === item.id ? "text-green" : "text-muted",
                )}
              >
                {tab === item.id ? (
                  <span className="absolute inset-x-6 top-0 h-0.5 bg-green" />
                ) : null}
                <item.icon className="h-5 w-5" strokeWidth={tab === item.id ? 2.2 : 1.7} />
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <PaidOverlay
          order={paidOverlay}
          demoMode={dashboard?.demoMode ?? false}
          onClose={() => setPaidOverlay(null)}
        />
        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
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
  canCharge: boolean;
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
    showTextInput,
    draftItems,
    cashCents,
    creditCents,
    customerName,
    draftTotal,
    digitalDue,
    overpay,
    savingOrder,
    canCharge,
    onStart,
    onStop,
    onTextInput,
    onToggleText,
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
    <div className="receipt-edge relative rounded-[4px] bg-card">
      <div className="relative overflow-hidden bg-green p-5 text-paper sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border border-paper/10" />
        <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full border border-paper/10" />

        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
            {listening ? (
              <>
                <span className="mic-ring absolute inset-0 rounded-full bg-paper/25" />
                <span className="mic-ring absolute inset-0 rounded-full bg-terracotta/30 [animation-delay:0.6s]" />
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
                "relative flex h-24 w-24 touch-none select-none items-center justify-center rounded-full transition active:scale-95 disabled:opacity-70",
                listening
                  ? "bg-terracotta text-paper ring-4 ring-paper/20"
                  : "bg-paper text-green hover:-translate-y-0.5",
              )}
            >
              {transcribing ? (
                <Loader2 className="h-9 w-9 animate-spin" />
              ) : listening ? (
                <span className="flex items-end gap-1.5">
                  {[0, 1, 2, 3].map((bar) => (
                    <span
                      key={bar}
                      className="w-1.5 rounded-full bg-paper/90"
                      style={{
                        height: `${14 + ((bar * 7 + recordingSeconds * 3) % 20)}px`,
                        animation: `blink ${0.7 + bar * 0.12}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </span>
              ) : (
                <Mic className="h-10 w-10" strokeWidth={1.7} />
              )}
            </button>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            {listening || transcribing ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-[3px] border border-paper/30 bg-paper/10 px-2.5 py-1 text-sm font-semibold text-paper">
                  {listening ? "Escuchando" : "Interpretando"}
                </span>
                {listening ? (
                  <span className="tabular text-sm font-semibold text-paper/80">
                    {recordingSeconds}s · suelta para terminar
                  </span>
                ) : null}
              </div>
            ) : null}
            <h2 className="mt-2 font-display text-[1.55rem] leading-tight tracking-tight text-paper sm:text-[1.8rem]">
              {listening
                ? "Te escucho…"
                : transcribing
                  ? "Armando la venta…"
                  : "¿Qué vendiste?"}
            </h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-paper/75">
              {listening
                ? "Di la venta como se la dirías a tu ayudante: productos, cantidades y precios."
                : "Mantén presionado el botón y habla. También puedes escribir la venta si hay mucho ruido."}
            </p>

            {transcript ? (
              <div className="mt-3 border-l-2 border-terracotta bg-paper/10 px-3.5 py-2.5 text-left text-sm leading-relaxed text-paper">
                <span className="mr-1.5 font-display text-terracotta-soft">“</span>
                {transcript}
                <span className="ml-0.5 font-display text-terracotta-soft">”</span>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
              {SAMPLE_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => onSample(phrase)}
                  className="inline-flex min-h-11 items-center border-b border-paper/30 py-1 text-left text-sm text-paper/75 transition hover:border-paper hover:text-paper"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">
              Pedido en curso
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {draftItems.length > 0
                ? `${draftItems.length} ${draftItems.length === 1 ? "producto" : "productos"}`
                : "Todavía no hay productos"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleText}
              className="flex h-11 items-center gap-1.5 rounded-[3px] border border-line bg-card px-3 text-sm font-semibold text-ink-soft transition hover:border-green/30 hover:text-green"
            >
              <Plus className="h-3.5 w-3.5" />
              {showTextInput ? "Ocultar texto" : "Escribir venta"}
            </button>
            {draftItems.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="flex h-11 items-center gap-1.5 rounded-[3px] px-2.5 text-sm font-semibold text-muted transition hover:text-terracotta-deep"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </button>
            ) : null}
          </div>
        </div>

        {showTextInput ? (
          <div className="mb-4 flex flex-col gap-2 rounded-[3px] border-b border-line bg-paper/60 p-2.5 sm:flex-row">
            <input
              value={textInput}
              onChange={(event) => onTextInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onInterpret();
              }}
              placeholder="Ej. dos quesadillas de 35 y un agua de 20"
              aria-label="Escribe la venta"
              className="min-w-0 flex-1 rounded-xl border border-transparent bg-card px-3.5 py-2.5 text-sm text-ink outline-none ring-green/30 placeholder:text-muted/70 focus:border-green/30 focus:ring-2"
            />
            <button
              type="button"
              onClick={onInterpret}
              disabled={!textInput.trim() || transcribing}
              className="flex items-center justify-center gap-2 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-green-deep disabled:opacity-50"
            >
              {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Interpretar
            </button>
          </div>
        ) : null}

        {draftItems.length > 0 ? (
          <div className="space-y-2">
            {draftItems.map((item, index) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto] gap-2 border-b border-line/60 py-2.5 sm:grid-cols-[1fr_74px_96px_auto] sm:items-center"
              >
                <input
                  value={item.description}
                  onChange={(event) => {
                    const next = [...draftItems];
                    next[index] = { ...item, description: event.target.value };
                    onDraftItems(next);
                  }}
                  className="min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-ink outline-none focus:border-line focus:bg-card"
                  aria-label="Producto"
                />
                <div className="flex items-center gap-1 sm:justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...draftItems];
                      next[index] = { ...item, quantity: Math.max(0.25, item.quantity - 1) };
                      onDraftItems(next);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-line bg-card text-muted"
                    aria-label="Menos cantidad"
                  >
                    <span className="text-sm leading-none">−</span>
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
                    className="tabular w-9 rounded-lg border border-transparent bg-transparent px-1 py-1 text-center text-sm font-semibold text-ink outline-none focus:border-line focus:bg-card"
                    aria-label="Cantidad"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...draftItems];
                      next[index] = { ...item, quantity: item.quantity + 1 };
                      onDraftItems(next);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-line bg-card text-muted"
                    aria-label="Más cantidad"
                  >
                    <span className="text-sm leading-none">+</span>
                  </button>
                </div>
                <div className="flex items-center justify-end gap-1 sm:justify-center">
                  <span className="text-sm text-muted">$</span>
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
                    className="tabular w-20 rounded-lg border border-transparent bg-transparent px-1 py-1 text-right text-sm font-semibold text-ink outline-none focus:border-line focus:bg-card"
                    aria-label="Precio unitario"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDraftItems(draftItems.filter((candidate) => candidate.id !== item.id))}
                  className="col-span-2 flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-muted transition hover:bg-terracotta-soft hover:text-terracotta-deep sm:col-span-1"
                  aria-label="Quitar producto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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
              className="flex w-full items-center justify-center gap-1.5 rounded-[3px] bg-paper/60 py-2.5 text-sm font-semibold text-muted transition hover:text-green"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar producto
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[3px] bg-paper/60 px-4 py-7 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-green-soft text-green">
              <ReceiptText className="h-5 w-5" />
            </div>
            <p className="mt-2 text-sm font-semibold text-ink-soft">La caja está lista</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Habla o escribe una venta. Si el cliente paga con tarjeta, CoDi o wallet, se genera
              un solo link.
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="rounded-[3px] bg-paper/60 p-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
              <Banknote className="h-3.5 w-3.5" />
              Efectivo recibido
            </span>
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-sm text-muted">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={cashCents === 0 ? "" : (cashCents / 100).toFixed(2)}
                onChange={(event) => onCash(Math.max(0, Math.round(Number(event.target.value) * 100)))}
                placeholder="0.00"
                aria-label="Efectivo recibido en pesos"
                className="tabular min-h-10 w-full bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-muted/50"
              />
            </div>
          </label>

          <label className="rounded-[3px] bg-paper/60 p-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
              <NotebookPen className="h-3.5 w-3.5" />
              A fiado
            </span>
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-sm text-muted">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={creditCents === 0 ? "" : (creditCents / 100).toFixed(2)}
                onChange={(event) => onCredit(Math.max(0, Math.round(Number(event.target.value) * 100)))}
                placeholder="0.00"
                aria-label="Monto a fiado en pesos"
                className="tabular min-h-10 w-full bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-muted/50"
              />
            </div>
          </label>
        </div>

        {creditCents > 0 ? (
          <div className="mt-2 flex items-center gap-2 rounded-[3px] bg-terracotta-soft/70 px-3 py-2.5">
            <UserRound className="h-4 w-4 shrink-0 text-terracotta-deep" />
            <input
              value={customerName}
              onChange={(event) => onCustomer(event.target.value)}
              placeholder="¿Quién queda a deber? Ej. Juan"
              aria-label="Nombre del cliente para el fiado"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-muted/70"
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="tabular font-display text-[2.15rem] leading-none tracking-tight text-ink">
              {formatMxn(draftTotal)}
            </p>
            <p className="mt-1 text-sm text-muted">
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
            disabled={!canCharge}
            className="group flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-green px-5 py-3 text-sm font-bold text-paper transition hover:bg-green-deep disabled:cursor-not-allowed disabled:opacity-45"
          >
            {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
            Confirmar venta
          </button>
        </div>
      </div>
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
}) {
  const { order, demoMode, loading, mode, onGenerate, onDemoPay, onClose, onNew, onCopy } = props;

  if (!order) {
    return (
      <div className="receipt-edge relative rounded-[4px] bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">Cobro</p>
            <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
              Un link. Cualquier forma de pagar.
            </h2>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-green-soft text-green">
            <QrCode className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-5 divide-y divide-line/60">
          {[
            { title: "CoDi", text: "Transferencia bancaria gratuita, directo a la cuenta receptora." },
            { title: "Tarjeta", text: "El cliente paga en el checkout alojado; no tocamos datos de tarjeta." },
            { title: "Apple Pay / Google Pay", text: "La misma liga funciona en el teléfono del cliente." },
          ].map((item) => (
            <div key={item.title} className="py-3">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 max-w-[60ch] text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          El pedido se marca como pagado únicamente cuando llega el webhook firmado de pey. Una
          captura de pantalla no cuenta.
        </p>
      </div>
    );
  }

  const due = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
  const isPaid = order.status === "paid";
  const isCredit = order.status === "fulfilled" && order.creditCents > 0;
  const isMixed = isCredit && order.digitalPaidCents > 0;
  const waiting = order.status === "payment_pending" || order.status === "confirmed";
  const qrValue = order.qrImage ? null : order.qrString ?? order.paymentUrl;

  if (isPaid || isCredit) {
    return (
      <div className="rise receipt-edge relative rounded-[4px] bg-card">
        <div className="bg-green p-6 text-paper">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-paper/70">
                {isPaid
                  ? demoMode
                    ? "Pago simulado · demo"
                    : "Pago verificado"
                  : isMixed
                    ? "Pago mixto"
                    : "Venta a fiado"}
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-tight text-paper">
                {isPaid ? "Listo para entregar" : isMixed ? "Cobro mixto registrado" : "Quedó registrado"}
              </h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-paper/15 text-paper">
              {isPaid ? <Check className="h-6 w-6" /> : <NotebookPen className="h-5 w-5" />}
            </div>
          </div>
          <p className="tabular mt-5 font-display text-[2.6rem] leading-none tracking-tight text-paper">
            {formatMxn(order.totalCents)}
          </p>
          <p className="mt-1.5 text-sm text-paper/75">
            Pedido {shortOrder(order.id)} ·{" "}
            {isPaid
              ? demoMode
                ? "simulado en modo demo"
                : "confirmado por pey"
              : isMixed
                ? `${formatMxn(order.digitalPaidCents)} digitales + ${formatMxn(order.creditCents)} a fiado`
                : `fiado con ${order.customerName ?? "el cliente"}`}
          </p>
          {isCredit ? (
            <p className="mt-3 rounded-[3px] bg-paper/10 px-3 py-2 text-sm leading-relaxed text-paper/80">
              {isMixed ? (
                <>
                  Digital verificado: <strong>{formatMxn(order.digitalPaidCents)}</strong>.{" "}
                </>
              ) : null}
              Saldo pendiente: <strong>{formatMxn(order.creditCents)}</strong>. Aparece en la
              libreta de fiado; no es dinero recibido.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-paper/15 p-4">
          <button
            type="button"
            onClick={onNew}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[3px] bg-paper px-4 py-3 text-sm font-bold text-green transition hover:bg-paper-deep"
          >
            <Plus className="h-4 w-4" />
            Nuevo cobro
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[3px] border border-paper/30 px-4 py-3 text-sm font-semibold text-paper/80 transition hover:text-paper"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rise receipt-print receipt-edge relative rounded-[4px] bg-card">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-muted">
            Cobro · Pedido {shortOrder(order.id)}
          </p>
          <StatusBadge status={order.status} />
        </div>
        <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
          {order.paymentUrl || order.qrString ? "Esperando el pago" : "Genera el cobro"}
        </h2>
        <p className="tabular mt-4 font-display text-[2.5rem] leading-none tracking-tight text-ink">
          {formatMxn(due)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {order.items.map((item) => `${item.quantity} ${item.description}`).join(" · ")}
        </p>
      </div>

      <div className="p-5 sm:p-6">
        {!order.paymentUrl && !order.qrString ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onGenerate("link")}
              disabled={loading}
              className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-[3px] bg-green px-4 py-3.5 text-left text-paper transition hover:bg-green-deep disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper/15">
                  <Link2 className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-bold">Link de pago</span>
                  <span className="block text-sm text-paper/70">CoDi + tarjeta + wallets</span>
                </span>
              </span>
              {loading && mode === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => onGenerate("qr")}
              disabled={loading}
              className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-[3px] bg-paper/60 px-4 py-3.5 text-left text-ink transition hover:bg-green-soft/40 disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-soft text-green">
                  <QrCode className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-bold">QR CoDi directo</span>
                  <span className="block text-sm text-muted">Solo transferencia CoDi</span>
                </span>
              </span>
              {loading && mode === "qr" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>
          </div>
        ) : null}

        {order.paymentUrl ? (
          <div className="space-y-3">
            <div className="flex justify-center rounded-[3px] border border-line bg-white p-4">
              <QrImage value={order.paymentUrl} className="h-48 w-48" />
            </div>
            <div className="flex items-center gap-2 rounded-[3px] bg-paper/60 p-2">
              <Link2 className="ml-1.5 h-4 w-4 shrink-0 text-muted" />
              <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">{order.paymentUrl}</p>
              <button
                type="button"
                onClick={() => onCopy(order.paymentUrl ?? "")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-card text-muted transition hover:text-green"
                aria-label="Copiar link"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <a
              href={order.paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-green-soft/60 px-4 py-2.5 text-sm font-semibold text-green-deep transition hover:bg-green-soft"
            >
              {demoMode ? "Abrir checkout de demostración" : "Abrir checkout de pey"}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        ) : null}

        {order.qrString ? (
          <div className="space-y-3">
            <div className="flex justify-center rounded-[3px] border border-line bg-white p-4">
              {order.qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={order.qrImage} alt="Código QR CoDi" className="h-48 w-48" />
              ) : qrValue ? (
                <QrImage value={qrValue} className="h-48 w-48" />
              ) : null}
            </div>
            <p className="text-center text-sm text-muted">
              Referencia {order.numRef ?? "—"} · expira en 10 minutos
            </p>
          </div>
        ) : null}

        {waiting && (order.paymentUrl || order.qrString) ? (
          <div className="mt-4 rounded-[3px] bg-terracotta-soft/60 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-terracotta" />
              </span>
              Esperando confirmación del banco…
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Esta pantalla se actualiza sola cuando pey confirma el pago. No marques el pedido
              como entregado antes.
            </p>
          </div>
        ) : null}

        {demoMode ? (
          order.paymentUrl || order.qrString ? (
            <div className="mt-4 rounded-[3px] bg-terracotta-soft/40 p-3">
              <p className="text-sm font-semibold text-terracotta-deep">
                Modo demo
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Simula la confirmación para probar la demo sin una cuenta activa.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDemoPay("codi")}
                  disabled={loading}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-[3px] bg-card px-2 py-2 text-sm font-semibold text-ink-soft transition hover:text-green disabled:opacity-50"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Simular CoDi
                </button>
                <button
                  type="button"
                  onClick={() => onDemoPay("card")}
                  disabled={loading}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-[3px] bg-card px-2 py-2 text-sm font-semibold text-ink-soft transition hover:text-green disabled:opacity-50"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Simular tarjeta
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-[3px] bg-paper/60 px-3 py-2.5 text-sm leading-relaxed text-muted">
              Genera el link o el QR para simular la confirmación del banco.
            </p>
          )
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 w-full rounded-[3px] py-2 text-center text-sm font-semibold text-muted transition hover:text-ink"
        >
          Cerrar cobro
        </button>
      </div>
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
    <div className="relative overflow-hidden rounded-[4px] bg-card">
      <div className="border-b-2 border-green/15 bg-paper-deep/50 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-muted">Mi negocio</p>
              {demoMode ? (
                <span className="rounded-[3px] bg-terracotta-soft px-2 py-0.5 text-sm font-semibold text-terracotta-deep">
                  Datos demo
                </span>
              ) : null}
            </div>
            <h2 className="mt-0.5 font-display text-2xl tracking-tight text-ink">
              Así va la caja
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4">
              {(["today", "week", "month"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={cn(
                    "min-h-11 min-w-11 border-b-2 pb-1 text-center text-sm font-semibold transition",
                    period === value
                      ? "border-green text-ink"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {value === "today" ? "Hoy" : value === "week" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={speakReport}
              className="flex min-h-11 items-center gap-1.5 rounded-[3px] bg-card px-3 text-sm font-semibold text-ink-soft transition hover:text-green"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Escuchar
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
      {loading && !report ? (
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <div className="shimmer h-28 rounded-2xl" />
          <div className="shimmer h-28 rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-5 rounded-2xl border border-terracotta/20 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : report ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="tabular font-display text-[3.4rem] leading-[0.9] tracking-[-0.03em] text-ink">
                {formatMxn(report.salesCents)}
              </p>
              <p className="mt-1 text-sm font-semibold text-muted">
                Ventas registradas · {report.label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {comparison === null ? (
                <span className="text-sm text-muted">Sin periodo anterior</span>
              ) : (
                <>
                  <span
                    className={cn(
                      "inline-flex rotate-[-4deg] items-center gap-1 border-2 px-2.5 py-1 text-sm font-bold",
                      comparison >= 0
                        ? "border-green/50 text-green-deep"
                        : "border-terracotta/50 text-terracotta-deep",
                    )}
                  >
                    <ArrowUpRight
                      className={cn("h-3.5 w-3.5", comparison < 0 && "rotate-90")}
                    />
                    {comparison >= 0 ? "+" : ""}
                    {comparison}%
                  </span>
                  <span className="text-sm text-muted">vs periodo anterior</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 border-t border-line/60">
            {[
              { label: "Cobrado", value: report.collectedCents, note: "De las ventas del periodo" },
              { label: "Por cobrar", value: report.pendingCents, note: "De las ventas del periodo" },
              { label: "Ticket promedio", value: report.averageTicketCents, note: `${report.orderCount} ventas` },
              { label: "Fiado", value: report.creditCents, note: "Saldo pendiente total" },
            ].map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "py-3.5",
                  index % 2 === 0 ? "border-r border-line/60 pr-3" : "pl-3",
                  index < 2 && "border-b border-line/60",
                )}
              >
                <p className="text-sm font-semibold text-muted">{item.label}</p>
                <p className="tabular mt-1 text-xl font-bold text-ink">{formatMxn(item.value)}</p>
                <p className="mt-0.5 text-sm text-muted">{item.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-line/60 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted">Cómo te pagaron</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-green" />
                  Efectivo {formatMxn(report.cashCents)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-terracotta" />
                  Digital {formatMxn(report.digitalCents)}
                </span>
              </div>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden bg-line/60">
              <div
                className="bg-green"
                style={{
                  width: `${
                    report.collectedCents > 0
                      ? (report.cashCents / report.collectedCents) * 100
                      : 0
                  }%`,
                }}
              />
              <div className="flex-1 bg-terracotta" />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-muted">
                {period === "month" ? "Últimos 30 días" : "Últimos 7 días"}
              </p>
              {report.bestDay ? (
                <p className="text-sm text-muted">
                  Mejor día: {report.bestDay.date.slice(5)} ·{" "}
                  {formatCompactMxn(report.bestDay.salesCents)}
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex h-24 items-end gap-1 border-b border-line/60">
              {report.series.map((point) => (
                <div
                  key={point.date}
                  className="group relative flex-1"
                  title={`${point.date}: ${formatMxn(point.salesCents)} · ${point.orders} ventas`}
                >
                  <div
                    className={cn(
                      "bar-grow w-full",
                      point.salesCents > 0
                        ? "bg-green group-hover:bg-green-deep"
                        : "bg-line/60",
                    )}
                    style={{
                      height: `${Math.max(3, (point.salesCents / maxSeries) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              <span>
                {report.bestHour !== null
                  ? `Mejor hora: ${String(report.bestHour).padStart(2, "0")}:00`
                  : "Sin datos por hora."}
              </span>
              <span>Mismo registro, sin doble conteo.</span>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-muted">
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
      showToast(
        "ok",
        `Corte guardado. Diferencia: ${formatMxn(data.close.differenceCents)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el corte.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="receipt-edge relative rounded-[4px] bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Corte de caja</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
            Cuenta el efectivo de hoy
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-paper/60 text-muted transition hover:text-ink disabled:opacity-50"
          title="Actualizar corte"
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
        <p className="mt-4 rounded-[3px] bg-terracotta-soft px-4 py-3 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : status ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            {[
              { label: "Base inicial", value: openingCents, negative: false },
              { label: "Ventas en efectivo", value: status.cashSalesCents, negative: false },
              { label: "Abonos de fiado en efectivo", value: status.cashCreditCents, negative: false },
              { label: "Gastos de caja", value: expensesCents, negative: true },
              { label: "Retiros", value: withdrawalsCents, negative: true },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-muted">{row.label}</span>
                <span
                  className={cn(
                    "tabular font-semibold",
                    row.negative && row.value > 0 ? "text-terracotta-deep" : "text-ink",
                  )}
                >
                  {row.negative && row.value > 0
                    ? `− ${formatMxn(row.value)}`
                    : formatMxn(row.value)}
                </span>
              </div>
            ))}
            <div className="flex items-end justify-between gap-3 border-t border-line pt-2">
              <span className="font-semibold text-ink">Debería haber</span>
              <span className="tabular font-display text-2xl font-bold leading-none text-ink">
                {formatMxn(expectedCents)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-sm font-semibold text-muted">Gastos de caja</span>
              <div className="mt-1 flex items-center gap-1 rounded-[3px] border-b border-line bg-paper/60 px-2.5 py-2">
                <span className="text-sm text-muted">$</span>
                <input
                  value={expenses}
                  onChange={(event) => setExpenses(event.target.value)}
                  inputMode="decimal"
                  className="tabular min-h-10 w-full bg-transparent text-sm text-ink outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-muted">Retiros</span>
              <div className="mt-1 flex items-center gap-1 rounded-[3px] border-b border-line bg-paper/60 px-2.5 py-2">
                <span className="text-sm text-muted">$</span>
                <input
                  value={withdrawals}
                  onChange={(event) => setWithdrawals(event.target.value)}
                  inputMode="decimal"
                  className="tabular min-h-10 w-full bg-transparent text-sm text-ink outline-none"
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-muted">Total contado</span>
            <div className="mt-1 flex items-center gap-1 rounded-[3px] border-b border-line bg-paper/60 px-3 py-2">
              <span className="text-sm text-muted">$</span>
              <input
                value={counted}
                onChange={(event) => {
                  setCounted(event.target.value);
                  setCounts({});
                }}
                inputMode="decimal"
                placeholder="0.00"
                className="tabular min-h-10 w-full bg-transparent text-lg font-bold text-ink outline-none"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => setShowCounts((value) => !value)}
            className="min-h-11 text-left text-sm font-semibold text-green underline-offset-2 hover:underline"
          >
            {showCounts ? "Ocultar conteo por billetes y monedas" : "Contar por billetes y monedas"}
          </button>

          {showCounts ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                El conteo por billetes reemplaza el total contado.
              </p>
              <div className="grid grid-cols-3 gap-2 rounded-[3px] bg-paper/60 p-3">
                {DENOMINATIONS.map((denomination) => (
                <label key={denomination} className="block">
                  <span className="text-sm font-semibold text-muted">
                    {denominationLabel(denomination)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={counts[denomination] ?? 0}
                    onChange={(event) =>
                      updateCount(denomination, Number(event.target.value))
                    }
                    className="tabular mt-1 min-h-9 w-full rounded-[3px] border border-line bg-card px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-green"
                  />
                </label>
              ))}
              </div>
            </div>
          ) : null}

          {hasCounted ? (
            <div className="flex items-center justify-between gap-3">
              <span
                className="stamp px-3 py-1.5 text-sm"
                style={{
                  color:
                    differenceCents === 0
                      ? "var(--color-green-deep)"
                      : "var(--color-terracotta-deep)",
                }}
              >
                {differenceCents === 0 ? "Cuadra" : "Diferencia"}
              </span>
              <span
                className={cn(
                  "tabular font-display text-2xl font-bold",
                  differenceCents === 0 ? "text-green-deep" : "text-terracotta-deep",
                )}
              >
                {formatMxn(differenceCents)}
              </span>
            </div>
          ) : (
            <p className="rounded-[3px] bg-paper/60 px-3 py-2.5 text-sm text-muted">
              Escribe el total contado para ver si cuadra.
            </p>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-muted">Base para mañana</span>
            <div className="mt-1 flex items-center gap-1 rounded-[3px] border-b border-line bg-paper/60 px-2.5 py-2">
              <span className="text-sm text-muted">$</span>
              <input
                value={baseNext}
                onChange={(event) => setBaseNext(event.target.value)}
                inputMode="decimal"
                className="tabular min-h-10 w-full bg-transparent text-sm text-ink outline-none"
              />
            </div>
          </label>
          {hasCounted ? (
            <p className="text-sm text-muted">
              Adicional a retirar:{" "}
              <span className="font-semibold text-ink">{formatMxn(withdrawalNextCents)}</span>
            </p>
          ) : null}

          {status.saved ? (
            <p className="rounded-[3px] bg-paper/60 px-3 py-2 text-sm leading-relaxed text-muted">
              Último corte guardado: contado {formatMxn(status.saved.countedCents)} · diferencia{" "}
              {formatMxn(status.saved.differenceCents)}. Puedes volver a contar y guardar de nuevo.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-[3px] bg-terracotta-soft px-3 py-2 text-sm text-terracotta-deep">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void saveClose()}
            disabled={saving}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-green px-4 py-3 text-sm font-semibold text-paper transition hover:bg-green-deep disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Guardando..." : "Guardar corte"}
          </button>
          <p className="text-sm leading-relaxed text-muted">
            Los gastos y retiros se registran solo al guardar el corte. No se ajusta el efectivo automáticamente.
          </p>
        </div>
      ) : null}
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
      showToast(
        "ok",
        `Apartaste ${formatMxn(amountCents)} para ${data.goal.title}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar la aportación.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="receipt-edge relative rounded-[4px] bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Mi camino</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
            Una meta a la vez
          </h2>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-terracotta/40 text-terracotta-deep">
          <Umbrella className="h-7 w-7" strokeWidth={1.4} />
        </div>
      </div>

      <div className="halftone relative mt-4 h-32 overflow-hidden rounded-[3px]">
        <Image
          src="/puesto-flores.jpg"
          alt="Puesto de flores en un tianguis de la Ciudad de México"
          fill
          sizes="(max-width: 1024px) 100vw, 420px"
          className="object-cover"
        />
      </div>
      <p className="mt-1.5 text-[0.8rem] text-muted">
        Lo que estás construyendo · Foto: Ehécatl Cabrera / CC BY-SA 4.0.
      </p>

      {loading && !goal ? (
        <div className="mt-4 shimmer h-24 rounded-[3px]" />
      ) : !goal ? (
        <p className="mt-4 rounded-[3px] bg-card/60 px-4 py-3 text-sm text-muted">
          Aún no hay una meta. La primera puede ser algo concreto para tu puesto.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-xl font-semibold tracking-tight text-ink">{goal.title}</p>
              <p className="text-sm text-muted">
                {formatMxn(goal.savedCents)} de {formatMxn(goal.targetCents)}
              </p>
            </div>
            <p className="tabular text-2xl font-bold text-terracotta-deep">{goal.progressPct}%</p>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-4 w-4 rounded-full border-2",
                  index < Math.round(goal.progressPct / 12.5)
                    ? "border-terracotta bg-terracotta"
                    : "border-line bg-card",
                )}
              />
            ))}
          </div>
          <p className="text-sm text-muted">
            {goal.weeksRemaining !== null
              ? `${goal.weeksRemaining} semanas para la meta`
              : "Sin fecha límite"}
          </p>
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div className="rounded-[3px] bg-paper/60 px-3 py-2">
              <p className="text-muted">Falta</p>
              <p className="tabular mt-0.5 text-base font-bold text-ink">{formatMxn(goal.remainingCents)}</p>
            </div>
            <div className="rounded-[3px] bg-paper/60 px-3 py-2">
              <p className="text-muted">Por semana</p>
              <p className="tabular mt-0.5 text-base font-bold text-ink">
                {goal.weeklyNeededCents ? formatMxn(goal.weeklyNeededCents) : "—"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-1 rounded-[3px] border-b border-line bg-paper/60 px-2.5 py-2">
              <span className="text-sm text-muted">$</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="¿Cuánto apartaste?"
                className="tabular min-h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
              />
            </div>
            <button
              type="button"
              onClick={() => void contribute()}
              disabled={saving}
              className="flex min-h-11 items-center gap-1.5 rounded-[3px] bg-terracotta-deep px-3 py-2 text-sm font-semibold text-paper transition hover:bg-ink disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Apartar
            </button>
          </div>
          {error ? (
            <p className="rounded-[3px] bg-terracotta-soft px-3 py-2 text-sm text-terracotta-deep">
              {error}
            </p>
          ) : null}
          <p className="text-sm leading-relaxed text-muted">
            Apartado declarado: no es una cuenta bancaria ni dinero custodiado. El efectivo sigue en tu resguardo.
          </p>
        </div>
      )}
    </div>
  );
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  if (!open) return null;

  const faqs = [
    {
      q: "¿Cómo cobro?",
      a: "Dicta o escribe la venta, confirma el total y genera un link o QR de pey. El cliente paga desde su banco o wallet.",
    },
    {
      q: "¿Cuándo está pagado?",
      a: "Solo cuando la app muestra “Pago verificado” después de un webhook firmado de pey. Mientras diga pendiente, no entregues el pedido.",
    },
    {
      q: "¿Puedo cobrar en efectivo?",
      a: "Sí. El efectivo se registra como declarado por la comerciante; no es una confirmación bancaria. El corte separa efectivo, digital verificado y fiado.",
    },
    {
      q: "¿Qué es el fiado?",
      a: "Es una libreta de deudas y abonos. Un abono reduce el saldo, pero no cuenta como una venta nueva ni como un pago bancario verificado.",
    },
    {
      q: "¿La cuenta es de mi hija?",
      a: "La app muestra únicamente los cobros generados por el negocio. No accede al saldo ni a los movimientos personales del titular de la cuenta.",
    },
    {
      q: "¿Qué es el corte de caja?",
      a: "Es la suma de tu base inicial más las ventas en efectivo y los abonos de fiado, menos gastos y retiros. Si lo contado no coincide, la app muestra la diferencia; no la ajusta sola.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guía de Mercado Cero"
        className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-[4px] border border-line bg-card p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">Guía</p>
            <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
              ¿Cómo funciona?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-paper/60 text-muted transition hover:text-ink"
            aria-label="Cerrar guía"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-[3px] bg-green-soft p-4 text-green-deep">
          <p className="text-sm font-semibold">Primeros pasos</p>
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
            <li>1. Dicta o escribe una venta.</li>
            <li>2. Genera el link o QR y compártelo.</li>
            <li>3. Espera el webhook firmado: solo entonces está pagado.</li>
            <li>4. Al final del día, cuenta tu efectivo y cierra caja.</li>
          </ol>
        </div>

        <div className="mt-3 space-y-1.5">
          {faqs.map((faq, index) => (
            <div key={faq.q} className="rounded-[3px] bg-paper/60">
              <button
                type="button"
                onClick={() => setExpanded(expanded === index ? null : index)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-semibold text-ink"
              >
                {faq.q}
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted transition-transform",
                    expanded === index && "rotate-90",
                  )}
                />
              </button>
              {expanded === index ? (
                <p className="px-3.5 pb-3 text-sm leading-relaxed text-muted">
                  {faq.a}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          Las respuestas son fijas y verificadas. La app no usa el modelo para decidir si un pago llegó.
        </p>
      </div>
    </div>
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
    <div className="rounded-[4px] bg-paper/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Conciliación</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
            ¿Cuadra con pey?
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void reconcile()}
          disabled={loading || demoMode}
          className="flex h-11 items-center gap-1.5 rounded-[3px] bg-card px-3 text-sm font-semibold text-ink-soft transition hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="mt-4 rounded-[3px] bg-card/60 px-4 py-3 text-sm leading-relaxed text-muted">
          En modo demo no hay transacciones reales de pey. La conciliación se
          activa con la API key y el webhook reales.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-[3px] bg-terracotta-soft px-4 py-3 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : !report ? (
        <p className="mt-4 rounded-[3px] bg-card/60 px-4 py-3 text-sm leading-relaxed text-muted">
          Compara los pagos digitales del día contra las transacciones de pey.
          No corrige nada: solo muestra si cuadran.
        </p>
      ) : report.checked === 0 ? (
        <p className="mt-4 rounded-[3px] bg-card/60 px-4 py-3 text-sm text-muted">
          No hay pagos digitales hoy.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-[3px] px-4 py-3",
              report.reconciled
                ? "bg-green-soft text-green-deep"
                : "bg-terracotta-soft text-terracotta-deep",
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

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[3px] bg-card/60 p-3">
              <p className="text-sm font-semibold text-muted">
                Local
              </p>
              <p className="tabular mt-1 text-base font-bold text-ink">
                {formatMxn(report.localDigitalCents)}
              </p>
            </div>
            <div className="rounded-[3px] bg-card/60 p-3">
              <p className="text-sm font-semibold text-muted">
                pey
              </p>
              <p className="tabular mt-1 text-base font-bold text-ink">
                {formatMxn(report.peyConfirmedCents)}
              </p>
            </div>
          </div>

          {report.differenceCents !== 0 ? (
            <p className="rounded-[3px] bg-terracotta-soft px-3 py-2 text-sm font-semibold text-ink-soft">
              Diferencia: {formatMxn(report.differenceCents)}
            </p>
          ) : null}

          {issues.slice(0, 3).map((item) => (
            <div
              key={`${item.orderId}-${item.transactionId ?? "sin-tx"}`}
              className="rounded-[3px] bg-card/60 px-3 py-2"
            >
              <p className="text-sm font-semibold text-ink">
                Pedido {shortOrder(item.orderId)} · {item.method}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">
                {item.reason ?? item.status}
              </p>
            </div>
          ))}

          <p className="text-sm leading-relaxed text-muted">
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
  return (
    <div className="receipt-edge relative rounded-[4px] bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Actividad</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
            Últimos movimientos
          </h2>
        </div>
        <span className="rounded-[3px] bg-paper/60 px-2.5 py-1 text-sm font-semibold text-muted">
          {orders.length} pedidos
        </span>
      </div>

      <div className="mt-4 max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="shimmer h-14 rounded-2xl" />
          ))
        ) : orders.length === 0 ? (
          <p className="rounded-[3px] bg-paper/60 px-4 py-6 text-center text-sm text-muted">
            Aún no hay ventas. Habla para crear la primera.
          </p>
        ) : (
          orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => onSelect(order)}
              className="group flex w-full items-center gap-3 border-b border-line/60 px-0 py-3 text-left transition last:border-b-0 hover:bg-paper/30"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px]",
                  order.status === "paid" || order.status === "fulfilled"
                    ? "bg-green-soft text-green"
                    : order.status === "payment_pending"
                      ? "bg-terracotta-soft text-terracotta-deep"
                      : "bg-paper-deep text-muted",
                )}
              >
                {order.status === "paid" || order.status === "fulfilled" ? (
                  <Check className="h-4 w-4" />
                ) : order.status === "payment_pending" ? (
                  <Clock3 className="h-4 w-4" />
                ) : (
                  <ReceiptText className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {order.items.map((item) => `${item.quantity} ${item.description}`).join(" · ") ||
                    `Pedido ${shortOrder(order.id)}`}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                  <span>{formatTime(order.createdAt)}</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-muted/50" />
                  <span>{statusLabel(order.status)}</span>
                  {order.creditCents > 0 ? (
                    <>
                      <span className="h-0.5 w-0.5 rounded-full bg-muted/50" />
                      <span className="text-terracotta-deep">fiado</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-bold text-ink">{formatMxn(order.totalCents)}</p>
                <ChevronRight className="ml-auto mt-0.5 h-3.5 w-3.5 text-muted/60 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Fiado                                    */
/* -------------------------------------------------------------------------- */

function CreditList({
  credits,
  payingId,
  amount,
  paying,
  onStart,
  onCancel,
  onAmount,
  onPay,
}: {
  credits: Credit[];
  payingId: string | null;
  amount: string;
  paying: boolean;
  onStart: (credit: Credit) => void;
  onCancel: () => void;
  onAmount: (value: string) => void;
  onPay: (credit: Credit) => void;
}) {
  return (
    <div className="receipt-edge relative rounded-[4px] bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Libreta</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">Fiado</h2>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-terracotta-soft text-terracotta-deep">
          <NotebookPen className="h-4 w-4" />
        </div>
      </div>

      {credits.length === 0 ? (
        <p className="mt-4 rounded-[3px] bg-paper/60 px-4 py-5 text-center text-sm text-muted">
          Sin fiados pendientes. Cuando apuntes uno, aparecerá aquí.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {credits.map((credit) => (
            <div key={credit.id} className="rounded-[3px] bg-paper/60 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-sm font-bold text-terracotta-deep shadow-sm">
                  {initials(credit.customerName ?? "Cliente")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {credit.customerName ?? "Cliente"}
                  </p>
                  <p className="text-sm text-muted">
                    {credit.status === "partial" ? "Abono parcial" : "Pendiente"} · desde{" "}
                    {formatTime(credit.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm font-bold text-terracotta-deep">
                    {formatMxn(credit.balanceCents)}
                  </p>
                  <p className="text-sm text-muted">saldo</p>
                </div>
              </div>

              {payingId === credit.id ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1 rounded-xl border border-line bg-card px-2.5 py-1.5">
                    <span className="text-sm text-muted">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={amount}
                      onChange={(event) => onAmount(event.target.value)}
                      aria-label="Monto del abono en pesos"
                      className="tabular w-full bg-transparent text-sm font-semibold text-ink outline-none"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onPay(credit)}
                    disabled={paying}
                    className="flex items-center gap-1.5 rounded-xl bg-green px-3 py-2 text-sm font-bold text-paper transition hover:bg-green-deep disabled:opacity-50"
                  >
                    {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Registrar
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:text-ink"
                    aria-label="Cancelar abono"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onStart(credit)}
                  className="mt-2.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[3px] bg-paper/60 py-2.5 text-sm font-semibold text-ink-soft transition hover:text-green"
                >
                  <Banknote className="h-3.5 w-3.5" />
                  Registrar abono
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Verificación                                */
/* -------------------------------------------------------------------------- */

function VerifyCard({
  value,
  result,
  verifying,
  onChange,
  onVerify,
  onFake,
}: {
  value: string;
  result: VerifyResult | null;
  verifying: boolean;
  onChange: (value: string) => void;
  onVerify: () => void;
  onFake: () => void;
}) {
  return (
    <div className="receipt-edge relative rounded-[4px] bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Anti-fraude</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
            Verificar comprobante
          </h2>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-paper-deep text-ink-soft">
          <ScanLine className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        Pega el ID de la transacción. Si no existe en tu cuenta de pey, no es un pago
        verificable.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onVerify();
          }}
          placeholder="Ej. 01HXYZTXN1234567890RSTUVWX"
          aria-label="ID de la transacción a verificar"
          className="min-h-11 min-w-0 flex-1 rounded-[3px] border-b border-line bg-paper/60 px-3 py-2.5 text-sm text-ink outline-none ring-green/30 placeholder:text-muted/60 focus:border-green/30 focus:ring-2"
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying || !value.trim()}
          className="flex min-h-11 items-center gap-1.5 rounded-[3px] bg-ink px-3.5 py-2.5 text-sm font-bold text-paper transition hover:bg-ink-soft disabled:opacity-50"
        >
          {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Verificar
        </button>
      </div>

      <button
        type="button"
        onClick={onFake}
        className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-terracotta-deep underline decoration-terracotta/30 underline-offset-4 transition hover:decoration-terracotta"
      >
        Probar con un comprobante falso
      </button>

      {result ? (
        <div
          className={cn(
            "mt-3 rounded-2xl border p-3",
            result.verified
              ? "border-green/25 bg-green-soft/70"
              : "border-terracotta/25 bg-terracotta-soft/60",
          )}
        >
          <div className="flex items-center gap-2">
            {result.verified ? (
              <ShieldCheck className="h-4 w-4 text-green" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-terracotta-deep" />
            )}
            <p className="text-sm font-bold text-ink">
              {result.verified ? "Comprobante verificado" : "No verificado"}
            </p>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {result.verified
              ? `${formatMxn(result.amountCents ?? 0)} · ${result.method ?? "pago"} · pedido ${result.orderId ? shortOrder(result.orderId) : "—"}`
              : result.message ?? "Ese comprobante no corresponde a un pago confirmado."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Overlay                                   */
/* -------------------------------------------------------------------------- */

function PaidOverlay({
  order,
  demoMode,
  onClose,
}: {
  order: Order | null;
  demoMode: boolean;
  onClose: () => void;
}) {
  if (!order) return null;
  const isCredit = order.status === "fulfilled" && order.creditCents > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
      <div className="pop receipt-edge relative w-full max-w-sm rounded-[4px] bg-card shadow-lift">
        <div className="relative px-6 pb-6 pt-8 text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-[3px] text-muted transition hover:bg-paper/60 hover:text-ink"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-muted">Mercado Cero · caja</p>
          <div
            className="stamp stamp-in mx-auto mt-5 px-5 py-2 text-2xl"
            style={{
              color: isCredit
                ? "var(--color-terracotta-deep)"
                : demoMode
                  ? "var(--color-terracotta-deep)"
                  : "var(--color-green-deep)",
            }}
          >
            {isCredit ? "Fiado" : demoMode ? "Demo" : "Pagado"}
          </div>
          <p className="mt-4 text-sm font-semibold text-muted">
            {isCredit ? "Venta a fiado" : demoMode ? "Pago simulado · demo" : "Pago verificado"}
          </p>
          <h2 className="mt-1 font-display text-3xl tracking-tight text-ink">
            {isCredit ? "Quedó anotado" : "¡Ya llegó!"}
          </h2>
          <p className="tabular mt-3 font-display text-[2.7rem] leading-none tracking-tight text-ink">
            {formatMxn(order.totalCents)}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Pedido {shortOrder(order.id)} ·{" "}
            {isCredit
              ? `fiado con ${order.customerName ?? "el cliente"}`
              : demoMode
                ? "simulado en modo demo"
                : "confirmado por pey"}
          </p>
        </div>
        <div className="p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full rounded-[3px] bg-green px-4 py-3 text-sm font-bold text-paper transition hover:bg-green-deep"
          >
            {isCredit ? "Entendido" : "Listo para entregar"}
          </button>
          <p className="mt-2 text-center text-sm text-muted">
            {isCredit
              ? "El saldo aparece en la libreta de fiado. No es dinero recibido."
              : demoMode
                ? "En producción, este estado solo se actualiza con el webhook firmado de pey."
                : "El estado se actualizó con un webhook firmado, no con una captura."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Toast                                    */
/* -------------------------------------------------------------------------- */

function Toast({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  if (!toast) return null;
  const tone = {
    ok: { icon: CheckCircle2, className: "border-green/25 bg-green-soft text-green-deep" },
    error: { icon: CircleAlert, className: "border-terracotta/25 bg-terracotta-soft text-terracotta-deep" },
    info: { icon: Sparkles, className: "border-terracotta/30 bg-terracotta-soft text-ink-soft" },
  }[toast.tone];
  const Icon = tone.icon;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6">
      <div
        role="status"
        className={cn(
          "pointer-events-auto flex max-w-md items-start gap-2.5 rounded-[3px] border px-4 py-3 shadow-lift",
          tone.className,
        )}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold leading-relaxed">{toast.text}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full opacity-60 transition hover:opacity-100"
          aria-label="Cerrar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   QR                                       */
/* -------------------------------------------------------------------------- */

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
    draft: "bg-paper-deep text-muted",
    confirmed: "bg-paper-deep text-ink-soft",
    payment_pending: "bg-terracotta-soft text-terracotta-deep",
    partially_paid: "bg-terracotta-soft text-terracotta-deep",
    paid: "bg-green-soft text-green",
    fulfilled: "bg-green-soft text-green",
    cancelled: "bg-paper-deep text-muted",
  };
  return (
    <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.1em]", styles[status])}>
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(status: Order["status"]): string {
  const labels: Record<Order["status"], string> = {
    draft: "Borrador",
    confirmed: "Por cobrar",
    payment_pending: "Esperando pago",
    partially_paid: "Pago parcial",
    paid: "Pagado",
    fulfilled: "Entregado",
    cancelled: "Cancelado",
  };
  return labels[status];
}
