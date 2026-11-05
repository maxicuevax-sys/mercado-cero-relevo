"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Credit } from "@/lib/types";
import { CreditPaySheet } from "./credit-pay-sheet";

/**
 * Acción "Registrar abono" de una fila de Fiados.
 *
 * La lista se renderiza en el servidor; este componente es el único trozo
 * cliente por fila: abre la hoja de abono cuando la persona lo pide y muestra
 * el resultado del último abono sin navegar ni robar foco al cargar la página.
 */
export function CreditPayButton({ credit }: { credit: Credit }) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const settled = credit.status === "settled" || credit.balanceCents <= 0;

  if (settled) {
    return <p className="mc-fiados-row__settled">Sin saldo pendiente</p>;
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
        aria-haspopup="dialog"
      >
        Registrar abono
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
