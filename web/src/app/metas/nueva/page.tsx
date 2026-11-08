import { withPilotPage } from "../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { FlowScreen } from "@/components/shell/flow-screen";
import { NewGoalForm } from "./new-goal-form";

export const metadata: Metadata = {
  title: "Nueva meta — Trangui",
};

function NuevaMetaPage() {
  return (
    <FlowScreen
      title="Nueva meta"
      titleId="nueva-meta-title"
      backHref="/metas"
      backLabel="Volver a Metas"
      activeHref="/metas"
    >
      <NewGoalForm />
    </FlowScreen>
  );
}

export default withPilotPage(NuevaMetaPage);

// Session-bound pages must never prerender another account's HTML.
export const instant = false;
