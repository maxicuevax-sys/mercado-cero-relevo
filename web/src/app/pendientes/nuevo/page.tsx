import type { Metadata } from "next";
import { FlowScreen } from "@/components/shell/flow-screen";
import { NewTaskForm } from "./new-task-form";

export const metadata: Metadata = {
  title: "Nuevo pendiente — Mercado Cero",
};

export default function NuevoPendientePage() {
  return (
    <FlowScreen
      title="Nuevo pendiente"
      titleId="nuevo-pendiente-title"
      backHref="/pendientes"
      backLabel="Volver a Pendientes"
      activeHref="/pendientes"
    >
      <NewTaskForm />
    </FlowScreen>
  );
}
