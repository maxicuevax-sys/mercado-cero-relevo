import { withPilotPage } from "../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { FlowScreen } from "@/components/shell/flow-screen";
import { NewTaskForm } from "./new-task-form";

export const metadata: Metadata = {
  title: "Nuevo pendiente — Trangui",
};

function NuevoPendientePage() {
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

export default withPilotPage(NuevoPendientePage);

// Session-bound pages must never prerender another account's HTML.
export const instant = false;
