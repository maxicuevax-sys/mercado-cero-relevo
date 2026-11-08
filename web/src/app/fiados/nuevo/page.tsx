import type { Metadata } from "next";
import { connection } from "next/server";
import { FlowScreen } from "@/components/shell/flow-screen";
import { listCredits } from "@/lib/db";
import { MEXICO_TZ } from "@/lib/mexico-date";
import { NewCreditForm } from "./new-credit-form";

export const metadata: Metadata = {
  title: "Nuevo fiado — Trangui",
};

export const instant = false;

const dayFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: MEXICO_TZ,
  day: "numeric",
  month: "short",
});

export default async function NuevoFiadoPage() {
  await connection();
  const todayLabel = `Hoy, ${dayFormatter.format(new Date()).replace(/\.$/, "")}`;
  const byName = new Map<string, number>();
  for (const credit of listCredits()) {
    const name = credit.customerName?.trim();
    if (!name) continue;
    byName.set(name, (byName.get(name) ?? 0) + credit.balanceCents);
  }
  const customers = [...byName.entries()]
    .map(([name, balanceCents]) => ({ name, balanceCents }))
    .sort((a, b) => b.balanceCents - a.balanceCents);

  return (
    <FlowScreen
      title="Nuevo fiado"
      titleId="nuevo-fiado-title"
      backHref="/fiados"
      backLabel="Volver a Fiados"
      activeHref="/fiados"
    >
      <NewCreditForm todayLabel={todayLabel} customers={customers} />
    </FlowScreen>
  );
}
