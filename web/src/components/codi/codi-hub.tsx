"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useClientReady } from "@/lib/use-client-ready";
import { Check, Loader2, QrCode, RefreshCw } from "lucide-react";
import qrArt from "@/assets/brand/ilustraciones/transparent/qr.png";
import { parseCodiAmountCents } from "./codi-amount";
import { formatMxn } from "@/lib/format";
import { PAYMENT_STATES, orderStatusCopy } from "@/lib/payment-labels";
import type { Order } from "@/lib/types";
import { TianguisQr } from "@/components/ui/tianguis-qr";
import "./codi-hub.css";

/** Mismo tope que `MAX_UNIT_PRICE_CENTS` en lib/orders.ts; se valida también en el servidor. */
const MAX_AMOUNT_CENTS = 10_000_000;
const MIN_AMOUNT_CENTS = 1;
const QUICK_AMOUNTS = [1, 2_000, 5_000, 10_000];
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
type CodiHubProps = { demo: boolean; initialOrder?: Order | null; scopedDemoCheckout?: boolean };

function clearSelectedOrderInUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("pedido");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function CodiHub({ demo, initialOrder = null, scopedDemoCheckout = false }: CodiHubProps) {
  const selectedId = useSearchParams().get("pedido");
  const selectedOrder = selectedId && initialOrder?.id === selectedId ? initialOrder : null;
  // Native history updates can precede a new server model. Never offer a fresh
  // amount form while the URL still selects an order we have not received.
  if (selectedId && !selectedOrder) {
    return <section id="cobrar-codi" className="inicio-codi mc-codi" aria-labelledby="mc-codi-title" data-demo={demo ? "true" : "false"}>
      <h2 id="mc-codi-title" className="mc-codi__title">Preparando el pedido seleccionado</h2>
      <p role="status">Si no aparece, vuelve a Pendientes para elegirlo o inicia un cobro nuevo.</p>
      <div className="mc-codi__actions">
        <Link href="/pendientes" className="mc-codi__button-secondary">Volver a Pendientes</Link>
        <button type="button" className="mc-codi__button-quiet" onClick={clearSelectedOrderInUrl}>Nuevo cobro</button>
      </div>
    </section>;
  }
  // The live URL changes B -> new on Nuevo, even when Next retains the page.
  return <CodiHubState key={selectedOrder?.id ?? "new"} demo={demo} initialOrder={selectedOrder} scopedDemoCheckout={scopedDemoCheckout} />;
}

function CodiHubState({ demo, initialOrder = null, scopedDemoCheckout = false }: CodiHubProps) {
  const ready = useClientReady();
  const initialDueCents = initialOrder
    ? Math.max(initialOrder.totalCents - initialOrder.paidCents, 0)
    : 0;
  const [amountRaw, setAmountRaw] = useState(
    initialDueCents > 0 ? (initialDueCents / 100).toFixed(2) : "",
  );
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<PendingRequest | null>(null);
  const focusKeyRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const parsedAmountCents = parseCodiAmountCents(amountRaw);
  const amountCents = parsedAmountCents ?? 0;
  const settled =
    order !== null &&
    (order.status === "paid" || order.status === "demo_paid" || order.status === "fulfilled");

  // Recheck wall time after background throttling, tab return or a clock change.
  // Expiry only affects QR presentation; it never changes the payment status.
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const expiresAt = order?.qrExpiresAt ? Date.parse(order.qrExpiresAt) : NaN;
  const expired = Boolean(order && !TERMINAL.has(order.status) && now !== null && Number.isFinite(expiresAt) && now >= expiresAt);

  // Consulta periódica del estado real del pedido: el hub nunca se declara
  // pagado por su cuenta. En demo el cambio llega al simular el pago.
  // Una orden existente que viene de Pendientes puede no tener QR todavía.
  // El hub lo genera al entrar para que el centro CoDi siempre muestre el QR.
  useEffect(() => {
    if (!initialOrder || TERMINAL.has(initialOrder.status)) return;
    if (initialOrder.qrImage && (!scopedDemoCheckout || initialOrder.qrString?.includes("/cobro/demo#v1."))) return;
    let active = true;
    const generation = generationRef.current;
    void requestQr(initialOrder.id)
      .then((next) => {
        if (active && generation === generationRef.current) setOrder(next);
      })
      .catch((caught) => {
        if (active && generation === generationRef.current) setError(friendlyError(caught, "No se pudo preparar el QR del pedido."));
      });
    return () => {
      active = false;
    };
  }, [initialOrder, scopedDemoCheckout]);

  useEffect(() => {
    if (!order || TERMINAL.has(order.status)) return;
    let active = true;
    const generation = generationRef.current;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { order?: Order };
        if (active && generation === generationRef.current && data.order && data.order.updatedAt >= order.updatedAt) {
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
    if (parsedAmountCents === null) {
      setError("Escribe un monto válido, por ejemplo 1.50 o 1,50, sin signos ni letras.");
      amountRef.current?.focus();
      return;
    }
    const cents = amountCents;
    if (cents < MIN_AMOUNT_CENTS) {
      setError("Escribe un monto de al menos $0.01 para cobrar.");
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

  async function renovarQr() {
    if (!order || TERMINAL.has(order.status) || creating || simulating) return;
    setCreating(true);
    setError(null);
    try {
      // Refresh the same order, including when only the browser clock advanced.
      setOrder(await requestQr(order.id, true));
      setNow(Date.now());
    } catch (caught) {
      setError(friendlyError(caught, "No se pudo renovar el QR del cobro."));
    } finally {
      setCreating(false);
    }
  }

  async function consultarEstado() {
    if (!order || checking || creating) return;
    const generation = generationRef.current;
    setChecking(true);
    setError(null);
    try {
      const next = await readOrder(order.id);
      if (generation === generationRef.current) setOrder(next);
    } catch (caught) {
      if (generation === generationRef.current) setError(friendlyError(caught, "No se pudo consultar el cobro."));
    } finally {
      if (generation === generationRef.current) setChecking(false);
    }
  }

  async function simularPago() {
    if (!order || simulating || creating || expired || TERMINAL.has(order.status)) return;
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
    // Late automatic QR/poll/manual reads belong to the previous collection.
    generationRef.current++;
    setChecking(false);
    clearSelectedOrderInUrl();
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
    setAmountRaw(value);
    if (error) setError(null);
  }

  const shortId = order ? order.id.slice(-4).toUpperCase() : "";
  const title = settled ? settledTitle(order, demo) : order ? expired ? "QR vencido" : statusLabel(order) : "Cobrar con CoDi";

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
                maxLength={64}
                aria-invalid={parsedAmountCents === null}
                disabled={!ready || creating}
                aria-describedby="mc-codi-amount-help"
                onChange={(event) => onAmountChange(event.target.value)}
                onBlur={() => {
                  if (parsedAmountCents === null) {
                    setError("Escribe un monto válido, por ejemplo 1.50 o 1,50, sin signos ni letras.");
                  } else if (amountCents > 0) setAmountRaw((amountCents / 100).toFixed(2));
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
                  disabled={!ready || creating}
                >
                  ${cents / 100}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="mc-codi__cta"
              onClick={() => void startCobro()}
              disabled={!ready || creating || parsedAmountCents === null}
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
                    ? `Cobrar ${formatMxn(amountCents)}`
                    : "Cobrar con CoDi"}
              </span>
            </button>

            <p className="mc-codi__hint" id="mc-codi-amount-help">
              El QR no es un pago: el cobro se confirma cuando el pago llega.
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
            <span>Cobro con CoDi</span>
            {demo ? <span className="mc-codi__badge">Demo</span> : null}
          </p>
          <h2 id="mc-codi-title" ref={headingRef} tabIndex={-1} className="mc-codi__title">
            {title}
          </h2>
          <p className="mc-codi__settled-amount">{formatMxn(order.totalCents)}</p>
          <p className="mc-codi__settled-meta">
            Pedido {shortId}
            {order.numRef ? ` · Referencia ${order.numRef}` : ""}
          </p>
          <p className="mc-codi__note">
            {order.status === "demo_paid"
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
            {expired ? (
              <div className="mc-codi__qr-missing">
                <p>Este QR venció. Renuévalo para seguir con el mismo pedido.</p>
                <button type="button" className="mc-codi__cta" onClick={() => void renovarQr()} disabled={creating}>
                  <RefreshCw aria-hidden="true" />
                  <span>{creating ? "Renovando el QR…" : "Renovar QR"}</span>
                </button>
              </div>
            ) : order.qrImage ? (
              <figure className="mc-codi__figure">
                <TianguisQr
                  original={order.qrImage}
                  payload={demo ? null : order.qrString}
                  decodeOriginal={demo}
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
                : expired
                  ? "El QR venció. El pedido sigue pendiente y no está pagado."
                  : demo
                  ? "El QR está listo y no es dinero recibido: en demo, simula el pago para ver el estado."
                  : "El QR está listo, pero el pago todavía no se confirma. Un QR no es dinero recibido: no lo cuentes como cobrado."}
            </p>

            <div className="mc-codi__actions">
              {demo && order.status !== "cancelled" && !expired ? (
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

async function requestQr(orderId: string, forceRefresh = false): Promise<Order> {
  const response = await fetch(`/api/orders/${orderId}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "qr", ...(forceRefresh ? { forceRefresh: true } : {}) }),
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
