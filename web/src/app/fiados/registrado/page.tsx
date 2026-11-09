import { withPilotPage } from "../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Check, ReceiptText, ShoppingBasket, ShoppingCart, StickyNote, X } from "lucide-react";
import { connection } from "next/server";
import { FlowScreen } from "@/components/shell/flow-screen";
import { getCredit, getOrder, listCreditPayments } from "@/lib/db";
import { isDemoMode } from "@/lib/config";
import { formatActivityDate, formatMxn } from "@/lib/format";

export const metadata: Metadata = {
  title: "Resultado del registro — Trangui",
};

export const instant = false;

async function FiadoRegistradoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; creditId?: string; orderId?: string; requestId?: string }>;
}) {
  await connection();
  const query = await searchParams;
  // The URL identifies records only. Money, customer, method and date come
  // from this tenant's ledger, including when an old receipt is reopened.
  const identifier = (value: unknown, max = 128) =>
    typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
  const creditId = identifier(query.creditId);
  const orderId = identifier(query.orderId);
  const requestId = identifier(query.requestId);
  const credit = creditId ? getCredit(creditId) : null;
  const abono = query.tipo === "abono";
  const order = !query.tipo && orderId ? getOrder(orderId) : null;
  const payment = abono && credit && requestId
    ? listCreditPayments(credit.id).find((item) => item.requestId === requestId)
    : null;
  const confirmed = Boolean(credit && (abono ? payment : order && order.creditId === credit.id && credit.orderId === order.id));
  const amountCents = payment?.amountCents ?? credit?.originalCents ?? 0;
  const recordedAt = payment?.createdAt ?? order?.createdAt;
  const note = order?.items.map((item) => item.description).join(" · ");
  const method = payment?.method === "cash" ? "Efectivo"
    : payment?.provider === "pey" ? "Pago verificado"
    : payment?.method === "card" ? "Tarjeta declarada, sin verificar"
    : "Pago digital declarado, sin verificar";
  const name = credit?.customerName?.trim() || "tu cliente";

  return (
    <FlowScreen
      title={abono ? "Resultado del abono" : "Resultado del fiado"}
      titleId="fiado-registrado-title"
      backHref="/fiados"
      backLabel="Volver a Fiados"
      activeHref="/fiados"
    >
      <section className="mc-flow__dialog" role="status" aria-labelledby="fiado-registrado-heading">
        <Link className="mc-flow__dialog-close" href="/fiados" aria-label="Cerrar y volver a Fiados">
          <X aria-hidden="true" />
        </Link>
        {confirmed ? <span className="mc-flow__dialog-art" aria-hidden="true">
          <ShoppingBasket />
          <Check className="mc-flow__dialog-check" />
        </span> : null}
        <h2 id="fiado-registrado-heading">{confirmed ? (abono ? "Abono registrado" : "Fiado registrado") : "Registro no confirmado"}</h2>
        <p className="mc-flow__dialog-copy">{confirmed
          ? abono ? "El abono guardado redujo la deuda del cliente." : "La venta se guardó en el historial de fiados."
          : "No pude confirmar este registro. Revisa la libreta antes de volver a registrarlo."}</p>

        {confirmed && credit ? (
          <>
            <div className="mc-flow__dialog-customer">
              <span className="mc-flow__row-main">
                <strong>{name}</strong>
                <span>Saldo actual</span>
              </span>
              <b>{formatMxn(credit.balanceCents)}</b>
            </div>
            <dl className="mc-flow__dialog-rows">
              <div>
                <dt><ShoppingCart aria-hidden="true" />{abono ? "Abono aplicado" : "Venta a fiado"}</dt>
                <dd>{formatMxn(amountCents)}</dd>
              </div>
              <div>
                <dt><CalendarDays aria-hidden="true" />Fecha</dt>
                <dd>{recordedAt ? formatActivityDate(recordedAt) : "Sin fecha"}</dd>
              </div>
              <div>
                <dt><StickyNote aria-hidden="true" />{abono ? "Método" : "Concepto guardado"}</dt>
                <dd>{abono ? method : note || "Venta a fiado"}</dd>
              </div>
            </dl>
          </>
        ) : (
          null
        )}
        {confirmed && isDemoMode() ? <p className="mc-flow__dialog-copy">Registro de práctica. No representa dinero real.</p> : null}

        <div className="mc-flow__actions">
          <Link className="mc-flow__primary" href="/fiados">
            <Check aria-hidden="true" />
            Listo
          </Link>
          {confirmed && credit ? (
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

export default withPilotPage(FiadoRegistradoPage);
