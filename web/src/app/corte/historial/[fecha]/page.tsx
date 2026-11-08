import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { DifferencePill } from "@/components/corte/difference-pill";
import {
  differenceName,
  longDate,
  relativeDay,
} from "@/components/corte/history-format";
import { getAnalytics } from "@/lib/analytics";
import { getCashCloseById, listCashCloses } from "@/lib/cash";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatMxn, formatTime } from "@/lib/format";
import { mexicoDateKey, startOfMexicoDay } from "@/lib/time";
import "../historial.css";

export const metadata: Metadata = {
  title: "Detalle del corte · Trangui",
};

export const instant = false;

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export default async function CorteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  await connection();
  const { fecha } = await params;
  const { v } = await searchParams;
  if (!isDateKey(fecha)) notFound();

  const versions = listCashCloses(fecha, 10);
  if (versions.length === 0) notFound();

  const requested = v ? getCashCloseById(v) : null;
  const close =
    requested && requested.date === fecha ? requested : versions[0];
  const demo = isDemoMode();
  const todayKey = mexicoDateKey();
  const yesterdayKey = mexicoDateKey(startOfMexicoDay(1));
  const salesCents =
    getAnalytics("month").series.find((point) => point.date === fecha)
      ?.salesCents ?? null;

  return (
    <OperationalPage
      activeHref="/corte"
      title="Detalle del corte"
      titleId="corte-detalle-title"
      actions={
        <Link
          className="mc-parity-back"
          href="/corte/historial"
          aria-label="Volver al historial de cortes"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
      }
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      mainId="corte-detalle-main"
      contentClassName="mc-hist-page"
      focusTargetId="corte-detalle-title"
    >
      <div className="mc-hist-detail-date">
        <CalendarDays aria-hidden="true" />
        <span>
          <strong>{relativeDay(fecha, todayKey, yesterdayKey)}</strong> ·{" "}
          {longDate(fecha)}
        </span>
        <span className="mc-hist-detail-date__version">
          Versión {close.version}
        </span>
      </div>

      <section
        className="mc-hist-detail-hero"
        aria-labelledby="mc-hist-detail-diff-label"
      >
        <div className="mc-hist-detail-hero__block">
          <p id="mc-hist-detail-diff-label" className="mc-hist-detail-hero__label">
            Diferencia del corte
          </p>
          <DifferencePill
            cents={close.differenceCents}
            className="mc-hist-detail-hero__pill"
          />
          <p className="mc-hist-detail-hero__hint">
            {differenceName(close.differenceCents)}
          </p>
        </div>
        <div className="mc-hist-detail-hero__block">
          <p className="mc-hist-detail-hero__label">Ventas del día</p>
          <p className="mc-hist-detail-hero__value">
            {salesCents === null ? "—" : formatMxn(salesCents)}
          </p>
          <p className="mc-hist-detail-hero__hint">Registro actual del día</p>
        </div>
      </section>

      <section
        className="mc-hist-detail-card"
        aria-labelledby="mc-hist-detail-card-title"
      >
        <h2 id="mc-hist-detail-card-title" className="mc-hist-detail-card__title">
          Datos del corte
        </h2>
        <dl className="mc-hist-detail-rows">
          <div>
            <dt>Efectivo de ventas</dt>
            <dd>{formatMxn(close.cashSalesCents)}</dd>
          </div>
          <div>
            <dt>Abonos de fiado en efectivo</dt>
            <dd>{formatMxn(close.cashCreditCents)}</dd>
          </div>
          <div>
            <dt>Gastos</dt>
            <dd>{formatMxn(close.expensesCents)}</dd>
          </div>
          <div>
            <dt>Retiros</dt>
            <dd>{formatMxn(close.withdrawalsCents)}</dd>
          </div>
          <div>
            <dt>Debería haber</dt>
            <dd>{formatMxn(close.expectedCents)}</dd>
          </div>
          <div>
            <dt>Total contado</dt>
            <dd>{formatMxn(close.countedCents)}</dd>
          </div>
          <div className="mc-hist-detail-rows__diff">
            <dt>Diferencia</dt>
            <dd>
              <DifferencePill cents={close.differenceCents} />
            </dd>
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
          <div>
            <dt>Pendiente de cobro (foto)</dt>
            <dd>
              {close.snapshotKnown
                ? formatMxn(close.snapshotPendingDigitalCents)
                : "No registrado"}
            </dd>
          </div>
          <div>
            <dt>Guardado</dt>
            <dd>
              {longDate(close.date)} · {formatTime(close.createdAt)}
            </dd>
          </div>
        </dl>
        {close.reason ? (
          <p className="mc-hist-detail-card__reason">
            Motivo de la corrección: <strong>{close.reason}</strong>
          </p>
        ) : null}
        <p className="mc-hist-detail-card__note">
          Esta foto no cambia si entran ventas o abonos después del cierre. Las
          ventas del día se leen del registro actual; el corte guarda el
          efectivo y sus fotos.
        </p>
      </section>

      {versions.length > 1 ? (
        <section
          className="mc-hist-versions"
          aria-labelledby="mc-hist-versions-title"
        >
          <h2 id="mc-hist-versions-title" className="mc-hist-versions__title">
            Versiones del día
          </h2>
          <ul className="mc-hist-versions__list">
            {versions.map((version) => (
              <li key={version.id}>
                <Link
                  className="mc-hist-version"
                  href={`/corte/historial/${fecha}?v=${version.id}`}
                  aria-current={
                    version.id === close.id ? "true" : undefined
                  }
                >
                  <span>
                    Versión {version.version} · {formatTime(version.createdAt)}
                  </span>
                  <DifferencePill cents={version.differenceCents} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </OperationalPage>
  );
}
