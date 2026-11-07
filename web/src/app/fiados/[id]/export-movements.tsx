"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export interface MovementExportRow {
  date: string;
  title: string;
  detail: string;
  amount: string;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** CSV real con los movimientos visibles del fiado. No inventa filas ni importes. */
export function ExportMovementsButton({
  rows,
  fileName,
  customerName,
}: {
  rows: MovementExportRow[];
  fileName: string;
  customerName: string;
}) {
  const [done, setDone] = useState(false);
  const hasRows = rows.length > 0;

  function download() {
    if (!hasRows) return;
    const lines = [
      ["Fecha", "Movimiento", "Detalle", "Monto (MXN)"].map(csvCell).join(","),
      ...rows.map((row) =>
        [row.date, row.title, row.detail, row.amount].map(csvCell).join(","),
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
    setDone(true);
  }

  return (
    <>
      <button
        type="button"
        className="mc-flow__export"
        onClick={download}
        disabled={!hasRows}
        title={hasRows ? undefined : "No hay movimientos para exportar"}
        aria-label={`Exportar movimientos de ${customerName} a CSV`}
      >
        <Download aria-hidden="true" />
        Exportar
      </button>
      <span className="sr-only" role="status">
        {done ? "CSV descargado" : ""}
      </span>
    </>
  );
}
