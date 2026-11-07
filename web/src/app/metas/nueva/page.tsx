import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { NewGoalForm } from "@/components/metas/new-goal-form";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "../metas.css";

export const metadata: Metadata = {
  title: "Nueva meta · Mercado Cero",
};

export const instant = false;

export default async function NuevaMetaPage() {
  await connection();
  const demo = isDemoMode();

  return (
    <OperationalPage
      activeHref="/metas"
      title="Nueva meta"
      titleId="nueva-meta-title"
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      mainId="nueva-meta-main"
      focusTargetId="nueva-meta-title"
      contentClassName="mc-metas-main mc-metas-nueva-main"
      actions={
        <Link href="/metas" className="mc-metas-back" aria-label="Volver a Metas">
          <ArrowLeft aria-hidden="true" />
        </Link>
      }
    >
      <div className="mc-metas-native mc-metas-app mc-metas-nueva">
        <NewGoalForm />
      </div>
    </OperationalPage>
  );
}
