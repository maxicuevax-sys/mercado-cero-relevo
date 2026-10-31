import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutClient from "./checkout-client";

export const metadata: Metadata = {
  title: "Pagar · Mercado Cero",
  description: "Paga tu pedido con CoDi, tarjeta o wallet.",
};

function CheckoutFallback() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md animate-pulse rounded-[32px] border border-line bg-card p-7 shadow-card">
        <div className="h-11 w-11 rounded-2xl bg-paper-deep" />
        <div className="mt-6 h-3 w-24 rounded-full bg-paper-deep" />
        <div className="mt-3 h-10 w-44 rounded-xl bg-paper-deep" />
        <div className="mt-6 space-y-2">
          <div className="h-12 rounded-2xl bg-paper-deep/70" />
          <div className="h-12 rounded-2xl bg-paper-deep/70" />
          <div className="h-12 rounded-2xl bg-paper-deep/70" />
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
