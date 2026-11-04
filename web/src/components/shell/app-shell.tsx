import type { ReactNode } from "react";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { SkipLink } from "./skip-link";
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
}) {
  return (
    <div className={`inicio-shell ${className}`.trim()}>
      <SkipLink href={`#${mainId}`} />
      <Sidebar items={nav} foot={foot} activeHref={activeHref} />
      <div className="inicio-main">
        {topbar}
        <main id={mainId} tabIndex={-1} className={contentClassName}>
          {children}
        </main>
      </div>
      <MobileNav
        primary={mobilePrimaryItems}
        more={mobileMoreItems}
        activeHref={activeHref}
      />
    </div>
  );
}
