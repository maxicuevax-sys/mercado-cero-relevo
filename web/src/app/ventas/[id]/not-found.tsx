import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { OperationalPage } from "@/components/shell/operational-page";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "../ventas.css";
import "./detalle-venta.css";

export const metadata: Metadata = {
  title: "Venta no encontrada · Mercado Cero",
};

export default function VentaNoEncontrada() {
  const merchant = MERCHANT;
  const initial = (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";

  return (
    <OperationalPage
      activeHref="/ventas"
      title="Detalle de venta"
      titleId="mc-dv-title"
      eyebrow="Ventas"
      merchant={merchant.name}
      address={merchant.address}
      demo={isDemoMode()}
      initial={initial}
      mainId="venta-detalle-main"
      contentClassName="mc-dv-page"
      focusTargetId="mc-dv-title"
    >
      <section className="mc-dv-notfound" aria-labelledby="mc-dv-notfound-title">
        <ReceiptText aria-hidden="true" />
        <h2 id="mc-dv-notfound-title" className="mc-dv-notfound__title">
          No encontramos esta venta.
        </h2>
        <p className="mc-dv-notfound__body">
          Puede que el folio ya no exista en esta base o que la venta sea de
          otro modo (demo/real). El historial solo muestra ventas reales de la
          base actual.
        </p>
        <Link href="/ventas" className="mc-dv-back">
          <ArrowLeft aria-hidden="true" />
          Volver a Ventas
        </Link>
      </section>
    </OperationalPage>
  );
}
