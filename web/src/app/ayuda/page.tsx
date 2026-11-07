import type { Metadata } from "next";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { HelpHome } from "@/components/ayuda/help-home";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "./ayuda.css";

export const metadata: Metadata = { title: "Ayuda ? Mercado Cero" };
export const instant = false;

export default async function Page() {
  await connection();
  return <OperationalPage activeHref="/ayuda" title="Ayuda" titleId="ayuda-title"
    contentClassName="mc-ayuda-page" merchant={MERCHANT.name} address={MERCHANT.address} demo={isDemoMode()}>
    <HelpHome />
  </OperationalPage>;
}
