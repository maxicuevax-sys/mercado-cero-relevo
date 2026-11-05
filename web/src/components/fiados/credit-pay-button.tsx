"use client";

import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import type { Credit } from "@/lib/types";
import { CreditPaySheet } from "./credit-pay-sheet";

/**
 * Acción de cobro de una fila de Fiados.
 *
 * La referencia de la libreta termina cada fila con un chevron: por eso el
 * disparador es un botón circular con chevron y su nombre accesible completo
 * (`Registrar abono a <cliente>`) explica la acción sin depender del icono.
 * La lista se renderiza en el servidor; este es el único trozo cliente por
 * fila y solo abre la hoja cuando la persona lo pide.
 */
export function CreditPayButton({ credit }: { credit: Credit }) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const settled = credit.status === "settled" || credit.balanceCents <= 0;
  const name = credit.customerName ?? "cliente";

  if (settled) {
    return (
      <span className="mc-fiados-row__settled" aria-label="Fiado saldado">
        <Check aria-hidden="true" />
      </span>
    );
  }

  return (
    <div className="mc-fiados-pay-wrap">
      <button
        type="button"
        className="mc-fiados-pay"
        onClick={() => {
          setSuccess(null);
          setOpen(true);
        }}
        aria-label={`Registrar abono a ${name}`}
        aria-haspopup="dialog"
        title="Registrar abono"
      >
        <ChevronRight aria-hidden="true" />
      </button>

      {success ? (
        <p className="mc-fiados-flash" role="status">
          <Check aria-hidden="true" />
          <span>{success}</span>
          <button
            type="button"
            className="mc-fiados-flash__close"
            onClick={() => setSuccess(null)}
            aria-label="Cerrar aviso de abono"
          >
            <X aria-hidden="true" />
          </button>
        </p>
      ) : null}

      {open ? (
        <CreditPaySheet
          credit={credit}
          onClose={() => setOpen(false)}
          onSaved={(message) => {
            setSuccess(message);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
