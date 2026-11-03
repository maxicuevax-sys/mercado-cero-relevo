"use client";

import { useId, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Link2Off,
  RefreshCw,
} from "lucide-react";
import { formatActivityDate, formatMxn, shortOrder } from "@/lib/format";
import type { Order } from "@/lib/types";

const COLLAPSED_LIMIT = 3;
const EXPANDED_LIMIT = 50;

type PendingStatus = "confirmed" | "payment_pending" | "partially_paid";

const STATUS: Record<
  PendingStatus,
  { label: string; className: string; Icon: typeof Clock3 }
> = {
  confirmed: {
    label: "Sin link",
    className: "border border-separator bg-surface text-ink-2",
    Icon: Link2Off,
  },
  payment_pending: {
    label: "Esperando confirmación",
    className: "bg-terracotta-soft text-attention",
    Icon: Clock3,
  },
  partially_paid: {
    label: "Parcial",
    className: "bg-blue-soft text-info",
    Icon: CircleDollarSign,
  },
};

function statusMeta(status: Order["status"]) {
  if (status === "confirmed" || status === "payment_pending" || status === "partially_paid") {
    return STATUS[status];
  }
  return {
    label: "Pendiente",
    className: "border border-separator bg-surface text-ink-2",
    Icon: Clock3,
  };
}

/**
 * Saldo digital por cobrar. El fiado ya vive en su propia libreta, así que no
 * se suma aquí: total − pagado − fiado.
 */
function pendingBalanceCents(order: Order): number {
  const total = Number.isFinite(order.totalCents) ? order.totalCents : 0;
  const paid = Number.isFinite(order.paidCents) ? order.paidCents : 0;
  const credit = Number.isFinite(order.creditCents) ? order.creditCents : 0;
  return Math.max(0, total - paid - credit);
}

function orderSummary(order: Order): string {
  const parts = (order.items ?? [])
    .map((item) => `${item.quantity} × ${item.description}`.trim())
    .filter(Boolean);
  if (parts.length === 0) return `Pedido ${shortOrder(order.id)}`;
  if (parts.length <= 2) return parts.join(" · ");
  return `${parts.slice(0, 2).join(" · ")} y ${parts.length - 2} más`;
}

export interface PendingPaymentsProps {
  orders: Order[];
  lastCheckedAt: string | null;
  error: string | null;
  onOpen: (order: Order) => void;
  onRetry: () => void;
  onViewAll?: () => void;
}

/**
 * Franja compacta de cobros pendientes. No abre ninguna hoja por sí sola:
 * la persona decide con el botón "Ver" de cada fila.
 */
export function PendingPayments({
  orders,
  lastCheckedAt,
  error,
  onOpen,
  onRetry,
  onViewAll,
}: PendingPaymentsProps) {
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const listId = useId();

  const visibleOrders = orders.slice(0, expanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT);
  const totalPendingCents = orders.reduce((sum, order) => sum + pendingBalanceCents(order), 0);
  const hasOrders = orders.length > 0;
  const canExpand = orders.length > COLLAPSED_LIMIT;
  const countLabel = hasOrders ? orders.length : error ? "—" : "0";
  const totalLabel = hasOrders ? formatMxn(totalPendingCents) : error ? "Sin datos" : formatMxn(0);
  const lastCheckedLabel = lastCheckedAt
    ? `Última comprobación: ${formatActivityDate(lastCheckedAt)}`
    : "Aún no se ha comprobado.";

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next) onViewAll?.();
  }

  return (
    <section
      aria-labelledby={titleId}
      className="pending-strip"
    >
      <div className="pending-strip__head">
        <div className="min-w-0">
          <div className="pending-strip__title">
            <Clock3 className="h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
            <h2 id={titleId}>Cobros pendientes (todas las fechas)</h2>
            <span className="pending-strip__count" aria-hidden="true">
              {countLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2">{lastCheckedLabel}</p>
        </div>

        <div className="pending-strip__total">
          <span>Total pendiente</span>
          <strong>{totalLabel}</strong>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mx-3 mb-3 flex flex-wrap items-start gap-x-2 gap-y-2 border-l-2 border-attention bg-terracotta-soft/60 px-3 py-2 text-sm text-ink"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">
            <span className="font-semibold">No pude comprobar los cobros.</span>{" "}
            <span className="text-ink-2">{error}</span>
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-12 shrink-0 items-center justify-center gap-1.5 border border-control-border bg-surface px-3 text-sm font-semibold text-accent transition hover:text-accent-press"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : null}

      {!hasOrders && !error ? (
        <p className="pending-strip__empty">
          No hay cobros pendientes.
        </p>
      ) : null}

      {hasOrders ? (
        <ul id={listId} className="pending-strip__list motion-list">
          {visibleOrders.map((order) => {
            const meta = statusMeta(order.status);
            const Icon = meta.Icon;
            const balanceCents = pendingBalanceCents(order);
            const summary = orderSummary(order);
            const paidCents = Math.max(0, Math.min(order.paidCents, order.totalCents));

            return (
              <li
                key={order.id}
                className="pending-strip__row"
              >
                <div className="pending-strip__summary">
                  <p className="break-words">
                    {summary}
                  </p>
                  <div className="pending-strip__meta">
                    <span className="inline-flex items-center gap-1 font-semibold text-attention">
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {meta.label}
                    </span>
                    <time dateTime={order.createdAt}>{formatActivityDate(order.createdAt)}</time>
                    {order.status === "partially_paid" ? (
                      <span>
                        Pagó {formatMxn(paidCents)} de {formatMxn(order.totalCents)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="pending-strip__balance">
                  <span>Saldo</span>
                  <strong>{formatMxn(balanceCents)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(order)}
                  aria-label={`Ver cobro: ${summary}, ${formatMxn(balanceCents)}`}
                  className="flex min-h-12 min-w-12 items-center justify-center border border-control-border bg-surface px-3 text-sm font-semibold text-accent transition hover:bg-green-soft hover:text-accent-press"
                >
                  Ver
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canExpand ? (
        <div>
          {expanded && orders.length > EXPANDED_LIMIT ? (
            <p className="px-3 pt-2 text-xs text-ink-2">
              Mostrando los primeros {EXPANDED_LIMIT} de {orders.length}.
            </p>
          ) : null}
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls={listId}
            className="pending-strip__more flex items-center justify-center gap-1.5"
          >
            {expanded ? (
              <>
                Ver menos
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                Ver todos
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
