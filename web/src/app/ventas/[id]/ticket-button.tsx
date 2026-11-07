"use client";

import { Printer } from "lucide-react";

/**
 * El ticket es la impresión de esta misma pantalla: no genera un comprobante
 * fiscal ni un PDF firmado. Si el navegador no puede imprimir, no inventa un
 * archivo; solo no hace nada.
 */
export function TicketButton() {
  return (
    <button
      type="button"
      className="mc-dv-ticket"
      onClick={() => window.print()}
      title="Imprimir este detalle con la impresión del navegador"
    >
      <Printer aria-hidden="true" />
      Ticket
    </button>
  );
}
