import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CashCount } from "@/components/corte/cash-count";
import { differenceText } from "@/components/corte/money";
import { getCashClose, getCashStatus, listCashCloses } from "@/lib/cash";
import { countPendingOrders, sumPendingOrderBalances } from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatActivityDate, formatMxn, formatTime } from "@/lib/format";
import type { CashClose } from "@/lib/types";
import "./corte.css";

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
          <dd className={`mc-corte-difference ${differenceTone(close.differenceCents)}`}>
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
  const saved = getCashClose(status.date);
  const history = listCashCloses(status.date, 6);
  const pendingCount = countPendingOrders();
  const pendingCents = sumPendingOrderBalances();
  const merchant = MERCHANT;
  const demo = isDemoMode();
  const previousVersions = history.slice(1);

  return (
    <OperationalPage
      activeHref="/corte"
      title="Corte de caja"
      titleId="corte-title"
      eyebrow="Cierre del día"
      subtitle="Primero cuenta el efectivo; después revisa los movimientos. El corte no se guarda solo: tú confirmas."
      actions={
        <Link href="/ventas" className="mc-corte-action">
          Ver ventas
        </Link>
      }
      merchant={merchant.name}
      address={merchant.address}
      demo={demo}
      initial={(merchant.owner || merchant.name).trim().charAt(0).toUpperCase() || "M"}
      mainId="corte-main"
      contentClassName="mc-corte-page"
      focusTargetId="mc-corte-tally-title"
    >
      <div className="mc-corte-body">
        {/* 1. Conteo primero: DOM y orden de tabulación. */}
        <div className="mc-corte-body__tally">
          <CashCount initialStatus={status} titleId="mc-corte-tally-title" />
        </div>

        {/* 2. Checklist / revisión posterior al conteo. */}
        <section
          className="mc-op-panel mc-corte-checks"
          aria-labelledby="mc-corte-checks-title"
        >
          <div className="mc-op-panel__head">
            <h2 id="mc-corte-checks-title" className="mc-op-panel__title">
              Antes de cerrar
            </h2>
            <p className="mc-op-panel__meta">
              {saved ? `Corte #${saved.version} guardado` : "Sin corte guardado hoy"}
            </p>
          </div>
          <ul className="mc-corte-checks__list">
            <li className="mc-corte-check">
              <span
                className={`mc-corte-check__mark${
                  saved ? " mc-corte-check__mark--done" : ""
                }`}
                aria-hidden="true"
              >
                {saved ? "✓" : "1"}
              </span>
              <div className="mc-corte-check__copy">
                <p className="mc-corte-check__title">
                  {saved
                    ? `Corte del día guardado (#${saved.version})`
                    : "Corte del día pendiente"}
                </p>
                <p className="mc-corte-check__body">
                  {saved
                    ? `Guardado ${formatActivityDate(
                        saved.createdAt,
                      )}. Si lo corriges se guarda una versión nueva con motivo; la anterior no se borra.`
                    : "El conteo es el primer paso. Al confirmar se registra la versión 1 del día."}
                </p>
              </div>
            </li>
            <li className="mc-corte-check">
              <span className="mc-corte-check__mark" aria-hidden="true">
                {pendingCount > 0 ? "!" : "✓"}
              </span>
              <div className="mc-corte-check__copy">
                <p className="mc-corte-check__title">Cobros digitales por confirmar</p>
                <p className="mc-corte-check__body">
                  {pendingCount > 0
                    ? `${pendingCount} ${
                        pendingCount === 1 ? "cobro" : "cobros"
                      } por ${formatMxn(
                        pendingCents,
                      )}. No son efectivo de caja y no se suman al conteo. `
                    : "No hay cobros digitales esperando confirmación. "}
                  <Link href="/pendientes">Ver pendientes</Link>
                </p>
              </div>
            </li>
            <li className="mc-corte-check">
              <span className="mc-corte-check__mark" aria-hidden="true">
                i
              </span>
              <div className="mc-corte-check__copy">
                <p className="mc-corte-check__title">Fiado no es efectivo recibido</p>
                <p className="mc-corte-check__body">
                  Solo las ventas en efectivo y los abonos de fiado en efectivo
                  entran al esperado. El fiado pendiente se cobra desde{" "}
                  <Link href="/fiados">Fiados</Link>.
                </p>
              </div>
            </li>
          </ul>
        </section>

        {/* 3. Resumen del servidor, después del checklist. */}
        <div className="mc-corte-summary">
          <section
            className="mc-op-panel mc-corte-cash-now"
            aria-labelledby="mc-corte-cash-now-title"
          >
            <div className="mc-op-panel__head">
              <h2 id="mc-corte-cash-now-title" className="mc-op-panel__title">
                Así va la caja
              </h2>
              <p className="mc-op-panel__meta">Cifras del servidor, hoy</p>
            </div>
            <dl className="mc-corte-cash-now__rows">
              <div>
                <dt>Ventas en efectivo</dt>
                <dd>{formatMxn(status.cashSalesCents)}</dd>
              </div>
              <div>
                <dt>Abonos de fiado en efectivo</dt>
                <dd>{formatMxn(status.cashCreditCents)}</dd>
              </div>
              <div>
                <dt>Base inicial</dt>
                <dd>{formatMxn(status.openingCents)}</dd>
              </div>
              <div>
                <dt>Gastos</dt>
                <dd>{formatMxn(status.expensesCents)}</dd>
              </div>
              <div>
                <dt>Retiros</dt>
                <dd>{formatMxn(status.withdrawalsCents)}</dd>
              </div>
              <div className="mc-corte-cash-now__total">
                <dt>Debería haber</dt>
                <dd>{formatMxn(status.expectedCents)}</dd>
              </div>
              <div>
                <dt>Diferencia del último corte</dt>
                <dd
                  className={
                    saved
                      ? `mc-corte-difference ${differenceTone(saved.differenceCents)}`
                      : "mc-corte-difference"
                  }
                >
                  {saved ? differenceText(saved.differenceCents) : "Sin corte guardado"}
                </dd>
              </div>
            </dl>
            <p className="mc-corte-cash-now__note">
              Esta vista se actualiza al recargar. El corte guardado no cambia
              aunque entren movimientos después del cierre.
            </p>
          </section>

          <section
            className="mc-op-panel mc-corte-history"
            aria-labelledby="mc-corte-history-title"
          >
            <div className="mc-op-panel__head">
              <h2 id="mc-corte-history-title" className="mc-op-panel__title">
                Cortes de hoy
              </h2>
              <p className="mc-op-panel__meta">
                {saved
                  ? `${saved.version} ${
                      saved.version === 1 ? "versión" : "versiones"
                    }`
                  : "Sin versiones"}
              </p>
            </div>
            {saved ? (
              <SavedClose close={saved} />
            ) : (
              <p className="mc-corte-history__empty">
                Aún no hay un corte guardado hoy. El primero queda como versión 1.
              </p>
            )}
            {previousVersions.length > 0 ? (
              <ol className="mc-corte-history__list" aria-label="Versiones anteriores de hoy">
                {previousVersions.map((item) => (
                  <li key={item.id}>
                    <span>
                      Corte #{item.version} · {formatTime(item.createdAt)}
                    </span>
                    <span className={`mc-corte-difference ${differenceTone(item.differenceCents)}`}>
                      {differenceText(item.differenceCents)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </div>
      </div>
    </OperationalPage>
  );
}
