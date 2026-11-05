import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { TasksPanel } from "@/components/pendientes/tasks-panel";
import { MERCHANT, isDemoMode } from "@/lib/config";
import {
  countPendingOrders,
  listPendingOrders,
  sumPendingOrderBalances,
} from "@/lib/db";
import { formatActivityDate, formatMxn, shortOrder } from "@/lib/format";
import { addDaysToDateKey, DAY_MS, mexicoDateKey } from "@/lib/mexico-date";
import { saleMoney } from "@/lib/sale-truth";
import { countTasks, listTasks } from "@/lib/tasks";
import type { Order } from "@/lib/types";
import "./pendientes.css";

export const metadata: Metadata = {
  title: "Pendientes · Mercado Cero",
};

export const instant = false;

/**
 * Antigüedad en palabras ("Hoy", "Ayer", "Hace 3 días"). Se calcula con la
 * llave de día de México, no con la zona del servidor.
 */
function ageLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const todayKey = mexicoDateKey(new Date());
  const createdKey = mexicoDateKey(date);
  if (createdKey === todayKey) return "Hoy";
  if (createdKey === addDaysToDateKey(todayKey, -1)) return "Ayer";
  const created = Date.parse(`${createdKey}T12:00:00Z`);
  const today = Date.parse(`${todayKey}T12:00:00Z`);
  const days = Math.round((today - created) / DAY_MS);
  if (!Number.isFinite(days) || days <= 0) return "Hoy";
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

type PendingTone = "pending" | "partial" | "registered";

function statusOf(order: Order): { label: string; tone: PendingTone } {
  if (order.status === "partially_paid") {
    return { label: "Parcial", tone: "partial" };
  }
  if (order.status === "payment_pending") {
    return { label: "Pendiente", tone: "pending" };
  }
  return { label: "Registrado", tone: "registered" };
}

export default async function PendientesPage() {
  await connection();
  const pendingOrders = listPendingOrders(50);
  const pendingCount = countPendingOrders();
  const pendingCents = sumPendingOrderBalances();
  const tasks = listTasks(50);
  const tasksTotal = countTasks();
  const openTasks = tasks.filter((task) => task.status === "open").length;

  return (
    <OperationalPage
      activeHref="/pendientes"
      title="Pendientes"
      titleId="pendientes-title"
      eyebrow="Lo que sigue"
      subtitle="Cobros que faltan y tareas para después. Un cobro pendiente no es dinero recibido."
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={isDemoMode()}
    >
      <section className="mc-op-kpis" aria-label="Resumen de pendientes">
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Falta cobrar</p>
          <CurrencyAmount
            as="p"
            cents={pendingCents}
            className="mc-op-kpi__value"
          />
          <p className="mc-op-kpi__note">
            {pendingCount === 1
              ? "1 cobro pendiente · no se suma a la caja"
              : `${pendingCount} cobros pendientes · no se suma a la caja`}
          </p>
        </article>
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Tareas abiertas</p>
          <p className="mc-op-kpi__value">{openTasks}</p>
          <p className="mc-op-kpi__note">
            {tasksTotal === 1
              ? "1 tarea registrada"
              : `${tasksTotal} tareas registradas en total`}
          </p>
        </article>
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Cobros en la lista</p>
          <p className="mc-op-kpi__value">{pendingOrders.length}</p>
          <p className="mc-op-kpi__note">Los más antiguos primero</p>
        </article>
      </section>

      <div className="mc-op-grid mc-op-grid--sidebar">
        <section
          className="mc-op-panel mc-pend-collections"
          aria-labelledby="mc-pend-collections-title"
        >
          <div className="mc-op-panel__head">
            <h2
              id="mc-pend-collections-title"
              className="mc-op-panel__title"
            >
              Cobros pendientes
            </h2>
            <p className="mc-op-panel__meta">
              {pendingCount === 1 ? "1 en total" : `${pendingCount} en total`} ·
              Falta {formatMxn(pendingCents)}
            </p>
          </div>

          <div className="mc-op-panel__body">
            {pendingOrders.length === 0 ? (
              <div className="mc-op-empty" role="status">
                <p className="mc-op-empty__title">No hay cobros pendientes.</p>
                <p className="mc-op-empty__body">
                  Cuando una venta quede por cobrar aparecerá aquí, con su
                  enlace de pago y lo que falta cobrar.
                </p>
              </div>
            ) : (
              <ul className="mc-pend-orders">
                {pendingOrders.map((order) => {
                  const status = statusOf(order);
                  const money = saleMoney(order);
                  return (
                    <li key={order.id} className="mc-pend-order">
                      <div className="mc-pend-order__main">
                        <div className="mc-pend-order__title-row">
                          <p className="mc-pend-order__title">
                            Pedido {shortOrder(order.id)}
                          </p>
                          <span
                            className={`mc-pend-status mc-pend-status--${status.tone}`}
                          >
                            {status.label}
                          </span>
                          <span className="mc-pend-age">
                            {ageLabel(order.createdAt)}
                          </span>
                        </div>
                        <p className="mc-pend-order__meta">
                          {order.customerName
                            ? `${order.customerName} · `
                            : ""}
                          {formatActivityDate(order.createdAt)}
                          {order.items.length > 0
                            ? ` · ${order.items.length} ${
                                order.items.length === 1
                                  ? "concepto"
                                  : "conceptos"
                              }`
                            : ""}
                        </p>
                        <p className="mc-pend-order__amounts">
                          Total{" "}
                          <CurrencyAmount cents={money.totalCents} />
                          {money.paidCents > 0 ? (
                            <>
                              {" "}
                              · Cobrado{" "}
                              <CurrencyAmount cents={money.paidCents} />
                            </>
                          ) : null}
                          {order.creditCents > 0 ? (
                            <>
                              {" "}
                              · Fiado{" "}
                              <CurrencyAmount cents={order.creditCents} />
                            </>
                          ) : null}
                          <span className="mc-pend-order__due">
                            {" "}
                            · Falta cobrar{" "}
                            <strong>
                              <CurrencyAmount cents={money.dueCents} />
                            </strong>
                          </span>
                        </p>
                      </div>
                      <Link
                        href={`/pay/${order.id}`}
                        className="mc-pend-order__cta"
                        aria-label={`Cobrar pedido ${shortOrder(order.id)}`}
                      >
                        Cobrar
                        <ArrowRight
                          className="mc-pend-icon"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {pendingCount > pendingOrders.length ? (
              <p className="mc-pend-more">
                Mostrando los {pendingOrders.length} cobros más antiguos de{" "}
                {pendingCount}. Los demás siguen disponibles en Caja.
              </p>
            ) : null}
          </div>

          <div className="mc-op-panel__foot">
            <Link href="/caja" className="mc-pend-link">
              Ir a Caja
            </Link>
            <p className="mc-pend-foot-note">
              El cobro se completa con el enlace de pago o al registrar el
              efectivo en Caja.
            </p>
          </div>
        </section>

        <TasksPanel initialTasks={tasks} totalCount={tasksTotal} />
      </div>

      <p className="mc-pend-note">
        Un cobro pendiente no es dinero recibido: no entra a la caja hasta que
        se registre el efectivo o se confirme un pago válido. Las tareas son
        recordatorios y no mueven saldos.
      </p>
    </OperationalPage>
  );
}
