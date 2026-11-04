"use client";

import Link from "next/link";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { formatMxn } from "@/lib/format";
import type { Order } from "@/lib/types";

export function SaleResult({
  order,
  changeCents,
  cashReceivedCents,
  creditBalanceCents,
  demo,
  onNewSale,
}: {
  order: Order;
  changeCents: number;
  cashReceivedCents: number;
  creditBalanceCents: number;
  demo: boolean;
  onNewSale: () => void;
}) {
  const cashPaidCents = Math.max(0, order.paidCents - order.digitalPaidCents);
  const hasCash = cashPaidCents > 0;
  const hasDigital = order.digitalPaidCents > 0;
  const isDigitalDemo =
    order.status === "demo_paid" || ((order.lastPaymentDemo || demo) && hasDigital);
  const isCashDemo = (order.lastPaymentDemo || demo) && hasCash && !hasDigital;
  const openCredit = creditBalanceCents > 0;
  const isCreditOnly = openCredit && order.paidCents === 0 && order.digitalPaidCents === 0;
  const title = isDigitalDemo
    ? "Pago demo (simulado)"
    : isCashDemo
      ? "Venta cobrada en efectivo (demo)"
      : openCredit && !isCreditOnly
      ? "Venta registrada con saldo fiado"
      : order.status === "paid"
        ? hasCash && hasDigital
          ? "Pago mixto registrado"
          : hasCash
            ? "Venta cobrada en efectivo"
            : "Pago confirmado por pey"
        : isCreditOnly
          ? "Venta registrada con fiado"
          : order.status === "confirmed"
            ? "Venta registrada"
            : "Operación registrada";
  const note = isDigitalDemo
    ? "Esta simulación no es dinero real ni una confirmación del banco."
    : isCashDemo
      ? "Efectivo de demostración. No es dinero real ni una confirmación bancaria."
      : order.status === "paid"
      ? hasCash && !hasDigital
        ? "El efectivo se registró en la caja. No pasó por pey ni es una confirmación bancaria."
        : hasCash && hasDigital
          ? "Se registraron efectivo y pago digital. Solo la parte digital pasó por el proveedor."
          : "El pago fue confirmado por el proveedor. No lo confirmó una captura ni un botón."
      : openCredit
        ? "La venta quedó registrada. La parte fiada es deuda; no la cuentes como dinero recibido."
        : isCreditOnly
          ? "El importe quedó como deuda en Fiado. No es dinero recibido."
          : "La venta quedó registrada. Revisa el estado antes de entregar.";

  return (
    <section className="mc-caja-card mc-caja-result" aria-labelledby="mc-caja-result-title">
      <p className="mc-caja-eyebrow">Resultado</p>
      <h2 id="mc-caja-result-title" tabIndex={-1}>
        {title}
      </h2>
      <p className="mc-caja-result__label">Total de la venta</p>
      <CurrencyAmount as="p" cents={order.totalCents} className="mc-caja-result__total" />
      <p className="mc-caja-result__note">{note}</p>

      <dl className="mc-caja-result__facts">
        <div>
          <dt>Pedido</dt>
          <dd>{order.id.slice(-4).toUpperCase()}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            {isDigitalDemo || isCashDemo ? "Demo (simulado)" : statusLabel(order.status)}
          </dd>
        </div>
        {cashReceivedCents > cashPaidCents ? (
          <div>
            <dt>Recibiste</dt>
            <dd>
              <CurrencyAmount cents={cashReceivedCents} />
            </dd>
          </div>
        ) : null}
        {cashPaidCents > 0 ? (
          <div>
            <dt>{cashReceivedCents > cashPaidCents ? "Efectivo aplicado" : "Efectivo recibido"}</dt>
            <dd>
              <CurrencyAmount cents={cashPaidCents} />
            </dd>
          </div>
        ) : null}
        {order.creditCents > 0 ? (
          <div>
            <dt>{openCredit ? "Saldo vivo fiado" : "Fiado saldado"}</dt>
            <dd>
              <CurrencyAmount cents={openCredit ? creditBalanceCents : order.creditCents} />
              {order.customerName ? ` · ${order.customerName}` : ""}
              {openCredit && creditBalanceCents < order.creditCents ? (
                <span className="mc-caja-result__original">
                  {" "}Original <CurrencyAmount cents={order.creditCents} />
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {order.digitalPaidCents > 0 ? (
          <div>
            <dt>Digital</dt>
            <dd>
              <CurrencyAmount cents={order.digitalPaidCents} />
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

      {openCredit ? (
        <p className="mc-caja-result__banner">
          Quedó anotado en Fiado. Solo el fiado es deuda; el efectivo sí se registró en la caja.
        </p>
      ) : null}
      {order.status === "paid" && !hasCash ? (
        <p className="mc-caja-result__banner">
          Confirmación del proveedor, no de una captura.
        </p>
      ) : null}

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
      return "Demo (simulado)";
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
