import { withPilotPage } from "../lib/auth/pilot-page";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const instant = false;

/**
 * La raíz ya no monta la Caja clásica. El Inicio canónico es /inicio.
 * Los bookmarks viejos `/?tab=...` y `/?ayuda=1` se conservan como redirecciones.
 */
const TAB_REDIRECTS = {
  caja: "/caja",
  fiado: "/fiados",
  corte: "/corte",
  meta: "/metas",
  pendientes: "/pendientes",
} as const;

async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ayuda?: string }>;
}) {
  const params = await searchParams;
  await connection();
  const tab = params.tab;

  if (tab && Object.hasOwn(TAB_REDIRECTS, tab)) {
    redirect(TAB_REDIRECTS[tab as keyof typeof TAB_REDIRECTS]);
  }

  if (params.ayuda === "1") redirect("/ayuda");

  return redirect("/inicio");
}

export default withPilotPage(Home);
