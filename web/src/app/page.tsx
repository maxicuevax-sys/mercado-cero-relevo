import { connection } from "next/server";
import CajaApp from "@/components/caja-app";
import { isDemoMode } from "@/lib/config";
import { getDashboardData } from "@/lib/dashboard";

// La caja entera depende de datos vivos: es preferible bloquear el request
// hasta tener las cifras reales que pintar un shell vacÃ­o y luego rellenarlo.
export const instant = false;

type HomeTab = "caja" | "fiado" | "corte" | "meta" | "pendientes";
const HOME_TABS = new Set<HomeTab>(["caja", "fiado", "corte", "meta", "pendientes"]);

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ayuda?: string }>;
}) {
  // La caja es dato vivo: se lee en cada request, no en el build.
  await connection();
  const initialDashboard = getDashboardData({ compactPending: true });
  const params = await searchParams;
  const requested = params.tab;
  const initialTab: HomeTab =
    requested && HOME_TABS.has(requested as HomeTab) ? (requested as HomeTab) : "caja";

  return (
    <CajaApp
      initialDashboard={initialDashboard}
      initialDemoMode={isDemoMode()}
      initialTab={initialTab}
      initialHelpOpen={params.ayuda === "1"}
    />
  );
}

