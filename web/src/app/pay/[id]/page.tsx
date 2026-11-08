import { withPilotPage } from "../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCheckoutData } from "@/lib/checkout";
import "@/app/checkout.css";
import CheckoutClient from "./checkout-client";

export const metadata: Metadata = {
  title: "Pagar · Trangui",
  description: "Paga tu pedido con CoDi, tarjeta o wallet.",
};

// El cobro es dato vivo: la ruta se renderiza completa antes de responder.
// Así un id inexistente puede devolver un 404 real, no un shell con 200.
export const instant = false;

interface CheckoutPageProps {
  params: Promise<{ id: string }>;
}

async function CheckoutPage({ params }: CheckoutPageProps) {
  await connection();
  const { id } = await params;
  const initialOrder = getCheckoutData(id);

  if (!initialOrder) notFound();

  return <CheckoutClient initialOrder={initialOrder} />;
}

export default withPilotPage(CheckoutPage, { buyer: true });
