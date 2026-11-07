import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mic,
} from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import {
  countOrders,
  getCredit,
  getDailySummary,
  listOrders,
  sumPendingOrderBalances,
} from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatActivityDate, shortOrder } from "@/lib/format";
import { saleMoney } from "@/lib/sale-truth";
import {
  saleMethodLabel,
  saleStampTone,
  saleStatusLabel,
  type SaleStampTone,
} from "@/lib/sale-display";
import type { Order } from "@/lib/types";
import tacosArt from "@/assets/brand/ilustraciones/transparent/tacos.png";
import papelPicadoArt from "@/assets/inicio/papel-picado.png";
import iconRecibo from "@/assets/brand/iconos/transparent/recibo.png";
import iconTienda from "@/assets/brand/iconos/transparent/tienda.png";
import iconCamion from "@/assets/brand/iconos/transparent/camion.png";
import iconQr from "@/assets/brand/iconos/transparent/qr-telefono.png";
import "./ventas.css";

export const metadata: Metadata = {
  title: "Ventas · Mercado Cero",
};

export const instant = false;

const PAGE_SIZE = 25;

/** Medallones de fila: rotan recibo/tienda/camión, como la iconografía del kit. */
const ROW_MEDALLIONS = [iconRecibo, iconTienda, iconCamion];
const ROW_TONES = ["green", "saffron", "terracotta"];

type StampTone = SaleStampTone;

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const requested =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const summary = getDailySummary();
  const pendingCentsTotal = sumPendingOrderBalances();
  const total = countOrders();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pageCount);
  const offset = (page - 1) * PAGE_SIZE;
  const orders = listOrders(PAGE_SIZE, offset);
  const merchant = MERCHANT;
  const initial = (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";
  const demo = isDemoMode();
  const hasOrders = orders.length > 0;

  return (
    <OperationalPage
      activeHref="/ventas"
      title="Ventas"
      titleId="ventas-title"
      eyebrow="Historial"
      subtitle="Consulta las ventas registradas. Los importes son ventas, no necesariamente dinero cobrado."
      actions={
        <Link href="/caja" className="mc-ventas-cta">
          <Mic aria-hidden="true" />
          Nueva venta
        </Link>
      }
      merchant={merchant.name}
      address={merchant.address}
      demo={demo}
      initial={initial}
      mainId="ventas-main"
      contentClassName="mc-ventas-page"
      focusTargetId="mc-ventas-list-title"
    >
      {/* Acento de papel picado en la esquina superior derecha del contenido. */}
      <Image
        src={papelPicadoArt}
        alt=""
        aria-hidden="true"
        className="mc-ventas-page__picado"
        sizes="(max-width: 767px) 120px, 210px"
      />

      <section
        className="mc-ventas-summary mc-ventas-stats"
        aria-label="Resumen de ventas"
      >
        <article className="mc-ventas-kpi">
          <div className="mc-ventas-kpi__top">
            <span
              className="mc-ventas-kpi__medallion mc-ventas-kpi__medallion--green"
              aria-hidden="true"
            >
              <Image src={iconTienda} alt="" sizes="28px" />
            </span>
            <p className="mc-ventas-kpi__label">Ventas hoy</p>
          </div>
          <CurrencyAmount
            as="p"
            cents={summary.salesCents}
            className="mc-ventas-kpi__value"
          />
          <p className="mc-ventas-kpi__note">
            {demo
              ? "Incluye ventas demo; no es dinero real"
              : "Registradas, no necesariamente cobradas"}
          </p>
        </article>

        <article className="mc-ventas-kpi">
          <div className="mc-ventas-kpi__top">
            <span
              className="mc-ventas-kpi__medallion mc-ventas-kpi__medallion--saffron"
              aria-hidden="true"
            >
              <Image src={iconRecibo} alt="" sizes="28px" />
            </span>
            <p className="mc-ventas-kpi__label">Cobrado confirmado</p>
          </div>
          <CurrencyAmount
            as="p"
            cents={summary.cashCents + summary.verifiedDigitalCents}
            className="mc-ventas-kpi__value"
          />
          <p className="mc-ventas-kpi__note">
            {demo
              ? "Solo efectivo real y pagos verificados; demo no cuenta"
              : "Efectivo + pagos verificados por pey"}
          </p>
        </article>

        <article className="mc-ventas-kpi">
          <div className="mc-ventas-kpi__top">
            <span
              className="mc-ventas-kpi__medallion mc-ventas-kpi__medallion--terracotta"
              aria-hidden="true"
            >
              <Image src={iconQr} alt="" sizes="28px" />
            </span>
            <p className="mc-ventas-kpi__label">Por cobrar digital</p>
          </div>
          <CurrencyAmount
            as="p"
            cents={pendingCentsTotal}
            className="mc-ventas-kpi__value"
          />
          <p className="mc-ventas-kpi__note">
            Links y QR de todos los días. No incluye fiado.
          </p>
        </article>
      </section>

      {!hasOrders ? (
        <section className="mc-ventas-empty" aria-labelledby="mc-ventas-empty-title">
          <Image
            src={tacosArt}
            alt=""
            aria-hidden="true"
            className="mc-ventas-empty__art"
            sizes="(max-width: 767px) 200px, 260px"
          />
          <h2 id="mc-ventas-empty-title" className="mc-ventas-empty__title">
            Todavía no hay ventas registradas.
          </h2>
          <p className="mc-ventas-empty__body">
            Registra la primera venta desde Caja. Aquí verás el historial y el
            estado de cobro de cada pedido.
          </p>
          <Link href="/caja" className="mc-ventas-empty__link">
            Ir a Caja
          </Link>
        </section>
      ) : (
        <section className="mc-ventas-list" aria-labelledby="mc-ventas-list-title">
          <div className="mc-ventas-list__head">
            <h2 id="mc-ventas-list-title" className="mc-ventas-list__title" tabIndex={-1}>
              Ventas registradas
            </h2>
            <p className="mc-ventas-list__meta" data-route-announcement>
              {total} en total · página {page} de {pageCount}
            </p>
          </div>

          <ul className="mc-ventas-items">
            {orders.map((order, index) => {
              const credit = order.creditId ? getCredit(order.creditId) : null;
              const isDemoOrder =
                demo || order.status === "demo_paid" || order.lastPaymentDemo;
              const creditKnown = credit !== null;
              const creditBalanceCents =
                credit?.balanceCents ?? (order.creditCents > 0 ? order.creditCents : 0);
              const money = saleMoney(order, creditBalanceCents);
              const digitalDueCents = money.dueCents;
              const slot = index % ROW_MEDALLIONS.length;
              const medallion = ROW_MEDALLIONS[slot];
              const tone = ROW_TONES[slot];
              const stamp: StampTone = saleStampTone(order, creditBalanceCents, isDemoOrder);
              return (
                <li key={order.id} className="mc-ventas-item">
                  <article className="mc-ventas-row">
                    <span
                      className={`mc-ventas-row__medallion mc-ventas-row__medallion--${tone}`}
                      aria-hidden="true"
                    >
                      <Image
                        src={medallion}
                        alt=""
                        className="mc-ventas-row__medallion-img"
                        sizes="44px"
                      />
                    </span>

                    <div className="mc-ventas-row__main">
                      <div className="mc-ventas-row__title">
                        <h3>
                          <Link
                            href={`/ventas/${encodeURIComponent(order.id)}`}
                            className="mc-ventas-row__link"
                          >
                            Pedido {shortOrder(order.id)}
                          </Link>
                        </h3>
                        <span
                          className={`mc-ventas-status mc-ventas-stamp mc-ventas-stamp--${stamp}`}
                        >
                          {saleStatusLabel(
                            order,
                            creditBalanceCents,
                            creditKnown,
                            isDemoOrder,
                          )}
                        </span>
                      </div>
                      <p className="mc-ventas-row__meta">
                        {formatActivityDate(order.createdAt)} · {saleMethodLabel(order)}
                        {order.customerName ? ` · ${order.customerName}` : ""}
                      </p>
                      <p className="mc-ventas-row__items">
                        {order.items
                          .map((item) => `${item.quantity} × ${item.description}`)
                          .join(" · ")}
                      </p>
                    </div>

                    <div className="mc-ventas-row__amount">
                      <CurrencyAmount
                        cents={order.totalCents}
                        className="mc-ventas-row__total"
                      />
                      <span className="mc-ventas-row__amount-note">
                        {isDemoOrder
                          ? "Demo, no es dinero real"
                          : money.paidCents > 0
                            ? (
                              <>
                                Cobrado <CurrencyAmount cents={money.paidCents} />
                              </>
                            )
                            : order.status === "payment_pending"
                              ? "Pendiente de cobro"
                              : money.creditCents > 0
                                ? creditKnown && creditBalanceCents === 0
                                  ? "Fiado saldado"
                                  : "Fiado, no cobrado"
                                : "Sin cobro confirmado"}
                      </span>
                      {isDemoOrder && money.paidCents > 0 ? (
                        <span className="mc-ventas-row__demo-paid">
                          Simulado: cobrado <CurrencyAmount cents={money.paidCents} />
                        </span>
                      ) : null}
                      {!isDemoOrder && money.hasCash && money.hasDigital ? (
                        <span className="mc-ventas-row__split">
                          Efectivo <CurrencyAmount cents={money.cashPaidCents} /> + digital{" "}
                          <CurrencyAmount cents={money.digitalPaidCents} />
                        </span>
                      ) : null}
                      {digitalDueCents > 0 ? (
                        <span className="mc-ventas-row__due">
                          Falta cobrar <CurrencyAmount cents={digitalDueCents} />
                        </span>
                      ) : null}
                      {order.creditCents > 0 ? (
                        <span className="mc-ventas-row__credit">
                          {creditKnown
                            ? creditBalanceCents > 0
                              ? "Saldo vivo"
                              : "Fiado saldado"
                            : "Fiado original (saldo no disponible)"}{" "}
                          <CurrencyAmount
                            cents={
                              creditKnown && creditBalanceCents > 0
                                ? creditBalanceCents
                                : order.creditCents
                            }
                          />
                        </span>
                      ) : null}
                    </div>

                    <div className="mc-ventas-row__footer">
                      <details className="mc-ventas-row__details">
                        <summary>
                          Ver conceptos
                          <ChevronDown aria-hidden="true" />
                        </summary>
                        <ul>
                          {order.items.map((item) => (
                            <li key={item.id}>
                              <span>{item.description}</span>
                              <span>
                                {item.quantity} × <CurrencyAmount cents={item.unitPriceCents} />
                              </span>
                              <CurrencyAmount cents={item.totalCents} />
                            </li>
                          ))}
                        </ul>
                      </details>
                      <Link
                        href={`/ventas/${encodeURIComponent(order.id)}`}
                        className="mc-ventas-row__open"
                      >
                        Ver detalle
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>

          {pageCount > 1 ? (
            <nav className="mc-ventas-pager" aria-label="Páginas de ventas">
              {page > 1 ? (
                <Link href={`/ventas?page=${page - 1}`} rel="prev">
                  <ChevronLeft aria-hidden="true" />
                  Anterior
                </Link>
              ) : (
                <span aria-disabled="true">
                  <ChevronLeft aria-hidden="true" />
                  Anterior
                </span>
              )}
              {page < pageCount ? (
                <Link href={`/ventas?page=${page + 1}`} rel="next">
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
      )}

      {/* Momento ilustrado (solo si hay ventas: la otra variante es el empty). */}
      {hasOrders ? (
        <section className="mc-ventas-hero">
          <div className="mc-ventas-hero__copy">
            <p className="mc-ventas-hero__kicker">Consulta, no cobro</p>
            <p className="mc-ventas-hero__lead">
              Ventas registradas, dinero por confirmar.
            </p>
            <p className="mc-ventas-hero__note">
              Cada fila distingue lo cobrado, lo pendiente y lo fiado. Un pedido
              pagado no es lo mismo que un pedido registrado.
            </p>
          </div>
          <Image
            src={tacosArt}
            alt=""
            aria-hidden="true"
            className="mc-ventas-hero__art"
            sizes="(max-width: 767px) 128px, 300px"
          />
        </section>
      ) : null}

      <p className="mc-ventas-note">
        El historial se lee de la misma base que Caja. Un pedido <strong>pendiente</strong> o{" "}
        <strong>fiado</strong> no es dinero recibido; solo se marca pagado con la confirmación
        válida del proveedor o con el efectivo registrado.
      </p>
    </OperationalPage>
  );
}
