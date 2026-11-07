"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, QrCode, ScanLine, Share2 } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { formatMxn } from "@/lib/format";
import { saleMoney } from "@/lib/sale-truth";
import type { Order } from "@/lib/types";

const TERMINAL = new Set(["paid", "demo_paid", "fulfilled", "cancelled"]);

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
  const [busy, setBusy] = useState<"link" | "qr" | "refresh" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const actionLockRef = useRef(false);
  const orderRef = useRef(order);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const money = saleMoney(order, creditBalanceCents);
  const dueCents = money.dueCents;
  const pending = !TERMINAL.has(order.status);

  useEffect(() => {
    if (!pending) return;
    let active = true;
    const timer = window.setInterval(async () => {
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
          onOrder(data.order, data.credit?.balanceCents ?? null);
        }
      } catch {
        // El polling no debe tapar la operación; el botón de actualizar es explícito.
      }
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [onOrder, order.id, pending]);

  async function generate(mode: "link" | "qr") {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(mode);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error ?? "No se pudo generar el cobro.");
      onOrder(data.order);
    } catch (caught) {
      setError(friendlyPaymentError(caught, "No se pudo generar el cobro."));
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
    try {
      const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
      const data = (await response.json()) as {
        order?: Order;
        credit?: { balanceCents: number } | null;
        error?: string;
      };
      if (!response.ok || !data.order) throw new Error(data.error ?? "No se pudo leer el pedido.");
      onOrder(data.order, data.credit?.balanceCents ?? null);
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
      onOrder(data.order);
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

  return (
    <section className="mc-caja-card mc-caja-payment" aria-labelledby="mc-caja-payment-title">
      <div className="mc-qr-tabs" aria-label="Opciones QR"><span><QrCode aria-hidden="true" />Pago QR</span><button type="button" onClick={() => setScanNotice(!scanNotice)} aria-expanded={scanNotice}><ScanLine aria-hidden="true" />Escanear</button></div>
      {scanNotice ? <p role="status">Escanea este QR con la c?mara o la app de pago del cliente. Esta caja no valida capturas ni tiene lector de c?mara integrado.</p> : null}
      <div className="mc-caja-card__head">
        <div>
          <p className="mc-caja-eyebrow">Cobro digital</p>
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

      {order.qrImage ? (
        <figure className="mc-caja-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={order.qrImage} alt={`QR de cobro del pedido ${order.id.slice(-4).toUpperCase()}`} />
          <figcaption>QR de cobro. Escanéalo con la app del banco.</figcaption>
        </figure>
      ) : null}

      {order.paymentUrl ? <button type="button" className="mc-caja-button mc-caja-button--secondary mc-qr-share" onClick={() => void copyLink()}><Share2 aria-hidden="true" />{copied ? "Compartir QR ? link copiado" : "Compartir QR"}</button> : null}
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
        {!order.qrImage ? (
          <button
            type="button"
            className="mc-caja-button mc-caja-button--secondary"
            onClick={() => void generate("qr")}
            disabled={busy !== null}
          >
            {busy === "qr" ? <span className="mc-caja-spinner" aria-hidden="true" /> : null}
            Generar QR
          </button>
        ) : null}
        <button
          type="button"
          className="mc-caja-button mc-caja-button--secondary"
          onClick={() => void refresh()}
          disabled={busy !== null}
        >
          {busy === "refresh" ? <span className="mc-caja-spinner" aria-hidden="true" /> : null}
          Confirmar pago ? consultar estado
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
