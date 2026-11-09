import { withPilotPage } from "../../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FlowScreen } from "@/components/shell/flow-screen";
import { getCredit } from "@/lib/db";
import { AbonoForm } from "./abono-form";

export const metadata: Metadata = {
  title: "Registrar abono — Trangui",
};

export const instant = false;

async function AbonoPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ metodo?: string | string[] }>;
}) {
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const initialMethod = query.metodo === "codi" || query.metodo === "card" ? query.metodo : "cash";
  const credit = getCredit(id);
  if (!credit) notFound();

  return (
    <FlowScreen
      title="Registrar abono"
      titleId="abono-title"
      backHref={`/fiados/${credit.id}`}
      backLabel="Volver al fiado"
      activeHref="/fiados"
    >
      <AbonoForm credit={credit} initialMethod={initialMethod} />
    </FlowScreen>
  );
}

export default withPilotPage(AbonoPage);
