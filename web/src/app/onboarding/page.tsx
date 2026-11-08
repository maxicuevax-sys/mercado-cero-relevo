import { withPilotPage } from "../../lib/auth/pilot-page";
import { connection } from "next/server";
import { getBusinessProfile } from "@/lib/business-profile";
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Bienvenida · Trangui",
  description:
    "Elige el giro de tu puesto y adapta las sugerencias de Trangui a tu negocio.",
};

async function OnboardingPage() {
  await connection();
  return <OnboardingFlow profile={getBusinessProfile()} />;
}

export default withPilotPage(OnboardingPage);

// Session-bound pages must never prerender another account's HTML.
export const instant = false;
