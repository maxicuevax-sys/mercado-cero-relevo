import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { CreditPayButton } from "@/components/fiados/credit-pay-button";
import { getOpenCreditTotals, listCredits } from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatMxn } from "@/lib/format";
import { DAY_MS, mexicoDateKey } from "@/lib/mexico-date";
import type { Credit, CreditStatus } from "@/lib/types";
import libretaIcon from "@/assets/brand/iconos/transparent/libreta.png";
import tiendaIcon from "@/assets/brand/iconos/transparent/tienda.png";
import listaIcon from "@/assets/brand/iconos/transparent/lista.png";
import ahorroArt from "@/assets/brand/ilustraciones/transparent/ahorro.png";
import papelPicadoArt from "@/assets/inicio/papel-picado.png";
import { MobileLedger } from "./mobile-ledger";
import "./fiados.css";
import "@/components/shell/ledger-parity.css";
import "./mobile-ledger.css";

export const metadata: Metadata = {
  title: "Fiados · Mercado Cero",
};

// El saldo vivo no se puede servir desde un snapshot de build.
export const instant = false;

const PAGE_SIZE = 20;

const MEDALLIONS = [libretaIcon, tiendaIcon, listaIcon];
const MEDALLION_TONES = ["green", "saffron", "terracotta"];

const ageFormat = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
});

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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

function stampLabel(status: CreditStatus, settled: boolean): string {
  if (settled || status === "settled") return "Saldado";
  if (status === "partial") return "Abono parcial";
  return "Pendiente";
}

function pagerHref(page: number, query: string, history = false, practice = false): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (history) params.set("view", "history");
  if (practice) params.set("libreta", "practica");
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/fiados?${suffix}` : "/fiados";
}

function FiadosRow({ credit, index }: { credit: Credit; index: number }) {
  const settled = credit.status === "settled" || credit.balanceCents <= 0;
  const paidCents = Math.max(0, credit.originalCents - credit.balanceCents);
  const key = createdAtKey(credit.createdAt);
  const since = key ? `${ageFormat.format(new Date(key + "T12:00:00"))}` : null;
  const slot = ((index % MEDALLION_TONES.length) + MEDALLION_TONES.length) %
    MEDALLION_TONES.length;
  const tone = MEDALLION_TONES[slot];
  const medallion = MEDALLIONS[slot];
  const stampTone = settled
    ? "saldado"
    : credit.status === "partial"
      ? "parcial"
      : "pendiente";

  return (
    <li className={`mc-fiados-row mc-fiados-row--${tone}${settled ? " mc-fiados-row--settled" : ""}`}>
      <span className="mc-fiados-row__medallion" aria-hidden="true">
        <Image src={medallion} alt="" sizes="24px" className="mc-fiados-row__medallion-img" />
      </span>

      <div className="mc-fiados-row__main">
        <div className="mc-fiados-row__head">
          <h3 className="mc-fiados-row__name">{credit.customerName ?? "Cliente"}</h3>
          <span className={`mc-fiados-stamp mc-fiados-stamp--${stampTone}`}>
            {stampLabel(credit.status, settled)}
          </span>
        </div>
        <p className="mc-fiados-row__meta">
          {paidCents > 0 ? `Abonado: ${formatMxn(paidCents)}` : "Sin abonos"}
          <span className="sr-only"> {since ? `Desde ${since}` : ageLabel(credit.createdAt)}</span>
        </p>
      </div>

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
    </li>
  );
}

function FiadosPager({
  page,
  pageCount,
  query,
  history,
  practice = false,
}: {
  page: number;
  pageCount: number;
  query: string;
  history: boolean;
  practice?: boolean;
}) {
  return (
    <nav className="mc-fiados-pager" aria-label="Páginas de fiados">
      {page > 1 ? (
        <Link className="mc-fiados-pager__link" href={pagerHref(page - 1, query, history, practice)} rel="prev">
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Link>
      ) : (
        <span className="mc-fiados-pager__link mc-fiados-pager__link--off" aria-disabled="true">
          <ChevronLeft aria-hidden="true" />
          Anterior
        </span>
      )}
      <p className="mc-fiados-pager__status">
        Página {page} de {pageCount}
      </p>
      {page < pageCount ? (
        <Link className="mc-fiados-pager__link" href={pagerHref(page + 1, query, history, practice)} rel="next">
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span className="mc-fiados-pager__link mc-fiados-pager__link--off" aria-disabled="true">
          Siguiente
          <ChevronRight aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

export default async function FiadosPage({ searchParams }: {
  searchParams: Promise<{ page?: string; q?: string; view?: string; libreta?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const requested = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const history = params.view === "history";
  const practice = params.libreta === "practica";
  const needle = normalize(query);
  const matchesQuery = (name: string) => !needle || normalize(name).includes(needle);
  const matches = listCredits().filter((credit) => {
    const settled = credit.status === "settled" || credit.balanceCents <= 0;
    return settled === history && matchesQuery(credit.customerName ?? "");
  });
  const total = matches.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pageCount);
  const offset = (page - 1) * PAGE_SIZE;
  const credits = matches.slice(offset, offset + PAGE_SIZE);
  const openTotals = getOpenCreditTotals();
  const demo = isDemoMode();
  return (
    <OperationalPage activeHref="/fiados" title="Fiados" titleId="fiados-title"
      actions={<Link className="mc-parity-back" href="/inicio" aria-label="Volver a Inicio"><ArrowLeft aria-hidden="true" /></Link>}
      merchant={MERCHANT.name} address={MERCHANT.address} demo={demo}
      mainId="fiados-main" contentClassName="mc-fiados-page" focusTargetId="fiados-main">
      <MobileLedger credits={credits} balance={openTotals.balanceCents} demo={demo}
        history={history} practice={practice} query={query} offset={offset} matchesQuery={matchesQuery}
        pager={pageCount > 1 ? <FiadosPager page={page} pageCount={pageCount} query={query} history={history} practice={practice} /> : null} />
      <div className="mc-fiados-desktop">
      <Image src={papelPicadoArt} alt="" aria-hidden="true"
        className="mc-fiados-page__picado" sizes="(max-width: 767px) 80px, 132px" />
      <nav className="mc-fiados-tabs" aria-label="Vista de fiados">
        <Link href={pagerHref(1, query)} aria-current={!history ? "page" : undefined}>Por cobrar ({openTotals.count})</Link>
        <Link href={pagerHref(1, query, true)} aria-current={history ? "page" : undefined}>Historial</Link>
      </nav>
      <details className="mc-fiados-tools" open={query ? true : undefined}>
        <summary><Search aria-hidden="true" /><span className="sr-only">Buscar cliente y ver total por cobrar</span></summary>
        <section className="mc-fiados-total" aria-labelledby="mc-fiados-total-label">
          <Image src={ahorroArt} alt="" aria-hidden="true" className="mc-fiados-total__art" sizes="56px" />
          <div className="mc-fiados-total__copy">
            <p id="mc-fiados-total-label" className="mc-fiados-total__label">Total por cobrar</p>
            <CurrencyAmount as="p" cents={openTotals.balanceCents} className="mc-fiados-total__value" />
          </div>
        </section>
        <form className="mc-fiados-search" role="search" action="/fiados" method="get">
          {history ? <input type="hidden" name="view" value="history" /> : null}
          <button type="submit" className="mc-fiados-search__submit" aria-label="Buscar"><Search aria-hidden="true" /></button>
          <label className="sr-only" htmlFor="mc-fiados-search">Buscar cliente</label>
          <input id="mc-fiados-search" className="mc-fiados-search__input" type="search" name="q" defaultValue={query} placeholder="Buscar cliente" autoComplete="off" />
          {query ? <Link className="mc-fiados-search__clear" href={pagerHref(1, "", history)}>Limpiar</Link> : null}
        </form>
      </details>
      <section className="mc-fiados-ledger" aria-labelledby="mc-fiados-ledger-title">
        <h2 id="mc-fiados-ledger-title" className="sr-only">{history ? "Fiados saldados" : "Saldos por cliente"}</h2>
        {credits.length === 0 ? (
          <div className="mc-op-empty mc-fiados-empty" role="status">
            <p className="mc-op-empty__title">{query ? "Sin coincidencias" : history ? "Sin fiados saldados" : "Sin fiados pendientes"}</p>
            <p className="mc-op-empty__body">{query ? `No encontramos un cliente que coincida con ${query}.` : history ? "Los fiados que termines de cobrar aparecen aquí." : "Anota una venta a fiado desde Caja para llevar su saldo y registrar abonos."}</p>
          </div>
        ) : (
          <ul className="mc-fiados-list">
            {credits.map((credit, index) => <FiadosRow key={credit.id} credit={credit} index={offset + index} />)}
          </ul>
        )}
        {pageCount > 1 ? <FiadosPager page={page} pageCount={pageCount} query={query} history={history} /> : null}
        <div className="mc-fiados-ledger__foot">
          <Link href="/caja" className="mc-fiados-new"><Plus aria-hidden="true" />Nuevo fiado</Link>
        </div>
      </section>
      <details className="mc-fiados-explanation">
        <summary>Sobre los saldos{demo ? " · Demo" : ""}</summary>
        <p className="mc-fiados-note">{openTotals.customers} clientes · {openTotals.count} fiados abiertos. Lo que te deben no es dinero recibido. Un abono reduce la deuda y no crea una venta nueva. Si fue en efectivo, suma al efectivo de hoy; digital o tarjeta quedan como abono declarado, sin verificación de pey.</p>
      </details>
      </div>
    </OperationalPage>
  );
}
