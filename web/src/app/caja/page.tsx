import { withPilotPage } from "../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { connection } from "next/server";
import { CajaScreen } from "@/components/caja/caja-screen";
import { MERCHANT, isDemoMode } from "@/lib/config";

export const metadata: Metadata = {
  title: "Caja · Trangui",
};

export const instant = false;

async function CajaPage() {
  await connection();
  return <CajaScreen merchant={MERCHANT} demo={isDemoMode()} />;
}

export default withPilotPage(CajaPage);
