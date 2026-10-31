"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Loader2, ShieldCheck, Store } from "lucide-react";
import { formatMxn } from "@/lib/format";

interface CheckoutData {
  demoMode: boolean;
  merchant: { name: string; address: string };
  order: {
    id: string;
    shortRef: string;
    status: string;
    totalCents: number;
    amountDueCents: number;
  };
  payment: {
    method: string;
    transactionId: string | null;
    amountCents: number;
    createdAt: string;
  } | null;
}

const METHOD_LABEL: Record<string, string> = {
  codi: "CoDi",
  card: "Tarjeta",
  wallet: "Apple Pay / Google Pay",
  cash: "Efectivo",
  mixed: "Pago mixto",
};

export default function CheckoutSuccessPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [data, setData] = useState<CheckoutData | null>(null);
  const [attempts, setAttempts] = useState(0);

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

  const paid = Boolean(data?.payment) || (data?.order.amountDueCents ?? 1) <= 0;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-[32px] border border-line bg-card shadow-lift">
        <div className="bg-gradient-to-br from-green-soft via-card to-yellow-soft/50 px-6 pb-7 pt-9 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green text-paper">
            {paid ? (
              <Check className="h-8 w-8" strokeWidth={2.5} />
            ) : (
              <Loader2 className="h-7 w-7 animate-spin" />
            )}
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-green">
            {paid ? "Pago confirmado" : "Verificando pago"}
          </p>
          <h1 className="mt-1 font-display text-[1.8rem] leading-tight text-ink">
            {paid ? "Listo para entregar" : "Estamos confirmando con el banco"}
          </h1>
          {data ? (
            <p className="tabular mt-3 font-display text-[2.4rem] leading-none text-ink">
              {formatMxn(data.payment?.amountCents ?? data.order.totalCents)}
            </p>
          ) : null}
          {data ? (
            <p className="mt-2 text-sm text-muted">
              Pedido {data.order.shortRef} · {data.merchant.name}
            </p>
          ) : null}
        </div>

        <div className="px-6 py-5">
          {paid && data?.payment ? (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Método</dt>
                  <dd className="font-semibold text-ink">
                    {METHOD_LABEL[data.payment.method] ?? data.payment.method}
                  </dd>
                </div>
                {data.payment.transactionId ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted">Transacción</dt>
                    <dd className="max-w-[15rem] break-all text-right font-mono text-xs text-ink-soft">
                      {data.payment.transactionId}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-green/15 bg-green-soft/50 px-3.5 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                <p className="text-xs leading-relaxed text-green-deep">
                  {data.demoMode
                    ? "Pago simulado para la demo. En producción, este estado solo aparece con el webhook firmado de pey."
                    : "pey confirmó este pago con un webhook firmado. Ya puedes mostrar esta pantalla."}
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-sm leading-relaxed text-ink-soft">
                Tu pago ya salió del banco. Mercado Cero está esperando la
                confirmación firmada de pey; normalmente tarda unos segundos.
              </p>
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-paper/50 px-3.5 py-3">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <p className="text-xs leading-relaxed text-muted">
                  No cierres esta pantalla. Si tarda más de un minuto, muestra
                  tu comprobante a la comerciante; ella puede verificarlo por
                  ID de transacción.
                </p>
              </div>
              {attempts > 15 ? (
                <p className="mt-3 text-center text-xs text-muted">
                  Sigue esperando la confirmación. La caja se actualizará sola.
                </p>
              ) : null}
            </>
          )}

          <Link
            href="/"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card px-5 py-3 text-sm font-semibold text-ink-soft transition hover:border-green/30 hover:text-green"
          >
            Volver a Mercado Cero
          </Link>
        </div>
      </section>
    </main>
  );
}
