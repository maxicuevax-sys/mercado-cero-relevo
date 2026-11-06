import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { MaskIcon } from "@/components/ui/icon";
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
import botArt from "@/assets/brand/ilustraciones/transparent/bot.png";
import reciboIcon from "@/assets/brand/iconos/transparent/recibo.png";
import qrIcon from "@/assets/brand/iconos/transparent/qr-telefono.png";
import picadoArt from "@/assets/inicio/papel-picado.png";
import iconMonedas from "@/assets/inicio/icons/monedas.svg";
import iconPendientes from "@/assets/inicio/icons/pendientes.svg";
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
      eyebrow="LO QUE SIGUE"
      subtitle="Cobros que faltan y tareas para después. Un cobro pendiente no es dinero recibido."
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={isDemoMode()}
      contentClassName="mc-pend-main"
    >
      <div className="mc-op-grid mc-op-grid--sidebar mc-pend-grid">
        <section
          id="mc-pend-cobros"
          className="mc-op-panel mc-pend-collections"
          aria-labelledby="mc-pend-collections-title"
        >
          <div className="mc-pend-panel-head">
            <span className="mc-pend-medallion mc-pend-medallion--saffron">
              <Image
                src={reciboIcon}
                alt=""
                aria-hidden="true"
                width={22}
                height={25}
                className="mc-pend-medallion__art"
              />
            </span>
            <div className="mc-pend-panel-head__copy">
              <h2
                id="mc-pend-collections-title"
                className="mc-op-panel__title"
              >
                Cobros pendientes
              </h2>
              <p className="mc-op-panel__meta">
                {pendingCount === 1 ? "1 en total" : `${pendingCount} en total`}{" "}
                · Falta {formatMxn(pendingCents)}
              </p>
            </div>
          </div>

          <div className="mc-op-panel__body">
            {pendingOrders.length === 0 ? (
              <div className="mc-pend-empty" role="status">
                <Image
                  src={qrIcon}
                  alt=""
                  aria-hidden="true"
                  width={80}
                  height={93}
                  className="mc-pend-empty__art"
                  sizes="80px"
                />
                <div className="mc-pend-empty__copy">
                  <p className="mc-pend-empty__title">
                    No hay cobros pendientes.
                  </p>
                  <p className="mc-pend-empty__text">
                    Cuando una venta quede por cobrar aparecerá aquí, con su
                    enlace de pago y lo que falta cobrar.
                  </p>
                  <Link href="/caja" className="mc-pend-cta mc-pend-cta--secondary">
                    Ir a Caja
                    <ArrowRight className="mc-pend-icon" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="mc-pend-orders">
                {pendingOrders.map((order) => {
                  const status = statusOf(order);
                  const money = saleMoney(order);
                  return (
                    <li key={order.id} className="mc-pend-order">
                      <span className="mc-pend-order__medallion">
                        <Image
                          src={reciboIcon}
                          alt=""
                          aria-hidden="true"
                          width={20}
                          height={23}
                          className="mc-pend-order__medallion-art"
                        />
                      </span>
                      <div className="mc-pend-order__main">
                        <div className="mc-pend-order__title-row">
                          <p className="mc-pend-order__title">
                            Pedido {shortOrder(order.id)}
                          </p>
                          <span
                            className={`mc-pend-sello mc-pend-sello--${status.tone}`}
                          >
                            {status.label}
                          </span>
                          <span className="mc-pend-age">
                            {ageLabel(order.createdAt)}
                          </span>
                        </div>
                        <p className="mc-pend-order__meta">
                          {order.customerName ? `${order.customerName} · ` : ""}
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
                          Total <CurrencyAmount cents={money.totalCents} />
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
                        </p>
                      </div>
                      <div className="mc-pend-order__side">
                        <p className="mc-pend-order__due-label">
                          Falta cobrar
                        </p>
                        <p className="mc-pend-order__due-amount">
                          <CurrencyAmount cents={money.dueCents} />
                        </p>
                        <Link
                          href={`/pay/${order.id}`}
                          prefetch={false}
                          className="mc-pend-order__cta"
                          aria-label={`Cobrar pedido ${shortOrder(order.id)}`}
                        >
                          Cobrar
                          <ArrowRight
                            className="mc-pend-icon"
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
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
            <p className="mc-pend-foot-note">
              El cobro se completa con el enlace de pago o al registrar el
              efectivo en Caja.
            </p>
            {pendingOrders.length > 0 ? (
              <Link href="/caja" className="mc-pend-cta mc-pend-cta--secondary">
                Ir a Caja
                <ArrowRight className="mc-pend-icon" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </section>

        <TasksPanel initialTasks={tasks} totalCount={tasksTotal} />
      </div>

      <section className="mc-pend-hero" aria-labelledby="mc-pend-hero-title">
        <Image
          src={picadoArt}
          alt=""
          aria-hidden="true"
          className="mc-pend-hero__picado"
          sizes="(max-width: 767px) 160px, 200px"
        />
        <div className="mc-pend-hero__art">
          <Image
            src={botArt}
            alt=""
            aria-hidden="true"
            width={435}
            height={414}
            className="mc-pend-hero__art-img"
            sizes="(max-width: 767px) 150px, 210px"
          />
        </div>
        <div className="mc-pend-hero__copy">
          <p className="mc-pend-hero__kicker">Tu asistente</p>
          <h2 id="mc-pend-hero-title" className="mc-pend-hero__title">
            Tu día, en orden.
          </h2>
          <p className="mc-pend-hero__text">
            Los cobros por un lado, los recados por otro. Lo que falta queda a
            la vista, sin mezclarlo con el dinero que ya entró.
          </p>
          <ul className="mc-pend-hero__chips">
            <li className="mc-pend-hero__chip">
              <MaskIcon src={iconMonedas} className="mc-pend-hero__chip-icon" />
              {pendingCount === 1 ? "1 cobro" : `${pendingCount} cobros`}
            </li>
            <li className="mc-pend-hero__chip">
              <MaskIcon
                src={iconPendientes}
                className="mc-pend-hero__chip-icon"
              />
              {openTasks === 1 ? "1 tarea" : `${openTasks} tareas`}
            </li>
          </ul>
        </div>
      </section>

      <p className="mc-pend-note">
        Un cobro pendiente no es dinero recibido: no entra a la caja hasta que
        se registre el efectivo o se confirme un pago válido. Las tareas son
        recordatorios y no mueven saldos.
      </p>
    </OperationalPage>
  );
}
