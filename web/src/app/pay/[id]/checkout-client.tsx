"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
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
    creditCents: number;
    amountDueCents: number;
    paymentMethod: string | null;
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
    title: "Apple Pay / Google Pay",
    subtitle: "Un toque desde tu teléfono",
    icon: Wallet,
  },
];

const METHOD_LABEL: Record<string, string> = {
  codi: "CoDi",
  card: "Tarjeta",
  wallet: "Apple Pay / Google Pay",
  cash: "Efectivo",
  mixed: "Pago mixto",
};

function merchantInitials(name: string): string {
  return name
    .replace(/^(Antojitos|Tienda|Abarrotes|Fonda|Cocina)\s+de\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

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

  const isPaid = useMemo(() => {
    if (!data) return false;
    return Boolean(data.payment) || data.order.amountDueCents <= 0;
  }, [data]);

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
        throw new Error(
          "Este prototipo no procesa pagos reales desde esta pantalla. Abre el link de pey.",
        );
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
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4 text-sm text-muted shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-green" />
          Abriendo tu cobro…
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-md rounded-[28px] border border-line bg-card p-7 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-terracotta-soft text-terracotta-deep">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl text-ink">
            Este cobro no existe
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {error ?? "Pide a la comerciante que genere un link nuevo."}
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-green px-5 py-2.5 text-sm font-semibold text-paper"
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

  if (isPaid) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 py-10">
        <section className="pop w-full max-w-md overflow-hidden rounded-[32px] border border-line bg-card shadow-lift">
          <div className="relative overflow-hidden bg-gradient-to-br from-green-soft via-card to-yellow-soft/60 px-6 pb-8 pt-10 text-center">
            <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full border border-green/10" />
            <div className="pointer-events-none absolute -left-16 top-20 h-48 w-48 rounded-full border border-green/10" />
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green text-paper shadow-lift">
              <Check className="h-10 w-10" strokeWidth={2.4} />
            </div>
            <p className="relative mt-5 text-xs font-bold uppercase tracking-[0.22em] text-green">
              Pago confirmado
            </p>
            <h1 className="relative mt-1 font-display text-[2rem] leading-tight tracking-tight text-ink">
              Listo para entregar
            </h1>
            <p className="tabular relative mt-3 font-display text-[2.8rem] leading-none text-ink">
              {formatMxn(payment?.amountCents ?? order.totalCents)}
            </p>
            <p className="relative mt-2 text-sm text-muted">
              Pedido {order.shortRef} · {merchant.name}
            </p>
          </div>

          <div className="px-6 py-5">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Método</dt>
                <dd className="font-semibold text-ink">{methodLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Comercio</dt>
                <dd className="font-semibold text-ink">{merchant.name}</dd>
              </div>
              {payment?.transactionId ? (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted">Transacción</dt>
                  <dd className="max-w-[15rem] break-all text-right font-mono text-xs leading-relaxed text-ink-soft">
                    {payment.transactionId}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-green/15 bg-green-soft/50 px-3.5 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" />
              <p className="text-xs leading-relaxed text-green-deep">
                {demoMode
                  ? "Pago simulado para la demo. En producción, Mercado Cero solo muestra este estado después del webhook firmado de pey."
                  : "Este pago fue confirmado por pey. La comerciante ya puede entregar el pedido."}
              </p>
            </div>

            <Link
              href="/"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-green px-5 py-3.5 text-sm font-bold text-paper transition hover:bg-green-deep"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la caja
            </Link>
            {justPaid ? (
              <p className="mt-3 text-center text-xs text-muted">
                La caja de la comerciante ya recibió la confirmación.
              </p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green text-paper">
              <Store className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="font-display text-[1.05rem] leading-none text-ink">
                Mercado Cero
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-muted">
                Pago seguro
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-card/80 px-2.5 py-1.5 text-xs font-semibold text-muted">
            <Lock className="h-3 w-3 text-green" />
            Pago protegido
          </span>
        </header>

        <section className="rise mt-4 overflow-hidden rounded-[32px] border border-line bg-card shadow-card">
          <div className="border-b border-line/70 bg-paper/50 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-terracotta-soft font-display text-lg text-terracotta-deep">
                {merchantInitials(merchant.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{merchant.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {merchant.address} · Pedido {order.shortRef}
                </p>
              </div>
              <BadgeCheck className="ml-auto h-5 w-5 shrink-0 text-green" />
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                Total a pagar
              </p>
              <p className="tabular mt-1 font-display text-[3rem] leading-none tracking-tight text-ink">
                {formatMxn(order.amountDueCents)}
              </p>
              <p className="mt-1.5 text-xs text-muted">
                {order.items.length}{" "}
                {order.items.length === 1 ? "producto" : "productos"} · incluye
                todo
              </p>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-2xl border border-line/70 bg-paper/40 px-3.5 py-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-baseline justify-between gap-3 border-b border-line/50 py-2 text-sm last:border-0"
                >
                  <span className="min-w-0 text-ink-soft">
                    <span className="tabular mr-1.5 text-muted">
                      {item.quantity}×
                    </span>
                    {item.description}
                  </span>
                  <span className="tabular shrink-0 font-semibold text-ink">
                    {formatMxn(item.totalCents)}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-muted">
              ¿Cómo quieres pagar?
            </p>
            <div className="mt-2 space-y-2">
              {METHODS.map((option) => {
                const Icon = option.icon;
                const selected = method === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMethod(option.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
                      selected
                        ? "border-green/40 bg-green-soft/40 shadow-sm"
                        : "border-line bg-card hover:border-green/25",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        selected
                          ? "bg-green text-paper"
                          : "bg-paper-deep text-ink-soft",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {option.title}
                        {option.tag ? (
                          <span className="rounded-full bg-yellow-soft px-2 py-0.5 text-xs font-bold uppercase tracking-[0.04em] text-terracotta-deep">
                            {option.tag}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {option.subtitle}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-green bg-green text-paper"
                          : "border-line bg-card",
                      )}
                    >
                      {selected ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {demoMode ? (
              <div className="mt-4 rounded-2xl border border-yellow/70 bg-yellow-soft/60 px-3.5 py-2.5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta-deep">
                  Modo demo
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Este pago se simula y no mueve dinero real. En producción, el
                  botón abre el checkout de pey con CoDi, tarjeta o wallet.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2 text-xs font-medium text-terracotta-deep">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={pay}
              disabled={paying}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-green px-5 py-4 text-[0.95rem] font-bold text-paper shadow-card transition hover:bg-green-deep disabled:cursor-wait disabled:opacity-80"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmando con el banco…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Pagar {formatMxn(order.amountDueCents)}
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs leading-relaxed text-muted">
              Al pagar aceptas el cobro de {merchant.name}. No guardamos datos
              de tu tarjeta.
            </p>
          </div>
        </section>

        <footer className="mt-4 flex items-center justify-center gap-2 px-4 text-center text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-green" />
          {demoMode
            ? "Demo de Mercado Cero · pago simulado, sin cargo real"
            : "Procesado por pey · confirmación verificada por webhook firmado"}
        </footer>
      </div>
    </main>
  );
}
