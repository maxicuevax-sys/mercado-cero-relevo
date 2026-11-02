"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Banknote, Check, Loader2, NotebookPen, Sparkles, Store } from "lucide-react";
import { cn, formatMxn } from "@/lib/format";

interface CheckoutData {
  demoMode: boolean;
  merchant: { name: string; address: string };
  order: {
    id: string;
    shortRef: string;
    status: string;
    totalCents: number;
    paidCents: number;
    digitalPaidCents: number;
    amountDueCents: number;
    creditCents: number;
  };
  payment: {
    provider: string;
    method: string;
    transactionId: string | null;
    amountCents: number;
    createdAt: string;
  } | null;
}

const METHOD_LABEL: Record<string, string> = {
  codi: "CoDi",
  card: "Tarjeta",
  wallet: "Wallet",
  cash: "Efectivo",
  mixed: "Pago mixto",
};

export default function CheckoutSuccessPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [data, setData] = useState<CheckoutData | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [exited, setExited] = useState(false);

  function finish() {
    // Salida pública: nunca el dashboard de la comerciante.
    try {
      window.close();
    } catch {
      // Si el navegador no deja cerrar, el mensaje de abajo lo explica.
    }
    setExited(true);
  }

  const load = useCallback(async () => {
    const response = await fetch(`/api/checkout/${orderId}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    setData((await response.json()) as CheckoutData);
  }, [orderId]);

  useEffect(() => {
    // Carga inicial del estado de pago; el polling continúa después.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.payment || (data && data.order.amountDueCents <= 0)) return;
    const interval = window.setInterval(() => {
      setAttempts((value) => value + 1);
      void load();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [data, load]);

  const isCredit =
    Boolean(data) &&
    (data?.order.creditCents ?? 0) > 0 &&
    (data?.order.amountDueCents ?? 1) <= 0;
  const paid =
    Boolean(data?.payment) ||
    (Boolean(data) && (data?.order.amountDueCents ?? 1) <= 0 && !isCredit);
  const demo = data?.payment?.provider === "demo";
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!paid && !isCredit) return;
    const timer = window.setTimeout(() => headingRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [paid, isCredit]);

  if (isCredit && data) {
    const cashPaid = Math.max(0, data.order.paidCents - data.order.digitalPaidCents);
    const source = [
      cashPaid > 0 ? `${formatMxn(cashPaid)} en efectivo` : null,
      data.payment
        ? `${formatMxn(data.payment.amountCents)} ${
            data.payment.provider === "demo"
              ? "demo"
              : data.payment.provider === "pey"
                ? "verificado por pey"
                : "sin verificar"
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" + ");

    return (
      <main className="pay-shell grid min-h-dvh place-items-center bg-canvas px-[16px] py-8">
        <section role="status" aria-live="polite" className="w-full max-w-md overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
          <div className="px-[18px] pb-7 pt-8 text-center sm:px-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-terracotta-soft text-attention">
              <NotebookPen className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-semibold text-ink-2">
              {data.order.paidCents > 0 ? "Cobro mixto" : "Venta a fiado"}
            </p>
            <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-[1.75rem] font-semibold tracking-tight text-ink outline-none">
              Quedó anotado
            </h1>
            <p className="pay-amount tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
              {formatMxn(data.order.totalCents)}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Pedido {data.order.shortRef} · {data.merchant.name}
            </p>
          </div>
          <div className="border-t border-separator px-[18px] py-4 sm:px-5">
            <div className="rounded-xl border border-separator bg-surface px-3.5 py-3">
              <p className="text-sm leading-relaxed text-ink-2">
                {source ? <>Recibiste {source}. </> : null}
                Quedó a fiado: <strong>{formatMxn(data.order.creditCents)}</strong>. Está en la
                libreta de fiado; no es dinero recibido ni un pago confirmado.
              </p>
            </div>
            {exited ? (
              <p role="status" className="mt-4 text-center text-sm font-semibold text-ink-2">
                Listo. El fiado quedó anotado; ya puedes cerrar esta pestaña.
              </p>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="cta-primary on-accent mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-press"
              >
                Listo
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  const cashPaid = data ? Math.max(0, data.order.paidCents - data.order.digitalPaidCents) : 0;
  const cashOnly = Boolean(data) && paid && !data?.payment && cashPaid > 0;
  const sourceMixed = Boolean(data?.payment) && paid && cashPaid > 0;

  return (
    <main className="pay-shell grid min-h-dvh place-items-center bg-canvas px-[16px] py-8">
      <section role="status" aria-live="polite" className="w-full max-w-md overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
        <div className="px-[18px] pb-7 pt-8 text-center sm:px-5">
          <div
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
              paid && sourceMixed
                ? demo
                  ? "bg-terracotta-soft text-attention"
                  : "bg-green-soft text-green"
                : paid && !demo && !cashOnly
                  ? "bg-green-soft text-green"
                  : paid && cashOnly
                    ? "border border-separator bg-surface text-ink"
                    : paid && demo
                      ? "bg-terracotta-soft text-attention"
                      : "border border-separator bg-surface text-ink-2",
            )}
          >
            {paid ? (
              demo ? (
                <Sparkles className="h-7 w-7" />
              ) : cashOnly ? (
                <Banknote className="h-7 w-7" />
              ) : (
                <Check className="h-8 w-8" strokeWidth={2.4} />
              )
            ) : (
              <Loader2 className="h-7 w-7 animate-spin" />
            )}
          </div>
          <p className="mt-4 text-sm font-semibold text-ink-2">
            {paid
              ? sourceMixed
                ? demo
                  ? "Efectivo + demo"
                  : "Efectivo + verificado"
                : demo
                  ? "Modo demo"
                  : cashOnly
                    ? "Cobrado en caja"
                    : "Pago confirmado"
              : "Verificando pago"}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight text-ink outline-none">
            {paid
              ? sourceMixed
                ? "Pago mixto"
                : demo
                  ? "Pago simulado"
                  : cashOnly
                    ? "Efectivo recibido"
                    : "Listo para entregar"
              : "Estamos confirmando con el banco"}
          </h1>
          {data ? (
            <p className="pay-amount tabular mt-3 text-[2.125rem] font-semibold leading-none tracking-tight text-ink">
              {formatMxn(
                sourceMixed
                  ? data.order.totalCents
                  : data.payment?.amountCents ?? (cashPaid || data.order.totalCents),
              )}
            </p>
          ) : null}
          {data ? (
            <p className="mt-2 text-sm text-ink-2">
              Pedido {data.order.shortRef} · {data.merchant.name}
            </p>
          ) : null}
        </div>

        <div className="border-t border-separator px-[18px] py-4 sm:px-5">
          {paid && data?.payment ? (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-2">Método</dt>
                  <dd className="font-semibold text-ink">
                    {sourceMixed
                      ? `Efectivo + ${METHOD_LABEL[data.payment.method] ?? data.payment.method}`
                      : METHOD_LABEL[data.payment.method] ?? data.payment.method}
                  </dd>
                </div>
                {data.payment.transactionId ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-ink-2">Transacción</dt>
                    <dd className="max-w-[15rem] break-all text-right font-mono text-xs text-ink-2">
                      {data.payment.transactionId}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-4 rounded-xl border border-separator bg-surface px-3.5 py-3">
                <p className="text-sm leading-relaxed text-ink-2">
                  {sourceMixed
                    ? demo
                      ? `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(data.payment.amountCents)} en un pago simulado. El efectivo sí es dinero real; el digital es demo.`
                      : `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(data.payment.amountCents)} verificados por pey.`
                    : demo
                      ? "Pago simulado para la demo. En producción, este estado solo aparece con la confirmación firmada de pey."
                      : data.payment.provider === "pey"
                      ? "pey confirmó este pago con una confirmación firmada. Ya puedes mostrar esta pantalla."
                      : "Este pago no tiene una confirmación firmada de pey. No lo presentes como verificado."}
                </p>
              </div>
            </>
          ) : cashOnly ? (
            <>
              <p className="text-center text-sm leading-relaxed text-ink-2">
                Recibiste {formatMxn(cashPaid)} en efectivo en la caja. No pasó por pey ni es un
                pago verificado por el banco.
              </p>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-separator bg-surface px-3.5 py-3">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
                <p className="text-sm leading-relaxed text-ink-2">
                  La comerciante ya puede entregar el pedido. El efectivo queda registrado en el
                  corte de caja.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-sm leading-relaxed text-ink-2">
                Tu pago ya salió del banco. Mercado Cero está esperando la confirmación
                firmada de pey; normalmente tarda unos segundos.
              </p>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-separator bg-surface px-3.5 py-3">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
                <p className="text-sm leading-relaxed text-ink-2">
                  No cierres esta pantalla. Si tarda más de un minuto, muestra tu comprobante
                  a la comerciante; ella puede verificarlo por ID de transacción.
                </p>
              </div>
              {attempts > 15 ? (
                <p className="mt-3 text-center text-xs text-ink-2">
                  Sigue esperando la confirmación. La caja se actualizará sola.
                </p>
              ) : null}
            </>
          )}

          {exited ? (
            <p role="status" className="mt-5 text-center text-sm font-semibold text-ink-2">
              Listo. Ya puedes cerrar esta pestaña; tu comprobante queda en este link.
            </p>
          ) : paid ? (
            <button
              type="button"
              onClick={finish}
              className="cta-primary on-accent mt-5 flex min-h-12 w-full items-center justify-center gap-2 bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-press"
            >
              Listo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void load()}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-separator bg-surface px-5 text-sm font-semibold text-ink-2 transition hover:border-accent/30 hover:text-accent"
            >
              Revisar link
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
