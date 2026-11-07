import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarCheck2, ChevronRight } from "lucide-react";
import { connection } from "next/server";
import { FlowScreen } from "@/components/shell/flow-screen";
import { differenceText } from "@/components/corte/money";
import { listRecentCashCloses } from "@/lib/cash";
import { formatDayMonth, formatMxn, formatTime } from "@/lib/format";
import { addDaysToDateKey, mexicoDateKey } from "@/lib/mexico-date";
import registerNative from "@/assets/definitive-a/register.png";

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

function toneClass(cents: number): string {
  if (cents === 0) return "is-zero";
  return cents > 0 ? "is-positive" : "is-negative";
}

export default async function HistorialCortesPage() {
  await connection();
  const closes = listRecentCashCloses(12);

  return (
    <FlowScreen
      title="Historial de cortes"
      titleId="historial-cortes-title"
      backHref="/corte"
      backLabel="Volver a Corte"
      activeHref="/corte"
    >
      <section className="mc-flow__hero" aria-label="Consulta tus cierres">
        <Image src={registerNative} alt="" aria-hidden="true" sizes="240px" />
        <div>
          <h2>Consulta tus cierres</h2>
          <p>Revisa cuánto vendiste, tus gastos y la diferencia de caja.</p>
        </div>
      </section>

      <h2 className="mc-flow__section-title">Últimos cortes</h2>
      {closes.length === 0 ? (
        <div className="mc-flow__card">
          <p className="mc-flow__note">
            Todavía no hay cortes guardados. Al cerrar la caja del día, el corte
            aparece aquí con su foto de ventas, gastos y diferencia.
          </p>
          <div className="mc-flow__actions">
            <Link className="mc-flow__primary" href="/corte">
              <CalendarCheck2 aria-hidden="true" />
              Ir a Corte
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mc-flow__list">
          {closes.map((close) => {
            const label = dateLabel(close.date);
            const sales = close.cashSalesCents + close.cashCreditCents;
            return (
              <li key={close.id}>
                <details className="mc-flow__close">
                  <summary>
                    <span className="mc-flow__datebadge">
                      <CalendarCheck2 aria-hidden="true" />
                      <strong>{label.top}</strong>
                      <small>{label.bottom}</small>
                    </span>
                    <span className="mc-flow__close-main">
                      <span>Ventas en efectivo</span>
                      <strong>{formatMxn(sales)}</strong>
                    </span>
                    <span className="mc-flow__close-diff">
                      <span>Diferencia</span>
                      <b className={toneClass(close.differenceCents)}>
                        {differenceText(close.differenceCents)}
                      </b>
                    </span>
                    <ChevronRight className="mc-flow__chevron" aria-hidden="true" />
                  </summary>
                  <dl className="mc-flow__close-detail">
                    <div><dt>Contado</dt><dd>{formatMxn(close.countedCents)}</dd></div>
                    <div><dt>Esperado con movimientos</dt><dd>{formatMxn(close.expectedCents)}</dd></div>
                    <div><dt>Gastos</dt><dd>−{formatMxn(close.expensesCents)}</dd></div>
                    <div><dt>Retiros</dt><dd>−{formatMxn(close.withdrawalsCents)}</dd></div>
                    <div><dt>Base para mañana</dt><dd>{formatMxn(close.baseNextCents)}</dd></div>
                    <div><dt>Guardado</dt><dd>{formatTime(close.createdAt)} · v{close.version}</dd></div>
                  </dl>
                  {close.reason ? (
                    <p className="mc-flow__note">Motivo de la corrección: {close.reason}</p>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mc-flow__note">
        Cada corte es una foto del cierre: no cambia si entran ventas o abonos
        después. El digital verificado no es efectivo de cajón.
      </p>

      <div className="mc-flow__actions">
        <Link className="mc-flow__secondary" href="/corte">
          <ArrowLeft aria-hidden="true" />
          Volver a Corte
        </Link>
      </div>
    </FlowScreen>
  );
}
