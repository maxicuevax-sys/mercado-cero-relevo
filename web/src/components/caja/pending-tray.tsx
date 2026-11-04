"use client";

import { CurrencyAmount } from "@/components/ui/currency-amount";
import { saleMoney } from "@/lib/sale-truth";
import type { Order } from "@/lib/types";

export type PendingEntry = {
  id: string;
  order: Order | null;
  creditBalanceCents: number;
  error?: string;
};

export function PendingTray({
  entries,
  onOpen,
  onRefresh,
}: {
  entries: PendingEntry[];
  onOpen: (entry: PendingEntry) => void;
  onRefresh: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="mc-caja-card mc-caja-pending" aria-labelledby="mc-caja-pending-title">
      <div className="mc-caja-card__head">
        <div>
          <p className="mc-caja-eyebrow">Pendientes</p>
          <h2 id="mc-caja-pending-title">
            {entries.length === 1 ? "1 cobro en curso" : `${entries.length} cobros en curso`}
          </h2>
        </div>
        <button type="button" className="mc-caja-button mc-caja-button--secondary" onClick={onRefresh}>
          Actualizar lista
        </button>
      </div>
      <ul className="mc-caja-pending__list">
        {entries.map((entry) => {
          const order = entry.order;
          const money = order ? saleMoney(order, entry.creditBalanceCents) : null;
          return (
            <li key={entry.id}>
              <div className="mc-caja-pending__copy">
                <p className="mc-caja-pending__title">
                  Pedido {entry.id.slice(-4).toUpperCase()}
                  {order ? ` · ${statusLabel(order.status)}` : " · sin lectura"}
                </p>
                {order && money ? (
                  <p className="mc-caja-pending__amounts">
                    Total <CurrencyAmount cents={money.totalCents} /> · Cobrado{" "}
                    <CurrencyAmount cents={money.paidCents} />
                    {money.dueCents > 0 ? (
                      <>
                        {" "}· Falta <CurrencyAmount cents={money.dueCents} />
                      </>
                    ) : null}
                    {money.openCredit ? (
                      <>
                        {" "}· Fiado <CurrencyAmount cents={money.creditBalanceCents} />
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mc-caja-pending__amounts">
                    No pudimos leer este pedido. No lo des por cobrado ni lo elimines.
                  </p>
                )}
              </div>
              {order ? (
                <button
                  type="button"
                  className="mc-caja-button mc-caja-button--secondary"
                  onClick={() => onOpen(entry)}
                >
                  {money && money.dueCents > 0 ? "Seguir cobrando" : "Ver resultado"}
                </button>
              ) : (
                <button
                  type="button"
                  className="mc-caja-button mc-caja-button--quiet"
                  onClick={onRefresh}
                >
                  Reintentar lectura
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mc-caja-pending__note">
        Estos pedidos ya están registrados en el servidor. Iniciar otra venta no los cancela ni
        los borra; puedes retomarlos desde aquí.
      </p>
    </section>
  );
}

function statusLabel(status: Order["status"]): string {
  switch (status) {
    case "payment_pending":
      return "pendiente";
    case "partially_paid":
      return "parcial";
    case "confirmed":
      return "registrado";
    case "paid":
      return "pagado";
    case "demo_paid":
      return "demo";
    case "fulfilled":
      return "entregado";
    case "cancelled":
      return "cancelado";
    default:
      return status;
  }
}
