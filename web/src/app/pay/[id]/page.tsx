import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCheckoutData } from "@/lib/checkout";
import CheckoutClient from "./checkout-client";
import { CheckoutSkeleton } from "./checkout-skeleton";

export const metadata: Metadata = {
  title: "Pagar · Mercado Cero",
  description: "Paga tu pedido con CoDi, tarjeta o wallet.",
};

interface CheckoutPageProps {
  params: Promise<{ id: string }>;
}

async function CheckoutContent({ params }: CheckoutPageProps) {
  // El cobro es dato vivo: se lee en cada request, nunca en el build.
  await connection();
  const { id } = await params;
  const initialOrder = getCheckoutData(id);

  return <CheckoutClient initialOrder={initialOrder} />;
}

export default function CheckoutPage({ params }: CheckoutPageProps) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent params={params} />
    </Suspense>
  );
}
