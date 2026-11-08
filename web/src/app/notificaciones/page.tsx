import { withPilotPage } from "../../lib/auth/pilot-page";
import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { MERCHANT, isDemoMode } from "@/lib/config";

export const metadata: Metadata = { title: "Notificaciones · Trangui" };

function NotificacionesPage() {
  const demo = isDemoMode();
  return (
    <OperationalPage
      activeHref="/notificaciones"
      title="Notificaciones"
      titleId="notificaciones-title"
      eyebrow="TU NEGOCIO"
      subtitle="Avisos de cobros, pendientes y movimientos."
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      initial={(MERCHANT.owner || "M").charAt(0).toUpperCase()}
      mainId="notificaciones-main"
      contentClassName="mc-notificaciones-page"
      actions={<Link href="/inicio" className="mc-parity-back" aria-label="Cerrar notificaciones"><X aria-hidden="true" /></Link>}
    >
      <section className="mc-op-panel" aria-labelledby="notificaciones-empty">
        <h2 id="notificaciones-empty" className="mc-op-panel__title">Sin notificaciones nuevas</h2>
        <p className="mc-op-panel__meta">
          Los avisos de cobros todavía no están conectados aquí. Revisa el estado de cada cobro en Movimientos.
        </p>
        <p><Link href="/movimientos">Ver movimientos</Link> · <Link href="/pendientes">Ver pendientes</Link></p>
      </section>
    </OperationalPage>
  );
}

export default withPilotPage(NotificacionesPage);

// Session-bound pages must never prerender another account's HTML.
export const instant = false;
