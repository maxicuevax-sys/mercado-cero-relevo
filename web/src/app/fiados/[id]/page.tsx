import { withPilotPage } from "../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ArrowDownLeft,
  ArrowLeft,
  BarChart3,
  Check,
  Banknote,
  CreditCard,
  ReceiptText,
  Smartphone,
  Tag,
  Wallet,
} from "lucide-react";
import { FlowScreen } from "@/components/shell/flow-screen";
import { getCredit, listCreditPayments } from "@/lib/db";
import { formatMxn } from "@/lib/format";
import { addDaysToDateKey, mexicoDateKey } from "@/lib/mexico-date";
import { ExportMovementsButton } from "./export-movements";

export const metadata: Metadata = {
  title: "Fiado de cliente — Trangui",
};

export const instant = false;

const dayLabel = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" });

function movementDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const key = mexicoDateKey(date);
  const today = mexicoDateKey(new Date());
  if (key === today) return "Hoy";
  if (key === addDaysToDateKey(today, -1)) return "Ayer";
  return dayLabel.format(date);
}

function methodLabel(method: string): string {
  if (method === "cash") return "Efectivo";
  if (method === "codi") return "Digital";
  if (method === "card") return "Tarjeta";
  return "Abono";
}

function MethodIcon({ method }: { method: string }) {
  if (method === "cash") return <Banknote aria-hidden="true" />;
  if (method === "card") return <CreditCard aria-hidden="true" />;
  if (method === "codi") return <Smartphone aria-hidden="true" />;
  return <Wallet aria-hidden="true" />;
}

async function FiadoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ abono?: string; abonoRequestId?: string; vista?: string }>;
}) {
  await connection();
  const { id } = await params;
  const { abono, abonoRequestId, vista } = await searchParams;
  const resumen = vista === "resumen";
  const credit = getCredit(id);
  if (!credit) notFound();

  const payments = listCreditPayments(id);
  const confirmedPayment = typeof abonoRequestId === "string" && abonoRequestId.length <= 128
    ? payments.find((payment) => payment.requestId === abonoRequestId)
    : null;
  const paidCents = Math.max(0, credit.originalCents - credit.balanceCents);
  const settled = credit.status === "settled" || credit.balanceCents <= 0;
  const name = credit.customerName?.trim() || "Cliente";
  const portrait = "/assets/spec/fiados-avatar-juan.png";

  const movements = [
    ...payments.map((payment) => ({
      id: payment.id,
      day: movementDay(payment.createdAt),
      at: payment.createdAt,
      title: "Abono",
      detail: methodLabel(payment.method),
      method: payment.method,
      amountCents: -payment.amountCents,
      tone: "green" as const,
    })),
    {
      id: `sale-${credit.id}`,
      day: movementDay(credit.createdAt),
      at: credit.createdAt,
      title: "Venta a fiado",
      detail: credit.orderId ? "Pedido registrado" : "Sin pedido",
      method: "sale",
      amountCents: credit.originalCents,
      tone: "clay" as const,
    },
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const exportRows = movements.map((movement) => ({
    date: mexicoDateKey(new Date(movement.at)),
    title: movement.title,
    detail: movement.detail,
    amount: `${movement.amountCents < 0 ? "-" : ""}${(
      Math.abs(movement.amountCents) / 100
    ).toFixed(2)}`,
  }));

  const groups: Array<{ day: string; items: typeof movements }> = [];
  for (const movement of movements) {
    const last = groups[groups.length - 1];
    if (last && last.day === movement.day) last.items.push(movement);
    else groups.push({ day: movement.day, items: [movement] });
  }

  return (
    <FlowScreen
      title="Historial de fiados"
      titleId="fiado-detalle-title"
      backHref="/fiados"
      backLabel="Volver a Fiados"
      activeHref="/fiados"
      headingAction={
        <ExportMovementsButton
          rows={exportRows}
          customerName={name}
          fileName={`fiado-${name.toLocaleLowerCase("es-MX").replace(/[^a-z0-9]+/gi, "-")}.csv`}
        />
      }
    >
      {abono || abonoRequestId ? (
        <p className="mc-flow__card mc-flow__card--soft" role="status">
          {confirmedPayment ? <>
            <Check aria-hidden="true" style={{ width: 28, height: 28, verticalAlign: "middle", marginRight: 10 }} />
            Abono registrado: {formatMxn(confirmedPayment.amountCents)}. Saldo actual de {name}: {formatMxn(credit.balanceCents)}.
          </> : "No pude confirmar este abono. Revisa los movimientos antes de volver a registrarlo."}
        </p>
      ) : null}

      <section className="mc-flow__row" aria-label={`Cliente ${name}`}>
        <Image src={portrait} width={121} height={111} alt="" unoptimized />
        <div className="mc-flow__row-main">
          <strong>{name}</strong>
          <span>{settled ? "Fiado saldado" : "Activo"}</span>
        </div>
        <span className={`mc-flow__badge${settled ? " mc-flow__badge--muted" : ""}`}>
          {settled ? "Saldado" : "Activo"}
        </span>
      </section>

      <section className="mc-flow__metrics" aria-label="Resumen del fiado">
        <article className="mc-flow__metric">
          <p><Wallet aria-hidden="true" />Saldo actual</p>
          <strong className="is-clay">{formatMxn(credit.balanceCents)}</strong>
        </article>
        <article className="mc-flow__metric">
          <p><Tag aria-hidden="true" />Total del fiado</p>
          <strong>{formatMxn(credit.originalCents)}</strong>
        </article>
        <article className="mc-flow__metric">
          <p><ArrowDownLeft aria-hidden="true" />Total de abonos</p>
          <strong className="is-green">{formatMxn(paidCents)}</strong>
        </article>
      </section>

      <div className="mc-flow__tabs" role="group" aria-label="Vista">
        <Link
          className={`mc-flow__tab${resumen ? "" : " is-active"}`}
          href={`/fiados/${credit.id}`}
          aria-current={resumen ? undefined : "page"}
        >
          <ReceiptText aria-hidden="true" />
          Movimientos
        </Link>
        <Link
          className={`mc-flow__tab${resumen ? " is-active" : ""}`}
          href={`/fiados/${credit.id}?vista=resumen`}
          aria-current={resumen ? "page" : undefined}
        >
          <BarChart3 aria-hidden="true" />
          Resumen
        </Link>
      </div>

      {resumen ? (
        <section aria-labelledby="mc-flow-summary-title">
          <h2 id="mc-flow-summary-title" className="mc-flow__section-title">
            Resumen del fiado
          </h2>
          <dl className="mc-flow__summary">
            <div>
              <dt>Saldo actual</dt>
              <dd className="is-clay">{formatMxn(credit.balanceCents)}</dd>
            </div>
            <div>
              <dt>Total del fiado</dt>
              <dd>{formatMxn(credit.originalCents)}</dd>
            </div>
            <div>
              <dt>Total de abonos</dt>
              <dd className="is-green">{formatMxn(paidCents)}</dd>
            </div>
            <div>
              <dt>Abonos registrados</dt>
              <dd>{payments.length}</dd>
            </div>
            <div>
              <dt>Abonos en efectivo</dt>
              <dd>
                {formatMxn(
                  payments
                    .filter((payment) => payment.method === "cash")
                    .reduce((sum, payment) => sum + payment.amountCents, 0),
                )}
              </dd>
            </div>
            <div>
              <dt>Abonos digitales o con tarjeta</dt>
              <dd>
                {formatMxn(
                  payments
                    .filter((payment) => payment.method !== "cash")
                    .reduce((sum, payment) => sum + payment.amountCents, 0),
                )}
              </dd>
            </div>
            <div>
              <dt>Último movimiento</dt>
              <dd>{movements[0]?.day ?? "Sin movimientos"}</dd>
            </div>
          </dl>
          <p className="mc-flow__note">
            El saldo es deuda pendiente, no dinero recibido. Los abonos digitales o
            con tarjeta quedan declarados, sin verificación de pey.
          </p>
        </section>
      ) : (
        <section id="resumen" aria-labelledby="mc-flow-movements">
        <h2 id="mc-flow-movements" className="mc-flow__section-title">
          Historial de movimientos
        </h2>
        {groups.map((group) => (
          <div key={group.day}>
            <p className="mc-flow__group">
              {group.day}
            </p>
            <ul className="mc-flow__list">
              {group.items.map((movement) => (
                <li key={movement.id} className="mc-flow__movement">
                  <span className={`mc-flow__movement-icon mc-flow__movement-icon--${movement.tone}`}>
                    {movement.method === "sale" ? <Tag aria-hidden="true" /> : <MethodIcon method={movement.method} />}
                  </span>
                  <span className="mc-flow__row-main">
                    <strong>{movement.title}</strong>
                    <span>{movement.detail}</span>
                  </span>
                  <span className={`mc-flow__movement-amount is-${movement.tone}`}>
                    {movement.amountCents < 0 ? "−" : "+"}
                    {formatMxn(Math.abs(movement.amountCents))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        </section>
      )}

      <p className="mc-flow__note">
        Un abono reduce la deuda y no crea una venta nueva. Si fue en efectivo,
        suma al efectivo de hoy; digital o tarjeta quedan como abono declarado,
        sin verificación de pey.
      </p>

      <div className="mc-flow__actions">
        {settled ? (
          <Link className="mc-flow__secondary" href="/fiados">
            <Check aria-hidden="true" />
            Fiado saldado
          </Link>
        ) : (
          <Link className="mc-flow__primary" href={`/fiados/${credit.id}/abono`}>
            <Banknote aria-hidden="true" />
            Registrar abono
          </Link>
        )}
        {!settled ? <Link className="mc-flow__secondary" href={`/fiados/${credit.id}/abono?metodo=codi`}>
          <Smartphone aria-hidden="true" />
          Registrar abono digital
        </Link> : null}
        <Link className="mc-flow__secondary" href="/fiados">
          <ArrowLeft aria-hidden="true" />
          Volver a Fiados
        </Link>
      </div>
    </FlowScreen>
  );
}

export default withPilotPage(FiadoDetallePage);
