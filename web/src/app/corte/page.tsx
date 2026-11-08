import { withPilotPage } from "../../lib/auth/pilot-page";
import type { Metadata } from "next";
import Image from "next/image";
import registerNative from "@/assets/definitive-a/register.png";
import { ArrowLeft, Banknote, CalendarDays, CheckCircle2, CreditCard, QrCode } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { CashCount } from "@/components/corte/cash-count";
import { ReadReceipt } from "@/components/corte/read-receipt";
import { differenceText } from "@/components/corte/money";
import { getCashClose, getCashStatus, listCashCloses } from "@/lib/cash";
import {
  countPendingOrders,
  getDailySummary,
  sumPendingOrderBalances,
} from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatDayMonth, formatMxn, formatTime } from "@/lib/format";
import type { CashClose } from "@/lib/types";
import "./corte.css";
import "@/components/shell/ledger-parity.css";

export const metadata: Metadata = {
  title: "Corte de caja · Trangui",
};

export const instant = false;

function differenceTone(cents: number): string {
  if (cents === 0) return "mc-corte-difference--ok";
  return cents > 0 ? "mc-corte-difference--extra" : "mc-corte-difference--missing";
}

function SavedClose({ close }: { close: CashClose }) {
  return (
    <div className="mc-corte-history__saved">
      <p className="mc-corte-history__version">
        Corte #{close.version} · {formatTime(close.createdAt)}
      </p>
      <dl className="mc-corte-history__rows">
        <div><dt>Contado</dt><dd>{formatMxn(close.countedCents)}</dd></div>
        <div><dt>Esperado con movimientos</dt><dd>{formatMxn(close.expectedCents)}</dd></div>
        <div>
          <dt>Diferencia</dt>
          <dd className={`mc-corte-difference ${differenceTone(close.differenceCents)}`}>
            {differenceText(close.differenceCents)}
          </dd>
        </div>
        <div><dt>Retiros</dt><dd>{formatMxn(close.withdrawalsCents)}</dd></div>
        <div><dt>Base para mañana</dt><dd>{formatMxn(close.baseNextCents)}</dd></div>
        <div><dt>Retiro adicional</dt><dd>{formatMxn(close.withdrawalNextCents)}</dd></div>
        <div><dt>Efectivo del día (foto)</dt><dd>{formatMxn(close.snapshotCashCents)}</dd></div>
        <div><dt>Fiado pendiente (foto)</dt><dd>{close.snapshotKnown ? formatMxn(close.snapshotCreditCents) : "No registrado"}</dd></div>
      </dl>
      {close.reason ? (
        <p className="mc-corte-history__reason">Motivo de la corrección: <strong>{close.reason}</strong></p>
      ) : null}
      <p className="mc-corte-history__note">El corte guardado conserva estas cifras aunque después entren ventas o abonos.</p>
    </div>
  );
}

async function CortePage() {
  await connection();
  const status = getCashStatus();
  const saved = getCashClose(status.date);
  const history = listCashCloses(status.date, 6);
  const pendingCount = countPendingOrders();
  const pendingCents = sumPendingOrderBalances();
  const summary = getDailySummary();
  const demo = isDemoMode();
  const cashTodayCents = status.cashSalesCents + status.cashCreditCents;
  const receiptSpeech = `Efectivo en caja: ${formatMxn(status.expectedCents)}. Cobros digitales verificados: ${formatMxn(summary.verifiedDigitalCents)}. Ventas del día: ${formatMxn(summary.salesCents)}. Gastos: ${formatMxn(status.expensesCents)}.`;

  const methods = summary.methods ?? {};
  const cashCents = methods.cash ?? summary.cashCents;
  const cardCents = methods.card ?? 0;
  const qrCents = methods.qr ?? methods.digital ?? summary.verifiedDigitalCents;
  const methodTotal = Math.max(1, cashCents + cardCents + qrCents);
  const methodRows = [
    { key: "cash", label: "Efectivo", cents: cashCents, Icon: Banknote },
    { key: "card", label: "Tarjeta", cents: cardCents, Icon: CreditCard },
    { key: "qr", label: "Pago QR", cents: qrCents, Icon: QrCode },
  ];
  const tickets = summary.orderCount;

  return (
    <OperationalPage
      activeHref="/corte"
      title="Corte de caja"
      titleId="corte-title"
      actions={<Link className="mc-parity-back" href="/inicio" aria-label="Volver a Inicio"><ArrowLeft aria-hidden="true" /></Link>}
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      mainId="corte-main"
      contentClassName="mc-corte-page"
      focusTargetId="corte-title"
    >
      <div className="mc-corte-date">
        <CalendarDays aria-hidden="true" />
        <time dateTime={status.date}>Hoy, {formatDayMonth(status.date)}</time>
      </div>

      <section className="mc-corte-v2-hero" aria-label="Total vendido">
        <div className="mc-corte-v2-hero__art">
          <Image src={registerNative} alt="" aria-hidden="true" sizes="150px" />
        </div>
        <div>
          <p>Total vendido</p>
          <CurrencyAmount as="p" cents={summary.salesCents} />
        </div>
      </section>

      <section className="mc-corte-v2-card" aria-labelledby="corte-resumen-title">
        <h2 id="corte-resumen-title">Resumen del corte</h2>
        <dl className="mc-corte-v2-summary">
          <div><dt>Ventas del día</dt><dd>{formatMxn(summary.salesCents)}</dd></div>
          <div><dt>Cobros</dt><dd>{formatMxn(summary.salesCents)}</dd></div>
          <div><dt>Tickets</dt><dd>{tickets}</dd></div>
        </dl>
      </section>

      <section className="mc-corte-v2-card" aria-labelledby="corte-metodos-title">
        <h2 id="corte-metodos-title">Métodos de pago</h2>
        <ul className="mc-corte-v2-methods">
          {methodRows.map(({ key, label, cents, Icon }) => (
            <li key={key}>
              <span className="mc-corte-v2-method-icon"><Icon aria-hidden="true" /></span>
              <span>{label}</span>
              <strong>{formatMxn(cents)}</strong>
              <span className="mc-corte-v2-method-pct">{Math.round((cents / methodTotal) * 100)}%</span>
            </li>
          ))}
        </ul>
      </section>

      <details className="mc-corte-v2-count">
        <summary className="mc-corte-v2-close">
          <CheckCircle2 aria-hidden="true" />
          Cerrar corte
        </summary>
        <CashCount initialStatus={status} titleId="mc-corte-tally-title" />
      </details>

      <details className="mc-corte-detail">
        <summary>Ver historial y movimientos{demo ? " · Demo" : ""}</summary>
        <ReadReceipt text={receiptSpeech} />
        <dl className="mc-corte-summary__rows">
          <div><dt>Efectivo recibido hoy</dt><dd>{formatMxn(cashTodayCents)}</dd></div>
          <div><dt>Base inicial</dt><dd>{formatMxn(status.openingCents)}</dd></div>
          <div><dt>Digital declarado, sin verificar</dt><dd>{formatMxn(summary.declaredDigitalCents)}</dd></div>
          <div><dt>Retiros</dt><dd>{formatMxn(status.withdrawalsCents)}</dd></div>
        </dl>
        <p className="mc-corte-hint">{demo ? "Modo demo: los pagos simulados no cuentan como dinero real. " : ""}El digital verificado no es efectivo de cajón. Los abonos en efectivo entran al esperado; el fiado pendiente no. El saldo se recalcula al confirmar.</p>
        <p className="mc-corte-hint">{pendingCount} cobros por confirmar por {formatMxn(pendingCents)}. <Link href="/pendientes">Ver pendientes</Link></p>
        <h2 className="mc-op-panel__title">Cortes de hoy</h2>
        {saved ? <SavedClose close={saved} /> : <p className="mc-corte-history__empty">Sin corte guardado hoy.</p>}
        {history.slice(1).map((item) => <div key={item.id}><SavedClose close={item} /></div>)}
      </details>

      <p className="mc-corte-history-link">
        <Link href="/movimientos?filtro=pagados">Ver pagos CoDi</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/corte/historial">Ver historial de cortes</Link>
      </p>
    </OperationalPage>
  );
}


export default withPilotPage(CortePage);
