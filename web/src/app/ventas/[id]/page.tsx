import { withPilotPage } from "../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  Undo2,
  User,
  Wallet,
} from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { getCredit, getOrder } from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatMxn, shortOrder } from "@/lib/format";
import { isDemoSale, saleMoney } from "@/lib/sale-truth";
import {
  saleMethodLabel,
  saleStampTone,
  saleStatusLabel,
} from "@/lib/sale-display";
import iconRecibo from "@/assets/brand/iconos/transparent/recibo.png";
import iconTienda from "@/assets/brand/iconos/transparent/tienda.png";
import iconCamion from "@/assets/brand/iconos/transparent/camion.png";
import registerArt from "@/assets/inicio/hero-registradora.png";
import { TicketButton } from "./ticket-button";
import "../ventas.css";
import "./detalle-venta.css";

export const metadata: Metadata = {
  title: "Detalle de venta · Trangui",
  description: "Consulta el ticket, los productos y el estado real de una venta.",
};

// El detalle es dato vivo: se renderiza por petición para que un id
// inexistente devuelva 404 y no un snapshot de build.
export const instant = false;

const ITEM_MEDALLIONS = [iconRecibo, iconTienda, iconCamion];
const ITEM_TONES = ["green", "saffron", "terracotta"];

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  hour: "numeric",
  minute: "2-digit",
});

function dateParts(iso: string): { date: string; time: string } {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return { date: "Sin fecha", time: "" };
  return { date: dateFormat.format(value), time: timeFormat.format(value) };
}

function paymentTruth(
  order: Parameters<typeof saleMoney>[0],
  money: ReturnType<typeof saleMoney>,
  demoOrder: boolean,
): string {
  if (demoOrder) {
    return "Cobro simulado: estos importes no son dinero real.";
  }
  if (money.openCredit) {
    return `Queda fiado ${formatMxn(money.creditBalanceCents)}; una deuda no es dinero cobrado.`;
  }
  if (money.dueCents > 0) {
    return `Falta cobrar ${formatMxn(money.dueCents)}. Un cobro pendiente no es dinero recibido.`;
  }
  if (money.hasCash && money.hasDigital) {
    return `Cobrado ${formatMxn(money.paidCents)}: efectivo ${formatMxn(money.cashPaidCents)} + digital ${formatMxn(money.digitalPaidCents)}.`;
  }
  if (money.hasDigital) {
    return "Cobro digital confirmado por el proveedor; no se toma de una captura.";
  }
  if (money.hasCash) {
    return `Cobrado ${formatMxn(money.cashPaidCents)} en efectivo registrado en Caja.`;
  }
  if (order.status === "cancelled") {
    return "Venta cancelada: no representa dinero cobrado.";
  }
  return "Sin cobro confirmado para esta venta.";
}

async function DetalleVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const order = getOrder(id);

  if (!order) notFound();

  const demo = isDemoMode();
  const demoOrder = isDemoSale(order, demo);
  const credit = order.creditId ? getCredit(order.creditId) : null;
  const creditKnown = credit !== null;
  const creditBalanceCents = credit?.balanceCents ?? order.creditCents;
  const money = saleMoney(order, creditBalanceCents);
  const status = saleStatusLabel(order, creditBalanceCents, creditKnown, demoOrder);
  const stamp = saleStampTone(order, creditBalanceCents, demoOrder);
  const method = saleMethodLabel(order);
  const customer = order.customerName?.trim() || "Público general";
  const folio = `V-${shortOrder(order.id)}`;
  const created = dateParts(order.createdAt);
  const merchant = MERCHANT;
  const initial = (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";

  return (
    <OperationalPage
      activeHref="/ventas"
      title="Detalle de venta"
      titleId="mc-dv-title"
      eyebrow="Ventas"
      actions={
        <div className="mc-dv-actions">
          <Link href="/ventas" className="mc-dv-back">
            <ArrowLeft aria-hidden="true" />
            <span className="mc-dv-back__label">Ventas</span>
          </Link>
          <TicketButton />
        </div>
      }
      merchant={merchant.name}
      address={merchant.address}
      demo={demo}
      initial={initial}
      mainId="venta-detalle-main"
      contentClassName="mc-dv-page"
      focusTargetId="mc-dv-title"
    >
      <section className="mc-dv-hero" aria-labelledby="mc-dv-folio">
        <div className="mc-dv-hero__art">
          <Image
            src={registerArt}
            alt=""
            aria-hidden="true"
            sizes="(max-width: 479px) 88px, (max-width: 767px) 112px, 190px"
          />
        </div>

        <div className="mc-dv-hero__body">
          <p className="mc-dv-hero__folio" id="mc-dv-folio">
            Venta #{folio}
          </p>
          <CurrencyAmount
            as="p"
            cents={order.totalCents}
            className="mc-dv-hero__total"
          />
          <span className={`mc-dv-status mc-dv-status--${stamp}`}>
            {status}
          </span>
        </div>

        <div className="mc-dv-hero__when">
          <CalendarDays aria-hidden="true" />
          <p className="mc-dv-hero__date">{created.date}</p>
          {created.time ? (
            <p className="mc-dv-hero__time">{created.time}</p>
          ) : null}
        </div>
      </section>

      {demoOrder ? (
        <p className="mc-dv-demo" role="note">
          Venta demo: los importes son de práctica y no representan dinero real.
        </p>
      ) : null}

      <section className="mc-dv-card" aria-labelledby="mc-dv-products">
        <h2 id="mc-dv-products" className="mc-dv-card__title">
          Productos ({order.items.length})
        </h2>
        {order.items.length === 0 ? (
          <p className="mc-dv-card__empty">
            Esta venta no tiene conceptos guardados.
          </p>
        ) : (
          <ul className="mc-dv-items">
            {order.items.map((item, index) => {
              const slot = index % ITEM_MEDALLIONS.length;
              return (
                <li key={item.id} className="mc-dv-item">
                  <span
                    className={`mc-dv-item__badge mc-dv-item__badge--${ITEM_TONES[slot]}`}
                    aria-hidden="true"
                  >
                    <Image src={ITEM_MEDALLIONS[slot]} alt="" sizes="28px" />
                  </span>
                  <div className="mc-dv-item__main">
                    <p className="mc-dv-item__name">{item.description}</p>
                    <p className="mc-dv-item__unit">
                      {item.quantity} × {formatMxn(item.unitPriceCents)}
                    </p>
                  </div>
                  <CurrencyAmount
                    cents={item.totalCents}
                    className="mc-dv-item__total"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mc-dv-total">
        <span>Total de la venta</span>
        <CurrencyAmount as="p" cents={order.totalCents} className="mc-dv-total__value" />
      </div>

      <section className="mc-dv-meta" aria-label="Datos del cobro">
        <div className="mc-dv-meta__cell">
          <Wallet aria-hidden="true" />
          <div>
            <p className="mc-dv-meta__label">Método de pago</p>
            <p className="mc-dv-meta__value">{method}</p>
          </div>
        </div>
        <div className="mc-dv-meta__cell">
          <User aria-hidden="true" />
          <div>
            <p className="mc-dv-meta__label">Cliente</p>
            <p className="mc-dv-meta__value">{customer}</p>
          </div>
        </div>
        <div className="mc-dv-meta__cell">
          <ClipboardCheck aria-hidden="true" />
          <div>
            <p className="mc-dv-meta__label">Estado</p>
            <p className="mc-dv-meta__value">{status}</p>
          </div>
        </div>
      </section>

      <p className="mc-dv-truth">{paymentTruth(order, money, demoOrder)}</p>

      <section className="mc-dv-notes" aria-labelledby="mc-dv-notes-title">
        <MessageSquare aria-hidden="true" />
        <div>
          <h2 id="mc-dv-notes-title" className="mc-dv-notes__title">
            Notas
          </h2>
          <p className="mc-dv-notes__body">Sin notas</p>
          <p className="mc-dv-notes__hint">
            Por ahora no puedes guardar notas en un pedido.
          </p>
        </div>
      </section>

      <section className="mc-dv-refund" aria-labelledby="mc-dv-refund-title">
        <h2 id="mc-dv-refund-title" className="mc-dv-refund__title">
          Devolución
        </h2>
        <button
          type="button"
          className="mc-dv-refund__button"
          disabled
          aria-describedby="mc-dv-refund-note"
        >
          <Undo2 aria-hidden="true" />
          Devolver venta
        </button>
        <p id="mc-dv-refund-note" className="mc-dv-refund__note">
          Por ahora no puedes devolver una venta ni revertir un cobro desde
          esta app. Si necesitas corregirla, hazlo fuera del sistema. Aquí
          no se registra ni se simula una devolución.
        </p>
      </section>

      <p className="mc-dv-foot">
        Esta pantalla lee la venta guardada en la base. No cambia el estado ni
        el dinero: solo muestra lo que ya está registrado.
      </p>
    </OperationalPage>
  );
}

export default withPilotPage(DetalleVentaPage);
