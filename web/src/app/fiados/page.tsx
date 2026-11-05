import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { CreditPayButton } from "@/components/fiados/credit-pay-button";
import { countCredits, getOpenCreditTotals, listCredits } from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatActivityDate, formatDayMonth, shortOrder } from "@/lib/format";
import { DAY_MS, mexicoDateKey } from "@/lib/mexico-date";
import type { Credit, CreditStatus } from "@/lib/types";
import "./fiados.css";

export const metadata: Metadata = {
  title: "Fiados · Mercado Cero",
};

// El saldo vivo no se puede servir desde un snapshot de build.
export const instant = false;

const PAGE_SIZE = 20;

function ageLabel(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "Sin fecha";
  const dayNumber = (key: string) => Date.parse(`${key}T00:00:00Z`);
  const days = Math.max(
    0,
    Math.round(
      (dayNumber(mexicoDateKey(new Date())) - dayNumber(mexicoDateKey(created))) /
        DAY_MS,
    ),
  );
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

function createdAtKey(createdAt: string): string | null {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return mexicoDateKey(created);
}

function statusLabel(status: CreditStatus, settled: boolean): string {
  if (settled || status === "settled") return "Saldado";
  if (status === "partial") return "Abono parcial";
  return "Pendiente";
}

function FiadosRow({ credit }: { credit: Credit }) {
  const settled = credit.status === "settled" || credit.balanceCents <= 0;
  const paidCents = Math.max(0, credit.originalCents - credit.balanceCents);
  const key = createdAtKey(credit.createdAt);
  const since = key ? formatDayMonth(key) : null;

  return (
    <li className="mc-fiados-row">
      <div className="mc-fiados-row__main">
        <div className="mc-fiados-row__head">
          <h3 className="mc-fiados-row__name">{credit.customerName ?? "Cliente"}</h3>
          <span className={`mc-fiados-status mc-fiados-status--${credit.status}`}>
            {statusLabel(credit.status, settled)}
          </span>
        </div>
        <p className="mc-fiados-row__meta">
          {ageLabel(credit.createdAt)}
          {" · "}
          {credit.orderId ? `Pedido ${shortOrder(credit.orderId)}` : "Sin pedido"}
          {" · desde "}
          {since ?? formatActivityDate(credit.createdAt)}
        </p>
        <p className="mc-fiados-row__detail">
          Original <CurrencyAmount cents={credit.originalCents} />
          {paidCents > 0 ? (
            <>
              {" · abonado "}
              <CurrencyAmount cents={paidCents} />
            </>
          ) : (
            " · sin abonos todavía"
          )}
        </p>
      </div>
      <div className="mc-fiados-row__side">
        <p className="mc-fiados-row__amount">
          <CurrencyAmount
            as="span"
            cents={credit.balanceCents}
            className="mc-fiados-row__amount-value"
          />
          <span className="mc-fiados-row__amount-label">
            {settled ? "saldado" : "saldo"}
          </span>
        </p>
        <CreditPayButton credit={credit} />
      </div>
    </li>
  );
}

function FiadosPager({ page, pageCount }: { page: number; pageCount: number }) {
  return (
    <nav className="mc-fiados-pager" aria-label="Páginas de fiados">
      {page > 1 ? (
        <Link className="mc-fiados-pager__link" href={`/fiados?page=${page - 1}`} rel="prev">
          Anterior
        </Link>
      ) : (
        <span className="mc-fiados-pager__link mc-fiados-pager__link--off" aria-disabled="true">
          Anterior
        </span>
      )}
      <p className="mc-fiados-pager__status">
        Página {page} de {pageCount}
      </p>
      {page < pageCount ? (
        <Link className="mc-fiados-pager__link" href={`/fiados?page=${page + 1}`} rel="next">
          Siguiente
        </Link>
      ) : (
        <span className="mc-fiados-pager__link mc-fiados-pager__link--off" aria-disabled="true">
          Siguiente
        </span>
      )}
    </nav>
  );
}

export default async function FiadosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const requested =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const total = countCredits();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pageCount);
  const offset = (page - 1) * PAGE_SIZE;
  const credits = listCredits(PAGE_SIZE, offset);
  const openTotals = getOpenCreditTotals();
  const merchant = MERCHANT;
  const demo = isDemoMode();

  return (
    <OperationalPage
      activeHref="/fiados"
      title="Fiados"
      titleId="fiados-title"
      eyebrow="Libreta de la clientela"
      subtitle="Lo que te deben, no dinero recibido. Registra el abono cuando llegue el pago: la deuda baja y no se crea una venta nueva."
      actions={
        <Link href="/caja" className="mc-fiados-action">
          Anotar fiado en Caja
        </Link>
      }
      merchant={merchant.name}
      address={merchant.address}
      demo={demo}
      initial={(merchant.owner || merchant.name).trim().charAt(0).toUpperCase() || "M"}
      mainId="fiados-main"
      contentClassName="mc-fiados-page"
      focusTargetId="mc-fiados-ledger-title"
    >
      <section className="mc-op-kpis mc-fiados-kpis" aria-label="Resumen de fiados">
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Total fiado</p>
          <CurrencyAmount
            as="p"
            cents={openTotals.balanceCents}
            className="mc-op-kpi__value"
          />
          <p className="mc-op-kpi__note">Saldo vivo de todos los fiados abiertos</p>
        </article>
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Clientes con saldo</p>
          <p className="mc-op-kpi__value">{openTotals.customers}</p>
          <p className="mc-op-kpi__note">
            {openTotals.customers === 1
              ? "Una persona te debe"
              : "Personas que te deben"}
          </p>
        </article>
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Fiados abiertos</p>
          <p className="mc-op-kpi__value">{openTotals.count}</p>
          <p className="mc-op-kpi__note">Uno por venta anotada a fiado</p>
        </article>
      </section>

      <section
        className="mc-op-panel mc-fiados-ledger"
        aria-labelledby="mc-fiados-ledger-title"
      >
        <div className="mc-op-panel__head">
          <h2 id="mc-fiados-ledger-title" className="mc-op-panel__title">
            Saldos por cliente
          </h2>
          <p className="mc-op-panel__meta">
            {total === 0
              ? "Sin fiados registrados"
              : `${total} ${total === 1 ? "fiado" : "fiados"} · página ${page} de ${pageCount}`}
          </p>
        </div>

        {credits.length === 0 ? (
          <div className="mc-op-empty" role="status">
            <p className="mc-op-empty__title">Sin fiados pendientes</p>
            <p className="mc-op-empty__body">
              El fiado se anota al cerrar una venta en Caja: elige “A fiado” y el
              nombre de quien queda a deber. Aquí verás el saldo y podrás
              registrar abonos.
            </p>
            <div className="mc-op-empty__action">
              <Link href="/caja" className="mc-fiados-action">
                Ir a Caja
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="mc-op-list mc-fiados-list">
              {credits.map((credit) => (
                <FiadosRow key={credit.id} credit={credit} />
              ))}
            </ul>
            {pageCount > 1 ? <FiadosPager page={page} pageCount={pageCount} /> : null}
          </>
        )}
      </section>

      <p className="mc-fiados-note">
        Un abono reduce la deuda y no crea una venta nueva. Si fue en efectivo,
        suma al efectivo de hoy; digital o tarjeta quedan como abono declarado,
        sin verificación de pey. El fiado no se suma a la caja hasta que se cobra.
      </p>
    </OperationalPage>
  );
}
