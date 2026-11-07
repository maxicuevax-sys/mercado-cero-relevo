import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { NewTaskForm } from "@/components/pendientes/new-task-form";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "../pendientes.css";

export const metadata: Metadata = {
  title: "Nuevo pendiente · Mercado Cero",
};

export const instant = false;

export default async function NuevoPendientePage() {
  await connection();

  return (
    <OperationalPage
      activeHref="/pendientes"
      title="Nuevo pendiente"
      titleId="nuevo-pendiente-title"
      actions={
        <Link
          href="/pendientes"
          className="mc-pend-back"
          aria-label="Volver a Pendientes"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
      }
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={isDemoMode()}
      mainId="nuevo-pendiente-main"
      focusTargetId="nuevo-pendiente-title"
      contentClassName="mc-pend-main mc-pend-main--nuevo"
    >
      <NewTaskForm />
    </OperationalPage>
  );
}
