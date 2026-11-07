"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { Credit } from "@/lib/types";

/**
 * Acción de una fila de Fiados.
 *
 * La referencia de la libreta termina cada fila con un chevron: el disparador
 * abre el historial del cliente (`/fiados/[id]`), donde vive el saldo, los
 * movimientos y el botón real de «Registrar abono». En escritorio el mismo
 * enlace cubre la fila, sin botones escondidos.
 */
export function CreditPayButton({ credit }: { credit: Credit }) {
  const settled = credit.status === "settled" || credit.balanceCents <= 0;
  const name = credit.customerName ?? "cliente";

  if (settled) {
    return (
      <Link
        className="mc-fiados-row__settled"
        href={`/fiados/${credit.id}`}
        aria-label={`Ver fiado saldado de ${name}`}
      >
        <Check aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="mc-fiados-pay-wrap">
      <Link
        className="mc-fiados-pay"
        href={`/fiados/${credit.id}`}
        aria-label={`Ver fiado de ${name}`}
        title="Ver fiado y registrar abono"
      >
        <ChevronRight aria-hidden="true" />
      </Link>
    </div>
  );
}
