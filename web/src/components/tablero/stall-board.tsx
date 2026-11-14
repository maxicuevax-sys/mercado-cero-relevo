"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatMxn } from "@/lib/format";
import { boardWord, hasRealCodiQr, pickCodiTicket } from "@/lib/stall-board";
import type { Order } from "@/lib/types";
import "./stall-board.css";

const POLL_MS = 3000;

function useNow(): number | null {
  return useSyncExternalStore(
    (callback) => {
      const id = window.setInterval(callback, 1000);
      return () => window.clearInterval(id);
    },
    () => Date.now(),
    () => null,
  );
}

export function StallBoard({
  dayLabel,
  demo,
  initialOrders,
}: {
  dayLabel: string;
  demo: boolean;
  initialOrders: Order[];
}) {
  const now = useNow();
  const [orders, setOrders] = useState(initialOrders);
  const [rejectedId, setRejectedId] = useState<string | null>(null);
  const [askingId, setAskingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const featured = pickCodiTicket(orders);
  const rest = orders.filter((order) => order.id !== featured?.id);

  useEffect(() => {
    let active = true;
    async function pull() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/tablero", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { orders?: Order[] };
        if (active && Array.isArray(data.orders)) setOrders(data.orders);
      } catch {
        // El tablero conserva la última lectura.
      }
    }
    const id = window.setInterval(() => void pull(), POLL_MS);
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", pull);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  async function askQr(orderId: string) {
    if (askingId) return;
    setAskingId(orderId);
    setNotice(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "qr" }),
      });
      const data = (await response.json()) as { order?: Order; error?: string; code?: string };
      if (!response.ok || !data.order) {
        if (response.status >= 400 && response.status < 500) setRejectedId(orderId);
        setNotice(data.error ?? "No se pudo pedir el QR.");
        return;
      }
      setRejectedId(null);
      setOrders((current) => current.map((order) => (order.id === data.order?.id ? data.order : order)));
    } catch {
      setNotice("No sabemos si pey creó el QR. Revisa la conexión antes de pedirlo otra vez.");
    } finally {
      setAskingId(null);
    }
  }

  return (
    <div className="mc-board">
      <p className="mc-board__day">
        {formatDay(dayLabel)}
        {demo ? " · simulación" : ""}
      </p>
      <div className="mc-board__grid">
        {featured ? (
          <FeaturedTicket
            order={featured}
            demo={demo}
            now={now}
            rejected={rejectedId === featured.id}
            asking={askingId === featured.id}
            onAsk={() => void askQr(featured.id)}
          />
        ) : (
          <article className="mc-board__card mc-board__card--feature" aria-labelledby="mc-board-empty-codi">
            <p className="mc-board__kicker">Cobro CoDi</p>
            <h2 id="mc-board-empty-codi" className="mc-board__word">
              Sin cobro abierto
            </h2>
            <p className="mc-board__detail">
              Registra el ticket en Caja. El QR sale por el mismo cobro de pey y este lugar pasa a PAGADO solo con el webhook firmado.
            </p>
          </article>
        )}
        <ul className="mc-board__rest">
          {rest.map((order) => (
            <li key={order.id}>
              <TicketCard order={order} demo={demo} now={now} rejected={rejectedId === order.id} />
            </li>
          ))}
        </ul>
      </div>
      {orders.length === 0 ? (
        <p className="mc-board__empty" role="status">
          Hoy todavía no hay tickets. Las ventas de Caja aparecen aquí.
        </p>
      ) : null}
      {notice ? (
        <p className="mc-board__notice" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function FeaturedTicket({
  order,
  demo,
  now,
  rejected,
  asking,
  onAsk,
}: {
  order: Order;
  demo: boolean;
  now: number | null;
  rejected: boolean;
  asking: boolean;
  onAsk: () => void;
}) {
  const word = boardWord(order, now, { simulation: demo, rejected });
  const realQr = hasRealCodiQr(order);
  const open = word.face !== "paid" && word.face !== "cash" && word.face !== "demo" && word.face !== "credit";
  return (
    <article
      className="mc-board__card mc-board__card--feature"
      data-word={word.face}
      aria-labelledby={`mc-board-${order.id}-word`}
    >
      <p className="mc-board__kicker">Cobro CoDi · {folio(order.id)}</p>
      <h2 id={`mc-board-${order.id}-word`} className="mc-board__word" role="status" aria-live="polite">
        {word.word}
      </h2>
      <p className="mc-board__amount">{formatMxn(order.totalCents)}</p>
      <p className="mc-board__items">{itemLine(order)}</p>
      <p className="mc-board__detail">{word.detail}</p>
      {realQr && order.qrImage && open ? (
        // El PNG lo genera el servidor a partir del qrString de pey.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="mc-board__qr"
          src={order.qrImage}
          alt={`QR CoDi del pedido ${folio(order.id)}, ${formatMxn(order.totalCents)}. No es un comprobante de pago.`}
        />
      ) : null}
      {realQr && open && order.numRef ? (
        <p className="mc-board__ref">
          Referencia <strong>{order.numRef}</strong>
        </p>
      ) : null}
      {!realQr && open ? (
        <button type="button" className="mc-board__ask" onClick={onAsk} disabled={asking}>
          {asking ? "Pidiendo el QR…" : "Pedir QR CoDi"}
        </button>
      ) : null}
    </article>
  );
}

function TicketCard({
  order,
  demo,
  now,
  rejected,
}: {
  order: Order;
  demo: boolean;
  now: number | null;
  rejected: boolean;
}) {
  const word = boardWord(order, now, { simulation: demo, rejected });
  return (
    <article className="mc-board__card" data-word={word.face} aria-label={`${folio(order.id)} ${word.word}`}>
      <p className="mc-board__kicker">{folio(order.id)}</p>
      <p className="mc-board__word mc-board__word--side">{word.word}</p>
      <p className="mc-board__amount mc-board__amount--side">{formatMxn(order.totalCents)}</p>
      <p className="mc-board__items">{itemLine(order)}</p>
    </article>
  );
}

function folio(id: string): string {
  return id.slice(-4).toUpperCase();
}

function itemLine(order: Order): string {
  if (order.items.length === 0) return "Sin conceptos";
  return order.items.map((item) => `${item.quantity} ${item.description}`).join(" · ");
}

function formatDay(label: string): string {
  const [year, month, day] = label.split("-").map(Number);
  if (!year || !month || !day) return label;
  const formatted = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, day, 18)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
