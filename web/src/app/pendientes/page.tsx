import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Clock3 } from "lucide-react";
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
import reciboIcon from "@/assets/brand/iconos/transparent/recibo.png";
import qrIcon from "@/assets/brand/iconos/transparent/qr-telefono.png";
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
  const tasks = listTasks(200);
  const tasksTotal = countTasks();

  return (
    <OperationalPage
      activeHref="/pendientes"
      title="Pendientes"
      titleId="pendientes-title"
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={isDemoMode()}
      contentClassName="mc-pend-main"
    >
      <div className="mc-pend-screen">
        <TasksPanel initialTasks={tasks} totalCount={tasksTotal} />

        <section
          id="mc-pend-cobros"
          className="mc-pend-collections"
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
                  sizes="(max-width: 479px) 44px, 72px"
                />
                <div className="mc-pend-empty__copy">
                  <p className="mc-pend-empty__title">
                    No hay cobros pendientes.
                  </p>
                  <p className="mc-pend-empty__text">
                    Cuando una venta quede por cobrar aparecerá aquí, con su
                    enlace de pago y lo que falta cobrar.
                  </p>
                  <Link
                    href="/caja"
                    className="mc-pend-cta mc-pend-cta--secondary"
                  >
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
                            {status.tone === "pending" ? (
                              <Clock3 aria-hidden="true" />
                            ) : null}
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

          <div className="mc-op-panel__foot mc-pend-collections__foot">
            <p className="mc-pend-foot-note">
              El cobro se completa con el enlace de pago o al registrar el
              efectivo en Caja.
            </p>
            {pendingOrders.length > 0 ? (
              <Link
                href="/caja"
                className="mc-pend-cta mc-pend-cta--secondary"
              >
                Ir a Caja
                <ArrowRight className="mc-pend-icon" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </section>

        <p className="mc-pend-note">
          Un cobro pendiente no es dinero recibido: no entra a la caja hasta
          que se registre el efectivo o se confirme un pago válido. Los
          pendientes son recordatorios y no mueven saldos.
        </p>
      </div>
    </OperationalPage>
  );
}
