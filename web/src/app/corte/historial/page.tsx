import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarCheck2, ChevronRight } from "lucide-react";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { DifferencePill } from "@/components/corte/difference-pill";
import { ExportHistoryButton } from "@/components/corte/export-history";
import { listRecentCashCloses } from "@/lib/cash";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatDayMonth, formatMxn } from "@/lib/format";
import { addDaysToDateKey, mexicoDateKey } from "@/lib/mexico-date";
import registerNative from "@/assets/definitive-a/register.png";
import "./historial.css";

export const metadata: Metadata = {
  title: "Historial de cortes — Mercado Cero",
};

export const instant = false;

function dateLabel(dateKey: string): { top: string; bottom: string } {
  const today = mexicoDateKey(new Date());
  if (dateKey === today) return { top: "Hoy", bottom: formatDayMonth(dateKey) };
  if (dateKey === addDaysToDateKey(today, -1)) {
    return { top: "Ayer", bottom: formatDayMonth(dateKey) };
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return {
    top: new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" })
      .format(date)
      .replace(/\.$/, ""),
    bottom: String(year),
  };
}

export default async function HistorialCortesPage() {
  await connection();
  const closes = listRecentCashCloses(12);
  const demo = isDemoMode();

  const exportRows = closes.map((close) => ({
    date: close.date,
    dateLabel: `${dateLabel(close.date).top} ${dateLabel(close.date).bottom}`,
    version: close.version,
    salesCents: close.cashSalesCents + close.cashCreditCents,
    cashCents: close.cashSalesCents,
    creditCents: close.cashCreditCents,
    expensesCents: close.expensesCents,
    withdrawalsCents: close.withdrawalsCents,
    expectedCents: close.expectedCents,
    countedCents: close.countedCents,
    differenceCents: close.differenceCents,
    baseNextCents: close.baseNextCents,
    withdrawalNextCents: close.withdrawalNextCents,
    createdAt: close.createdAt,
  }));

  return (
    <OperationalPage
      activeHref="/corte"
      title="Historial de cortes"
      titleId="corte-historial-title"
      actions={
        <Link
          className="mc-parity-back"
          href="/corte"
          aria-label="Volver a Corte"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
      }
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      mainId="corte-historial-main"
      contentClassName="mc-hist-page"
      focusTargetId="corte-historial-title"
    >
      <section className="mc-hist-banner" aria-label="Consulta tus cierres">
        <Image
          src={registerNative}
          alt=""
          aria-hidden="true"
          className="mc-hist-banner__art"
          sizes="(max-width: 760px) 40vw, 320px"
        />
        <div className="mc-hist-banner__copy">
          <h2 className="mc-hist-banner__title">Consulta tus cierres</h2>
          <p className="mc-hist-banner__body">
            Revisa cuánto vendiste, tus gastos y la diferencia de caja.
          </p>
        </div>
      </section>

      <section className="mc-hist-list" aria-labelledby="mc-hist-list-title">
        <div className="mc-hist-list__head">
          <h2 id="mc-hist-list-title" className="mc-hist-list__title">
            Últimos cortes
          </h2>
          {closes.length > 0 ? (
            <p className="mc-hist-list__meta">
              {closes.length === 1 ? "1 cierre" : `${closes.length} cierres`}
            </p>
          ) : null}
        </div>

        {closes.length === 0 ? (
          <div className="mc-hist-empty mc-op-empty">
            <p className="mc-op-empty__title">Todavía no hay cortes guardados.</p>
            <p className="mc-op-empty__body">
              Al cerrar la caja del día, el corte aparece aquí con su foto de
              ventas, gastos y diferencia.
            </p>
            <Link className="mc-hist-empty__action" href="/corte">
              <CalendarCheck2 aria-hidden="true" />
              Ir a Corte
            </Link>
          </div>
        ) : (
          <ul className="mc-hist-rows">
            {closes.map((close) => {
              const label = dateLabel(close.date);
              const sales = close.cashSalesCents + close.cashCreditCents;
              return (
                <li key={close.id} className="mc-hist-row-item">
                  <Link
                    className="mc-hist-row"
                    href={`/corte/historial/${close.date}?v=${close.id}`}
                    aria-label={`Corte ${label.top} ${label.bottom}, versión ${close.version}`}
                  >
                    <span className="mc-hist-row__date">
                      <CalendarCheck2
                        className="mc-hist-row__calendar"
                        aria-hidden="true"
                      />
                      <strong>{label.top}</strong>
                      <small>{label.bottom}</small>
                    </span>
                    <span className="mc-hist-row__sales">
                      <span className="mc-hist-row__caption">
                        Ventas en efectivo
                      </span>
                      <strong>{formatMxn(sales)}</strong>
                    </span>
                    <span className="mc-hist-row__diff">
                      <span className="mc-hist-row__caption">Diferencia</span>
                      <DifferencePill cents={close.differenceCents} />
                    </span>
                    <ChevronRight
                      className="mc-hist-row__chevron"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {closes.length > 0 ? (
        <ExportHistoryButton
          rows={exportRows}
          fileName="cortes-mercado-cero.csv"
          noteId="mc-hist-export-note"
        />
      ) : null}

      <p className="mc-hist-note">
        Cada corte es una foto del cierre: no cambia si entran ventas o abonos
        después. El digital verificado no es efectivo de cajón; el fiado
        pendiente no es dinero recibido.
      </p>
    </OperationalPage>
  );
}
