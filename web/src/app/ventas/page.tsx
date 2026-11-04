import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { TopBar } from "@/components/shell/top-bar";
import {
  cajaFoot,
  cajaMobileMore,
  cajaMobilePrimary,
  cajaNav,
} from "@/components/shell/nav";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { EmptyState } from "@/components/ui/empty-state";
import {
  countOrders,
  getCredit,
  getDailySummary,
  listOrders,
  sumPendingOrderBalances,
} from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatActivityDate, shortOrder } from "@/lib/format";
import type { Order } from "@/lib/types";
import "@/app/inicio/inicio.css";
import "./ventas.css";

export const metadata: Metadata = {
  title: "Ventas · Mercado Cero",
};

export const instant = false;

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const limit = 25;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const requested = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const summary = getDailySummary();
  const pendingCentsTotal = sumPendingOrderBalances();
  const total = countOrders();
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requested, pageCount);
  const offset = (page - 1) * limit;
  const orders = listOrders(limit, offset);
  const merchant = MERCHANT;
  const initial = (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";
  const demo = isDemoMode();

  return (
    <AppShell
      activeHref="/ventas"
      mainId="ventas-main"
      contentClassName="mc-ventas"
      nav={cajaNav}
      foot={cajaFoot}
      mobilePrimaryItems={cajaMobilePrimary}
      mobileMoreItems={cajaMobileMore}
      topbar={
        <TopBar
          merchant={merchant.name}
          address={merchant.address}
          initial={initial}
          demo={demo}
        />
      }
    >
      <PageHeader
        eyebrow="Historial"
        title="Ventas"
        titleId="ventas-title"
        subtitle="Consulta las ventas registradas. Los importes son ventas, no necesariamente dinero cobrado."
        actions={
          <Link href="/caja" className="mc-ventas-new">
            Nueva venta
          </Link>
        }
      />

      <section className="mc-ventas-stats" aria-label="Resumen de ventas">
        <article>
          <p>Ventas hoy</p>
          <CurrencyAmount cents={summary.salesCents} />
          <span>
            {demo
              ? "Incluye ventas demo; no es dinero real"
              : "Registradas, no necesariamente cobradas"}
          </span>
        </article>
        <article>
          <p>Cobrado confirmado</p>
          <CurrencyAmount
            cents={summary.cashCents + summary.verifiedDigitalCents}
          />
          <span>
            {demo
              ? "Solo efectivo real y pagos verificados; demo no cuenta"
              : "Efectivo + pagos verificados por pey"}
          </span>
        </article>
        <article>
          <p>Por cobrar digital</p>
          <CurrencyAmount cents={pendingCentsTotal} />
          <span>Links y QR de todos los días. No incluye fiado.</span>
        </article>
      </section>

      {orders.length === 0 ? (
        <EmptyState title="Todavía no hay ventas registradas.">
          Registra la primera desde <Link href="/caja">Caja</Link>.
        </EmptyState>
      ) : (
        <section className="mc-ventas-list" aria-labelledby="mc-ventas-list-title">
          <div className="mc-ventas-list__head">
            <h2 id="mc-ventas-list-title">Ventas registradas</h2>
            <p>
              {total} en total · página {page} de {pageCount}
            </p>
          </div>
          <ul>
            {orders.map((order) => {
              const credit = order.creditId ? getCredit(order.creditId) : null;
              const isDemoOrder =
                demo || order.status === "demo_paid" || order.lastPaymentDemo;
              const creditKnown = credit !== null;
              const creditBalanceCents =
                credit?.balanceCents ?? (order.creditCents > 0 ? order.creditCents : 0);
              const digitalDueCents = Math.max(
                0,
                order.totalCents - order.paidCents - order.creditCents,
              );
              return (
              <li key={order.id}>
                <article className="mc-ventas-row">
                  <div className="mc-ventas-row__main">
                    <div className="mc-ventas-row__title">
                      <span
                        className={`mc-ventas-status mc-ventas-status--${
                          isDemoOrder ? "demo_paid" : creditBalanceCents > 0 ? "credit" : order.status
                        }`}
                      >
                        {statusLabel(order, creditBalanceCents, creditKnown, isDemoOrder)}
                      </span>
                      <h3>Pedido {shortOrder(order.id)}</h3>
                    </div>
                    <p className="mc-ventas-row__meta">
                      {formatActivityDate(order.createdAt)} · {methodLabel(order)}
                      {order.customerName ? ` · ${order.customerName}` : ""}
                    </p>
                    <p className="mc-ventas-row__items">
                      {order.items
                        .map((item) => `${item.quantity} × ${item.description}`)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="mc-ventas-row__amount">
                    <CurrencyAmount cents={order.totalCents} />
                    <span>
                      {isDemoOrder ? (
                        "Demo, no es dinero real"
                      ) : order.status === "payment_pending" ? (
                        "Pendiente de cobro"
                      ) : order.paidCents > 0 ? (
                        <>
                          Cobrado <CurrencyAmount cents={order.paidCents} />
                        </>
                      ) : order.creditCents > 0 ? (
                        creditKnown && creditBalanceCents === 0
                          ? "Fiado saldado"
                          : "Fiado, no cobrado"
                      ) : (
                        "Sin cobro confirmado"
                      )}
                    </span>
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
                  <details className="mc-ventas-row__details">
                    <summary>Ver conceptos</summary>
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
                </article>
              </li>
              );
            })}
          </ul>
          {pageCount > 1 ? (
            <nav className="mc-ventas-pager" aria-label="Páginas de ventas">
              {page > 1 ? (
                <Link href={`/ventas?page=${page - 1}`} rel="prev">
                  Anterior
                </Link>
              ) : (
                <span aria-disabled="true">Anterior</span>
              )}
              {page < pageCount ? (
                <Link href={`/ventas?page=${page + 1}`} rel="next">
                  Siguiente
                </Link>
              ) : (
                <span aria-disabled="true">Siguiente</span>
              )}
            </nav>
          ) : null}
        </section>
      )}

      <p className="mc-ventas-note">
        El historial se lee de la misma base que Caja. Un pedido <strong>pendiente</strong> o{" "}
        <strong>fiado</strong> no es dinero recibido; solo se marca pagado con la confirmación
        válida del proveedor o con el efectivo registrado.
      </p>
    </AppShell>
  );
}

function statusLabel(
  order: Order,
  creditBalanceCents: number,
  creditKnown: boolean,
  isDemoOrder: boolean,
): string {
  if (isDemoOrder) {
    return order.status === "payment_pending" ? "Demo · pendiente" : "Demo";
  }
  if (order.status === "payment_pending") return "Pendiente";
  if (creditKnown && order.creditCents > 0 && creditBalanceCents === 0) {
    return "Saldado";
  }
  if (creditBalanceCents > 0) {
    return order.paidCents > 0 || order.digitalPaidCents > 0
      ? "Fiado + cobro"
      : "Fiado";
  }
  if (order.status === "paid") return "Pagado";
  if (order.status === "partially_paid") return "Parcial";
  if (order.status === "fulfilled") return "Entregado";
  if (order.status === "cancelled") return "Cancelado";
  return "Registrado";
}

function methodLabel(order: Order): string {
  if (order.status === "payment_pending") return "Por cobrar";
  if (order.creditCents > 0 && order.paymentMethod === "cash") return "Efectivo + fiado";
  if (order.creditCents > 0 && !order.paymentMethod) return "Fiado";
  if (!order.paymentMethod && order.creditCents === 0) return "Digital";
  if (order.paymentMethod === "cash" && order.digitalPaidCents > 0) {
    return "Efectivo + digital";
  }
  switch (order.paymentMethod) {
    case "cash":
      return "Efectivo";
    case "codi":
      return "CoDi";
    case "card":
      return "Tarjeta";
    case "wallet":
      return "Wallet";
    case "mixed":
      return "Mixto";
    default:
      return "Sin método";
  }
}
