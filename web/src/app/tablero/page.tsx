import { withPilotPage } from "../../lib/auth/pilot-page";
import type { Metadata } from "next";
import Link from "next/link";
import { OperationalPage } from "@/components/shell/operational-page";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { listOrdersBetween } from "@/lib/db";
import { mexicoCityDayBounds } from "@/lib/stall-board";
import { StallBoard } from "@/components/tablero/stall-board";
import "@/components/tablero/stall-board.css";
import type { Order } from "@/lib/types";

export const metadata: Metadata = {
  title: "Mostrador · Trangui",
};

export const instant = false;

async function TableroPage() {
  const day = mexicoCityDayBounds();
  const orders = listOrdersBetween(day.startIso, day.endIso) as Order[];
  const merchant = MERCHANT;
  const initial = (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";
  return (
    <OperationalPage
      activeHref="/tablero"
      title="Mostrador"
      titleId="mc-board-title"
      eyebrow="Hoy en el puesto"
      subtitle="Los tickets de hoy, en una sola vista. El cobro CoDi cambia a PAGADO aquí cuando llega la confirmación firmada."
      merchant={merchant.name}
      address={merchant.address}
      demo={isDemoMode()}
      initial={initial}
      contentClassName="mc-board-page"
      actions={
        <Link href="/caja" className="mc-board-caja">
          Ir a Caja
        </Link>
      }
    >
      <StallBoard dayLabel={day.label} demo={isDemoMode()} initialOrders={orders} />
    </OperationalPage>
  );
}

export default withPilotPage(TableroPage);
