"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Banknote, Check, Loader2, QrCode, RefreshCw, Zap } from "lucide-react";
import qrArt from "@/assets/brand/ilustraciones/transparent/qr.png";
import { parseMoneyCents } from "@/components/caja/types";
import { formatMxn } from "@/lib/format";
import { PAYMENT_STATES, orderStatusCopy } from "@/lib/payment-labels";
import type { Order } from "@/lib/types";
import "./codi-hub.css";

/** Mismo tope que `MAX_UNIT_PRICE_CENTS` en lib/orders.ts; se valida también en el servidor. */
const MAX_AMOUNT_CENTS = 10_000_000;
const MIN_AMOUNT_CENTS = 100;
const QUICK_AMOUNTS = [2_000, 5_000, 10_000, 20_000];
const POLL_MS = 5_000;
const TERMINAL: ReadonlySet<Order["status"]> = new Set([
  "paid",
  "demo_paid",
  "fulfilled",
  "cancelled",
]);

type PendingRequest = { id: string; amountCents: number };

/**
 * Hub CoDi de Inicio. Es la puerta principal para cobrar: pide el monto y
 * reutiliza el flujo existente de órdenes (`/api/orders` + `.../pay` qr) y el
 * simulador demo (`/api/demo/pay`). No inventa endpoints ni duplica la lógica
 * del QR: un QR generado nunca se muestra como dinero recibido.
 */
export function CodiHub({ demo, initialOrder = null }: { demo: boolean; initialOrder?: Order | null }) {
  const initialDueCents = initialOrder
    ? Math.max(initialOrder.totalCents - initialOrder.paidCents, 0)
    : 0;
  const [amountRaw, setAmountRaw] = useState(
    initialDueCents > 0 ? (initialDueCents / 100).toFixed(2) : "",
  );
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<PendingRequest | null>(null);
  const focusKeyRef = useRef<string | null>(null);

  const amountCents = parseMoneyCents(amountRaw);
  const settled =
    order !== null &&
    (order.status === "paid" || order.status === "demo_paid" || order.status === "fulfilled");

  // Consulta periódica del estado real del pedido: el hub nunca se declara
  // pagado por su cuenta. En demo el cambio llega al simular el pago.
  // Una orden existente que viene de Pendientes puede no tener QR todavía.
  // El hub lo genera al entrar para que el centro CoDi siempre muestre el QR.
  useEffect(() => {
    if (!initialOrder || initialOrder.qrImage || TERMINAL.has(initialOrder.status)) return;
    let active = true;
    void requestQr(initialOrder.id)
      .then((next) => {
        if (active) setOrder(next);
      })
      .catch((caught) => {
        if (active) setError(friendlyError(caught, "No se pudo preparar el QR del pedido."));
      });
    return () => {
      active = false;
    };
  }, [initialOrder]);

  useEffect(() => {
    if (!order || TERMINAL.has(order.status)) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { order?: Order };
        if (active && data.order && data.order.updatedAt >= order.updatedAt) {
          setOrder(data.order);
        }
      } catch {
        // El sondeo no debe tapar la operación; "Consultar estado" es explícito.
      }
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [order]);

  // Al aparecer el QR o al confirmarse el pago se mueve el foco al título del
  // estado, para que el cambio se anuncie también con teclado y lector.
  useEffect(() => {
    if (!order) return;
    const key = `${settled ? "settled" : "pending"}:${order.id}`;
    if (focusKeyRef.current === key) return;
    focusKeyRef.current = key;
    headingRef.current?.focus();
  }, [order, settled]);

  async function startCobro() {
    if (creating || simulating) return;
    const cents = amountCents;
    if (cents < MIN_AMOUNT_CENTS) {
      setError("Escribe un monto de al menos $1.00 para cobrar.");
      amountRef.current?.focus();
      return;
    }
    if (cents > MAX_AMOUNT_CENTS) {
      setError("El monto máximo por cobro es $100,000.00.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      let current = order;
      if (!current) {
        // Si la conexión falla después de enviar, se reintenta con la misma
        // llave para no duplicar el pedido.
        let request = requestRef.current;
        if (!request || request.amountCents !== cents) {
          request = { id: newClientKey("cobro"), amountCents: cents };
          requestRef.current = request;
        }
        current = await requestOrder(cents, request.id);
        setOrder(current);
      }
      if (!current.qrImage) {
        current = await requestQr(current.id);
        setOrder(current);
      }
      requestRef.current = null;
    } catch (caught) {
      setError(friendlyError(caught, "No se pudo iniciar el cobro con CoDi."));
    } finally {
      setCreating(false);
    }
  }

  async function startCashCobro() {
    if (creating || simulating) return;
    const cents = amountCents;
    if (cents < MIN_AMOUNT_CENTS) {
      setError("Escribe un monto de al menos $1.00 para cobrar.");
      amountRef.current?.focus();
      return;
    }
    if (cents > MAX_AMOUNT_CENTS) {
      setError("El monto máximo por cobro es $100,000.00.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const requestId = newClientKey("cobro-cash");
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              description: "Cobro rápido",
              quantity: 1,
              unitPriceCents: cents,
            },
          ],
          cashCents: cents,
          paymentMethod: "cash",
          requestId,
        }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error ?? "No se pudo registrar el cobro en efectivo.");
      }
      setOrder(data.order);
      requestRef.current = null;
    } catch (caught) {
      setError(friendlyError(caught, "No se pudo registrar el cobro en efectivo."));
    } finally {
      setCreating(false);
    }
  }

  async function consultarEstado() {
    if (!order || checking || creating) return;
    setChecking(true);
    setError(null);
    try {
      setOrder(await readOrder(order.id));
    } catch (caught) {
      setError(friendlyError(caught, "No se pudo consultar el cobro."));
    } finally {
      setChecking(false);
    }
  }

  async function simularPago() {
    if (!order || simulating || creating) return;
    setSimulating(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, method: "codi" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { order?: Order; error?: string }
        | null;
      if (!response.ok || !data?.order) {
        throw new Error(data?.error ?? "No se pudo simular el pago.");
      }
      setOrder(data.order);
    } catch (caught) {
      setError(friendlyError(caught, "No se pudo simular el pago."));
    } finally {
      setSimulating(false);
    }
  }

  function nuevoCobro() {
    if (creating || simulating) return;
    setOrder(null);
    setAmountRaw("");
    setError(null);
    focusKeyRef.current = null;
    requestRef.current = null;
    window.requestAnimationFrame(() => amountRef.current?.focus());
  }

  function chooseQuick(cents: number) {
    setAmountRaw((cents / 100).toFixed(2));
    setError(null);
  }

  function onAmountChange(value: string) {
    setAmountRaw(normalizeAmountInput(value));
    if (error) setError(null);
  }

  const shortId = order ? order.id.slice(-4).toUpperCase() : "";
  const title = settled ? settledTitle(order, demo) : order ? statusLabel(order) : "Cobrar con CoDi";

  return (
    <section
      id="cobrar-codi"
      className={`inicio-codi mc-codi${settled ? " mc-codi--settled" : ""}${order && !settled ? " mc-codi--order" : ""}`}
      aria-labelledby="mc-codi-title"
      data-demo={demo ? "true" : "false"}
    >
      {!order ? (
        <div className="mc-codi__grid">
          <div className="mc-codi__copy">
            <p className="mc-codi__eyebrow">
              <QrCode aria-hidden="true" />
              <span>Cobro con CoDi</span>
              {demo ? <span className="mc-codi__badge">Demo</span> : null}
            </p>
            <h2 id="mc-codi-title" className="mc-codi__title">
              Cobrar con CoDi
            </h2>
            <p className="mc-codi__lede">
              Escribe el monto y muestra el QR. Tu cliente paga desde su banco.
            </p>
            <div className="mc-codi__art" aria-hidden="true">
              <Image src={qrArt} alt="" sizes="(max-width: 760px) 96px, 150px" />
            </div>
          </div>

          <div className="mc-codi__form">
            <label className="mc-codi__label" htmlFor="mc-codi-amount">
              Monto a cobrar
            </label>
            <div className="mc-codi__amount">
              <span className="mc-codi__currency" aria-hidden="true">
                $
              </span>
              <input
                ref={amountRef}
                id="mc-codi-amount"
                className="mc-codi__input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="go"
                placeholder="0.00"
                value={amountRaw}
                disabled={creating}
                aria-describedby="mc-codi-amount-help"
                onChange={(event) => onAmountChange(event.target.value)}
                onBlur={() => {
                  if (amountCents > 0) setAmountRaw((amountCents / 100).toFixed(2));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void startCobro();
                  }
                }}
              />
              <span className="mc-codi__currency mc-codi__currency--suffix" aria-hidden="true">
                MXN
              </span>
            </div>

            <div className="mc-codi__quick" role="group" aria-label="Montos rápidos">
              {QUICK_AMOUNTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  className="mc-codi__chip"
                  aria-pressed={amountCents === cents}
                  onClick={() => chooseQuick(cents)}
                  disabled={creating}
                >
                  ${cents / 100}
                </button>
              ))}
            </div>

            <div className="mc-codi__buttons">
              <button
                type="button"
                className="mc-codi__cta"
                onClick={() => void startCobro()}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="mc-codi__spin" aria-hidden="true" />
                ) : (
                  <QrCode aria-hidden="true" />
                )}
                <span>
                  {creating
                    ? "Preparando el QR…"
                    : amountCents >= MIN_AMOUNT_CENTS
                      ? `Cobrar con CoDi (${formatMxn(amountCents)})`
                      : "Cobrar con CoDi"}
                </span>
              </button>
              <button
                type="button"
                className="mc-codi__cta mc-codi__cta--cash"
                onClick={() => void startCashCobro()}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="mc-codi__spin" aria-hidden="true" />
                ) : (
                  <Banknote aria-hidden="true" />
                )}
                <span>
                  {amountCents >= MIN_AMOUNT_CENTS
                    ? `⚡ Cobro rápido en efectivo (${formatMxn(amountCents)})`
                    : "⚡ Cobro rápido en efectivo"}
                </span>
              </button>
            </div>

            <p className="mc-codi__hint" id="mc-codi-amount-help">
              El QR no es un pago: el cobro se confirma cuando el pago llega.{" "}
              {demo ? "En demo se simula y nunca entra dinero real." : ""}
            </p>
            <Link className="mc-codi__link" href="/caja">
              Ticket con varios productos · Abrir Caja
            </Link>
          </div>
        </div>
      ) : settled ? (
        <div className="mc-codi__settled">
          <span className="mc-codi__check" aria-hidden="true">
            <Check />
          </span>
          <p className="mc-codi__eyebrow">
            <span>{order.paymentMethod === "cash" ? "Cobro en efectivo" : "Cobro con CoDi"}</span>
            {demo ? <span className="mc-codi__badge">Demo</span> : null}
          </p>
          <h2 id="mc-codi-title" ref={headingRef} tabIndex={-1} className="mc-codi__title">
            {order.paymentMethod === "cash" ? "Cobro en efectivo registrado" : title}
          </h2>
          <p className="mc-codi__settled-amount">{formatMxn(order.totalCents)}</p>
          <p className="mc-codi__settled-meta">
            Pedido {shortId}
            {order.numRef ? ` · Referencia ${order.numRef}` : ""}
          </p>
          <p className="mc-codi__note">
            {order.paymentMethod === "cash"
              ? demo
                ? "Cobro en efectivo registrado (demo). Sumado a la caja de hoy."
                : "Cobro en efectivo registrado. Sumado a la caja de hoy."
              : order.status === "demo_paid"
                ? `${PAYMENT_STATES.demo.detail} No lo cuentes como cobrado.`
                : order.status === "paid"
                  ? "El proveedor de pagos confirmó este cobro."
                  : "La entrega de este pedido ya quedó registrada."}
          </p>
          <div className="mc-codi__actions">
            <button type="button" className="mc-codi__cta" onClick={nuevoCobro}>
              <QrCode aria-hidden="true" />
              <span>Nuevo cobro</span>
            </button>
            <Link className="mc-codi__button-secondary" href="/ventas">
              Ver ventas
            </Link>
          </div>
        </div>
      ) : (
        <div className="mc-codi__order">
          <div className="mc-codi__qr-pane">
            {order.qrImage ? (
              <figure className="mc-codi__figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.qrImage}
                  alt={`QR de cobro CoDi por ${formatMxn(
                    order.totalCents,
                  )}, pedido ${shortId}`}
                  width={220}
                  height={220}
                />
                <figcaption>
                  {demo
                    ? "QR de demostración · no cobra dinero real."
                    : "Muéstrale este QR al cliente para que pague desde su banco."}
                </figcaption>
              </figure>
            ) : (
              <div className="mc-codi__qr-missing">
                <p>El QR todavía no está listo.</p>
                <button
                  type="button"
                  className="mc-codi__cta"
                  onClick={() => void startCobro()}
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="mc-codi__spin" aria-hidden="true" />
                  ) : (
                    <QrCode aria-hidden="true" />
                  )}
                  <span>{creating ? "Preparando el QR…" : "Generar QR de cobro"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="mc-codi__order-info">
            <p className="mc-codi__eyebrow">
              <QrCode aria-hidden="true" />
              <span>Cobro con CoDi</span>
              {demo ? <span className="mc-codi__badge">Demo</span> : null}
            </p>
            <h2 id="mc-codi-title" ref={headingRef} tabIndex={-1} className="mc-codi__title">
              {title}
            </h2>
            <p className="mc-codi__order-amount">{formatMxn(order.totalCents)}</p>
            <p className="mc-codi__order-meta">
              Pedido {shortId}
              {order.numRef ? ` · Referencia ${order.numRef}` : ""}
            </p>
            <p className="mc-codi__note inline-status" role="status" aria-live="polite">
              {order.status === "cancelled"
                ? "Este cobro se canceló o venció. No lo cuentes como pagado."
                : demo
                  ? "El QR está listo y no es dinero recibido: en demo, simula el pago para ver el estado."
                  : "El QR está listo, pero el pago todavía no se confirma. Un QR no es dinero recibido: no lo cuentes como cobrado."}
            </p>

            <div className="mc-codi__actions">
              {demo && order.status !== "cancelled" ? (
                <button
                  type="button"
                  className="mc-codi__cta"
                  onClick={() => void simularPago()}
                  disabled={simulating || creating}
                >
                  {simulating ? (
                    <Loader2 className="mc-codi__spin" aria-hidden="true" />
                  ) : (
                    <Check aria-hidden="true" />
                  )}
                  <span>{simulating ? "Simulando el pago…" : "Simular pago CoDi"}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="mc-codi__button-secondary"
                onClick={() => void consultarEstado()}
                disabled={checking || creating || order.status === "cancelled"}
              >
                {checking ? (
                  <Loader2 className="mc-codi__spin" aria-hidden="true" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}
                <span>{checking ? "Consultando…" : "Consultar estado"}</span>
              </button>
              <button type="button" className="mc-codi__button-quiet" onClick={nuevoCobro}>
                Nuevo cobro
              </button>
            </div>
            <p className="mc-codi__hint">
              Este cobro no suma a la caja hasta que se confirme. Si empiezas otro, queda en
              pendientes.
            </p>
          </div>
        </div>
      )}

      {error ? (
        <p className="mc-codi__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function normalizeAmountInput(value: string): string {
  const clean = value.replace(/[^\d.]/g, "");
  const firstDot = clean.indexOf(".");
  if (firstDot === -1) return clean.slice(0, 9);
  const integer = clean.slice(0, firstDot).slice(0, 9);
  const decimals = clean.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return `${integer}.${decimals}`;
}

function statusLabel(order: Order): string {
  if (order.status === "cancelled") return "Cobro cancelado";
  if (order.status === "payment_pending") return "Esperando pago";
  return orderStatusCopy(order.status).label;
}

function settledTitle(order: Order, demo: boolean): string {
  switch (order.status) {
    case "demo_paid":
      return "Pago simulado";
    case "paid":
      return "Pago recibido";
    case "fulfilled":
      return "Cobrado y entregado";
    default:
      return demo ? "Pago demo (simulado)" : "Cobro";
  }
}

async function requestOrder(amountCents: number, requestId: string): Promise<Order> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ description: "Cobro con CoDi", quantity: 1, unitPriceCents: amountCents }],
      cashCents: 0,
      creditCents: 0,
      customerName: null,
      requestId,
    }),
  });
  const data = (await response.json().catch(() => null)) as
    | { order?: Order; error?: string }
    | null;
  if (!response.ok || !data?.order) {
    throw new Error(data?.error ?? "No se pudo registrar el cobro.");
  }
  return data.order;
}

async function requestQr(orderId: string): Promise<Order> {
  const response = await fetch(`/api/orders/${orderId}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "qr" }),
  });
  const data = (await response.json().catch(() => null)) as
    | { order?: Order; error?: string }
    | null;
  if (!response.ok || !data?.order) {
    throw new Error(data?.error ?? "No se pudo generar el QR del cobro.");
  }
  return data.order;
}

async function readOrder(orderId: string): Promise<Order> {
  const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
  const data = (await response.json().catch(() => null)) as
    | { order?: Order; error?: string }
    | null;
  if (!response.ok || !data?.order) {
    throw new Error(data?.error ?? "No se pudo leer el cobro.");
  }
  return data.order;
}

function newClientKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function friendlyError(caught: unknown, fallback: string): string {
  if (caught instanceof Error) {
    if (/failed to fetch|load failed|networkerror|network request failed/i.test(caught.message)) {
      return "No sabemos si el cobro quedó registrado. Revisa tu conexión y consulta el estado antes de reintentar.";
    }
    return caught.message;
  }
  return fallback;
}
