import { withPilotPage } from "../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Bienvenida · Trangui",
  description:
    "Cuatro pasos para conocer Trangui: tu negocio, una venta de ejemplo y tu primera visita al mostrador.",
};

function OnboardingPage() {
  return <OnboardingFlow />;
}

export default withPilotPage(OnboardingPage);
