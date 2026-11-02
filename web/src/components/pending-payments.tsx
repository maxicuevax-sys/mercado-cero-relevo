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
import { cn, formatActivityDate, formatMxn, shortOrder } from "@/lib/format";
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
    className: "bg-surface-2 text-ink-2",
    Icon: Link2Off,
  },
  payment_pending: {
    label: "Esperando banco",
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
    className: "bg-surface-2 text-ink-2",
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
    .map((item) => `${item.quantity} ${item.description}`.trim())
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
      className="rounded-2xl border border-separator bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-terracotta-soft text-attention">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id={titleId}
              className="break-words text-[1.0625rem] font-semibold tracking-tight text-ink"
            >
              Cobros pendientes
            </h2>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-2">
              {countLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2">{lastCheckedLabel}</p>
        </div>

        <div className="ml-auto max-w-full shrink-0 text-right">
          <p className="text-xs font-semibold text-ink-2">Total pendiente</p>
          <p className="tabular mt-0.5 text-[1.25rem] font-semibold leading-tight text-ink">
            {totalLabel}
          </p>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mx-4 mb-3 flex flex-wrap items-start gap-x-2 gap-y-2 rounded-xl border border-attention/25 bg-terracotta-soft/60 px-3 py-2 text-sm text-ink sm:mx-5"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">
            <span className="font-semibold">No pude comprobar los cobros.</span>{" "}
            <span className="text-ink-2">{error}</span>
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-green transition hover:border-accent/40 hover:text-accent"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : null}

      {!hasOrders && !error ? (
        <p className="border-t border-separator px-4 py-3 text-sm text-ink-2 sm:px-5">
          No hay cobros pendientes.
        </p>
      ) : null}

      {hasOrders ? (
        <ul id={listId} className="motion-list border-t border-separator">
          {visibleOrders.map((order) => {
            const meta = statusMeta(order.status);
            const Icon = meta.Icon;
            const balanceCents = pendingBalanceCents(order);
            const summary = orderSummary(order);
            const paidCents = Math.max(0, Math.min(order.paidCents, order.totalCents));

            return (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-separator px-4 py-3 last:border-b-0 sm:px-5"
              >
                <div className="min-w-0 flex-1 basis-[10rem]">
                  <p className="break-words text-sm font-semibold leading-snug text-ink">
                    {summary}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                        meta.className,
                      )}
                    >
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

                <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-2">
                      Saldo
                    </p>
                    <p className="tabular whitespace-nowrap text-sm font-semibold text-ink">
                      {formatMxn(balanceCents)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(order)}
                    aria-label={`Ver cobro: ${summary}, ${formatMxn(balanceCents)}`}
                    className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-green transition hover:border-accent/40 hover:bg-green-soft hover:text-accent"
                  >
                    Ver
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canExpand ? (
        <div className="border-t border-separator px-2 py-1 sm:px-3">
          {expanded && orders.length > EXPANDED_LIMIT ? (
            <p className="px-2 pt-2 text-xs text-ink-2">
              Mostrando los primeros {EXPANDED_LIMIT} de {orders.length}.
            </p>
          ) : null}
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls={listId}
            className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-green transition hover:bg-surface-2"
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
