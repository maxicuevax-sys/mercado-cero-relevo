import type { Metadata } from "next";
import { FlowScreen } from "@/components/shell/flow-screen";
import { NewGoalForm } from "./new-goal-form";

export const metadata: Metadata = {
  title: "Nueva meta — Mercado Cero",
};

export default function NuevaMetaPage() {
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
