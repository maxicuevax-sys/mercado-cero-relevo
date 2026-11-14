"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { formatMxn } from "@/lib/format";
import { presentTimeline, type PulsoEvent } from "@/lib/pulso-timeline";
import { boardWord, hasRealCodiQr, pickCodiTicket } from "@/lib/stall-board";
import type { Order } from "@/lib/types";
import "./stall-board.css";

const POLL_MS = 3000;

export interface BoardProduct {
  id: string;
  name: string;
  stock: number;
  priceCents: number;
}

export interface BoardEvent {
  orderId: string;
  step: string;
  at: string;
  detail: string | null;
}

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
  initialProducts,
  initialEvents,
  initialProducing,
}: {
  dayLabel: string;
  demo: boolean;
  initialOrders: Order[];
  initialProducts: BoardProduct[];
  initialEvents: BoardEvent[];
  initialProducing: string[];
}) {
  const now = useNow();
  const [orders, setOrders] = useState(initialOrders);
  const [products, setProducts] = useState(initialProducts);
  const [events, setEvents] = useState(initialEvents);
  const [producing, setProducing] = useState(initialProducing);
  const [phrase, setPhrase] = useState("una quesadilla y un agua");
  const [phraseBusy, setPhraseBusy] = useState(false);
  const [phraseNote, setPhraseNote] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const featured = pickCodiTicket(orders);
  const rest = orders.filter((order) => order.id !== featured?.id);

  useEffect(() => {
    let active = true;
    async function pull() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/tablero", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          orders?: Order[];
          products?: BoardProduct[];
          events?: BoardEvent[];
          producing?: string[];
        };
        if (!active) return;
        if (Array.isArray(data.orders)) setOrders(data.orders);
        if (Array.isArray(data.products)) setProducts(data.products);
        if (Array.isArray(data.events)) setEvents(data.events);
        if (Array.isArray(data.producing)) setProducing(data.producing);
      } catch {
        // El tablero conserva la última lectura.
      }
    }
    refreshRef.current = pull;
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

  async function submitPhrase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = phrase.trim();
    if (!text || phraseBusy) return;
    setPhraseBusy(true);
    setPhraseNote(null);
    try {
      const response = await fetch("/api/tablero/frase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: text, requestId: crypto.randomUUID() }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) {
        setPhraseNote(data.error ?? "No pude anotar el pedido.");
        return;
      }
      const line = data.order.items.map((item) => `${item.quantity} ${item.description}`).join(" y ");
      setPhraseNote(`Anoté ${line}. Sigue por cobrar.`);
      await refreshRef.current();
    } catch {
      setPhraseNote("No pude anotar el pedido. Revisa la conexión.");
    } finally {
      setPhraseBusy(false);
    }
  }

  return (
    <div className="mc-board">
      <form className="mc-board__phrase" onSubmit={(event) => void submitPhrase(event)}>
        <label htmlFor="mc-board-phrase">Pedido en una frase</label>
        <div>
          <input
            id="mc-board-phrase"
            value={phrase}
            maxLength={200}
            autoComplete="off"
            onChange={(event) => setPhrase(event.target.value)}
          />
          <button type="submit" disabled={phraseBusy || phrase.trim().length === 0}>
            {phraseBusy ? "Anotando…" : "Anotar"}
          </button>
        </div>
        {phraseNote ? <p role="status">{phraseNote}</p> : null}
      </form>
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
            producing={producing.includes(featured.id)}
            events={events.filter((event) => event.orderId === featured.id)}
          />
        ) : (
          <article className="mc-board__card mc-board__card--feature" data-word="rejected" aria-labelledby="mc-board-empty-codi">
            <p className="mc-board__kicker">Pulso · CoDi</p>
            <h2 id="mc-board-empty-codi" className="mc-board__word">
              RECHAZADO
            </h2>
            <p className="mc-board__detail">CoDi no activo. Esta tarjeta no pide un cobro.</p>
          </article>
        )}
        <ul className="mc-board__rest">
          {rest.map((order) => (
            <li key={order.id}>
              <TicketCard order={order} demo={demo} now={now} producing={producing.includes(order.id)} />
            </li>
          ))}
        </ul>
      </div>
      <section className="mc-board__stock" aria-label="Existencias del puesto">
        <h2 className="mc-board__stock-title">Existencias</h2>
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              <span>{product.name}</span>
              <strong>{product.stock}</strong>
            </li>
          ))}
        </ul>
      </section>
      {orders.length === 0 ? (
        <p className="mc-board__empty" role="status">
          Hoy todavía no hay tickets. Las ventas de Caja aparecen aquí.
        </p>
      ) : null}
    </div>
  );
}

function FeaturedTicket({
  order,
  demo,
  now,
  producing,
  events,
}: {
  order: Order;
  demo: boolean;
  now: number | null;
  producing: boolean;
  events: BoardEvent[];
}) {
  const word = boardWord(order, now, { simulation: demo, producing });
  const realQr = hasRealCodiQr(order);
  const marks = presentTimeline(events as PulsoEvent[], {
    createdAt: order.createdAt,
    codiInactive: word.face === "rejected",
  });
  return (
    <article
      className="mc-board__card mc-board__card--feature"
      data-word={word.face}
      aria-labelledby={`mc-board-${order.id}-word`}
    >
      <p className="mc-board__kicker">Pulso · CoDi · {folio(order.id)}</p>
      <h2 id={`mc-board-${order.id}-word`} className="mc-board__word" role="status" aria-live="polite">
        {word.word}
      </h2>
      <p className="mc-board__amount">{formatMxn(order.totalCents)}</p>
      <p className="mc-board__items">{itemLine(order)}</p>
      <p className="mc-board__detail">{word.detail}</p>
      {realQr && order.qrImage && word.face !== "producing" ? (
        // El PNG lo genera el servidor a partir del qrString de pey.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="mc-board__qr"
          src={order.qrImage}
          alt={`QR CoDi del pedido ${folio(order.id)}, ${formatMxn(order.totalCents)}. No es un comprobante de pago.`}
        />
      ) : null}
      {producing ? (
        <div className="mc-board__ticket">
          <p>Comanda</p>
          <ul>
            {order.items.map((item) => (
              <li key={item.id}>
                {item.quantity} {item.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ol className="mc-board__timeline">
        {marks.map((mark) => (
          <li key={mark.step} data-done={mark.done ? "true" : "false"}>
            <span className="mc-board__step-name">{mark.step}</span>
            <span className="mc-board__step-detail">{mark.detail}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function TicketCard({
  order,
  demo,
  now,
  producing,
}: {
  order: Order;
  demo: boolean;
  now: number | null;
  producing: boolean;
}) {
  const word = boardWord(order, now, { simulation: demo, producing });
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
