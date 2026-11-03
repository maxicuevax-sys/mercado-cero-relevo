"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/format";
import { PAYMENT_STATES } from "@/lib/payment-labels";
import type { CheckoutData } from "@/lib/checkout";

type CheckoutMethod = "codi" | "card" | "wallet";

const METHODS: Array<{
  id: CheckoutMethod;
  title: string;
  subtitle: string;
  icon: typeof Smartphone;
  tag?: string;
}> = [
  {
    id: "codi",
    title: "CoDi",
    subtitle: "Transferencia bancaria, sin comisión",
    icon: Smartphone,
    tag: "Recomendado",
  },
  {
    id: "card",
    title: "Tarjeta",
    subtitle: "Débito o crédito, 3D Secure",
    icon: CreditCard,
  },
  {
    id: "wallet",
    title: "Wallet",
    subtitle: "Apple Pay o Google Pay si tu banco lo permite",
    icon: Wallet,
  },
];

const METHOD_LABEL: Record<string, string> = {
  codi: "CoDi",
  card: "Tarjeta",
  wallet: "Wallet",
  cash: "Efectivo",
  mixed: "Pago mixto",
};

export default function CheckoutPage({
  initialOrder,
}: {
  initialOrder: CheckoutData | null;
}) {
  const params = useParams<{ id: string }>();
  const orderId = initialOrder?.order.id ?? params.id;

  // El servidor ya leyó la orden: el primer render no es un spinner.
  const [data, setData] = useState<CheckoutData | null>(initialOrder);
  const etagRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<CheckoutMethod>("codi");
  const [paying, setPaying] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [exited, setExited] = useState(false);

  function finish() {
    // El comprador no tiene por qué caer en el dashboard de la comerciante.
    try {
      window.close();
    } catch {
      // Algunos navegadores no permiten cerrar una pestaña que no abrió el
      // script; el mensaje de abajo le dice que ya terminó.
    }
    setExited(true);
  }

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    try {
      const response = await fetch(`/api/checkout/${orderId}`, {
        cache: "no-store",
        headers:
          !force && etagRef.current
            ? { "If-None-Match": etagRef.current }
            : undefined,
      });
      if (response.status === 304) return data;
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "No encontramos este cobro.");
      }
      const etag = response.headers.get("etag");
      if (etag) etagRef.current = etag;
      const next = (await response.json()) as CheckoutData;
      setData(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No encontramos este cobro.",
      );
      return null;
    }
  }, [data, orderId]);

  useEffect(() => {
    if (!data || data.payment || data.order.amountDueCents <= 0 || paying) return;
    // 3 s recién llegado, luego 10 s y 30 s: el comprador puede esperar el
    // webhook sin castigar la batería ni la red si la pestaña queda abierta.
    const DELAYS = [3000, 10_000, 30_000];
    let cancelled = false;
    let timer: number | null = null;
    let step = 0;
    const schedule = (delay: number) => {
      timer = window.setTimeout(tick, delay);
    };
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        await load();
        step = Math.min(step + 1, DELAYS.length - 1);
      }
      if (!cancelled) schedule(DELAYS[step]);
    };
    const onVisibility = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (document.visibilityState === "visible") {
        step = 0;
        schedule(0);
      }
    };
    schedule(DELAYS[0]);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [data, load, paying]);

  const isCredit = useMemo(() => {
    if (!data) return false;
    return data.order.creditCents > 0 && data.order.amountDueCents <= 0;
  }, [data]);

  const isPaid = useMemo(() => {
    if (!data) return false;
    return Boolean(data.payment) || (data.order.amountDueCents <= 0 && !isCredit);
  }, [data, isCredit]);

  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isPaid && !isCredit) return;
    const timer = window.setTimeout(() => resultHeadingRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isPaid, isCredit]);

  async function pay() {
    if (!data || paying || isPaid) return;
    setPaying(true);
    setError(null);

    try {
      if (data.demoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        const response = await fetch("/api/demo/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.order.id, method }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "No se pudo simular el pago.");
        }
      } else {
        if (!data.order.paymentUrl) {
          throw new Error(
            "Este cobro todavía no tiene un link de pago. Pide a la comerciante que lo genere de nuevo.",
          );
        }
        window.location.assign(data.order.paymentUrl);
        return;
      }

      const next = await load({ force: true });
      if (next?.payment) setJustPaid(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo completar el pago.",
      );
    } finally {
      setPaying(false);
    }
  }

  if (!data) {
    return (
      <main className="pay-shell grid min-h-dvh place-items-center px-4 py-8">
        <section className="receipt-stack receipt-stack--layered empty-sheet">
          <div className="receipt-paper p-7 text-center">
            <span className="stamp stamp--demo">Cobro no disponible</span>
            <div className="empty-sheet__icon mt-4">
              <Store className="h-6 w-6" />
            </div>
            <h1 className="mt-3 font-display text-[1.7rem] font-semibold leading-tight text-ink">
              Este cobro no existe
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              {error ?? "Pide a la comerciante que genere un link nuevo."}
            </p>
            {exited ? (
              <p role="status" className="mt-5 text-sm font-semibold text-ink-2">
                Listo. Ya puedes cerrar esta pestaña o pedir a la comerciante un
                link nuevo.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={finish}
                  className="result-exit mt-5"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => void load({ force: true })}
                  className="result-secondary"
                >
                  Reintentar
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  const { merchant, order, payment, demoMode } = data;
  const isDemoPayment = payment?.demo === true || payment?.provider === "demo";
  const methodLabel = payment
    ? isDemoPayment && payment.method === "cash"
      ? "Demo (no es efectivo real)"
      : METHOD_LABEL[payment.method] ?? payment.method
    : null;
  const realCashPaid =
    order.cashPaidCents ?? Math.max(0, order.paidCents - order.digitalPaidCents);

  if (isCredit) {
    const cashPaid = realCashPaid;
    const source = [
      cashPaid > 0 ? `${formatMxn(cashPaid)} en efectivo` : null,
      payment ? `${formatMxn(payment.amountCents)} ${isDemoPayment ? "demo" : "verificado por pey"}` : null,
    ]
      .filter(Boolean)
      .join(" + ");

    return (
      <main className="pay-shell grid min-h-dvh place-items-center px-[16px] py-8">
        <section role="status" aria-live="polite" className="receipt-stack receipt-stack--layered w-full">
          <div className="receipt-paper">
            <div className="receipt-paper__perf" aria-hidden="true" />
            <div className="receipt-result">
              <div className="receipt-result__stamp">
                <span className="stamp stamp--sim">Fiado anotado</span>
              </div>
              <p className="receipt-result__method">
                {order.paidCents > 0 ? "Cobro mixto" : "Venta a fiado"}
              </p>
              <h1 ref={resultHeadingRef} tabIndex={-1}>
                Quedó anotado
              </h1>
              <p className="receipt-result__amount">
                {formatMxn(order.totalCents)}
              </p>
              <p className="receipt-result__ref">
                Folio {order.shortRef} · {merchant.name}
              </p>
            </div>
            <div className="receipt-body">
              <div className="pay-note">
                <p className="text-sm leading-relaxed text-ink-2">
                  {source ? <>Recibiste {source}. </> : null}
                  Quedó a fiado: <strong>{formatMxn(order.creditCents)}</strong>. Está en la
                  libreta de fiado; no es dinero recibido ni un pago confirmado.
                </p>
              </div>
              {exited ? (
                <p role="status" className="mt-4 text-center text-sm font-semibold text-ink-2">
                  Listo. El fiado quedó anotado; ya puedes cerrar esta pestaña.
                </p>
              ) : (
                <button type="button" onClick={finish} className="result-exit mt-4">
                  Listo
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (isPaid) {
    const demo = isDemoPayment || (order.demoPaidCents ?? 0) > 0;
    const cashPaid = realCashPaid;
    const cashOnly = !payment && cashPaid > 0 && !demo;
    const sourceMixed = Boolean(payment) && cashPaid > 0;

    return (
      <main className="pay-shell grid min-h-dvh place-items-center px-[16px] py-8">
        <section role="status" aria-live="polite" className="receipt-stack receipt-stack--layered w-full">
          <div className="receipt-paper">
            <div className="receipt-paper__perf" aria-hidden="true" />
            <div className="receipt-result">
              <div className="receipt-result__stamp">
                <span
                  className={cn(
                    "stamp",
                    demo ? "stamp--sim" : cashOnly ? "stamp--cash" : "stamp--paid",
                  )}
                >
                  {demo
                    ? "Pago demo"
                    : cashOnly
                      ? PAYMENT_STATES.cash_received.label
                      : payment?.provider === "pey"
                        ? PAYMENT_STATES.digital_verified.label
                        : "Pagado"}
                </span>
              </div>
              <p className="receipt-result__method">
                {sourceMixed
                  ? demo
                    ? "Efectivo + pago demo"
                    : "Efectivo + pago verificado por pey"
                  : demo
                    ? "Simulación"
                    : cashOnly
                      ? "Cobrado en caja"
                      : payment?.provider === "pey"
                        ? "Confirmación firmada"
                        : "Pago sin confirmar"}
              </p>
              <h1 ref={resultHeadingRef} tabIndex={-1}>
                {sourceMixed
                  ? "Pago mixto"
                  : demo
                    ? PAYMENT_STATES.demo.label
                    : cashOnly
                      ? PAYMENT_STATES.cash_received.label
                      : payment?.provider === "pey"
                        ? PAYMENT_STATES.digital_verified.label
                        : "Pago recibido"}
              </h1>
              <p className="receipt-result__amount">
                {formatMxn(
                  sourceMixed
                    ? order.totalCents
                    : payment?.amountCents ?? (cashPaid || order.totalCents),
                )}
              </p>
              <p className="receipt-result__ref">
                Folio {order.shortRef} · {merchant.name}
              </p>
            </div>

            <div className="receipt-body">
              <div className="result-details">
                <dl>
                  <div>
                    <dt>Método</dt>
                    <dd>
                      {sourceMixed ? `Efectivo + ${methodLabel}` : payment ? methodLabel : "Efectivo"}
                    </dd>
                  </div>
                  <div>
                    <dt>Comercio</dt>
                    <dd className="break-words">{merchant.name}</dd>
                  </div>
                  {payment?.transactionId ? (
                    <div>
                      <dt>Transacción</dt>
                      <dd className="break-all font-mono text-xs">{payment.transactionId}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="pay-note">
                <p className="text-sm leading-relaxed text-ink-2">
                  {sourceMixed
                    ? demo
                      ? `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(payment?.amountCents ?? 0)} en un pago demo. El efectivo sí es dinero real; el digital es demo y el pedido no se entrega.`
                      : `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(payment?.amountCents ?? 0)} verificados por pey.`
                    : demo
                      ? PAYMENT_STATES.demo.detail
                      : cashOnly
                        ? "Recibiste el efectivo en la caja. No pasó por pey ni es un pago verificado por el banco."
                        : payment?.provider === "pey"
                          ? "pey confirmó este pago con una confirmación firmada. La comerciante ya puede entregar el pedido."
                          : "Este pago no tiene una confirmación firmada de pey. No lo presentes como verificado."}
                </p>
              </div>

              {exited ? (
                <p role="status" className="mt-4 text-center text-sm font-semibold text-ink-2">
                  Listo. Ya puedes cerrar esta pestaña; tu comprobante queda en este link.
                </p>
              ) : (
                <button type="button" onClick={finish} className="result-exit mt-4">
                  Listo
                </button>
              )}
              {justPaid ? (
                <p className="mt-3 text-center text-xs text-ink-2">
                  {cashOnly
                    ? "La caja ya registró el efectivo."
                    : demo
                      ? "La caja registró el pago demo (simulado)."
                      : "La caja de la comerciante ya recibió la confirmación."}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pay-shell min-h-dvh pb-32 pt-6 sm:pb-10 sm:pt-8">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="pay-header flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center border border-ink/20 bg-accent font-display text-xl font-bold text-white shadow-[2px_2px_0_rgba(36,31,25,.22)]">
              0
            </div>
            <div>
              <p className="pay-brand-name">Mercado Cero</p>
              <p className="pay-eyebrow font-semibold text-ink-2">Pago protegido</p>
            </div>
          </div>
          <span className="pay-secure">
            <Lock aria-hidden="true" className="h-3.5 w-3.5 text-green" />
            <span className="pay-secure-label">Seguro</span>
          </span>
        </header>

        <section className="receipt-stack">
          <div className="receipt-paper">
            <div className="receipt-paper__perf" aria-hidden="true" />
            <div className="receipt-head">
              <p className="receipt-head__merchant">{merchant.name}</p>
              <p className="receipt-head__meta">
                {merchant.address} · Folio {order.shortRef}
              </p>
              <h1 className="pay-title mt-3">Pagar a {merchant.name}</h1>
              <div className="mt-2">
                <p className="pay-total-label">Total a pagar</p>
                <p className="pay-total mt-0.5">
                  {formatMxn(order.amountDueCents)}
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  {order.items.length} {order.items.length === 1 ? "producto" : "productos"} ·
                  incluye todo
                </p>
              </div>
            </div>

            <div className="receipt-body">
              <div className="receipt-items">
                {order.items.map((item) => (
                  <div key={item.id} className="receipt-item">
                    <span className="receipt-item__desc">
                      <span className="tabular mr-1.5 text-ink-2">{item.quantity}×</span>
                      {item.description}
                    </span>
                    <span className="receipt-item__amount">
                      {formatMxn(item.totalCents)}
                    </span>
                  </div>
                ))}
              </div>

              {demoMode ? (
                <div className="demo-note">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
                  <p>
                    <strong>Modo demo</strong>
                    Pago de prueba, no se mueve dinero. En producción, el botón abre el
                    checkout de pey.
                  </p>
                </div>
              ) : null}

              <fieldset className="pay-methods min-w-0">
                <legend>¿Cómo quieres pagar?</legend>
                <div className="pay-method-list">
                  {METHODS.map((option) => {
                    const Icon = option.icon;
                    const selected = method === option.id;
                    return (
                      <label
                        key={option.id}
                        data-selected={selected ? "true" : "false"}
                        className="checkout-method"
                      >
                        <input
                          type="radio"
                          name="checkout-method"
                          value={option.id}
                          checked={selected}
                          onChange={() => setMethod(option.id)}
                          className="sr-only"
                        />
                        <span className="checkout-method__icon">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="checkout-method__text">
                          <span className="checkout-method__title">
                            {option.title}
                            {option.tag ? (
                              <span className="pay-method-tag">{option.tag}</span>
                            ) : null}
                          </span>
                          <span className="checkout-method__sub">{option.subtitle}</span>
                        </span>
                        <span
                          data-selected={selected ? "true" : "false"}
                          className="radio-dot"
                          aria-hidden="true"
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {error ? (
                <p role="alert" className="pay-feedback">
                  {error}
                </p>
              ) : null}

              <div className="pay-submit mt-4">
                <div className="pay-submit-total">
                  <p className="font-semibold text-ink-2">Total</p>
                  <p className="pay-sticky-total font-semibold leading-tight text-ink">
                    {formatMxn(order.amountDueCents)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={pay}
                  disabled={paying}
                  aria-busy={paying}
                  className="pay-submit-button"
                >
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {demoMode ? "Simulando el pago…" : "Conectando con el banco…"}
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 inline h-4 w-4" aria-hidden="true" />
                      Pagar {formatMxn(order.amountDueCents)}
                    </>
                  )}
                </button>
              </div>

              <p className="pay-fineprint">
                Al pagar aceptas el cobro de {merchant.name}. No guardamos datos de tu tarjeta.
              </p>
            </div>
          </div>
        </section>

        <footer className="pay-footer">
          <ShieldCheck className="h-4 w-4 text-green" aria-hidden="true" />
          {demoMode
            ? "Demo de Mercado Cero · pago simulado, sin cargo real"
            : "Procesado por pey · confirmación bancaria verificada"}
        </footer>
      </div>
    </main>
  );
}
