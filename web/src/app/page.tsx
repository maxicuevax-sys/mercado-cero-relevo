import { redirect } from "next/navigation";
import { connection } from "next/server";
import CajaApp from "@/components/caja-app";
import { isDemoMode } from "@/lib/config";
import { getDashboardData } from "@/lib/dashboard";

// La caja entera depende de datos vivos: es preferible bloquear el request
// hasta tener las cifras reales que pintar un shell vacÃ­o y luego rellenarlo.
export const instant = false;

/**
 * Alias heredados `/?tab=...` de la Caja clásica. Cada pestaña ya tiene su
 * pantalla nueva, así que el servidor redirige antes de montar el shell
 * clásico. Sin `tab`, `/` sigue renderizando la Caja clásica (compatibilidad
 * temporal B1, fuera del alcance del relevo).
 *
 * La hoja de ayuda clásica (`/?ayuda=1`) también se redirige a su pantalla
 * nueva. `/` sin `tab` sigue renderizando la Caja clásica (compatibilidad
 * temporal B1, fuera del alcance del relevo).
 */
const TAB_REDIRECTS = {
  caja: "/caja",
  fiado: "/fiados",
  corte: "/corte",
  meta: "/metas",
  pendientes: "/pendientes",
} as const;

function tabDestination(tab: string | undefined): string | null {
  if (!tab || !Object.hasOwn(TAB_REDIRECTS, tab)) return null;
  return TAB_REDIRECTS[tab as keyof typeof TAB_REDIRECTS];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ayuda?: string }>;
}) {
  // La caja es dato vivo: se lee en cada request, no en el build.
  await connection();
  const params = await searchParams;

  // Los alias viejos no deben montar el shell clásico: van a su pantalla nueva.
  const destination = tabDestination(params.tab);
  if (destination) redirect(destination);

  // La hoja de ayuda clásica pasa a ser una pantalla nueva. Un bookmark viejo
  // `/?ayuda=1#ajustes` llega sin el hash al servidor y cae en /ayuda; el enlace
  // nuevo del pie apunta directo a /ajustes.
  if (params.ayuda === "1") redirect("/ayuda");

  const initialDashboard = getDashboardData({ compactPending: true });

  return (
    <CajaApp
      initialDashboard={initialDashboard}
      initialDemoMode={isDemoMode()}
      initialTab="caja"
    />
  );
}

