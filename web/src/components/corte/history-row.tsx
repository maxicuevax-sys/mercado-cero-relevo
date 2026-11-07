import Link from "next/link";
import { CalendarCheck2, ChevronRight } from "lucide-react";
import { formatDayMonth, formatMxn } from "@/lib/format";
import type { CashClose } from "@/lib/types";
import { DifferencePill } from "./difference-pill";
import { longDate } from "./history-format";

export interface HistoryRowData {
  close: CashClose;
  /** Ventas registradas ese día (no solo el efectivo del corte). */
  salesCents: number;
  /** Etiqueta corta: Hoy · Ayer · 31 oct. */
  label: string;
}

export function HistoryRow({ row }: { row: HistoryRowData }) {
  const { close, salesCents, label } = row;
  return (
    <li className="mc-hist-row-item">
      <Link
        href={`/corte/historial/${close.date}`}
        className="mc-hist-row"
        aria-label={`Ver detalle del corte del ${longDate(
          close.date,
        )}. Ventas ${formatMxn(salesCents)}. Diferencia ${formatMxn(
          Math.abs(close.differenceCents),
        )} ${
          close.differenceCents === 0
            ? "cuadrada"
            : close.differenceCents > 0
              ? "de sobrante"
              : "de faltante"
        }.`}
      >
        <span className="mc-hist-row__date">
          <CalendarCheck2 className="mc-hist-row__calendar" aria-hidden="true" />
          <strong>{label}</strong>
          <small>{formatDayMonth(close.date)}</small>
        </span>
        <span className="mc-hist-row__sales">
          <span className="mc-hist-row__caption">Ventas</span>
          <strong>{formatMxn(salesCents)}</strong>
        </span>
        <span className="mc-hist-row__diff">
          <span className="mc-hist-row__caption">Diferencia</span>
          <DifferencePill cents={close.differenceCents} />
        </span>
        <ChevronRight className="mc-hist-row__chevron" aria-hidden="true" />
      </Link>
    </li>
  );
}
