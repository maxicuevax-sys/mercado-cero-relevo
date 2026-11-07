import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Check, ReceiptText, ShoppingBasket, ShoppingCart, StickyNote, X } from "lucide-react";
import { connection } from "next/server";
import { FlowScreen } from "@/components/shell/flow-screen";
import { getCredit } from "@/lib/db";
import { formatMxn } from "@/lib/format";

export const metadata: Metadata = {
  title: "Fiado registrado — Mercado Cero",
};

export const instant = false;

export default async function FiadoRegistradoPage({
  searchParams,
}: {
  searchParams: Promise<{ creditId?: string; amount?: string; note?: string }>;
}) {
  await connection();
  const { creditId, amount, note } = await searchParams;
  const credit = creditId ? getCredit(creditId) : null;
  const amountCents = Math.max(0, Number.parseInt(amount ?? "0", 10) || 0);
  const name = credit?.customerName?.trim() || "tu cliente";

  return (
    <FlowScreen
      title="Nuevo fiado"
      titleId="fiado-registrado-title"
      backHref="/fiados"
      backLabel="Volver a Fiados"
      activeHref="/fiados"
    >
      <section className="mc-flow__dialog" role="status" aria-labelledby="fiado-registrado-heading">
        <Link className="mc-flow__dialog-close" href="/fiados" aria-label="Cerrar y volver a Fiados">
          <X aria-hidden="true" />
        </Link>
        <span className="mc-flow__dialog-art" aria-hidden="true">
          <ShoppingBasket />
          <Check className="mc-flow__dialog-check" />
        </span>
        <h2 id="fiado-registrado-heading">Fiado registrado</h2>
        <p className="mc-flow__dialog-copy">La venta se guardó en el historial de fiados.</p>

        {credit ? (
          <>
            <div className="mc-flow__dialog-customer">
              <span className="mc-flow__row-main">
                <strong>{name}</strong>
                <span>Nuevo saldo</span>
              </span>
              <b>{formatMxn(credit.balanceCents)}</b>
            </div>
            <dl className="mc-flow__dialog-rows">
              <div>
                <dt><ShoppingCart aria-hidden="true" />Venta a fiado</dt>
                <dd>{formatMxn(amountCents || credit.originalCents)}</dd>
              </div>
              <div>
                <dt><CalendarDays aria-hidden="true" />Fecha</dt>
                <dd>Hoy</dd>
              </div>
              <div>
                <dt><StickyNote aria-hidden="true" />Nota</dt>
                <dd>{note || "Sin nota"}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mc-flow__dialog-copy">
            No pude leer el fiado recién creado. Ábrelo desde la libreta para ver su saldo.
          </p>
        )}

        <div className="mc-flow__actions">
          <Link className="mc-flow__primary" href="/fiados">
            <Check aria-hidden="true" />
            Listo
          </Link>
          {credit ? (
            <Link className="mc-flow__secondary" href={`/fiados/${credit.id}`}>
              <ReceiptText aria-hidden="true" />
              Ver fiados de {name}
            </Link>
          ) : null}
        </div>
      </section>
    </FlowScreen>
  );
}
