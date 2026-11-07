import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import brand from "@/assets/inicio/brand-shop-cream.svg";
import "./fiados-mobile-chrome.css";

/**
 * Barra de marca de las pantallas de flujo de fiados (18 y 20).
 * Reproduce la franja verde de la lámina: símbolo de tienda, "Mercado Cero",
 * campana con punto de aviso y la inicial de la comerciante.
 */
export function FiadosMobileBar({ initial }: { initial: string }) {
  return (
    <header className="mc-fiadosbar">
      <Link href="/inicio" prefetch={false} className="mc-fiadosbar__brand" aria-label="Mercado Cero · Ir a Inicio">
        <Image src={brand} width={36} height={36} alt="" unoptimized />
        <span>
          Mercado
          <br />
          Cero
          <svg className="mc-fiadosbar__rays" viewBox="0 0 20 24" aria-hidden="true" focusable="false">
            <path d="M4 6 13 2M5 12h12M4 18l9 4" />
          </svg>
        </span>
      </Link>
      <Link href="/pendientes" prefetch={false} className="mc-fiadosbar__bell" aria-label="Ver pendientes">
        <Bell aria-hidden="true" />
      </Link>
      <span className="mc-fiadosbar__avatar" aria-hidden="true">
        {initial}
      </span>
    </header>
  );
}
