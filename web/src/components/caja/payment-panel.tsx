"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Check, Copy, QrCode, ScanLine, Share2 } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { formatMxn } from "@/lib/format";
import { saleMoney } from "@/lib/sale-truth";
import type { Order } from "@/lib/types";
import { TianguisQr } from "@/components/ui/tianguis-qr";

const TERMINAL = new Set(["paid", "demo_paid", "fulfilled", "cancelled"]);

function useQrRemainingSeconds(expiresAt: string | null | undefined): number | null {
  return useSyncExternalStore(
    (callback) => {
      if (!expiresAt) return () => {};
      const targetMs = Date.parse(expiresAt);
      if (Number.isNaN(targetMs) || targetMs <= Date.now()) return () => {};
      const interval = window.setInterval(callback, 1000);
      const timeout = window.setTimeout(callback, Math.max(0, targetMs - Date.now()) + 50);
      return () => {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      };
    },
    () => {
      if (!expiresAt) return null;
      const targetMs = Date.parse(expiresAt);
      if (Number.isNaN(targetMs)) return null;
      return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
    },
    () => null,
  );
}

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function mergeOrder(current: Order, next: Order): Order {
  if (current.id !== next.id) return next;
  if (TERMINAL.has(current.status) && !TERMINAL.has(next.status)) {
    return current;
  }
  return {
    ...next,
    paymentUrl: next.paymentUrl ?? current.paymentUrl,
    paymentLinkId: next.paymentLinkId ?? current.paymentLinkId,
    qrImage: next.qrImage ?? current.qrImage,
    qrString: next.qrString ?? current.qrString,
    qrExpiresAt: next.qrExpiresAt ?? current.qrExpiresAt,
    numRef: next.numRef ?? current.numRef,
    codiPhoneMasked: next.codiPhoneMasked ?? current.codiPhoneMasked,
  };
}

export function PaymentPanel({
  order,
  demo,
  creditBalanceCents,
  onOrder,
  onNewSale,
}: {
  order: Order;
  demo: boolean;
  creditBalanceCents?: number | null;
  onOrder: (order: Order, creditBalanceCents?: number | null) => void;
  onNewSale: () => void;
}) {
  const [busy, setBusy] = useState<"link" | "qr" | "codi_push" | "refresh" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codiPhone, setCodiPhone] = useState("");
  const [qrViewMode, setQrViewMode] = useState<"codi" | "link">("codi");
  const [linkQrDataUrl, setLinkQrDataUrl] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ orderId: string; text: string } | null>(null);
  const activeSyncNotice = syncNotice?.orderId === order.id ? syncNotice.text : null;
  const remainingSeconds = useQrRemainingSeconds(order.qrExpiresAt);
  const qrExpired = remainingSeconds !== null && remainingSeconds <= 0;
  const actionLockRef = useRef(false);
  const qrPromiseRef = useRef<Promise<void> | null>(null);
  const autoQrOrderIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const orderRef = useRef(order);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const money = saleMoney(order, creditBalanceCents);
  const dueCents = money.dueCents;
  const pending = !TERMINAL.has(order.status);

  function applyOrderUpdate(nextOrder: Order, nextCredit?: number | null) {
    if (!mountedRef.current) return;
    const merged = mergeOrder(orderRef.current, nextOrder);
    orderRef.current = merged;
    onOrder(merged, nextCredit);
  }

  useEffect(() => {
    let active = true;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fallbackUrl = origin
      ? `${origin}/pay/${order.id}${demo ? "?demo=1" : ""}`
      : `/pay/${order.id}${demo ? "?demo=1" : ""}`;
    const targetUrl = order.paymentUrl || fallbackUrl;
    void QRCode.toDataURL(targetUrl, {
      width: 640,
      margin: 1,
      color: { dark: "#143D2F", light: "#FFFFFF" },
    })
      .then((url) => {
        if (active) setLinkQrDataUrl(url);
      })
      .catch(() => {
        if (active) setLinkQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [demo, order.id, order.paymentUrl]);

  useEffect(() => {
    if (!pending || dueCents <= 0 || order.qrImage || order.qrString) return;
    if (autoQrOrderIdRef.current === order.id) return;
    autoQrOrderIdRef.current = order.id;
    void generate("qr", false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueCents, order.id, order.qrImage, order.qrString, pending]);

  useEffect(() => {
    if (!pending) return;
    let active = true;

    async function pollOrder() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          order?: Order;
          credit?: { balanceCents: number } | null;
        };
        if (
          active &&
          data.order &&
          data.order.updatedAt >= orderRef.current.updatedAt
        ) {
          applyOrderUpdate(data.order, data.credit?.balanceCents ?? null);
        }
      } catch {
        // El polling no debe tapar la operación; el botón de actualizar es explícito.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void pollOrder();
      }
    }

    const timer = window.setInterval(() => {
      void pollOrder();
    }, 5000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOrder, order.id, pending]);

  async function generate(mode: "link" | "qr", forceRefresh = false, isAuto = false) {
    if (mode === "qr" && !forceRefresh && qrPromiseRef.current) {
      await qrPromiseRef.current;
      return;
    }
    if (!isAuto && actionLockRef.current) return;
    if (!isAuto) {
      actionLockRef.current = true;
      setBusy(mode);
      setError(null);
    }

    const task = (async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, forceRefresh }),
        });
        const data = (await response.json()) as { order?: Order; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error ?? "No se pudo generar el cobro.");
        applyOrderUpdate(data.order);
      } catch (caught) {
        if (!isAuto && mountedRef.current) {
          setError(friendlyPaymentError(caught, "No se pudo generar el cobro."));
        }
      } finally {
        if (!isAuto) {
          actionLockRef.current = false;
          if (mountedRef.current) setBusy(null);
        }
      }
    })();

    if (mode === "qr") {
      qrPromiseRef.current = task;
      try {
        await task;
      } finally {
        if (qrPromiseRef.current === task) {
          qrPromiseRef.current = null;
        }
      }
    } else {
      await task;
    }
  }

  async function sendCodiPush() {
    if (actionLockRef.current) return;
    if (!/^\d{10}$/.test(codiPhone)) {
      setError("Ingresa un número de celular de 10 dígitos para el cobro CoDi.");
      return;
    }
    actionLockRef.current = true;
    setBusy("codi_push");
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "codi_push", phone: codiPhone }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error ?? "No se pudo enviar el cobro CoDi.");
      applyOrderUpdate(data.order);
    } catch (caught) {
      setError(friendlyPaymentError(caught, "No se pudo enviar el cobro CoDi."));
    } finally {
      actionLockRef.current = false;
      setBusy(null);
    }
  }

  async function refresh() {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy("refresh");
    setError(null);
    setSyncNotice(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/sync-pey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as {
        order?: Order;
        credit?: { balanceCents: number } | null;
        error?: string;
        reason?: string;
      };
      let updatedOrder: Order | undefined;
      if (response.ok && data.order) {
        updatedOrder = mergeOrder(orderRef.current, data.order);
        applyOrderUpdate(updatedOrder, data.credit?.balanceCents ?? null);
      } else {
        const fallbackRes = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        const fallbackData = (await fallbackRes.json()) as {
          order?: Order;
          credit?: { balanceCents: number } | null;
          error?: string;
        };
        if (!fallbackRes.ok || !fallbackData.order) throw new Error(fallbackData.error ?? "No se pudo leer el pedido.");
        updatedOrder = mergeOrder(orderRef.current, fallbackData.order);
        applyOrderUpdate(updatedOrder, fallbackData.credit?.balanceCents ?? null);
      }
      if (mountedRef.current && updatedOrder) {
        if (updatedOrder.status === "paid" || updatedOrder.status === "fulfilled") {
          setSyncNotice({ orderId: order.id, text: "Pago confirmado por el proveedor." });
        } else if (updatedOrder.status === "demo_paid") {
          setSyncNotice({ orderId: order.id, text: "Pago de demostración registrado." });
        } else if (data.reason === "awaiting_signed_webhook") {
          setSyncNotice({ orderId: order.id, text: "El proveedor reporta el pago. Esperamos la confirmación para cerrar la venta." });
        } else {
          setSyncNotice({
            orderId: order.id,
            text: "Estado verificado: el cobro sigue pendiente de confirmación bancaria.",
          });
        }
      }
    } catch (caught) {
      setError(friendlyPaymentError(caught, "No se pudo leer el pedido."));
    } finally {
      actionLockRef.current = false;
      setBusy(null);
    }
  }

  async function demoPay(method: "codi" | "card" | "wallet") {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy("demo");
    setError(null);
    try {
      const response = await fetch("/api/demo/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, method }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error ?? "No se pudo simular el pago.");
      applyOrderUpdate(data.order);
    } catch (caught) {
      setError(friendlyPaymentError(caught, "No se pudo simular el pago."));
    } finally {
      actionLockRef.current = false;
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!order.paymentUrl) return;
    try {
      await navigator.clipboard.writeText(order.paymentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No pude copiar el link. Selecciónalo y cópialo a mano.");
    }
  }

  async function shareQr() {
    try {
      if (order.qrImage && navigator.share && navigator.canShare) {
        // Decode generated data URLs locally; connect-src 'self' forbids fetching data:.
        const inline = order.qrImage.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
        let blob: Blob;
        if (inline) {
          const bytes = Uint8Array.from(atob(inline[2]), char => char.charCodeAt(0));
          blob = new Blob([bytes], { type: inline[1] });
        } else {
          const response = await fetch(order.qrImage);
          if (!response.ok) throw new Error("QR no disponible");
          blob = await response.blob();
        }
        const file = new File([blob], `qr-${demo ? "DEMO-" : ""}${order.id}.png`, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: demo ? "DEMO · sin dinero real" : "QR de cobro · pendiente hasta confirmación de pey" });
          return;
        }
      }
      const text = order.qrString || order.paymentUrl;
      if (!text) throw new Error("Genera el QR antes de compartirlo.");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("No se pudo compartir el QR. Puedes mostrarlo en esta pantalla o generar un link de cobro.");
    }
  }

  return (
    <section className={`mc-caja-card mc-caja-payment${!money.hasReceived && !money.openCredit ? " mc-payment-only-digital" : ""}`} aria-labelledby="mc-caja-payment-title">
      <div className="mc-qr-tabs" aria-label="Opciones QR"><span><QrCode aria-hidden="true" />Pago QR</span><button type="button" onClick={() => setScanNotice(!scanNotice)} aria-expanded={scanNotice}><ScanLine aria-hidden="true" />Escanear</button></div>
      {scanNotice ? <p role="status">Escanea este QR con la cámara o la app de pago del cliente. Esta caja no valida capturas ni tiene lector de cámara integrado.</p> : null}
      <div className="mc-caja-card__head">
        <div>
          <p className="mc-caja-eyebrow">{demo ? "Cobro digital · DEMO" : "Cobro digital"}</p>
          <h2 id="mc-caja-payment-title" tabIndex={-1}>
            Pedido {order.id.slice(-4).toUpperCase()}
          </h2>
        </div>
        <span
          className={`mc-caja-status mc-caja-status--${order.status}`}
          role="status"
          aria-live="polite"
        >
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="mc-payment-total"><span>Total</span><CurrencyAmount cents={order.totalCents} /></div>
      {order.numRef ? (
        <div className="mc-caja-numref" role="status">
          <span>Referencia CoDi</span>
          <strong className="mc-caja-numref__digits">#{order.numRef}</strong>
        </div>
      ) : null}
      <div className="mc-caja-payment__amount">
        {money.hasReceived ? (
          <>
            <p className="mc-caja-payment__label">Ya recibiste</p>
            <CurrencyAmount as="p" cents={money.paidCents} className="mc-caja-payment__value" />
            <p className="mc-caja-payment__detail">
              {money.hasCash && money.hasDigital
                ? `Efectivo ${formatMxn(money.cashPaidCents)} + digital confirmado ${formatMxn(money.digitalPaidCents)}.`
                : money.hasCash
                  ? `En efectivo: ${formatMxn(money.cashPaidCents)}.`
                  : `Digital confirmado: ${formatMxn(money.digitalPaidCents)}.`}
            </p>
          </>
        ) : (
          <>
            <p className="mc-caja-payment__label">Falta cobrar</p>
            <CurrencyAmount as="p" cents={dueCents} className="mc-caja-payment__value" />
            <p className="mc-caja-payment__detail">Todavía no se recibe dinero.</p>
          </>
        )}
        {money.hasReceived && dueCents > 0 ? (
          <p className="mc-caja-payment__pending">
            Falta cobrar <CurrencyAmount cents={dueCents} />. El cobro digital sigue pendiente.
          </p>
        ) : null}
        {money.openCredit ? (
          <p className="mc-caja-payment__credit">
            Saldo fiado <CurrencyAmount cents={money.creditBalanceCents} />; es deuda, no dinero
            recibido.
          </p>
        ) : null}
      </div>

      {order.qrImage || (order.paymentUrl && linkQrDataUrl) ? (
        <figure className={`mc-caja-qr${qrExpired ? " mc-caja-qr--expired" : ""}`}>
          <div className="mc-caja-qr__modes" role="group" aria-label="Modo de código QR">
            <button
              type="button"
              className="mc-caja-qr__mode"
              aria-pressed={qrViewMode === "codi"}
              onClick={() => setQrViewMode("codi")}
            >
              QR CoDi
            </button>
            <button
              type="button"
              className="mc-caja-qr__mode"
              aria-pressed={qrViewMode === "link"}
              onClick={() => setQrViewMode("link")}
            >
              QR Cámara (Link)
            </button>
          </div>
          <TianguisQr
            payload={qrViewMode === "codi" && order.qrImage && !demo ? order.qrString : null}
            decodeOriginal={qrViewMode === "link" || demo}
            original={
              qrViewMode === "link"
                ? (linkQrDataUrl ?? order.qrImage ?? "")
                : (order.qrImage ?? linkQrDataUrl ?? "")
            }
            alt={`QR de cobro del pedido ${order.id.slice(-4).toUpperCase()}`}
          />
          <figcaption>
            {qrViewMode === "link"
              ? demo
                ? "QR Cámara (Link) de demostración · sin dinero real."
                : "QR Cámara (Link). Escanéalo con la cámara del cliente para abrir el link de cobro."
              : demo
                ? "QR de demostración · sin dinero real."
                : "QR de cobro. Escanéalo con la app de pago del cliente."}
          </figcaption>
        </figure>
      ) : null}

      {order.qrImage && order.qrExpiresAt ? (
        <div className={`mc-caja-qr-expiry${qrExpired ? " mc-caja-qr-expiry--expired" : ""}`}>
          <p>
            {qrExpired
              ? "El código QR ha expirado. Renueva el QR para continuar."
              : `Vigencia: ${remainingSeconds !== null ? formatCountdown(remainingSeconds) : "--:--"} · hasta las ${new Date(order.qrExpiresAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.`}
          </p>
          <button
            type="button"
            className="mc-caja-button mc-caja-button--secondary mc-caja-renew-qr"
            onClick={() => void generate("qr", true)}
            disabled={busy !== null}
          >
            {busy === "qr" ? <span className="mc-caja-spinner" aria-hidden="true" /> : null}
            Renovar QR
          </button>
        </div>
      ) : null}

      {order.qrImage || order.paymentUrl ? <button type="button" className="mc-caja-button mc-caja-button--secondary mc-qr-share" onClick={() => void shareQr()}><Share2 aria-hidden="true" />{copied ? "Compartir QR · código copiado" : "Compartir QR"}</button> : null}
      {order.paymentUrl ? (
        <div className="mc-caja-link">
          <p>Link de cobro</p>
          <div className="mc-caja-link__row">
            <a href={order.paymentUrl} target="_blank" rel="noreferrer">
              Abrir link
              <span className="sr-only"> (abre en una pestaña nueva)</span>
            </a>
            <button type="button" className="mc-caja-icon-button" onClick={copyLink}>
              {copied ? <Check aria-hidden="true" focusable="false" /> : <Copy aria-hidden="true" focusable="false" />}
              <span className="sr-only">Copiar link</span>
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? "Link copiado" : ""}
              </span>
            </button>
          </div>
          <code>{order.paymentUrl}</code>
        </div>
      ) : null}

      <details className="mc-caja-codi-push">
        <summary>Cobrar a celular CoDi (10 dígitos)</summary>
        <div className="mc-caja-codi-push__form">
          <label htmlFor="codi-phone-input">Celular del cliente (10 dígitos)</label>
          <div className="mc-caja-codi-push__row">
            <input
              id="codi-phone-input"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="5512345678"
              aria-label="Celular para cobro CoDi"
              value={codiPhone}
              onChange={(e) => setCodiPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              disabled={busy !== null}
            />
            <button
              type="button"
              className="mc-caja-button mc-caja-button--secondary"
              onClick={() => void sendCodiPush()}
              disabled={busy !== null || codiPhone.length !== 10}
            >
              {busy === "codi_push" ? <span className="mc-caja-spinner" aria-hidden="true" /> : null}
              Enviar cobro CoDi
            </button>
          </div>
          {order.codiPhoneMasked ? (
            <p className="mc-caja-codi-push__status" role="status">
              Notificación enviada al celular {order.codiPhoneMasked}.
            </p>
          ) : null}
        </div>
      </details>

      <div className="mc-qr-state" role="status">{pending ? "Por cobrar" : statusLabel(order.status)}</div>
      <div className="mc-caja-payment__actions">
        {!order.paymentUrl ? (
          <button
            type="button"
            className="mc-caja-button mc-caja-button--primary"
            onClick={() => void generate("link")}
            disabled={busy !== null}
          >
            {busy === "link" ? <span className="mc-caja-spinner" aria-hidden="true" /> : null}
            Generar link
          </button>
        ) : null}
        <button
          type="button"
          className="mc-caja-button mc-caja-button--secondary"
          onClick={() => {
            setQrViewMode("codi");
            void generate("qr");
          }}
          disabled={busy !== null}
        >
          {busy === "qr" ? <span className="mc-caja-spinner" aria-hidden="true" /> : null}
          Generar QR
        </button>
        <button
          type="button"
          className="mc-caja-button mc-caja-button--primary mc-payment-refresh"
          onClick={() => void refresh()}
          disabled={busy !== null}
        >
          {busy === "refresh" ? <span className="mc-caja-spinner" aria-hidden="true" /> : null}
          Confirmar pago · consultar estado
        </button>
        <button
          type="button"
          className="mc-caja-button mc-caja-button--quiet"
          onClick={onNewSale}
          disabled={busy !== null}
        >
          Nueva venta
        </button>
      </div>

      {activeSyncNotice ? (
        <p className="mc-caja-sync-notice" role="status" aria-live="polite">
          {activeSyncNotice}
        </p>
      ) : null}

      {demo ? (
        <div className="mc-caja-demo-pay">
          <p>
            <strong>Modo demo.</strong> Simula un pago para probar el recorrido. No es dinero real
            ni una confirmación de pey.
          </p>
          <div className="mc-caja-demo-pay__buttons">
            <button type="button" className="mc-caja-button mc-caja-button--secondary" onClick={() => void demoPay("codi")} disabled={busy !== null}>
              Simular CoDi
            </button>
            <button type="button" className="mc-caja-button mc-caja-button--secondary" onClick={() => void demoPay("card")} disabled={busy !== null}>
              Simular tarjeta
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mc-caja-alert" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mc-caja-payment__note">
        {dueCents > 0
          ? `${formatMxn(dueCents)} siguen pendientes. No entregues como pagado hasta ver la confirmación válida del proveedor.`
          : "No queda saldo pendiente en este pedido."}{" "}
        Si inicias otra venta, este cobro sigue registrado y queda en la lista de pendientes.
      </p>
      <Link className="mc-caja-clear" href="/ventas">
        Ver historial de ventas
      </Link>
    </section>
  );
}

function friendlyPaymentError(caught: unknown, fallback: string): string {
  if (caught instanceof Error) {
    if (/failed to fetch|load failed|networkerror|network request failed/i.test(caught.message)) {
      return "No sabemos si la operación se completó. Revisa tu conexión y actualiza el estado antes de reintentar.";
    }
    return caught.message;
  }
  return fallback;
}

function statusLabel(status: Order["status"]): string {
  switch (status) {
    case "paid":
      return "Pagado";
    case "demo_paid":
      return "Demo (simulado)";
    case "payment_pending":
      return "Pendiente";
    case "partially_paid":
      return "Parcial";
    case "fulfilled":
      return "Entregado";
    case "cancelled":
      return "Cancelado";
    default:
      return "Registrado";
  }
}
