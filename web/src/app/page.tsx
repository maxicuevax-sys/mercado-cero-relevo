import { connection } from "next/server";
import CajaApp from "@/components/caja-app";
import { isDemoMode } from "@/lib/config";
import { getDashboardData } from "@/lib/dashboard";

// La caja entera depende de datos vivos: es preferible bloquear el request
// hasta tener las cifras reales que pintar un shell vacío y luego rellenarlo.
export const instant = false;

export default async function Home() {
  // La caja es dato vivo: se lee en cada request, no en el build.
  await connection();
  const initialDashboard = getDashboardData({ compactPending: true });

  return (
    <CajaApp
      initialDashboard={initialDashboard}
      initialDemoMode={isDemoMode()}
    />
  );
}
