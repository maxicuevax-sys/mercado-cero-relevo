import type { Metadata } from "next";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { SettingsHome } from "@/components/ajustes/settings-home";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "./ajustes.css";

export const metadata: Metadata = { title: "Ajustes · Mercado Cero" };
export const instant = false;

export default async function Page() {
  await connection();
  return <OperationalPage activeHref="/ajustes" title="Ajustes" titleId="ajustes-title"
    contentClassName="mc-ajustes-page" merchant={MERCHANT.name} address={MERCHANT.address} demo={isDemoMode()}>
    <SettingsHome merchant={MERCHANT.name} address={MERCHANT.address} demo={isDemoMode()} />
  </OperationalPage>;
}
