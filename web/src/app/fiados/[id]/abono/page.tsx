import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FlowScreen } from "@/components/shell/flow-screen";
import { getCredit } from "@/lib/db";
import { AbonoForm } from "./abono-form";

export const metadata: Metadata = {
  title: "Registrar abono — Mercado Cero",
};

export const instant = false;

export default async function AbonoPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
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
      <AbonoForm credit={credit} />
    </FlowScreen>
  );
}
