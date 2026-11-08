import type { ReactNode } from "react";
import "@/app/inicio/inicio.css";
import { AppShell } from "./app-shell";
import { PageHeader } from "./page-header";
import { TopBar } from "./top-bar";
import {
  operationalFoot,
  operationalMobileMore,
  operationalNav,
} from "./nav";
import "./operational.css";

export type OperationalPageProps = {
  /** Destino activo del navegador, p. ej. `/fiados`. */
  activeHref: string;
  /** Texto del H1 único de la pantalla. */
  title: string;
  /** `id` del H1 para enlazarlo desde `aria-labelledby` si hace falta. */
  titleId?: string;
  eyebrow?: string;
  subtitle?: string;
  /** Acciones del encabezado (enlaces o botones ya existentes). */
  actions?: ReactNode;
  merchant: string;
  address: string;
  demo: boolean;
  /** Inicial del avatar; por defecto la primera letra de `merchant`. */
  initial?: string;
  /** Id que recibe el foco al navegar (RouteFocus). */
  focusTargetId?: string;
  /** Id del `<main>`; por defecto `main`. */
  mainId?: string;
  /** Clases extra para el contenedor `<div class="mc-op-page">`. */
  className?: string;
  /** Clases extra para el `<main>`; siempre conserva `mc-op-main`. */
  contentClassName?: string;
  /** Contenido server de la pantalla. */
  children: ReactNode;
};

/**
 * Wrapper de las pantallas operativas nuevas (Fiados, Corte, Metas,
 * Pendientes): compone AppShell + TopBar + PageHeader + `<div class="mc-op-page">`.
 *
 * Es un Server Component: `children` y `actions` pueden ser nodos server. La
 * única parte cliente es la del shell (RouteFocus, SkipLink, MobileNav).
 */
export function OperationalPage({
  activeHref,
  title,
  titleId,
  eyebrow,
  subtitle,
  actions,
  merchant,
  address,
  demo,
  initial,
  focusTargetId,
  mainId = "main",
  className = "",
  contentClassName = "",
  children,
}: OperationalPageProps) {
  const avatar = initial ?? (merchant.trim().charAt(0).toUpperCase() || "M");

  return (
    <AppShell
      className=""
      activeHref={activeHref}
      mainId={mainId}
      focusTargetId={focusTargetId}
      contentClassName={`mc-op-main ${contentClassName}`.trim()}
      nav={operationalNav}
      foot={operationalFoot}
      mobileMoreItems={operationalMobileMore}
      topbar={
        <TopBar
          merchant={merchant}
          address={address}
          initial={avatar}
          demo={demo}
        />
      }
    >
      <PageHeader
        className="mc-op-header"
        eyebrow={eyebrow}
        title={title}
        titleId={titleId}
        subtitle={subtitle}
        actions={actions}
      />
      <div className={`mc-op-page ${className}`.trim()}>{children}</div>
    </AppShell>
  );
}
