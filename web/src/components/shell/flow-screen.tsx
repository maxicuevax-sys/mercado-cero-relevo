import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronLeft, Store } from "lucide-react";
import brand from "@/assets/inicio/brand-shop-cream.svg";
import { MobileNav } from "./mobile-nav";
import { codiMobileCenter, operationalMobileMore, operationalMobilePrimary } from "./nav";
import { MERCHANT } from "@/lib/config";
import "./flow-screen.css";

/**
 * Lienzo nativo de los estados A (nuevo fiado, fiado de un cliente, abono,
 * historial de cortes, nueva meta, nuevo pendiente).
 *
 * Reusa la misma barra de marca y la misma navegación móvil que la libreta de
 * Fiados, pero es una pantalla completa: cada estado de la referencia tiene
 * ruta propia, no un modal escondido.
 */
export function FlowScreen({
  title,
  titleId,
  backHref,
  backLabel,
  activeHref,
  merchant = MERCHANT.name,
  address = MERCHANT.address,
  initial = MERCHANT.owner.charAt(0).toUpperCase(),
  headingAction,
  children,
  className = "",
}: {
  title: string;
  titleId?: string;
  backHref: string;
  backLabel: string;
  activeHref: string;
  merchant?: string;
  address?: string;
  initial?: string;
  /** Acción real alineada al título (p. ej. exportar). Opcional: no altera otras rutas. */
  headingAction?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mc-flow ${className}`.trim()}>
      <a className="mc-flow__skip" href="#mc-flow-main">
        Saltar al contenido
      </a>

      <header className="mc-flow__brandbar">
        <Link className="mc-flow__brand" href="/inicio" aria-label="Ir a Inicio">
          <Image src={brand} width={36} height={36} alt="" unoptimized />
          <span>
            Trangui
          </span>
        </Link>
        <div className="mc-flow__merchant">
          <Store aria-hidden="true" />
          <div>
            <strong>{merchant}</strong>
            <small>{address}</small>
          </div>
        </div>
        <Link className="mc-flow__bell" href="/pendientes" aria-label="Ver pendientes">
          <Bell aria-hidden="true" />
        </Link>
        <span className="mc-flow__avatar" aria-hidden="true">
          {initial}
        </span>
      </header>

      <main id="mc-flow-main" className="mc-flow__sheet" tabIndex={-1}>
        <div className="mc-flow__heading">
          <Link className="mc-flow__back" href={backHref} aria-label={backLabel}>
            <ChevronLeft aria-hidden="true" />
          </Link>
          <h1 id={titleId}>{title}</h1>
          {headingAction ? <div className="mc-flow__heading-action">{headingAction}</div> : null}
        </div>
        {children}
      </main>

      <MobileNav
        primary={operationalMobilePrimary}
        more={operationalMobileMore}
        activeHref={activeHref}
        center={codiMobileCenter}
      />
    </div>
  );
}
