import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { CashCount } from "@/components/corte/cash-count";
import { differenceText, differenceWord } from "@/components/corte/money";
import { getCashClose, getCashStatus, listCashCloses } from "@/lib/cash";
import {
  countPendingOrders,
  getDailySummary,
  sumPendingOrderBalances,
} from "@/lib/db";
import { MERCHANT, isDemoMode } from "@/lib/config";
import {
  formatActivityDate,
  formatDayMonth,
  formatMxn,
  formatTime,
} from "@/lib/format";
import type { CashClose } from "@/lib/types";
import ahorroArt from "@/assets/brand/ilustraciones/transparent/ahorro.png";
import papelPicadoArt from "@/assets/inicio/papel-picado.png";
import iconRecibo from "@/assets/brand/iconos/transparent/recibo.png";
import iconRegistradora from "@/assets/brand/iconos/transparent/registradora.png";
import iconTienda from "@/assets/brand/iconos/transparent/tienda.png";
import iconQr from "@/assets/brand/iconos/transparent/qr-telefono.png";
import iconCamion from "@/assets/brand/iconos/transparent/camion.png";
import iconLista from "@/assets/brand/iconos/transparent/lista.png";
import iconReporte from "@/assets/brand/iconos/transparent/reporte.png";
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
  const summary = getDailySummary();
  const merchant = MERCHANT;
  const demo = isDemoMode();
  const previousVersions = history.slice(1);

  // Recibo del día: efectivo real de caja y digital verificado separados; el
  // fiado pendiente y los cobros por confirmar no son efectivo de cajón.
  const cashTodayCents = status.cashSalesCents + status.cashCreditCents;
  const stampTone = saved
    ? saved.differenceCents === 0
      ? "ok"
      : saved.differenceCents > 0
        ? "extra"
        : "missing"
    : "none";

  return (
    <OperationalPage
      activeHref="/corte"
      title="Corte de caja"
      titleId="corte-title"
      eyebrow={`Cierre del día · ${formatDayMonth(status.date)}`}
      subtitle="Cuenta el efectivo, revisa gastos y retiros, y guarda el corte solo cuando el saldo tenga sentido."
      merchant={merchant.name}
      address={merchant.address}
      demo={demo}
      initial={(merchant.owner || merchant.name).trim().charAt(0).toUpperCase() || "M"}
      mainId="corte-main"
      contentClassName="mc-corte-page"
      focusTargetId="mc-corte-tally-title"
    >
      {/* Acento decorativo en la esquina superior derecha del contenido. */}
      <Image
        src={papelPicadoArt}
        alt=""
        aria-hidden="true"
        className="mc-corte-page__picado"
        sizes="(max-width: 767px) 130px, 280px"
      />

      <div className="mc-corte-body">
        {/* PASO 1 · Conteo primero en DOM y en el orden de tabulación. */}
        <div className="mc-corte-body__tally">
          <CashCount initialStatus={status} titleId="mc-corte-tally-title" />
        </div>

        {/* PASO 2 · Resumen en tarjeta tipo recibo. */}
        <section
          className="mc-corte-receipt"
          aria-labelledby="mc-corte-receipt-title"
        >
            <div className="mc-corte-receipt__head">
              <span className="mc-corte-receipt__badge" aria-hidden="true">
                <Image src={iconRecibo} alt="" sizes="44px" />
              </span>
              <div className="mc-corte-receipt__headline">
                <p className="mc-corte-receipt__kicker">
                  Resumen del día · {formatDayMonth(status.date)}
                </p>
                <h2 id="mc-corte-receipt-title" className="mc-corte-receipt__title">
                  Así va la caja
                </h2>
              </div>
            </div>

            <dl className="mc-corte-receipt__rows">
              <div className="mc-corte-receipt__row">
                <span className="mc-corte-receipt__row-icon mc-corte-receipt__row-icon--green" aria-hidden="true">
                  <Image src={iconTienda} alt="" sizes="32px" />
                </span>
                <dt>Ventas</dt>
                <dd>{formatMxn(summary.salesCents)}</dd>
              </div>
              <div className="mc-corte-receipt__row">
                <span className="mc-corte-receipt__row-icon" aria-hidden="true">
                  <Image src={iconRegistradora} alt="" sizes="32px" />
                </span>
                <dt>Efectivo</dt>
                <dd>{formatMxn(cashTodayCents)}</dd>
              </div>
              <div className="mc-corte-receipt__row">
                <span className="mc-corte-receipt__row-icon mc-corte-receipt__row-icon--green" aria-hidden="true">
                  <Image src={iconQr} alt="" sizes="32px" />
                </span>
                <dt>Digital verificado</dt>
                <dd>{formatMxn(summary.verifiedDigitalCents)}</dd>
              </div>
              {summary.declaredDigitalCents > 0 ? (
                <div className="mc-corte-receipt__row">
                  <span className="mc-corte-receipt__row-icon mc-corte-receipt__row-icon--saffron" aria-hidden="true">
                    <Image src={iconQr} alt="" sizes="32px" />
                  </span>
                  <dt>Digital declarado</dt>
                  <dd>{formatMxn(summary.declaredDigitalCents)}</dd>
                </div>
              ) : null}
              <div className="mc-corte-receipt__row">
                <span className="mc-corte-receipt__row-icon mc-corte-receipt__row-icon--terracotta" aria-hidden="true">
                  <Image src={iconRecibo} alt="" sizes="32px" />
                </span>
                <dt>Gastos</dt>
                <dd className="mc-corte-receipt__out">
                  − {formatMxn(status.expensesCents)}
                </dd>
              </div>
              <div className="mc-corte-receipt__row">
                <span className="mc-corte-receipt__row-icon mc-corte-receipt__row-icon--saffron" aria-hidden="true">
                  <Image src={iconCamion} alt="" sizes="32px" />
                </span>
                <dt>Retiros</dt>
                <dd className="mc-corte-receipt__out">
                  − {formatMxn(status.withdrawalsCents)}
                </dd>
              </div>
            </dl>

            <div className="mc-corte-receipt__saldo">
              <div className="mc-corte-receipt__saldo-copy">
                <p className="mc-corte-receipt__saldo-label">Saldo del día</p>
                <CurrencyAmount
                  as="p"
                  cents={status.expectedCents}
                  className="mc-corte-receipt__saldo-value"
                />
              </div>
              <Image
                src={ahorroArt}
                alt=""
                aria-hidden="true"
                className="mc-corte-receipt__art"
                sizes="(max-width: 479px) 84px, 112px"
              />
              <span
                className={`mc-corte-receipt__stamp mc-corte-receipt__stamp--${stampTone}`}
              >
                {saved ? (
                  <>
                    <span className="mc-corte-receipt__stamp-word">
                      {differenceWord(saved.differenceCents)}
                    </span>
                    <span className="mc-corte-receipt__stamp-amount">
                      {formatMxn(Math.abs(saved.differenceCents))}
                    </span>
                  </>
                ) : (
                  <span className="mc-corte-receipt__stamp-word">Sin corte</span>
                )}
              </span>
            </div>

            <div className="mc-corte-receipt__foot">
              <p className="mc-corte-receipt__note">
                {demo
                  ? "Modo demo: los pagos simulados no cuentan como dinero real."
                  : "El digital verificado no es efectivo de cajón y el fiado pendiente no entra al corte."}{" "}
                El saldo se recalcula con los movimientos vivos al confirmar.
              </p>
              {saved ? (
                <p className="mc-corte-receipt__saved">
                  Último corte #{saved.version} · {differenceText(saved.differenceCents)} ·{" "}
                  {formatTime(saved.createdAt)}
                </p>
              ) : null}
            </div>
          </section>

          <div className="mc-corte-lower">
            {/* Checklist de revisión (después del conteo en DOM). */}
          <section
            className="mc-op-panel mc-corte-checks"
            aria-labelledby="mc-corte-checks-title"
          >
            <div className="mc-op-panel__head">
              <div className="mc-corte-panel-title">
                <span
                  className="mc-corte-panel-title__badge mc-corte-panel-title__badge--green"
                  aria-hidden="true"
                >
                  <Image src={iconLista} alt="" sizes="34px" />
                </span>
                <h2 id="mc-corte-checks-title" className="mc-op-panel__title">
                  Antes de cerrar
                </h2>
              </div>
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

          {/* Historial del día (secundario). */}
          <section
            className="mc-op-panel mc-corte-history"
            aria-labelledby="mc-corte-history-title"
          >
            <div className="mc-op-panel__head">
              <div className="mc-corte-panel-title">
                <span className="mc-corte-panel-title__badge" aria-hidden="true">
                  <Image src={iconReporte} alt="" sizes="36px" />
                </span>
                <h2 id="mc-corte-history-title" className="mc-op-panel__title">
                  Cortes de hoy
                </h2>
              </div>
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
