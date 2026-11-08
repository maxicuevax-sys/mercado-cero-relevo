import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Bienvenida · Trangui",
  description:
    "Cuatro pasos para conocer Trangui: tu negocio, una venta de ejemplo y tu primera visita al mostrador.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
