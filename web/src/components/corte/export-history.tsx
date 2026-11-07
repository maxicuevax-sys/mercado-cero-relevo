"use client";

import { Download } from "lucide-react";

export interface HistoryExportRow {
  date: string;
  dateLabel: string;
  version: number;
  salesCents: number;
  cashCents: number;
  creditCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  expectedCents: number;
  countedCents: number;
  differenceCents: number;
  baseNextCents: number;
  withdrawalNextCents: number;
  createdAt: string;
}

const HEADERS = [
  "Fecha",
  "Fecha legible",
  "Versión",
  "Ventas del día",
  "Efectivo cobrado",
  "Abonos de fiado en efectivo",
  "Gastos",
  "Retiros",
  "Debería haber",
  "Total contado",
  "Diferencia",
  "Base para mañana",
  "Retiro adicional",
  "Guardado el",
];

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function amount(cents: number): string {
  return (Number.isFinite(cents) ? cents / 100 : 0).toFixed(2);
}

/** CSV real con una fila por corte visible. No inventa filas ni importes. */
export function ExportHistoryButton({
  rows,
  fileName,
  noteId,
}: {
  rows: HistoryExportRow[];
  fileName: string;
  noteId: string;
}) {
  const hasRows = rows.length > 0;

  function download() {
    if (!hasRows) return;
    const lines = [
      HEADERS.map(csvCell).join(","),
      ...rows.map((row) =>
        [
          csvCell(row.date),
          csvCell(row.dateLabel),
          csvCell(row.version),
          csvCell(amount(row.salesCents)),
          csvCell(amount(row.cashCents)),
          csvCell(amount(row.creditCents)),
          csvCell(amount(row.expensesCents)),
          csvCell(amount(row.withdrawalsCents)),
          csvCell(amount(row.expectedCents)),
          csvCell(amount(row.countedCents)),
          csvCell(amount(row.differenceCents)),
          csvCell(amount(row.baseNextCents)),
          csvCell(amount(row.withdrawalNextCents)),
          csvCell(row.createdAt),
        ].join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mc-hist-export-wrap">
      <button
        type="button"
        className="mc-hist-export"
        onClick={download}
        disabled={!hasRows}
        aria-describedby={noteId}
      >
        <Download aria-hidden="true" />
        Exportar historial
      </button>
      <p id={noteId} className="mc-hist-export__note" role="status">
        {hasRows
          ? `Descarga un CSV con ${rows.length} ${
              rows.length === 1 ? "corte guardado" : "cortes guardados"
            } y sus datos reales.`
          : "Aún no hay cortes guardados para exportar."}
      </p>
    </div>
  );
}
