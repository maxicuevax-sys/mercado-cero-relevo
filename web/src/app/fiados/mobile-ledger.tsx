import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, Store } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import brand from "@/assets/inicio/brand-shop-cream.svg";
import papelPicado from "@/assets/inicio/papel-picado.png";
import { CreditPayButton } from "@/components/fiados/credit-pay-button";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { MERCHANT } from "@/lib/config";
import { formatMxn } from "@/lib/format";
import type { Credit } from "@/lib/types";

const portraits = ["juan", "maria", "carlos", "elena", "ana"] as const;
const sample = [
  { name: "Juan", cents: 45000, portrait: "juan" },
  { name: "María", cents: 12000, portrait: "maria" },
  { name: "Carlos", cents: 10000, portrait: "carlos" },
  { name: "Doña Elena", cents: 8000, portrait: "elena" },
  { name: "Ana", cents: 7500, portrait: "ana" },
] as const;

const navigation = [
  { href: "/inicio", label: "Inicio", icon: "inicio" },
  { href: "/ventas", label: "Ventas", icon: "ventas" },
  { href: "/fiados", label: "Fiados", icon: "saldos" },
  { href: "/caja", label: "Caja", icon: "caja" },
  { href: "/metas", label: "Metas", icon: "metas" },
] as const;

function LedgerIcon({ name }: { name: (typeof navigation)[number]["icon"] | "historial" }) {
  const style = { "--fi-icon": `url("/assets/spec/fiados-icono-${name}.png")` } as CSSProperties;
  return <span aria-hidden="true" className="mc-fiados-mobile__icon" style={style} />;
}

function ledgerHref(query: string, history: boolean, practice: boolean) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (history) params.set("view", "history");
  if (practice) params.set("libreta", "practica");
  return params.size ? `/fiados?${params}` : "/fiados";
}

function RowContent({
  name, cents, portrait, status,
}: {
  name: string;
  cents: number;
  portrait: typeof portraits[number];
  status?: string;
}) {
  return (
    <>
      <Image src={`/assets/spec/fiados-retrato-${portrait}.png`} width={121} height={111}
        alt="" unoptimized className="mc-fiados-mobile__avatar" />
      <span className="mc-fiados-mobile__client">
        <span className="mc-fiados-mobile__name">{name}</span>
        {status ? <span className="mc-fiados-mobile__status">{status}</span> : null}
      </span>
      <CurrencyAmount cents={cents} className="mc-fiados-mobile__amount" />
      <ChevronRight className="mc-fiados-mobile__chevron" aria-hidden="true" />
    </>
  );
}

export function MobileLedger({
  credits, balance, demo, history, practice, query, offset, matchesQuery, pager,
}: {
  credits: Credit[];
  balance: number;
  demo: boolean;
  history: boolean;
  practice: boolean;
  query: string;
  offset: number;
  matchesQuery: (name: string) => boolean;
  pager: ReactNode;
}) {
  // La lámina ilustrativa solo se usa cuando no hay deudas reales que mostrar
  // (o cuando solo existe la semilla demo inicial intacta y no se abrió la libreta de práctica).
  const onlyDefaultSeed =
    credits.length === 1 &&
    credits[0].id.startsWith("demo_seed_") &&
    credits[0].balanceCents === credits[0].originalCents;
  const showSample = demo && (credits.length === 0 || onlyDefaultSeed) && !practice && !history;
  const examples = showSample ? sample.filter(({ name }) => matchesQuery(name)) : [];
  const empty = showSample ? examples.length === 0 : credits.length === 0;
  return (
    <div className="mc-fiados-mobile">
      <header className="mc-fiados-mobile__brandbar">
        <Link href="/inicio" prefetch={false} className="mc-fiados-mobile__brand">
          <Image src={brand} width={36} height={36} alt="" unoptimized />
          <span>Mercado<br />Cero</span>
        </Link>
        <div className="mc-fiados-mobile__merchant">
          <Store aria-hidden="true" />
          <div>
            <strong>{MERCHANT.name} <ChevronDown aria-hidden="true" /></strong>
            <small>{MERCHANT.address}</small>
          </div>
        </div>
        <Link href="/pendientes" prefetch={false} className="mc-fiados-mobile__bell" aria-label="Ver pendientes">
          <Bell aria-hidden="true" />
        </Link>
        {demo ? (
          <details className="mc-fiados-mobile__profile">
            <summary aria-label="Opciones de demostración">{MERCHANT.owner.charAt(0)}</summary>
            <div>
              <strong>{showSample ? "Muestra de diseño" : "Libreta de práctica"}</strong>
              <p>{showSample ? "Las cifras de la lámina son ilustrativas y no corresponden a tus registros." : "Aquí puedes consultar tus fiados de práctica y registrar abonos."}</p>
              <Link href={ledgerHref("", false, showSample)} prefetch={false}>
                {showSample ? "Abrir libreta de práctica" : "Ver muestra de diseño"}
              </Link>
            </div>
          </details>
        ) : (
          <span className="mc-fiados-mobile__profile-mark" aria-hidden="true">{MERCHANT.owner.charAt(0)}</span>
        )}
      </header>

      <div className="mc-fiados-mobile__sheet">
        <header className="mc-fiados-mobile__heading">
          <Link href="/inicio" prefetch={false} aria-label="Volver a Inicio"><ChevronLeft aria-hidden="true" /></Link>
          <h2>Fiados</h2>
          <Image src={papelPicado} width={488} height={102} alt="" unoptimized />
        </header>

        <nav className="mc-fiados-mobile__tabs" aria-label="Vista de fiados">
          <Link href={ledgerHref(query, false, practice)} aria-current={!history ? "page" : undefined}>
            <LedgerIcon name="saldos" />Saldos
          </Link>
          <Link href={ledgerHref(query, true, practice)} aria-current={history ? "page" : undefined}>
            <LedgerIcon name="historial" />Historial
          </Link>
        </nav>

        <form className="mc-fiados-mobile__search" role="search" action="/fiados">
          {history ? <input type="hidden" name="view" value="history" /> : null}
          {practice ? <input type="hidden" name="libreta" value="practica" /> : null}
          <button type="submit" aria-label="Buscar"><Search aria-hidden="true" /></button>
          <label className="sr-only" htmlFor="fiados-mobile-query">Buscar cliente</label>
          <input id="fiados-mobile-query" name="q" type="search" defaultValue={query}
            placeholder="Buscar cliente" autoComplete="off" />
          {query ? <Link href={ledgerHref("", history, practice)}>Limpiar</Link> : null}
        </form>

        <section className="mc-fiados-mobile__total" aria-labelledby="fiados-mobile-total">
          <Image src="/assets/spec/fiados-monedas.png" width={320} height={200} alt="" unoptimized />
          <div>
            <p id="fiados-mobile-total">Total por cobrar{showSample ? <span className="sr-only"> · Muestra ilustrativa</span> : null}</p>
            {showSample
              ? <p className="tabular-nums" data-sample>{formatMxn(112500)}</p>
              : <CurrencyAmount as="p" cents={balance} />}
          </div>
        </section>

        {empty ? (
          <p className="mc-fiados-mobile__empty" role="status">
            {query ? "Sin coincidencias" : history ? "Sin fiados saldados" : "Sin fiados pendientes"}
          </p>
        ) : (
          <ul className="mc-fiados-mobile__list" aria-label={showSample ? "Clientes de la muestra ilustrativa" : "Fiados por cliente"}>
            {showSample ? examples.map(({ name, cents, portrait }) => (
              <li key={portrait} className="mc-fiados-mobile__row">
                <details>
                  <summary className="mc-fiados-mobile__row-content">
                    <RowContent name={name} cents={cents} portrait={portrait} />
                  </summary>
                  <p className="mc-fiados-mobile__example">
                    Importe de la muestra. <Link href="/fiados?libreta=practica" prefetch={false}>Abrir libreta de práctica</Link>
                  </p>
                </details>
              </li>
            )) : credits.map((credit, index) => (
              <li key={credit.id} className="mc-fiados-mobile__row mc-fiados-mobile__row-content">
                <RowContent name={credit.customerName ?? "Cliente"} cents={credit.balanceCents}
                  portrait={portraits[(offset + index) % portraits.length]}
                  status={credit.status === "settled" || credit.balanceCents <= 0
                    ? "Saldado"
                    : credit.balanceCents < credit.originalCents
                      ? `Abonado: ${formatMxn(credit.originalCents - credit.balanceCents)}`
                      : "Sin abonos"} />
                <CreditPayButton credit={credit} />
              </li>
            ))}
          </ul>
        )}
        {showSample ? null : pager}

        <Link href="/fiados/nuevo" prefetch={false} className="mc-fiados-mobile__new">
          <Plus aria-hidden="true" />Nuevo fiado
        </Link>
      </div>

      <nav className="mc-fiados-mobile__nav" aria-label="Navegación principal">
        {navigation.map(({ href, label, icon }) => (
          <Link key={href} href={href} prefetch={false} aria-current={href === "/fiados" ? "page" : undefined}>
            <LedgerIcon name={icon} /><span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
