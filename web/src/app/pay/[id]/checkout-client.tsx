"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Check,
  CreditCard,
  Loader2,
  Lock,
  NotebookPen,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/format";

type CheckoutMethod = "codi" | "card" | "wallet";

interface CheckoutData {
  demoMode: boolean;
  merchant: {
    name: string;
    owner: string;
    address: string;
  };
  order: {
    id: string;
    shortRef: string;
    status: string;
    totalCents: number;
    paidCents: number;
    digitalPaidCents: number;
    creditCents: number;
    amountDueCents: number;
    paymentMethod: string | null;
    paymentUrl: string | null;
    createdAt: string;
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
    }>;
  };
  payment: {
    provider: string;
    method: string;
    transactionId: string | null;
    amountCents: number;
    createdAt: string;
  } | null;
}

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

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [data, setData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<CheckoutMethod>("codi");
  const [paying, setPaying] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/checkout/${orderId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "No encontramos este cobro.");
      }
      const next = (await response.json()) as CheckoutData;
      setData(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No encontramos este cobro.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    // Carga inicial del checkout; el estado de carga es intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!data || data.payment || data.order.amountDueCents <= 0) return;
    const interval = window.setInterval(() => {
      void load();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [data, load]);

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

      const next = await load();
      if (next?.payment) setJustPaid(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo completar el pago.",
      );
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-separator bg-surface px-5 py-4 text-sm text-ink-2 shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-green" />
          Abriendo tu cobro…
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-2xl border border-separator bg-surface p-7 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-terracotta-soft text-attention">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-[1.5rem] font-semibold text-ink">Este cobro no existe</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {error ?? "Pide a la comerciante que genere un link nuevo."}
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la caja
          </Link>
        </div>
      </main>
    );
  }

  const { merchant, order, payment, demoMode } = data;
  const methodLabel = payment ? METHOD_LABEL[payment.method] ?? payment.method : null;
  const isDemoPayment = payment?.provider === "demo";

  if (isCredit) {
    const cashPaid = Math.max(0, order.paidCents - order.digitalPaidCents);
    const source = [
      cashPaid > 0 ? `${formatMxn(cashPaid)} en efectivo` : null,
      payment ? `${formatMxn(payment.amountCents)} ${isDemoPayment ? "demo" : "verificado por pey"}` : null,
    ]
      .filter(Boolean)
      .join(" + ");

    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-[16px] py-8">
        <section role="status" aria-live="polite" className="w-full max-w-md overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
          <div className="px-[18px] pb-7 pt-8 text-center sm:px-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-terracotta-soft text-attention">
              <NotebookPen className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-semibold text-ink-2">
              {order.paidCents > 0 ? "Cobro mixto" : "Venta a fiado"}
            </p>
            <h1 ref={resultHeadingRef} tabIndex={-1} className="mt-1 text-[1.75rem] font-semibold tracking-tight text-ink outline-none">
              Quedó anotado
            </h1>
            <p className="tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
              {formatMxn(order.totalCents)}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Pedido {order.shortRef} · {merchant.name}
            </p>
          </div>
          <div className="border-t border-separator px-[18px] py-4 sm:px-5">
            <div className="rounded-xl bg-surface-2 px-3.5 py-3">
              <p className="text-sm leading-relaxed text-ink-2">
                {source ? <>Recibiste {source}. </> : null}
                Quedó a fiado: <strong>{formatMxn(order.creditCents)}</strong>. Está en la
                libreta de fiado; no es dinero recibido ni un pago confirmado.
              </p>
            </div>
            <Link
              href="/"
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la caja
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (isPaid) {
    const demo = isDemoPayment;
    const cashPaid = Math.max(0, order.paidCents - order.digitalPaidCents);
    const cashOnly = !payment && cashPaid > 0;
    const sourceMixed = Boolean(payment) && cashPaid > 0;

    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-[16px] py-8">
        <section role="status" aria-live="polite" className="w-full max-w-md overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
          <div className="px-[18px] pb-7 pt-8 text-center sm:px-5">
            <div
              className={cn(
                "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                sourceMixed
                  ? demo
                    ? "bg-terracotta-soft text-attention"
                    : "bg-green-soft text-green"
                  : demo
                    ? "bg-terracotta-soft text-attention"
                    : cashOnly
                      ? "bg-surface-2 text-ink"
                      : "bg-green-soft text-green",
              )}
            >
              {demo ? (
                <Sparkles className="h-7 w-7" />
              ) : cashOnly ? (
                <Banknote className="h-7 w-7" />
              ) : (
                <Check className="h-8 w-8" />
              )}
            </div>
            <p className="mt-4 text-sm font-semibold text-ink-2">
              {sourceMixed
                ? demo
                  ? "Efectivo + demo"
                  : "Efectivo + verificado"
                : demo
                  ? "Pago simulado · demo"
                  : cashOnly
                    ? "Cobrado en caja"
                    : "Pago confirmado"}
            </p>
            <h1 ref={resultHeadingRef} tabIndex={-1} className="mt-1 text-[1.75rem] font-semibold tracking-tight text-ink outline-none">
              {sourceMixed
                ? "Pago mixto"
                : demo
                  ? "Pago simulado"
                  : cashOnly
                    ? "Efectivo recibido"
                    : "Listo para entregar"}
            </h1>
            <p className="tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
              {formatMxn(
                sourceMixed
                  ? order.totalCents
                  : payment?.amountCents ?? (cashPaid || order.totalCents),
              )}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Pedido {order.shortRef} · {merchant.name}
            </p>
          </div>

          <div className="border-t border-separator px-[18px] py-4 sm:px-5">
            <dl className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <dt className="text-ink-2">Método</dt>
                <dd className="font-semibold text-ink">
                  {sourceMixed ? `Efectivo + ${methodLabel}` : payment ? methodLabel : "Efectivo"}
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <dt className="text-ink-2">Comercio</dt>
                <dd className="min-w-0 max-w-full break-words text-right font-semibold text-ink">{merchant.name}</dd>
              </div>
              {payment?.transactionId ? (
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <dt className="text-ink-2">Transacción</dt>
                  <dd className="max-w-full break-all text-right font-mono text-xs leading-relaxed text-ink-2">
                    {payment.transactionId}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 rounded-xl bg-surface-2 px-3.5 py-3">
              <p className="text-sm leading-relaxed text-ink-2">
                {sourceMixed
                  ? demo
                    ? `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(payment?.amountCents ?? 0)} en un pago simulado. El efectivo sí es dinero real; el digital es demo.`
                    : `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(payment?.amountCents ?? 0)} verificados por pey.`
                  : demo
                    ? "Pago simulado para la demo. En producción, este estado solo aparece con la confirmación firmada de pey."
                    : cashOnly
                      ? "Recibiste el efectivo en la caja. No pasó por pey ni es un pago verificado por el banco."
                      : "pey confirmó este pago. La comerciante ya puede entregar el pedido."}
              </p>
            </div>

            <Link
              href="/"
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-press"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la caja
            </Link>
            {justPaid ? (
              <p className="mt-3 text-center text-xs text-ink-2">
                {cashOnly
                  ? "La caja ya registró el efectivo."
                  : "La caja de la comerciante ya recibió la confirmación."}
              </p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-canvas px-[16px] py-8">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-display text-xl font-bold text-white">
              0
            </div>
            <div>
              <p className="font-display text-[1.15rem] leading-none tracking-tight text-ink">
                Mercado Cero
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">
                Pago protegido
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <Lock className="h-3.5 w-3.5 text-green" />
            Seguro
          </span>
        </header>

        <section className="mt-4 overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
          <div className="border-b border-separator bg-surface-2/60 px-[18px] py-4 sm:px-5">
            <h1 className="text-[1.625rem] font-semibold leading-tight tracking-tight text-ink">
              Pagar a {merchant.name}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              {merchant.address} · Pedido {order.shortRef}
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">
                Total a pagar
              </p>
              <p className="tabular mt-1 text-[2.25rem] font-semibold leading-none tracking-tight text-ink sm:text-[2.5rem]">
                {formatMxn(order.amountDueCents)}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {order.items.length} {order.items.length === 1 ? "producto" : "productos"} · incluye todo
              </p>
            </div>
          </div>

          <div className="px-[18px] py-4 sm:px-5">
            <div className="rounded-xl bg-surface-2 px-3.5 py-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 border-b border-separator/70 py-2 text-sm last:border-0"
                >
                  <span className="min-w-0 break-words text-ink-2">
                    <span className="tabular mr-1.5 text-ink-2">{item.quantity}×</span>
                    {item.description}
                  </span>
                  <span className="tabular self-end font-semibold text-ink">
                    {formatMxn(item.totalCents)}
                  </span>
                </div>
              ))}
            </div>

            <fieldset className="mt-5 min-w-0">
              <legend className="text-sm font-semibold text-ink">¿Cómo quieres pagar?</legend>
              <div className="mt-2 min-w-0 space-y-2">
                {METHODS.map((option) => {
                  const Icon = option.icon;
                  const selected = method === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "checkout-method relative block w-full min-w-0 rounded-xl border p-[14px] pr-[44px] transition",
                        selected
                          ? "border-accent/40 bg-green-soft/50"
                          : "border-separator bg-surface hover:border-accent/30",
                      )}
                    >
                      <input
                        type="radio"
                        name="checkout-method"
                        value={option.id}
                        checked={selected}
                        onChange={() => setMethod(option.id)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          selected ? "bg-accent text-white" : "bg-surface-2 text-ink-2",
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="mt-2 block min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                          {option.title}
                          {option.tag ? (
                            <span className="rounded-full bg-green-soft px-2 py-0.5 text-xs font-bold text-green">
                              {option.tag}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block break-words text-xs leading-relaxed text-ink-2">
                          {option.subtitle}
                        </span>
                      </span>
                      <span
                        data-selected={selected ? "true" : "false"}
                        className={cn(
                          "radio-dot absolute right-[14px] top-[14px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-accent bg-accent text-white" : "border-separator bg-surface",
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {demoMode ? (
              <div className="mt-4 rounded-xl border border-attention/25 bg-terracotta-soft/60 px-3.5 py-2.5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-attention">Modo demo</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  Este pago se simula y no mueve dinero real. En producción, el botón abre el checkout de pey.
                </p>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2.5 text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={pay}
              disabled={paying}
              aria-busy={paying}
              className="on-accent mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[0.9375rem] font-bold text-white shadow-card transition hover:bg-accent-press disabled:cursor-wait disabled:opacity-80"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {demoMode ? "Simulando el pago…" : "Conectando con el banco…"}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Pagar {formatMxn(order.amountDueCents)}
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs leading-relaxed text-ink-2">
              Al pagar aceptas el cobro de {merchant.name}. No guardamos datos de tu tarjeta.
            </p>
          </div>
        </section>

        <footer className="mt-4 flex items-center justify-center gap-2 px-4 text-center text-xs text-ink-2">
          <ShieldCheck className="h-4 w-4 text-green" />
          {demoMode
            ? "Demo de Mercado Cero · pago simulado, sin cargo real"
            : "Procesado por pey · confirmación bancaria verificada"}
        </footer>
      </div>
    </main>
  );
}
