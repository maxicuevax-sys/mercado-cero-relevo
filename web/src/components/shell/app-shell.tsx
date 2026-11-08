import { Suspense, type ReactNode } from "react";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { SkipLink } from "./skip-link";
import { RouteFocus } from "./route-focus";
import { PreferencesBoot } from "./preferences-boot";
import "./definitive-a.css";
import "./reference-a2.css";
import {
  codiMobileCenter,
  inicioFoot,
  inicioNav,
  mobileMore,
  mobilePrimary,
  type ShellMobileCenter,
  type ShellNavItem,
} from "./nav";

/**
 * Barra móvil compartida: Inicio · Movimientos · [Cobrar con CoDi] · Caja ·
 * Más. Fiados, Corte, Pendientes, Metas, Ventas, Ayuda y Ajustes no se
 * pierden: viven en "Más".
 */
function contextualMobilePrimary(_activeHref: string): ShellNavItem[] {
  return mobilePrimary;
}

export function AppShell({
  children,
  activeHref,
  topbar,
  mainId = "main",
  className = "",
  contentClassName = "inicio-content",
  nav = inicioNav,
  foot = inicioFoot,
  mobilePrimaryItems,
  mobileMoreItems = mobileMore,
  mobileCenter = codiMobileCenter,
  focusTargetId,
}: {
  children: ReactNode;
  activeHref: string;
  topbar: ReactNode;
  mainId?: string;
  className?: string;
  contentClassName?: string;
  nav?: ShellNavItem[];
  foot?: ShellNavItem[];
  mobilePrimaryItems?: ShellNavItem[];
  mobileMoreItems?: ShellNavItem[];
  mobileCenter?: ShellMobileCenter;
  focusTargetId?: string;
}) {
  return (
    <div className={`inicio-shell ${className} ${["/inicio", "/corte", "/metas", "/pendientes"].includes(activeHref) ? "mc-reference-a" : ""}`.trim()}>
      <PreferencesBoot />
      <Suspense fallback={null}>
        <RouteFocus mainId={mainId} targetId={focusTargetId} />
      </Suspense>
      <SkipLink href={`#${mainId}`} />
      <Sidebar items={nav} foot={foot} activeHref={activeHref} />
      <div className="inicio-main">
        {topbar}
        <main id={mainId} tabIndex={-1} className={contentClassName}>
          {children}
        </main>
      </div>
      <MobileNav
        primary={mobilePrimaryItems ?? contextualMobilePrimary(activeHref)}
        more={mobileMoreItems}
        activeHref={activeHref}
        center={mobileCenter}
      />
    </div>
  );
}
