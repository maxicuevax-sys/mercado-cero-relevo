import { judgeAccountsEnabled } from "@/lib/auth/pilot-mode";
import { withPilotPage } from "../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { SettingsHome } from "@/components/ajustes/settings-home";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "./ajustes.css";

export const metadata: Metadata = { title: "Ajustes · Trangui" };
export const instant = false;

async function Page() {
  await connection();
  return <OperationalPage activeHref="/ajustes" title="Ajustes" titleId="ajustes-title"
    contentClassName="mc-ajustes-page" merchant={MERCHANT.name} address={MERCHANT.address} demo={isDemoMode()}>
    <SettingsHome accountMode={judgeAccountsEnabled()} merchant={MERCHANT.name} address={MERCHANT.address} demo={isDemoMode()} />
  </OperationalPage>;
}

export default withPilotPage(Page);
