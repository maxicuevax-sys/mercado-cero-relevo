import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "./detalle-movimiento.css";

export const metadata: Metadata = {
  title: "Movimiento no encontrado · Trangui",
};

export default function MovimientoNoEncontrado() {
  const merchant = MERCHANT;
  const initial =
    (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";

  return (
    <OperationalPage
      activeHref="/movimientos"
      title="Detalle del movimiento"
      titleId="mc-mvd-title"
      eyebrow="CoDi"
      merchant={merchant.name}
      address={merchant.address}
      demo={isDemoMode()}
      initial={initial}
      mainId="movimiento-detalle-main"
      contentClassName="mc-mvd-page"
      focusTargetId="mc-mvd-title"
    >
      <section
        className="mc-mvd-notfound"
        aria-labelledby="mc-mvd-notfound-title"
      >
        <QrCode aria-hidden="true" />
        <h2 id="mc-mvd-notfound-title" className="mc-mvd-notfound__title">
          No encontramos este movimiento.
        </h2>
        <p className="mc-mvd-notfound__body">
          Puede que la solicitud ya no exista en esta base, que sea de otro modo
          (demo/real) o que no sea un cobro CoDi. El historial solo muestra
          solicitudes y pagos digitales de la base actual.
        </p>
        <Link href="/movimientos" className="mc-mvd-back">
          <ArrowLeft aria-hidden="true" />
          Volver a Movimientos
        </Link>
      </section>
    </OperationalPage>
  );
}
