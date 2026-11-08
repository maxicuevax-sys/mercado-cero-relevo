"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Store } from "lucide-react";
import { cn, formatMxn } from "@/lib/format";
import { SUCCESS_COPY } from "@/lib/payment-labels";
import type { CheckoutData } from "@/lib/checkout";

const METHOD_LABEL: Record<string, string> = {
  codi: "CoDi",
  card: "Tarjeta",
  wallet: "Wallet",
  cash: "Efectivo",
  mixed: "Pago mixto",
};

export default function CheckoutSuccessPage({
  initialOrder,
}: {
  initialOrder: CheckoutData | null;
}) {
  const params = useParams<{ id: string }>();
  const orderId = initialOrder?.order.id ?? params.id;
  // El servidor ya leyó el pago: no hay spinner de “confirmando” en el HTML.
  const [data, setData] = useState<CheckoutData | null>(initialOrder);
  const etagRef = useRef<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [exited, setExited] = useState(false);
  const [missing, setMissing] = useState(initialOrder === null);

  function finish() {
    // Salida pública: nunca el dashboard de la comerciante.
    try {
      window.close();
    } catch {
      // Si el navegador no deja cerrar, el mensaje de abajo lo explica.
    }
    setExited(true);
  }

  const load = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    const response = await fetch(`/api/checkout/${orderId}`, {
      cache: "no-store",
      headers:
        !force && etagRef.current
          ? { "If-None-Match": etagRef.current }
          : undefined,
    });
    if (response.status === 404) {
      // Un link inventado no va a confirmarse nunca: no lo dejamos esperando
      // al banco ni mostramos mensajes de un pago que no existe.
      setMissing(true);
      setData(null);
      return;
    }
    if (response.status === 304) return;
    if (!response.ok) return;
    setMissing(false);
    const etag = response.headers.get("etag");
    if (etag) etagRef.current = etag;
    setData((await response.json()) as CheckoutData);
  }, [orderId]);

  useEffect(() => {
    if (missing) return;
    if (!data || data.payment || data.order.amountDueCents <= 0) return;
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
        setAttempts((value) => value + 1);
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
  }, [data, load, missing]);

  const isCredit =
    Boolean(data) &&
    (data?.order.creditCents ?? 0) > 0 &&
    (data?.order.amountDueCents ?? 1) <= 0;
  const paid =
    Boolean(data?.payment) ||
    (Boolean(data) && (data?.order.amountDueCents ?? 1) <= 0 && !isCredit);
  const demo =
    data?.payment?.demo === true ||
    data?.payment?.provider === "demo" ||
    (data?.order.demoPaidCents ?? 0) > 0;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!paid && !isCredit && !missing) return;
    const timer = window.setTimeout(() => headingRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [paid, isCredit, missing]);

  useEffect(() => {
    if (!missing) return;
    const previousTitle = document.title;
    document.title = "Cobro no encontrado · Trangui";
    return () => {
      document.title = previousTitle;
    };
  }, [missing]);

  if (missing) {
    return (
      <main className="pay-shell grid min-h-dvh place-items-center px-[16px] py-8">
        <section
          role="status"
          aria-live="polite"
          className="receipt-stack receipt-stack--layered w-full"
        >
          <div className="receipt-paper">
            <div className="receipt-paper__perf" aria-hidden="true" />
            <div className="receipt-result">
              <div className="receipt-result__stamp">
                <span className="stamp stamp--cash">Extraviado</span>
              </div>
              <p className="receipt-result__method">Cobro no disponible</p>
              <h1 ref={headingRef} tabIndex={-1}>
                No encontramos este cobro
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                Este link no corresponde a un cobro de Trangui. Pide a la comerciante
                que genere uno nuevo.
              </p>
            </div>
            <div className="receipt-body">
              {exited ? (
                <p role="status" className="text-center text-sm font-semibold text-ink-2">
                  Listo. Ya puedes cerrar esta pestaña.
                </p>
              ) : (
                <>
                  <button type="button" onClick={finish} className="result-exit">
                    Cerrar esta pestaña
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
          </div>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="pay-shell grid min-h-dvh place-items-center px-4 py-8">
        <section className="receipt-stack receipt-stack--layered w-full">
          <div className="receipt-paper p-7 text-center">
            <span className="stamp stamp--cash">Sin datos</span>
            <div className="empty-sheet__icon mt-4">
              <Store className="h-6 w-6" />
            </div>
            <h1 className="mt-3 font-display text-[1.7rem] font-semibold text-ink">
              Este cobro no existe
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Pide a la comerciante que genere un link nuevo. No hay ningún pago
              en curso.
            </p>
            {exited ? (
              <p role="status" className="mt-5 text-sm font-semibold text-ink-2">
                Listo. Ya puedes cerrar esta pestaña.
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

  if (isCredit && data) {
    const cashPaid =
      data.order.cashPaidCents ??
      Math.max(0, data.order.paidCents - data.order.digitalPaidCents);
    const source = [
      cashPaid > 0 ? `${formatMxn(cashPaid)} en efectivo` : null,
      data.payment
        ? `${formatMxn(data.payment.amountCents)} ${
            data.payment.demo || data.payment.provider === "demo"
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
      <main className="pay-shell grid min-h-dvh place-items-center px-[16px] py-8">
        <section role="status" aria-live="polite" className="receipt-stack receipt-stack--layered w-full">
          <div className="receipt-paper">
            <div className="receipt-paper__perf" aria-hidden="true" />
            <div className="receipt-result">
              <div className="receipt-result__stamp">
                <span className="stamp stamp--sim">Fiado anotado</span>
              </div>
              <p className="receipt-result__method">
                {data.order.paidCents > 0 ? "Cobro mixto" : "Venta a fiado"}
              </p>
              <h1 ref={headingRef} tabIndex={-1}>
                Quedó anotado
              </h1>
              <p className="receipt-result__amount">
                {formatMxn(data.order.totalCents)}
              </p>
              <p className="receipt-result__ref">
                Folio {data.order.shortRef} · {data.merchant.name}
              </p>
            </div>
            <div className="receipt-body">
              <div className="pay-note">
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

  const cashPaid = data
    ? data.order.cashPaidCents ??
      Math.max(0, data.order.paidCents - data.order.digitalPaidCents)
    : 0;
  const cashOnly = Boolean(data) && paid && !data?.payment && cashPaid > 0 && !demo;
  const sourceMixed = Boolean(data?.payment) && paid && cashPaid > 0;
  const methodLabel = data?.payment
    ? demo && data.payment.method === "cash"
      ? "Demo (no es efectivo real)"
      : METHOD_LABEL[data.payment.method] ?? data.payment.method
    : null;

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
                  paid
                    ? sourceMixed
                      ? demo
                        ? "stamp--sim"
                        : "stamp--paid"
                      : demo
                        ? "stamp--sim"
                        : cashOnly
                          ? "stamp--cash"
                          : "stamp--paid"
                    : "stamp--draft",
                )}
              >
                {paid
                  ? demo
                    ? SUCCESS_COPY.demo.stamp
                    : cashOnly
                      ? SUCCESS_COPY.cash.stamp
                      : sourceMixed
                        ? "Pago mixto"
                        : SUCCESS_COPY.verified.stamp
                  : SUCCESS_COPY.pending.stamp}
              </span>
            </div>
            <p className="receipt-result__method">
              {paid
                ? sourceMixed
                  ? demo
                    ? "Efectivo + pago demo"
                    : "Efectivo + pago verificado por pey"
                  : demo
                    ? SUCCESS_COPY.demo.method
                    : cashOnly
                      ? SUCCESS_COPY.cash.method
                      : SUCCESS_COPY.verified.method
                : SUCCESS_COPY.pending.method}
            </p>
            <h1 ref={headingRef} tabIndex={-1}>
              {paid
                ? sourceMixed
                  ? "Pago mixto"
                  : demo
                    ? SUCCESS_COPY.demo.title
                    : cashOnly
                      ? SUCCESS_COPY.cash.title
                      : SUCCESS_COPY.verified.title
                : SUCCESS_COPY.pending.title}
            </h1>
            {data ? (
              <p className="receipt-result__amount">
                {formatMxn(
                  sourceMixed
                    ? data.order.totalCents
                    : data.payment?.amountCents ?? (cashPaid || data.order.totalCents),
                )}
              </p>
            ) : null}
            {data ? (
              <p className="receipt-result__ref">
                Folio {data.order.shortRef} · {data.merchant.name}
              </p>
            ) : null}
          </div>

          <div className="receipt-body">
            {paid && data?.payment ? (
              <>
                <div className="result-details">
                  <dl>
                    <div>
                      <dt>Método</dt>
                      <dd>{sourceMixed ? `Efectivo + ${methodLabel}` : methodLabel}</dd>
                    </div>
                    {data.payment.transactionId ? (
                      <div>
                        <dt>Transacción</dt>
                        <dd className="break-all font-mono text-xs">
                          {data.payment.transactionId}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <div className="pay-note mt-3">
                  <p className="text-sm leading-relaxed text-ink-2">
                    {sourceMixed
                      ? demo
                        ? `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(data.payment.amountCents)} en un pago demo. El efectivo sí es dinero real; el digital es demo y el pedido no se entrega.`
                        : `Recibiste ${formatMxn(cashPaid)} en efectivo y ${formatMxn(data.payment.amountCents)} verificados por pey.`
                      : demo
                        ? `${SUCCESS_COPY.demo.body} ${SUCCESS_COPY.demo.note}`
                        : data.payment.provider === "pey"
                          ? SUCCESS_COPY.verified.body
                          : "Este pago no tiene una confirmación firmada de pey. No lo presentes como verificado."}
                  </p>
                </div>
              </>
            ) : cashOnly ? (
              <>
                <p className="text-center text-sm leading-relaxed text-ink-2">
                  {SUCCESS_COPY.cash.body}
                </p>
                <div className="pay-note flex items-start gap-2.5">
                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
                  <p className="text-sm leading-relaxed text-ink-2">
                    {SUCCESS_COPY.cash.note}
                  </p>
                </div>
              </>
            ) : paid && demo ? (
              <div className="pay-note flex items-start gap-2.5">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
                <p className="text-sm leading-relaxed text-ink-2">
                  {SUCCESS_COPY.demo.body} {SUCCESS_COPY.demo.note}
                </p>
              </div>
            ) : (
              <>
                <p className="text-center text-sm leading-relaxed text-ink-2">
                  {SUCCESS_COPY.pending.body}
                </p>
                <div className="pay-note flex items-start gap-2.5">
                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
                  <p className="text-sm leading-relaxed text-ink-2">
                    {SUCCESS_COPY.pending.note}
                  </p>
                </div>
                {attempts > 15 ? (
                  <p className="mt-3 text-center text-xs text-ink-2">
                    Seguimos esperando la confirmación. La caja se actualiza sola; puedes
                    cerrar y volver a abrir este link.
                  </p>
                ) : null}
              </>
            )}

            <div className="result-actions">
              {exited ? (
                <p role="status" className="mt-2 text-center text-sm font-semibold text-ink-2">
                  Listo. Ya puedes cerrar esta pestaña; tu comprobante queda en este link.
                </p>
              ) : paid ? (
                <button type="button" onClick={finish} className="result-exit">
                  Listo
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={finish}
                    className="result-secondary"
                  >
                    Cerrar esta pestaña
                  </button>
                  <button
                    type="button"
                    onClick={() => void load({ force: true })}
                    className="result-secondary"
                  >
                    Revisar link
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
