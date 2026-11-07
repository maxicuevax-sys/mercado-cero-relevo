import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { HistoryRow, type HistoryRowData } from "@/components/corte/history-row";
import {
  ExportHistoryButton,
  type HistoryExportRow,
} from "@/components/corte/export-history";
import { longDate, relativeDay } from "@/components/corte/history-format";
import { getAnalytics } from "@/lib/analytics";
import { getCashClose } from "@/lib/cash";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { mexicoDateKey, startOfMexicoDay } from "@/lib/time";
import registerArt from "@/assets/inicio/hero-registradora.png";
import "./historial.css";

export const metadata: Metadata = {
  title: "Historial de cortes · Mercado Cero",
};

export const instant = false;

const HISTORY_DAYS = 30;
const HISTORY_LIMIT = 12;

export default async function HistorialCortesPage() {
  await connection();
  const demo = isDemoMode();
  const todayKey = mexicoDateKey();
  const yesterdayKey = mexicoDateKey(startOfMexicoDay(1));
  const salesByDate = new Map(
    getAnalytics("month").series.map((point) => [point.date, point.salesCents]),
  );

  const rows: HistoryRowData[] = [];
  for (let offset = 0; offset < HISTORY_DAYS; offset += 1) {
    if (rows.length >= HISTORY_LIMIT) break;
    const date = mexicoDateKey(startOfMexicoDay(offset));
    const close = getCashClose(date);
    if (!close) continue;
    rows.push({
      close,
      salesCents: salesByDate.get(date) ?? 0,
      label: relativeDay(date, todayKey, yesterdayKey),
    });
  }

  const exportRows: HistoryExportRow[] = rows.map(({ close }) => ({
    date: close.date,
    dateLabel: longDate(close.date),
    version: close.version,
    salesCents: salesByDate.get(close.date) ?? 0,
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
          aria-label="Volver a Corte de caja"
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
      <section className="mc-hist-banner" aria-labelledby="mc-hist-banner-title">
        <Image
          src={registerArt}
          alt=""
          aria-hidden="true"
          className="mc-hist-banner__art"
          sizes="(max-width: 767px) 132px, 240px"
        />
        <div className="mc-hist-banner__copy">
          <h2 id="mc-hist-banner-title" className="mc-hist-banner__title">
            Consulta tus cierres
          </h2>
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
          <p className="mc-hist-list__meta">
            {rows.length === 0
              ? "Sin cortes guardados"
              : `${rows.length} ${
                  rows.length === 1 ? "corte guardado" : "cortes guardados"
                }`}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mc-op-empty mc-hist-empty" role="status">
            <p className="mc-op-empty__title">Todavía no hay cortes guardados</p>
            <p className="mc-op-empty__body">
              Cuando cierres la caja de un día, su corte aparecerá aquí con la
              diferencia y sus movimientos.
            </p>
            <Link className="mc-hist-empty__action" href="/corte">
              <CalendarDays aria-hidden="true" />
              Ir al corte de hoy
            </Link>
          </div>
        ) : (
          <ul className="mc-hist-rows">
            {rows.map((row) => (
              <HistoryRow key={row.close.id} row={row} />
            ))}
          </ul>
        )}
      </section>

      <p className="mc-hist-note">
        «Ventas» se lee del registro del día; la diferencia corresponde a la
        última versión guardada del corte.
        {demo ? " Modo demo: incluye movimientos simulados, nunca dinero real." : ""}
      </p>

      <ExportHistoryButton
        rows={exportRows}
        fileName={`cortes-mercado-cero-${todayKey}.csv`}
        noteId="mc-hist-export-note"
      />
    </OperationalPage>
  );
}
