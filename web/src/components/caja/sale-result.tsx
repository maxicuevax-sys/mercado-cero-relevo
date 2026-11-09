"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Share2, House } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { readBrowserPreferences } from "@/lib/browser-preferences";
import { formatMxn } from "@/lib/format";
import { isDemoSale, saleMoney } from "@/lib/sale-truth";
import type { Order } from "@/lib/types";

export function SaleResult({
  order,
  changeCents,
  cashReceivedCents,
  cashReceiptUnavailable = false,
  creditBalanceCents,
  demo,
  onNewSale,
}: {
  order: Order;
  changeCents: number;
  cashReceivedCents: number;
  cashReceiptUnavailable?: boolean;
  creditBalanceCents: number;
  demo: boolean;
  onNewSale: () => void;
}) {
  const [shareNotice, setShareNotice] = useState("");
  const spokenRef = useRef<string | null>(null);
  const money = saleMoney(order, creditBalanceCents);
  const {
    paidCents,
    cashPaidCents,
    digitalPaidCents,
    creditCents,
    creditBalanceCents: balanceCents,
    dueCents,
    hasCash,
    hasDigital,
    hasReceived,
    openCredit,
    creditSettled,
  } = money;
  const isDemo = isDemoSale(order, demo);

  useEffect(() => {
    if (spokenRef.current === order.id) return;
    if (order.status !== "paid" && order.status !== "demo_paid") return;
    if (!hasDigital) return;

    spokenRef.current = order.id;

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const preferences = readBrowserPreferences();
      if (preferences.muted) return;
      const text = isDemo
        ? `Simulación demo de pago digital por ${formatMxn(digitalPaidCents)}. Sin dinero real.`
        : `Pago confirmado por Pey: ${formatMxn(digitalPaidCents)}${
            order.numRef ? `, referencia ${order.numRef.split("").join(" ")}` : ""
          }.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-MX";
      utterance.rate = preferences.voiceRate === "slow" ? 0.85 : preferences.voiceRate === "fast" ? 1.15 : 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Graceful fallback
    }
  }, [order.id, order.status, order.numRef, hasDigital, isDemo, digitalPaidCents]);
  const isDigitalDemo = isDemo && hasDigital;
  const isCashDemo = isDemo && hasCash && !hasDigital && !openCredit;
  const isMixedCreditDemo = isDemo && hasCash && openCredit;
  const isCreditOnly = openCredit && paidCents === 0;
  const isCreditOnlyDemo = isDemo && isCreditOnly;

  const title = isDigitalDemo
    ? "Pago demo"
    : isMixedCreditDemo
      ? "Venta demo registrada con saldo fiado"
      : isCashDemo
        ? "Venta cobrada en efectivo (demo)"
        : isCreditOnlyDemo
          ? "Venta demo registrada con fiado"
        : openCredit && !isCreditOnly
        ? "Venta registrada con saldo fiado"
        : isCreditOnly
          ? "Venta registrada con fiado"
          : order.status === "paid"
            ? hasCash && hasDigital
              ? "Pago mixto registrado"
              : hasCash
                ? "Venta cobrada en efectivo"
                : "Pago confirmado por pey"
            : order.status === "confirmed"
              ? "Venta registrada"
              : "Operación registrada";

  const note = isDigitalDemo
    ? "Esta simulación no es dinero real ni una confirmación del banco."
    : isCashDemo
      ? "Efectivo de demostración. No es dinero real ni una confirmación bancaria."
      : openCredit
        ? isDemo && !hasReceived
          ? `No recibiste dinero. El importe de ${formatMxn(balanceCents)} quedó como deuda en Fiado. Es una práctica demo: no se movió dinero real.`
        : hasCash && hasDigital
          ? `Recibiste ${formatMxn(cashPaidCents)} en efectivo y ${formatMxn(digitalPaidCents)} digital confirmado. El saldo de ${formatMxn(balanceCents)} quedó como deuda en Fiado.`
          : hasCash
            ? `Recibiste ${formatMxn(cashPaidCents)} en efectivo. El saldo de ${formatMxn(balanceCents)} quedó como deuda en Fiado.`
            : hasDigital
              ? `Recibiste ${formatMxn(digitalPaidCents)} digital confirmado. El saldo de ${formatMxn(balanceCents)} quedó como deuda en Fiado.`
              : `No recibiste dinero. El importe de ${formatMxn(balanceCents)} quedó como deuda en Fiado.`
        : creditSettled
          ? "El fiado quedó saldado. Revisa el total cobrado antes de entregar."
          : order.status === "paid"
            ? hasCash && !hasDigital
              ? "El efectivo se registró en la caja. No pasó por pey ni es una confirmación bancaria."
              : hasCash && hasDigital
                ? "Se registraron efectivo y pago digital. Solo la parte digital pasó por el proveedor."
                : "El pago fue confirmado por el proveedor. No lo confirmó una captura ni un botón."
            : dueCents > 0
              ? `La venta quedó registrada. Todavía falta cobrar ${formatMxn(dueCents)}; no lo cuentes como recibido.`
              : "La venta quedó registrada. Revisa el estado antes de entregar.";

  return (
    <section className="mc-caja-card mc-caja-result" aria-labelledby="mc-caja-result-title">
      <p className="mc-caja-eyebrow">Resultado</p>
      <h2 id="mc-caja-result-title" tabIndex={-1}>
        {title}
      </h2>
      {hasDigital ? <div className={`mc-payment-confirmed${isDemo ? " mc-payment-confirmed--demo" : ""}`}>
        <Image src="/assets/spec/b-confirmed.png" alt="" width={123} height={150} loading="eager" />
        <div><BadgeCheck aria-hidden="true" /><CurrencyAmount cents={digitalPaidCents} /><p>{isDemo ? "Pago digital simulado" : "Pago digital recibido"}</p><strong>{isDemo ? "DEMO · sin dinero real" : "Cobrado"}</strong></div>
      </div> : null}
      {!hasDigital ? <><p className="mc-caja-result__label">Total de la venta</p>
      <CurrencyAmount as="p" cents={order.totalCents} className="mc-caja-result__total" /></> : null}
      <p className="mc-caja-result__note">{note}</p>

      <h3 className="mc-receipt-title">Comprobante de pago{isDemo ? " · DEMO" : ""}</h3>
      <dl className="mc-caja-result__facts">
        <div><dt>Total</dt><dd><CurrencyAmount cents={order.totalCents} /></dd></div>
        <div><dt>Método</dt><dd>{hasDigital ? hasCash ? "Mixto / digital" : "Digital / QR" : hasCash ? "Efectivo" : "Fiado"}</dd></div>
        <div><dt>Hora</dt><dd>{new Date(order.updatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</dd></div>
        <div>
          <dt>Pedido</dt>
          <dd>{order.id.slice(-4).toUpperCase()}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{statusLabel(order.status)}</dd>
        </div>
        <div>
          <dt>Cobrado</dt>
          <dd>
            <CurrencyAmount cents={paidCents} />
          </dd>
        </div>
        {hasCash || (!hasReceived && (openCredit || dueCents > 0)) ? (
          <div>
            <dt>Cobrado en efectivo</dt>
            <dd>
              <CurrencyAmount cents={cashPaidCents} />
            </dd>
          </div>
        ) : null}
        {cashReceivedCents > cashPaidCents ? (
          <div>
            <dt>Recibiste</dt>
            <dd>
              <CurrencyAmount cents={cashReceivedCents} />
            </dd>
          </div>
        ) : null}
        {hasDigital ? (
          <div>
            <dt>{isDemo ? "Digital simulado" : "Digital confirmado"}</dt>
            <dd>
              <CurrencyAmount cents={digitalPaidCents} />
            </dd>
          </div>
        ) : null}
        {creditCents > 0 ? (
          <div>
            <dt>{openCredit ? "Saldo vivo fiado" : "Fiado saldado"}</dt>
            <dd>
              <CurrencyAmount cents={openCredit ? balanceCents : creditCents} />
              {order.customerName ? ` · ${order.customerName}` : ""}
              {openCredit && balanceCents < creditCents ? (
                <span className="mc-caja-result__original">
                  {" "}Original <CurrencyAmount cents={creditCents} />
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {dueCents > 0 ? (
          <div>
            <dt>Pendiente de cobro</dt>
            <dd>
              <CurrencyAmount cents={dueCents} />
            </dd>
          </div>
        ) : null}
        {changeCents > 0 ? (
          <div>
            <dt>Cambio</dt>
            <dd>
              <CurrencyAmount cents={changeCents} />
            </dd>
          </div>
        ) : null}
      </dl>
      {cashReceiptUnavailable ? <p role="status">Efectivo recibido y cambio no disponibles para esta recuperación.</p> : null}

      {openCredit ? (
        <p className="mc-caja-result__banner">
          {isDemo
            ? hasReceived
              ? "Quedó anotado en Fiado. Solo el fiado es deuda; el pago demo no es dinero real y el saldo restante es deuda."
              : "Quedó anotado en Fiado. Solo el fiado es deuda. Estás en modo demo: no se movió dinero real; el saldo es una deuda de práctica."
            : hasReceived
              ? "Quedó anotado en Fiado. Solo el fiado es deuda; el dinero recibido sí se registró y el saldo restante es deuda."
              : "Quedó anotado en Fiado. Solo el fiado es deuda; no recibiste dinero."}
        </p>
      ) : null}
      {order.status === "paid" && !hasCash && hasDigital ? (
        <p className="mc-caja-result__banner">
          Confirmación del proveedor, no de una captura.
        </p>
      ) : null}
      {dueCents > 0 && !openCredit ? (
        <p className="mc-caja-result__banner">
          El cobro pendiente no es dinero recibido. No entregues como pagado hasta la confirmación.
        </p>
      ) : null}

      <button type="button" className="mc-caja-button mc-caja-button--secondary mc-receipt-share" onClick={async () => {
        const text = `${isDemo ? "DEMO SIMULADO - SIN DINERO REAL" : title}\nPedido ${order.id}\nTotal ${formatMxn(order.totalCents)}\nEstado ${statusLabel(order.status)}\n${note}`;
        try { if (navigator.share) await navigator.share({ title: "Comprobante Trangui", text }); else await navigator.clipboard.writeText(text); setShareNotice("Comprobante compartido o copiado."); } catch { setShareNotice("No se compartió. Puedes copiar los datos del comprobante en pantalla."); }
      }}><Share2 aria-hidden="true" />Compartir comprobante</button>
      <p role="status">{shareNotice}</p>
      <Link href="/inicio" className="mc-caja-button mc-caja-button--primary"><House aria-hidden="true" />Volver al inicio</Link>
      <div className="mc-caja-result__actions">
        <button type="button" className="mc-caja-button mc-caja-button--primary" onClick={onNewSale}>
          Nueva venta
        </button>
        <Link href="/ventas" className="mc-caja-button mc-caja-button--secondary">
          Ver ventas
        </Link>
        <Link href="/caja" className="mc-caja-button mc-caja-button--quiet">
          Volver a Caja
        </Link>
      </div>
      <p className="mc-caja-result__footnote">
        Total registrado {formatMxn(order.totalCents)}. Si el estado no es pagado, no entregues
        como cobrado.
      </p>
    </section>
  );
}

function statusLabel(status: Order["status"]): string {
  switch (status) {
    case "paid":
      return "Pagado";
    case "demo_paid":
      return "Cobro demo";
    case "payment_pending":
      return "Pendiente";
    case "partially_paid":
      return "Parcial";
    case "fulfilled":
      return "Entregado";
    case "cancelled":
      return "Cancelado";
    case "confirmed":
      return "Registrado";
    default:
      return status;
  }
}
