import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CircleDashed,
  Link2,
  QrCode,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { MERCHANT, isDemoMode } from "@/lib/config";
import {
  getCodiMovementDetail,
  movementPaymentBadge,
  paymentMethodLabel,
  paymentProviderLabel,
  paymentStatusLabel,
} from "@/lib/codi-movements";
import { formatActivityDate, formatMxn, shortOrder } from "@/lib/format";
import type { MovementPayment } from "@/lib/codi-movements";
import qrArt from "@/assets/brand/ilustraciones/transparent/qr.png";
import iconRecibo from "@/assets/brand/iconos/transparent/recibo.png";
import iconTienda from "@/assets/brand/iconos/transparent/tienda.png";
import iconCamion from "@/assets/brand/iconos/transparent/camion.png";
import "./detalle-movimiento.css";

export const metadata: Metadata = {
  title: "Detalle del movimiento · Mercado Cero",
  description:
    "Consulta la solicitud, el QR y los pagos registrados de un movimiento CoDi.",
};

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

function shortTransaction(transactionId: string): string {
  return transactionId.length > 16
    ? `…${transactionId.slice(-12)}`
    : transactionId;
}

function PaymentRow({ payment }: { payment: MovementPayment }) {
  const badge =
    payment.status === "paid"
      ? movementPaymentBadge(payment)
      : { label: paymentStatusLabel(payment.status), tone: "neutral" as const };

  return (
    <li className="mc-mvd-payment">
      <span
        className={`mc-mvd-payment__icon mc-mvd-payment__icon--${badge.tone}`}
        aria-hidden="true"
      >
        {payment.demo || payment.provider === "demo" ? (
          <QrCode />
        ) : payment.method === "cash" ? (
          <Wallet />
        ) : (
          <ShieldCheck />
        )}
      </span>
      <div className="mc-mvd-payment__main">
        <p className="mc-mvd-payment__title">
          {paymentMethodLabel(payment.method)} ·{" "}
          {paymentProviderLabel(payment.provider, payment.demo)}
        </p>
        <p className="mc-mvd-payment__meta">
          {formatActivityDate(payment.createdAt)} ·{" "}
          {paymentStatusLabel(payment.status)}
        </p>
        {payment.transactionId ? (
          <p
            className="mc-mvd-payment__txn"
            title={payment.transactionId}
          >
            Transacción {shortTransaction(payment.transactionId)}
          </p>
        ) : null}
      </div>
      <div className="mc-mvd-payment__amount">
        <CurrencyAmount
          cents={payment.amountCents}
          className="mc-mvd-payment__value"
        />
        <span className={`mc-mvd-badge mc-mvd-badge--${badge.tone}`}>
          {badge.label}
        </span>
      </div>
    </li>
  );
}

export default async function DetalleMovimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const detail = getCodiMovementDetail(id);

  if (!detail) notFound();

  const { movement, credit, qrImage } = detail;
  const { order, summary, state, stateLabel, stateTone, stateDetail } = movement;
  const merchant = MERCHANT;
  const initial =
    (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";
  const demoMode = isDemoMode();
  const demoMovement =
    order.demo ||
    order.status === "demo_paid" ||
    movement.payments.some((payment) => payment.demo || payment.provider === "demo");
  const hasDemoPayment = summary.demoPaidCents > 0;
  const created = dateParts(order.createdAt);
  const updated = dateParts(order.updatedAt);
  const customer = order.customerName?.trim() || "Público general";
  const creditKnown = credit !== null;
  const creditBalanceCents = credit?.balanceCents ?? summary.creditCents;
  const qrAlt = `Código QR de la solicitud ${shortOrder(order.id)}${
    order.numRef ? `, referencia ${order.numRef}` : ""
  }, por ${formatMxn(order.totalCents)}${demoMovement ? " (demo)" : ""}`;

  return (
    <OperationalPage
      activeHref="/movimientos"
      title="Detalle del movimiento"
      titleId="mc-mvd-title"
      eyebrow="CoDi"
      actions={
        <Link href="/movimientos" className="mc-mvd-back">
          <ArrowLeft aria-hidden="true" />
          <span className="mc-mvd-back__label">Movimientos</span>
        </Link>
      }
      merchant={merchant.name}
      address={merchant.address}
      demo={demoMode}
      initial={initial}
      mainId="movimiento-detalle-main"
      contentClassName="mc-mvd-page"
      focusTargetId="mc-mvd-title"
    >
      <section className="mc-mvd-hero" aria-labelledby="mc-mvd-folio">
        <div className="mc-mvd-hero__art">
          <Image
            src={qrArt}
            alt=""
            aria-hidden="true"
            sizes="(max-width: 479px) 92px, (max-width: 767px) 112px, 190px"
          />
        </div>

        <div className="mc-mvd-hero__body">
          <p className="mc-mvd-hero__folio" id="mc-mvd-folio">
            Solicitud #{shortOrder(order.id)}
          </p>
          <CurrencyAmount
            as="p"
            cents={order.totalCents}
            className="mc-mvd-hero__total"
          />
          <span className={`mc-mvd-status mc-mvd-status--${stateTone}`}>
            {stateLabel}
          </span>
          <p className="mc-mvd-hero__state">{stateDetail}</p>
        </div>

        <div className="mc-mvd-hero__when">
          <CalendarDays aria-hidden="true" />
          <p className="mc-mvd-hero__date">{created.date}</p>
          {created.time ? (
            <p className="mc-mvd-hero__time">{created.time}</p>
          ) : null}
        </div>
      </section>

      {demoMovement ? (
        <p className="mc-mvd-demo" role="note">
          {hasDemoPayment
            ? "Movimiento demo: incluye pagos simulados. No representan dinero real ni se entregan."
            : "Solicitud demo: es una práctica y no tiene dinero real asociado."}
        </p>
      ) : null}

      <section className="mc-mvd-card" aria-labelledby="mc-mvd-solicitud-title">
        <h2 id="mc-mvd-solicitud-title" className="mc-mvd-card__title">
          Solicitud
        </h2>
        <p className="mc-mvd-card__lead">
          Lo que se pidió en el mostrador. La deuda por fiado no es dinero
          recibido.
        </p>

        {order.items.length === 0 ? (
          <p className="mc-mvd-card__empty">
            Esta solicitud no tiene conceptos guardados.
          </p>
        ) : (
          <ul className="mc-mvd-items">
            {order.items.map((item, index) => {
              const slot = index % ITEM_MEDALLIONS.length;
              return (
                <li key={item.id} className="mc-mvd-item">
                  <span
                    className={`mc-mvd-item__badge mc-mvd-item__badge--${ITEM_TONES[slot]}`}
                    aria-hidden="true"
                  >
                    <Image
                      src={ITEM_MEDALLIONS[slot]}
                      alt=""
                      sizes="28px"
                    />
                  </span>
                  <div className="mc-mvd-item__main">
                    <p className="mc-mvd-item__name">{item.description}</p>
                    <p className="mc-mvd-item__unit">
                      {item.quantity} × {formatMxn(item.unitPriceCents)}
                    </p>
                  </div>
                  <CurrencyAmount
                    cents={item.totalCents}
                    className="mc-mvd-item__total"
                  />
                </li>
              );
            })}
          </ul>
        )}

        <div className="mc-mvd-total">
          <span>Total de la solicitud</span>
          <CurrencyAmount
            as="p"
            cents={order.totalCents}
            className="mc-mvd-total__value"
          />
        </div>

        <dl className="mc-mvd-meta">
          <div className="mc-mvd-meta__cell">
            <CalendarDays aria-hidden="true" />
            <div>
              <dt className="mc-mvd-meta__label">Creada</dt>
              <dd className="mc-mvd-meta__value">
                {created.date}
                {created.time ? ` · ${created.time}` : ""}
              </dd>
            </div>
          </div>
          <div className="mc-mvd-meta__cell">
            <CalendarDays aria-hidden="true" />
            <div>
              <dt className="mc-mvd-meta__label">Última actualización</dt>
              <dd className="mc-mvd-meta__value">
                {updated.date}
                {updated.time ? ` · ${updated.time}` : ""}
              </dd>
            </div>
          </div>
          <div className="mc-mvd-meta__cell">
            <User aria-hidden="true" />
            <div>
              <dt className="mc-mvd-meta__label">Cliente</dt>
              <dd className="mc-mvd-meta__value">{customer}</dd>
            </div>
          </div>
          <div className="mc-mvd-meta__cell">
            <QrCode aria-hidden="true" />
            <div>
              <dt className="mc-mvd-meta__label">Referencia</dt>
              <dd className="mc-mvd-meta__value">
                {order.numRef ?? "Sin referencia"}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <section className="mc-mvd-card" aria-labelledby="mc-mvd-cobro-title">
        <h2 id="mc-mvd-cobro-title" className="mc-mvd-card__title">
          Cobro digital
        </h2>
        <p className="mc-mvd-card__lead">
          Un QR o un link son una solicitud de pago, no un ingreso. El dinero se
          registra solo cuando llega un pago.
        </p>

        {summary.hasQr ? (
          <div className="mc-mvd-qr">
            {qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrImage}
                alt={qrAlt}
                className="mc-mvd-qr__image"
                width={200}
                height={200}
              />
            ) : (
              <div className="mc-mvd-qr__missing" aria-label="QR sin imagen">
                <QrCode aria-hidden="true" />
                <span>QR guardado sin imagen</span>
              </div>
            )}
            <div className="mc-mvd-qr__copy">
              <p className="mc-mvd-qr__title">QR generado</p>
              <p className="mc-mvd-qr__meta">
                {order.numRef
                  ? `Referencia ${order.numRef}`
                  : "Sin número de referencia"}
              </p>
              <p className="mc-mvd-qr__note">
                Escanearlo no registra dinero aquí. Solo un pago confirmado
                cambia el estado.
              </p>
              {state === "expired" ? (
                <p className="mc-mvd-qr__warning">
                  <AlertTriangle aria-hidden="true" />
                  {stateDetail}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {summary.hasLink ? (
          <div className="mc-mvd-link">
            <Link2 aria-hidden="true" />
            <div>
              <p className="mc-mvd-link__title">Link de cobro generado</p>
              {order.paymentUrl ? (
                <a
                  className="mc-mvd-link__anchor"
                  href={order.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir link de cobro
                </a>
              ) : (
                <p className="mc-mvd-link__meta">
                  Link registrado sin URL guardada.
                </p>
              )}
              <p className="mc-mvd-link__note">
                Abrirlo no registra dinero; es solo la solicitud.
              </p>
            </div>
          </div>
        ) : null}

        {!summary.hasQr && !summary.hasLink ? (
          <p className="mc-mvd-empty-line">
            <CircleDashed aria-hidden="true" />
            {summary.hasPayment
              ? "No se guardó QR ni link de esta solicitud. El pago sí está registrado abajo."
              : "Todavía no se generó QR ni link para esta solicitud."}
          </p>
        ) : null}
      </section>

      <section
        className="mc-mvd-card mc-mvd-card--money"
        aria-labelledby="mc-mvd-dinero-title"
      >
        <h2 id="mc-mvd-dinero-title" className="mc-mvd-card__title">
          Dinero recibido
        </h2>
        <CurrencyAmount
          as="p"
          cents={summary.realPaidCents}
          className="mc-mvd-money__value"
        />
        <p className="mc-mvd-money__note">
          Solo efectivo real y pagos verificados por pey. Un QR, un link o un
          pago demo no suman aquí.
        </p>

        <dl className="mc-mvd-money__rows">
          <div className="mc-mvd-money__row">
            <dt>Efectivo recibido</dt>
            <dd>
              <CurrencyAmount cents={summary.cashRealCents} />
            </dd>
          </div>
          <div className="mc-mvd-money__row">
            <dt>Verificado por pey</dt>
            <dd>
              <CurrencyAmount cents={summary.verifiedPaidCents} />
            </dd>
          </div>
          {summary.demoPaidCents > 0 ? (
            <div className="mc-mvd-money__row mc-mvd-money__row--demo">
              <dt>Pago demo (simulado)</dt>
              <dd>
                <CurrencyAmount cents={summary.demoPaidCents} />
              </dd>
            </div>
          ) : null}
          <div className="mc-mvd-money__row">
            <dt>Por cobrar</dt>
            <dd>
              {state === "cancelled" ? (
                "No se cobra"
              ) : (
                <CurrencyAmount cents={summary.dueCents} />
              )}
            </dd>
          </div>
          {summary.creditCents > 0 ? (
            <div className="mc-mvd-money__row mc-mvd-money__row--credit">
              <dt>Fiado (deuda)</dt>
              <dd>
                <CurrencyAmount
                  cents={creditKnown ? creditBalanceCents : summary.creditCents}
                />
              </dd>
            </div>
          ) : null}
        </dl>

        {summary.creditCents > 0 ? (
          <p className="mc-mvd-money__credit-note">
            {creditKnown
              ? "El fiado es una deuda del cliente, no dinero recibido; un abono la reduce."
              : "El fiado original está guardado, pero el saldo actual no está disponible en esta base."}
          </p>
        ) : null}
      </section>

      <section className="mc-mvd-card" aria-labelledby="mc-mvd-pagos-title">
        <h2 id="mc-mvd-pagos-title" className="mc-mvd-card__title">
          Pagos registrados
        </h2>
        {movement.payments.length === 0 ? (
          <p className="mc-mvd-empty-line">
            <Wallet aria-hidden="true" />
            {state === "cancelled"
              ? "Sin pagos: la solicitud se canceló."
              : "Sin pagos registrados. La solicitud sigue abierta."}
          </p>
        ) : (
          <ul className="mc-mvd-payments">
            {movement.payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </ul>
        )}
      </section>

      <section className="mc-mvd-notes" aria-label="Límites de esta vista">
        <p>
          Esta pantalla no cambia estados ni registra pagos: muestra lo que ya
          está guardado en la misma base que Caja y Ventas.
        </p>
        <p>
          La hora exacta de generación del QR no se guarda. «QR vencido» se
          deriva de la última actualización y de la vigencia de 10 minutos que
          se pide al banco; no cancela la solicitud. El estado «Cancelada» solo
          aparece si la base ya lo tiene: esta versión no tiene una acción para
          cancelar.
        </p>
      </section>
    </OperationalPage>
  );
}
