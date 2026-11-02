import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutClient from "./checkout-client";

export const metadata: Metadata = {
  title: "Pagar · Mercado Cero",
  description: "Paga tu pedido con CoDi, tarjeta o wallet.",
};

function CheckoutFallback() {
  return (
    <main className="pay-shell min-h-dvh bg-canvas px-4 pt-8">
      <p role="status" className="sr-only">
        Abriendo tu cobro…
      </p>
      <div className="mx-auto w-full max-w-[480px] animate-pulse" aria-hidden="true">
        <div className="flex items-center gap-3 px-1">
          <div className="h-10 w-10 rounded-xl bg-surface-2" />
          <div>
            <div className="h-4 w-32 rounded bg-surface-2" />
            <div className="mt-1 h-2.5 w-24 rounded bg-surface-2" />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-separator bg-surface p-5 shadow-card">
          <div className="h-3 w-24 rounded-full bg-surface-2" />
          <div className="mt-3 h-10 w-44 rounded-xl bg-surface-2" />
          <div className="mt-6 space-y-2">
            <div className="h-12 rounded-2xl bg-surface-2/70" />
            <div className="h-12 rounded-2xl bg-surface-2/70" />
            <div className="h-12 rounded-2xl bg-surface-2/70" />
          </div>
          <div className="mt-6 h-12 rounded-xl bg-surface-2" />
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutClient />
    </Suspense>
  );
}
