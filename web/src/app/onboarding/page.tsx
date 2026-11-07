import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Bienvenida · Mercado Cero",
  description:
    "Cuatro pasos para conocer Mercado Cero: tu negocio, una venta de ejemplo y tu primera visita al mostrador.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
