import { Suspense, type ReactNode } from "react";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { SkipLink } from "./skip-link";
import { RouteFocus } from "./route-focus";
import { PreferencesBoot } from "./preferences-boot";
import "./definitive-a.css";
import "./reference-a2.css";
import {
  inicioFoot,
  inicioNav,
  mobileMore,
  mobilePrimary,
  type ShellNavItem,
} from "./nav";

export function AppShell({
  children,
  activeHref,
  topbar,
  mainId = "main",
  className = "",
  contentClassName = "inicio-content",
  nav = inicioNav,
  foot = inicioFoot,
  mobilePrimaryItems = mobilePrimary,
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
        referenceA={["/inicio", "/corte", "/metas", "/pendientes"].includes(activeHref)}
        primary={mobilePrimaryItems}
        more={mobileMoreItems}
        activeHref={activeHref}
      />
    </div>
  );
}
