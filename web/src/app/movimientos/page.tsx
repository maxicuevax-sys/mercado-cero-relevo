import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Link2,
  QrCode,
  Wallet,
} from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatActivityDate, shortOrder } from "@/lib/format";
import {
  getCodiMovementsSummary,
  listCodiMovements,
  movementFilterHref,
  parseMovementFilter,
  type Movement,
  type MovementFilter,
} from "@/lib/codi-movements";
import type { OrderItem } from "@/lib/types";
import qrArt from "@/assets/brand/ilustraciones/transparent/qr.png";
import papelPicadoArt from "@/assets/inicio/papel-picado.png";
import iconQr from "@/assets/brand/iconos/transparent/qr-telefono.png";
import iconRecibo from "@/assets/brand/iconos/transparent/recibo.png";
import iconTienda from "@/assets/brand/iconos/transparent/tienda.png";
import "./movimientos.css";

export const metadata: Metadata = {
  title: "Movimientos · Mercado Cero",
  description:
    "Historial de solicitudes y pagos CoDi: qué se pidió, qué se cobró y qué sigue pendiente.",
};

// Dato vivo: se lee la base en cada petición y se pinta por petición.
export const instant = false;

const ROW_MEDALLIONS = [iconQr, iconRecibo, iconTienda];
const ROW_TONES = ["green", "saffron", "terracotta"];

const FILTERS: Array<{ id: MovementFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "pagados", label: "Pagados" },
];

function itemsLine(items: OrderItem[]): string {
  if (items.length === 0) return "Sin conceptos guardados";
  return items
    .map((item) => `${item.quantity} × ${item.description}`)
    .join(" · ");
}

function requestIcon(movement: Movement) {
  if (movement.summary.hasQr) return <QrCode aria-hidden="true" />;
  if (movement.summary.hasLink) return <Link2 aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function MovementRow({
  movement,
  index,
}: {
  movement: Movement;
  index: number;
}) {
  const { order, summary, state, stateLabel, stateTone } = movement;
  const slot = index % ROW_MEDALLIONS.length;
  const titleId = `mc-mov-${order.id}-title`;
  const detailHref = `/movimientos/${encodeURIComponent(order.id)}`;

  return (
    <li className="mc-mov-item">
      <article className="mc-mov-row" aria-labelledby={titleId}>
        <span
          className={`mc-mov-row__medallion mc-mov-row__medallion--${ROW_TONES[slot]}`}
          aria-hidden="true"
        >
          <Image
            src={ROW_MEDALLIONS[slot]}
            alt=""
            className="mc-mov-row__medallion-img"
            sizes="44px"
          />
        </span>

        <div className="mc-mov-row__main">
          <div className="mc-mov-row__title">
            <h3 id={titleId}>
              <Link href={detailHref} className="mc-mov-row__link">
                Solicitud {shortOrder(order.id)}
              </Link>
            </h3>
            <span
              className={`mc-mov-stamp mc-mov-stamp--${stateTone} mc-mov-stamp--${state}`}
            >
              {stateLabel}
            </span>
          </div>

          <p className="mc-mov-row__meta">
            {formatActivityDate(order.createdAt)}
            {order.customerName ? ` · ${order.customerName}` : ""}
            {order.numRef ? ` · Ref. ${order.numRef}` : ""}
          </p>
          <p className="mc-mov-row__items">{itemsLine(order.items)}</p>

          <div className="mc-mov-row__flow">
            <span className="mc-mov-row__flow-item">
              <span className="mc-mov-row__flow-label">Solicitud</span>
              {requestIcon(movement)}
              {movement.requestLabel}
            </span>
            <span className="mc-mov-row__flow-item">
              <span className="mc-mov-row__flow-label">Dinero</span>
              <Wallet aria-hidden="true" />
              {movement.moneyLabel}
            </span>
          </div>

          {state === "expired" ? (
            <p className="mc-mov-row__warning">
              <AlertTriangle aria-hidden="true" />
              {movement.stateDetail}
            </p>
          ) : null}
        </div>

        <div className="mc-mov-row__amount">
          <CurrencyAmount
            cents={order.totalCents}
            className="mc-mov-row__total"
          />
          {state === "cancelled" ? (
            <span className="mc-mov-row__pending">
              {summary.hasPayment
                ? "Cancelada · pago registrado"
                : "Cancelada, no se cobra"}
            </span>
          ) : summary.dueCents > 0 ? (
            <span className="mc-mov-row__due">
              Falta cobrar <CurrencyAmount cents={summary.dueCents} />
            </span>
          ) : summary.hasPayment ? (
            <span className="mc-mov-row__settled">Cubierto</span>
          ) : (
            <span className="mc-mov-row__pending">Sin cobro</span>
          )}
          {summary.creditCents > 0 ? (
            <span className="mc-mov-row__credit">
              Fiado <CurrencyAmount cents={summary.creditCents} /> (deuda)
            </span>
          ) : null}
          {summary.hasDemoPayment ? (
            <span className="mc-mov-row__demo">
              Demo, no es dinero real
            </span>
          ) : null}
          <Link href={detailHref} className="mc-mov-row__open">
            Ver detalle
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      </article>
    </li>
  );
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const filter = parseMovementFilter(params.filtro);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { movements, total, page: currentPage, pageCount, counts } =
    listCodiMovements({ filter, page });
  const summary = getCodiMovementsSummary();
  const hasAny = summary.total > 0;
  const merchant = MERCHANT;
  const initial =
    (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";
  const demo = isDemoMode();
  const listTitle =
    filter === "pendientes"
      ? "Solicitudes pendientes"
      : filter === "pagados"
        ? "Solicitudes pagadas"
        : "Movimientos registrados";
  const emptyTitle =
    filter === "pendientes"
      ? "No hay solicitudes pendientes."
      : filter === "pagados"
        ? "Todavía no hay solicitudes pagadas."
        : "Todavía no hay movimientos en el historial.";

  const filterCounts: Record<MovementFilter, number> = {
    todos: counts.todos,
    pendientes: counts.pendientes,
    pagados: counts.pagados,
  };

  return (
    <OperationalPage
      activeHref="/movimientos"
      title="Movimientos"
      titleId="mc-mov-title"
      eyebrow="CoDi"
      subtitle="Solicitudes y pagos digitales. Un QR generado no es dinero recibido."
      actions={
        <Link href="/caja" className="mc-mov-cta">
          <QrCode aria-hidden="true" />
          Nuevo cobro
        </Link>
      }
      merchant={merchant.name}
      address={merchant.address}
      demo={demo}
      initial={initial}
      mainId="movimientos-main"
      contentClassName="mc-mov-page"
      focusTargetId={hasAny ? "mc-mov-list-title" : "mc-mov-empty-title"}
    >
      <Image
        src={papelPicadoArt}
        alt=""
        aria-hidden="true"
        className="mc-mov-page__picado"
        sizes="(max-width: 767px) 120px, 210px"
      />

      <section className="mc-mov-summary" aria-label="Resumen de movimientos">
        <article className="mc-mov-kpi">
          <div className="mc-mov-kpi__top">
            <span
              className="mc-mov-kpi__medallion mc-mov-kpi__medallion--green"
              aria-hidden="true"
            >
              <Image src={iconQr} alt="" sizes="28px" />
            </span>
            <p className="mc-mov-kpi__label">Por cobrar</p>
          </div>
          <CurrencyAmount
            as="p"
            cents={summary.openDueCents}
            className="mc-mov-kpi__value"
          />
          <p className="mc-mov-kpi__note">
            {summary.openCount === 0
              ? "Ninguna solicitud con saldo."
              : `${summary.openCount} ${plural(summary.openCount, "solicitud", "solicitudes")} con saldo. Un QR no es dinero.`}
          </p>
        </article>

        <article className="mc-mov-kpi">
          <div className="mc-mov-kpi__top">
            <span
              className="mc-mov-kpi__medallion mc-mov-kpi__medallion--saffron"
              aria-hidden="true"
            >
              <Image src={iconRecibo} alt="" sizes="28px" />
            </span>
            <p className="mc-mov-kpi__label">Dinero recibido</p>
          </div>
          <CurrencyAmount
            as="p"
            cents={summary.realPaidCents}
            className="mc-mov-kpi__value"
          />
          <p className="mc-mov-kpi__note">
            Efectivo real + pey. Demo no cuenta.
          </p>
        </article>

        <article className="mc-mov-kpi">
          <div className="mc-mov-kpi__top">
            <span
              className="mc-mov-kpi__medallion mc-mov-kpi__medallion--terracotta"
              aria-hidden="true"
            >
              <Image src={iconTienda} alt="" sizes="28px" />
            </span>
            <p className="mc-mov-kpi__label">Pago demo</p>
          </div>
          <CurrencyAmount
            as="p"
            cents={summary.demoPaidCents}
            className="mc-mov-kpi__value"
          />
          <p className="mc-mov-kpi__note">
            {summary.demoPaidCents > 0
              ? "Simulación, no es dinero real."
              : "Sin pagos demo registrados."}
          </p>
        </article>
      </section>

      {!hasAny ? (
        <section
          className="mc-mov-empty"
          aria-labelledby="mc-mov-empty-title"
        >
          <Image
            src={qrArt}
            alt=""
            aria-hidden="true"
            className="mc-mov-empty__art"
            sizes="(max-width: 767px) 200px, 260px"
          />
          <h2 id="mc-mov-empty-title" className="mc-mov-empty__title" tabIndex={-1}>
            Todavía no hay movimientos CoDi.
          </h2>
          <p className="mc-mov-empty__body">
            Cuando generes un QR o un link de cobro desde Caja, aparecerá aquí
            con su estado de pago. Un QR generado no suma como dinero recibido.
          </p>
          <Link href="/caja" className="mc-mov-empty__link">
            Ir a Caja
          </Link>
        </section>
      ) : (
        <>
          <nav className="mc-mov-filters" aria-label="Filtrar movimientos">
            {FILTERS.map((item) => {
              const active = item.id === filter;
              return (
                <Link
                  key={item.id}
                  href={movementFilterHref(item.id)}
                  className="mc-mov-filter"
                  aria-current={active ? "page" : undefined}
                  aria-label={`${item.label}, ${filterCounts[item.id]} ${plural(
                    filterCounts[item.id],
                    "movimiento",
                    "movimientos",
                  )}`}
                >
                  {item.label}
                  <span className="mc-mov-filter__count" aria-hidden="true">
                    {filterCounts[item.id]}
                  </span>
                </Link>
              );
            })}
          </nav>

          <section
            className="mc-mov-list"
            aria-labelledby="mc-mov-list-title"
          >
            <div className="mc-mov-list__head">
              <h2
                id="mc-mov-list-title"
                className="mc-mov-list__title"
                tabIndex={-1}
              >
                {listTitle}
              </h2>
              <p className="mc-mov-list__meta" data-route-announcement>
                {total} {plural(total, "movimiento", "movimientos")} · página{" "}
                {currentPage} de {pageCount}
              </p>
            </div>

            {movements.length === 0 ? (
              <div className="mc-mov-empty mc-mov-empty--compact" role="status">
                <h3 className="mc-mov-empty__title">{emptyTitle}</h3>
                <p className="mc-mov-empty__body">
                  Cambia el filtro para ver todo el historial de solicitudes y
                  pagos.
                </p>
                <Link href="/movimientos" className="mc-mov-empty__link">
                  Ver todos
                </Link>
              </div>
            ) : (
              <ul className="mc-mov-items">
                {movements.map((movement, index) => (
                  <MovementRow
                    key={movement.order.id}
                    movement={movement}
                    index={index}
                  />
                ))}
              </ul>
            )}

            {pageCount > 1 ? (
              <nav className="mc-mov-pager" aria-label="Páginas de movimientos">
                {currentPage > 1 ? (
                  <Link
                    href={movementFilterHref(filter, currentPage - 1)}
                    rel="prev"
                  >
                    <ChevronLeft aria-hidden="true" />
                    Anterior
                  </Link>
                ) : (
                  <span aria-disabled="true">
                    <ChevronLeft aria-hidden="true" />
                    Anterior
                  </span>
                )}
                {currentPage < pageCount ? (
                  <Link
                    href={movementFilterHref(filter, currentPage + 1)}
                    rel="next"
                  >
                    Siguiente
                    <ChevronRight aria-hidden="true" />
                  </Link>
                ) : (
                  <span aria-disabled="true">
                    Siguiente
                    <ChevronRight aria-hidden="true" />
                  </span>
                )}
              </nav>
            ) : null}
          </section>

          <section className="mc-mov-hero">
            <div className="mc-mov-hero__copy">
              <p className="mc-mov-hero__kicker">Solicitud, no comprobante</p>
              <p className="mc-mov-hero__lead">
                El QR pide el pago; el banco lo confirma.
              </p>
              <p className="mc-mov-hero__note">
                Este historial separa lo que se pidió de lo que ya entró. Un QR
                o un link generado no suma a «Dinero recibido».
              </p>
            </div>
            <Image
              src={qrArt}
              alt=""
              aria-hidden="true"
              className="mc-mov-hero__art"
              sizes="(max-width: 767px) 128px, 300px"
            />
          </section>

          <section className="mc-mov-notes" aria-label="Cómo leer este historial">
            <p>
              El historial se lee de la misma base que Caja y Ventas. Un pedido{" "}
              <strong>pendiente</strong> o un <strong>QR generado</strong> no es
              dinero recibido; solo el efectivo registrado y los pagos
              confirmados cuentan. Los pagos demo son simulación.
            </p>
            <p>
              «QR vencido» es una referencia: el QR de CoDi se pide con 10
              minutos de vigencia y este aviso se deriva de la última
              actualización del pedido. No cancela la solicitud; si el pago
              llega después, se registra.
            </p>
          </section>
        </>
      )}
    </OperationalPage>
  );
}
