import type { Metadata } from "next";
import { Suspense } from "react";
import CheckoutSuccessClient from "./success-client";

export const metadata: Metadata = {
  title: "Confirmando pago · Mercado Cero",
  description: "Estamos verificando tu pago con el banco.",
};

function SuccessFallback() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md animate-pulse rounded-2xl border border-separator bg-surface p-7 shadow-card">
        <div className="mx-auto h-16 w-16 rounded-full bg-surface-2" />
        <div className="mx-auto mt-5 h-3 w-28 rounded-full bg-surface-2" />
        <div className="mx-auto mt-3 h-9 w-40 rounded-xl bg-surface-2" />
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <CheckoutSuccessClient />
    </Suspense>
  );
}
