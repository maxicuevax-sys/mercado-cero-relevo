import { Suspense, type ReactNode } from "react";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { SkipLink } from "./skip-link";
import { RouteFocus } from "./route-focus";
import { PreferencesBoot } from "./preferences-boot";
import "./definitive-a.css";
import "./reference-a2.css";
import {
  appNav,
  inicioFoot,
  inicioNav,
  mobileMore,
  type ShellNavItem,
} from "./nav";

const gastosItem: ShellNavItem = {
  ...appNav[4],
  id: "gastos",
  label: "Gastos",
  href: "/corte",
  ariaLabel: "Gastos del día",
};

function contextualMobilePrimary(activeHref: string): ShellNavItem[] {
  const ctx = activeHref.startsWith("/fiados")
    ? appNav[3]
    : activeHref.startsWith("/metas")
      ? appNav[5]
      : gastosItem;

  // Inicio · Ventas · Vender(+/Caja) · sección contextual
  return [appNav[0], appNav[2], appNav[1], ctx];
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
      />
    </div>
  );
}
