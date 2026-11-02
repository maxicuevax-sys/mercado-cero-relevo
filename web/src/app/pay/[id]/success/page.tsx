import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCheckoutData } from "@/lib/checkout";
import CheckoutSuccessClient from "./success-client";

export const metadata: Metadata = {
  title: "Confirmando pago · Mercado Cero",
  description: "Estamos verificando tu pago con el banco.",
};

interface SuccessPageProps {
  params: Promise<{ id: string }>;
}

function SuccessFallback() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-8">
      <p role="status" className="sr-only">
        Revisando tu pago…
      </p>
      <div
        className="min-h-[29rem] w-full max-w-md animate-pulse rounded-2xl border border-separator bg-surface p-7 shadow-card"
        aria-hidden="true"
      >
        <div className="mx-auto h-16 w-16 rounded-full bg-surface-2" />
        <div className="mx-auto mt-5 h-3 w-28 rounded-full bg-surface-2" />
        <div className="mx-auto mt-3 h-9 w-40 rounded-xl bg-surface-2" />
        <div className="mx-auto mt-3 h-3 w-36 rounded bg-surface-2" />
        <div className="mt-8 h-16 rounded-xl bg-surface-2/70" />
        <div className="mt-6 h-12 rounded-xl bg-surface-2" />
      </div>
    </main>
  );
}

async function SuccessContent({ params }: SuccessPageProps) {
  // El estado de pago es dato vivo: se lee en cada request, no en el build.
  await connection();
  const { id } = await params;
  const initialOrder = getCheckoutData(id);

  return <CheckoutSuccessClient initialOrder={initialOrder} />;
}

export default function CheckoutSuccessPage({ params }: SuccessPageProps) {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <SuccessContent params={params} />
    </Suspense>
  );
}
