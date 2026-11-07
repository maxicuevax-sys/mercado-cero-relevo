import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  CreditCard,
  QrCode,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { CashCount } from "@/components/corte/cash-count";
import { ReadReceipt } from "@/components/corte/read-receipt";
import { differenceText } from "@/components/corte/money";
import { longDate } from "@/components/corte/history-format";
import { getCashStatus, listCashCloses } from "@/lib/cash";
import {
  countPendingOrders,
  getDailySummary,
  sumPendingOrderBalances,
} from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatMxn, formatTime } from "@/lib/format";
import type { CashClose } from "@/lib/types";
import registerArt from "@/assets/inicio/hero-registradora.png";
import { getDemoMethodTotals } from "./cash-methods";
import "./corte.css";
import "@/components/shell/ledger-parity.css";

export const metadata: Metadata = {
  title: "Corte de caja · Mercado Cero",
};

// El corte se lee con datos vivos en cada visita; nunca desde un snapshot.
export const instant = false;

function differenceTone(cents: number): string {
  if (cents === 0) return "mc-corte-difference--ok";
  return cents > 0
    ? "mc-corte-difference--extra"
    : "mc-corte-difference--missing";
}

function percentage(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 100);
}

function SavedClose({ close }: { close: CashClose }) {
  return (
    <div className="mc-corte-history__saved">
      <p className="mc-corte-history__version">
        Corte #{close.version} · {formatTime(close.createdAt)}
      </p>
      <dl className="mc-corte-history__rows">
        <div>
          <dt>Contado</dt>
          <dd>{formatMxn(close.countedCents)}</dd>
        </div>
        <div>
          <dt>Esperado con movimientos</dt>
          <dd>{formatMxn(close.expectedCents)}</dd>
        </div>
        <div>
          <dt>Diferencia</dt>
          <dd
            className={`mc-corte-difference ${differenceTone(
              close.differenceCents,
            )}`}
          >
            {differenceText(close.differenceCents)}
          </dd>
        </div>
        <div>
          <dt>Retiros</dt>
          <dd>{formatMxn(close.withdrawalsCents)}</dd>
        </div>
        <div>
          <dt>Base para mañana</dt>
          <dd>{formatMxn(close.baseNextCents)}</dd>
        </div>
        <div>
          <dt>Retiro adicional</dt>
          <dd>{formatMxn(close.withdrawalNextCents)}</dd>
        </div>
        <div>
          <dt>Efectivo del día (foto)</dt>
          <dd>{formatMxn(close.snapshotCashCents)}</dd>
        </div>
        <div>
          <dt>Fiado pendiente (foto)</dt>
          <dd>
            {close.snapshotKnown
              ? formatMxn(close.snapshotCreditCents)
              : "No registrado"}
          </dd>
        </div>
      </dl>
      {close.reason ? (
        <p className="mc-corte-history__reason">
          Motivo de la corrección: <strong>{close.reason}</strong>
        </p>
      ) : null}
      <p className="mc-corte-history__note">
        Esta foto no cambia si entran ventas o abonos después del cierre.
      </p>
    </div>
  );
}

export default async function CortePage() {
  await connection();
  const status = getCashStatus();
  const saved = status.saved;
  const history = listCashCloses(status.date, 6);
  const pendingCount = countPendingOrders();
  const pendingCents = sumPendingOrderBalances();
  const summary = getDailySummary();
  const demo = isDemoMode();
  const cashTodayCents = status.cashSalesCents + status.cashCreditCents;

  // En demo se suma el desglose simulado aparte para que la pantalla no
  // confunda "sin cobros" con "no hay datos". La nota lo dice explícitamente.
  const demoMethods = getDemoMethodTotals();
  const methods: Record<string, number> = { ...summary.methods };
  for (const [method, cents] of Object.entries(demoMethods.methods)) {
    methods[method] = (methods[method] ?? 0) + cents;
  }

  const knownMethods = new Set(["cash", "card", "codi"]);
  const otherCents = Object.entries(methods)
    .filter(([method]) => !knownMethods.has(method))
    .reduce((total, [, cents]) => total + (Number.isFinite(cents) ? cents : 0), 0);

  const methodRows = [
    { key: "cash", label: "Efectivo", Icon: Banknote, cents: methods.cash ?? 0 },
    { key: "card", label: "Tarjeta", Icon: CreditCard, cents: methods.card ?? 0 },
    { key: "codi", label: "Pago QR", Icon: QrCode, cents: methods.codi ?? 0 },
    ...(otherCents > 0
      ? [{ key: "other", label: "Otros", Icon: Wallet, cents: otherCents }]
      : []),
  ];
  const methodTotal = methodRows.reduce((total, row) => total + row.cents, 0);
  const collectedCents = methodTotal;

  const receiptSpeech = `Efectivo en caja: ${formatMxn(
    status.expectedCents,
  )}. Cobros digitales verificados: ${formatMxn(
    summary.verifiedDigitalCents,
  )}. Ventas del día: ${formatMxn(summary.salesCents)}. Gastos: ${formatMxn(
    status.expensesCents,
  )}.`;

  return (
    <OperationalPage
      activeHref="/corte"
      title="Corte de caja"
      titleId="corte-title"
      actions={
        <Link
          className="mc-parity-back"
          href="/inicio"
          aria-label="Volver a Inicio"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
      }
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      mainId="corte-main"
      contentClassName="mc-corte-page"
      focusTargetId="corte-title"
    >
      <details className="mc-corte-chip">
        <summary className="mc-corte-chip__summary">
          <CalendarDays className="mc-corte-chip__calendar" aria-hidden="true" />
          <span className="mc-corte-chip__label">
            Hoy, <time dateTime={status.date}>{longDate(status.date)}</time>
          </span>
          <ChevronDown className="mc-corte-chip__chevron" aria-hidden="true" />
        </summary>
        <div className="mc-corte-chip__panel">
          <p>
            <strong>Estás viendo el corte de hoy.</strong> La caja solo
            mantiene datos vivos del día en curso; los cierres anteriores se
            consultan en el historial.
          </p>
          <Link className="mc-corte-chip__link" href="/corte/historial">
            Abrir historial de cortes
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      </details>

      <section className="mc-corte-hero" aria-labelledby="mc-corte-total-label">
        <Image
          src={registerArt}
          alt=""
          aria-hidden="true"
          className="mc-corte-hero__art"
          sizes="(max-width: 767px) 132px, 260px"
        />
        <div className="mc-corte-hero__copy">
          <p id="mc-corte-total-label" className="mc-corte-hero__label">
            Total vendido
          </p>
          <CurrencyAmount
            as="p"
            cents={summary.salesCents}
            className="mc-corte-hero__value"
          />
        </div>
      </section>

      <section className="mc-corte-brief" aria-labelledby="mc-corte-brief-title">
        <div className="mc-corte-brief__head">
          <h2 id="mc-corte-brief-title" className="mc-corte-brief__title">
            Resumen del corte
          </h2>
          <Link href="/corte/historial" className="mc-corte-brief__history">
            Historial de cortes
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
        <dl className="mc-corte-brief__grid">
          <div className="mc-corte-brief__item">
            <dt>
              <ShoppingBag aria-hidden="true" />
              <span>Ventas del día</span>
            </dt>
            <dd>{formatMxn(summary.salesCents)}</dd>
          </div>
          <div className="mc-corte-brief__item">
            <dt>
              <Coins aria-hidden="true" />
              <span>Cobros</span>
            </dt>
            <dd>{formatMxn(collectedCents)}</dd>
          </div>
          <div className="mc-corte-brief__item">
            <dt>
              <ReceiptText aria-hidden="true" />
              <span>Tickets</span>
            </dt>
            <dd>{summary.paidOrderCount}</dd>
          </div>
        </dl>
        <p className="mc-corte-brief__note">
          Tickets cuenta los pedidos cobrados hoy. Cobros suma los pagos
          registrados; el fiado pendiente no es dinero cobrado.
          {demo ? " En demo se incluyen cobros simulados, nunca dinero real." : ""}
        </p>
      </section>

      <section
        className="mc-corte-methods"
        aria-labelledby="mc-corte-methods-title"
      >
        <h2 id="mc-corte-methods-title" className="mc-corte-methods__title">
          Métodos de pago
        </h2>
        <ul className="mc-corte-methods__list">
          {methodRows.map(({ key, label, Icon, cents }) => {
            const pct = percentage(cents, methodTotal);
            return (
              <li key={key} className="mc-corte-method">
                <span
                  className={`mc-corte-method__icon mc-corte-method__icon--${key}`}
                  aria-hidden="true"
                >
                  <Icon />
                </span>
                <span className="mc-corte-method__label">{label}</span>
                <span className="mc-corte-method__amount">
                  {formatMxn(cents)}
                </span>
                <span className="mc-corte-method__pct">
                  {pct === null ? (
                    <span aria-hidden="true">—</span>
                  ) : (
                    `${pct}%`
                  )}
                  <span className="sr-only">
                    {pct === null
                      ? " Sin cobros registrados con este método"
                      : " del total cobrado"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {demo ? (
          <p className="mc-corte-methods__note">
            Modo demo: los importes incluyen cobros simulados. No representan
            dinero real y no se marcan como pagados por esta pantalla.
          </p>
        ) : null}
      </section>

      <details className="mc-corte-close">
        <summary className="mc-corte-close__summary">
          <CheckCircle2 aria-hidden="true" />
          <span>{saved ? "Corregir corte" : "Cerrar corte"}</span>
        </summary>
        <div className="mc-corte-close__body">
          <p id="mc-corte-start-help" className="mc-corte-close__help">
            <strong>PASO 1</strong> Cuenta el efectivo y revisa gastos, retiros
            y base. Nada se guarda hasta que confirmes el corte.
          </p>
          <CashCount initialStatus={status} titleId="mc-corte-tally-title" />
        </div>
      </details>

      <details className="mc-corte-detail">
        <summary>Movimientos, gastos y cortes de hoy{demo ? " · Demo" : ""}</summary>
        <div className="mc-corte-detail__body">
          <ReadReceipt text={receiptSpeech} />
          <dl className="mc-corte-detail__rows">
            <div>
              <dt>Efectivo en caja</dt>
              <dd>{formatMxn(status.expectedCents)}</dd>
            </div>
            <div>
              <dt>Cobros digitales verificados</dt>
              <dd>{formatMxn(summary.verifiedDigitalCents)}</dd>
            </div>
            <div>
              <dt>Efectivo recibido hoy</dt>
              <dd>{formatMxn(cashTodayCents)}</dd>
            </div>
            <div>
              <dt>Base inicial</dt>
              <dd>{formatMxn(status.openingCents)}</dd>
            </div>
            <div>
              <dt>Gastos del día</dt>
              <dd className={status.expensesCents > 0 ? "mc-corte-summary__out" : undefined}>
                {formatMxn(0 - status.expensesCents)}
              </dd>
            </div>
            <div>
              <dt>Retiros</dt>
              <dd>{formatMxn(status.withdrawalsCents)}</dd>
            </div>
            <div>
              <dt>Digital declarado, sin verificar</dt>
              <dd>{formatMxn(summary.declaredDigitalCents)}</dd>
            </div>
            <div>
              <dt>Fiado pendiente de cobro</dt>
              <dd>{formatMxn(summary.creditCents)}</dd>
            </div>
          </dl>
          <p className="mc-corte-hint">
            {demo
              ? "Modo demo: los pagos simulados no cuentan como dinero real. "
              : ""}
            El digital verificado no es efectivo de cajón. Los abonos en
            efectivo entran al esperado; el fiado pendiente no. El saldo se
            recalcula al confirmar.
          </p>
          <p className="mc-corte-hint">
            {pendingCount} cobros por confirmar por {formatMxn(pendingCents)}.{" "}
            <Link href="/pendientes">Ver pendientes</Link>
          </p>
          <h2 className="mc-corte-detail__title">Cortes de hoy</h2>
          {saved ? (
            <SavedClose close={saved} />
          ) : (
            <p className="mc-corte-history__empty">Sin corte guardado hoy.</p>
          )}
          {history
            .filter((item) => item.id !== saved?.id)
            .map((item) => (
              <div key={item.id}>
                <SavedClose close={item} />
              </div>
            ))}
        </div>
      </details>
    </OperationalPage>
  );
}
