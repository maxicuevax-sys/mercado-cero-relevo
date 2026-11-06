import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { CreditPayButton } from "@/components/fiados/credit-pay-button";
import { countCredits, getOpenCreditTotals, listCredits } from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatMxn } from "@/lib/format";
import { DAY_MS, mexicoDateKey } from "@/lib/mexico-date";
import type { Credit, CreditStatus } from "@/lib/types";
import ahorroArt from "@/assets/brand/ilustraciones/transparent/ahorro.png";
import papelPicadoArt from "@/assets/inicio/papel-picado.png";
import iconLibreta from "@/assets/brand/iconos/transparent/libreta.png";
import iconCamion from "@/assets/brand/iconos/transparent/camion.png";
import iconLista from "@/assets/brand/iconos/transparent/lista.png";
import "./fiados.css";

export const metadata: Metadata = {
  title: "Fiados · Mercado Cero",
};

// El saldo vivo no se puede servir desde un snapshot de build.
export const instant = false;

const PAGE_SIZE = 20;

/**
 * La libreta rota tres medallones de marca y tres fondos pastel del sistema
 * (verde/maíz/terracota), igual que la iconografía de Inicio. Se alterna por
 * índice absoluto (offset + fila) para que al paginar no se repita el mismo.
 */
const MEDALLIONS = [iconLibreta, iconCamion, iconLista];
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

function pagerHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
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
        <Image
          src={medallion}
          alt=""
          className="mc-fiados-row__medallion-img"
          sizes="48px"
        />
      </span>

      <div className="mc-fiados-row__main">
        <div className="mc-fiados-row__head">
          <h3 className="mc-fiados-row__name">{credit.customerName ?? "Cliente"}</h3>
          <span className={`mc-fiados-stamp mc-fiados-stamp--${stampTone}`}>
            {stampLabel(credit.status, settled)}
          </span>
        </div>
        <p className="mc-fiados-row__meta">
          {since ? `Desde ${since}` : ageLabel(credit.createdAt)}
          {" · "}
          {paidCents > 0 ? `abonado ${formatMxn(paidCents)}` : "sin abonos"}
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
}: {
  page: number;
  pageCount: number;
  query: string;
}) {
  return (
    <nav className="mc-fiados-pager" aria-label="Páginas de fiados">
      {page > 1 ? (
        <Link className="mc-fiados-pager__link" href={pagerHref(page - 1, query)} rel="prev">
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
        <Link className="mc-fiados-pager__link" href={pagerHref(page + 1, query)} rel="next">
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

export default async function FiadosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const requested =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let total: number;
  let credits: Credit[];
  let page: number;
  let pageCount: number;
  let offset: number;

  if (query) {
    // La búsqueda recorre la libreta completa y pagina el resultado en el
    // servidor; el contrato histórico de `listCredits()` permite el listado
    // sin límite cuando no hay paginación.
    const needle = normalize(query);
    const matches = listCredits().filter((credit) =>
      normalize(credit.customerName ?? "").includes(needle),
    );
    total = matches.length;
    pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(requested, pageCount);
    offset = (page - 1) * PAGE_SIZE;
    credits = matches.slice(offset, offset + PAGE_SIZE);
  } else {
    total = countCredits();
    pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(requested, pageCount);
    offset = (page - 1) * PAGE_SIZE;
    credits = listCredits(PAGE_SIZE, offset);
  }

  const openTotals = getOpenCreditTotals();
  const merchant = MERCHANT;
  const demo = isDemoMode();
  const customersLabel =
    openTotals.customers === 1 ? "1 cliente" : `${openTotals.customers} clientes`;
  const openLabel = openTotals.count === 1 ? "1 fiado abierto" : `${openTotals.count} fiados abiertos`;

  return (
    <OperationalPage
      activeHref="/fiados"
      title="Fiados"
      titleId="fiados-title"
      eyebrow="Libreta de la clientela"
      merchant={merchant.name}
      address={merchant.address}
      demo={demo}
      initial={(merchant.owner || merchant.name).trim().charAt(0).toUpperCase() || "M"}
      mainId="fiados-main"
      contentClassName="mc-fiados-page"
      focusTargetId="mc-fiados-ledger-title"
    >
      {/* Patrón decorativo en la esquina superior derecha del contenido,
          nunca como fondo: mismo recurso que Inicio. */}
      <Image
        src={papelPicadoArt}
        alt=""
        aria-hidden="true"
        className="mc-fiados-page__picado"
        sizes="(max-width: 479px) 148px, (max-width: 767px) 130px, 280px"
      />

      <section
        className="mc-fiados-total"
        aria-labelledby="mc-fiados-total-label"
        aria-describedby="mc-fiados-total-meta"
      >
        <Image
          src={ahorroArt}
          alt=""
          aria-hidden="true"
          className="mc-fiados-total__art"
          sizes="(max-width: 767px) 92px, 140px"
        />
        <div className="mc-fiados-total__copy">
          <p id="mc-fiados-total-label" className="mc-fiados-total__label">
            Total por cobrar
          </p>
          <CurrencyAmount
            as="p"
            cents={openTotals.balanceCents}
            className="mc-fiados-total__value"
          />
        </div>
      </section>

      <form className="mc-fiados-search" role="search" action="/fiados" method="get">
        <button type="submit" className="mc-fiados-search__submit" aria-label="Buscar">
          <Search aria-hidden="true" />
        </button>
        <label className="sr-only" htmlFor="mc-fiados-search">
          Buscar cliente
        </label>
        <input
          id="mc-fiados-search"
          className="mc-fiados-search__input"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Buscar cliente"
          autoComplete="off"
        />
        {query ? (
          <Link className="mc-fiados-search__clear" href="/fiados">
            Limpiar
          </Link>
        ) : null}
      </form>

      <section className="mc-fiados-ledger" aria-labelledby="mc-fiados-ledger-title">
        <div className="mc-fiados-ledger__head">
          <h2 id="mc-fiados-ledger-title" className="mc-fiados-ledger__title" tabIndex={-1}>
            Saldos por cliente
          </h2>
          <p className="mc-fiados-ledger__meta">
            {query
              ? `${total} ${total === 1 ? "coincidencia" : "coincidencias"} para “${query}”`
              : total === 0
                ? "Sin fiados registrados"
                : `${total} ${total === 1 ? "fiado" : "fiados"} · página ${page} de ${pageCount}`}
          </p>
        </div>

        {credits.length === 0 ? (
          <div className="mc-op-empty mc-fiados-empty" role="status">
            <Image
              src={iconLibreta}
              alt=""
              aria-hidden="true"
              className="mc-fiados-empty__art"
              sizes="96px"
            />
            {query ? (
              <>
                <p className="mc-op-empty__title">Sin coincidencias</p>
                <p className="mc-op-empty__body">
                  No encontramos un cliente que coincida con “{query}”. Revisa el
                  nombre o mira la libreta completa.
                </p>
                <div className="mc-op-empty__action">
                  <Link href="/fiados" className="mc-fiados-cta">
                    Ver toda la libreta
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mc-op-empty__title">Sin fiados pendientes</p>
                <p className="mc-op-empty__body">
                  El fiado se anota al cerrar una venta en Caja: elige “A fiado” y
                  el nombre de quien queda a deber. Aquí verás el saldo y podrás
                  registrar abonos.
                </p>
                <div className="mc-op-empty__action">
                  <Link href="/caja" className="mc-fiados-cta">
                    <Plus aria-hidden="true" />
                    Nuevo fiado
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <ul className="mc-fiados-list">
              {credits.map((credit, rowIndex) => (
                <FiadosRow
                  key={credit.id}
                  credit={credit}
                  index={offset + rowIndex}
                />
              ))}
            </ul>
            {pageCount > 1 ? (
              <FiadosPager page={page} pageCount={pageCount} query={query} />
            ) : null}
          </>
        )}

        <div className="mc-fiados-ledger__foot">
          <Link href="/caja" className="mc-fiados-new">
            <Plus aria-hidden="true" />
            Nuevo fiado
          </Link>
          <p className="mc-fiados-ledger__foot-note">Se anota desde Caja.</p>
        </div>
      </section>

      <p className="mc-fiados-note">
        <span id="mc-fiados-total-meta" className="mc-fiados-note__total">
          {customersLabel} · {openLabel}
        </span>
        Lo que te deben no es dinero recibido. Un abono reduce la deuda y no crea una venta nueva. Si fue en efectivo,
        suma al efectivo de hoy; digital o tarjeta quedan como abono declarado,
        sin verificación de pey. El fiado no se suma a la caja hasta que se cobra.
      </p>
    </OperationalPage>
  );
}
