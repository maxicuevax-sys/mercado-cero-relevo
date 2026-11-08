import type { StaticImageData } from "next/image";
import iconInicio from "@/assets/inicio/icons/inicio.svg";
import iconVentas from "@/assets/inicio/icons/ventas.svg";
import iconFiado from "@/assets/inicio/icons/fiado.svg";
import iconCaja from "@/assets/inicio/icons/caja.svg";
import iconReportes from "@/assets/inicio/icons/reportes.svg";
import iconMonedas from "@/assets/inicio/icons/monedas.svg";
import iconPendientes from "@/assets/inicio/icons/pendientes.svg";
import iconMetas from "@/assets/inicio/icons/metas.svg";
import iconAyuda from "@/assets/inicio/icons/ayuda.svg";
import iconAjustes from "@/assets/inicio/icons/ajustes.svg";

export type ShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: StaticImageData;
  ariaLabel?: string;
  /** false mientras la ruta la integra otro carril: evita prefetch 404. */
  prefetch?: boolean;
};

/**
 * Centro del producto en la barra móvil: un solo destino grande para cobrar
 * con CoDi. Inicio es el hub; el resto de la operación vive en "Más".
 */
export type ShellMobileCenter = {
  label: string;
  href: string;
  ariaLabel?: string;
  glyph?: "qr" | "plus";
};

/** Hub CoDi dentro de Inicio. La barra móvil y el shell lo usan como centro. */
export const codiHubAnchor = "/inicio#cobrar-codi";

export const codiMobileCenter: ShellMobileCenter = {
  label: "Cobrar",
  href: codiHubAnchor,
  ariaLabel: "Cobrar con CoDi",
  glyph: "qr",
};

/**
 * Navegación completa del producto. Inicio es el hub CoDi y Movimientos reúne
 * el historial; Caja conserva la venta completa. Ningún destino se borra:
 * Fiados, Corte, Pendientes, Metas, Ventas, Ayuda y Ajustes viven en "Más".
 */
export const appNav: ShellNavItem[] = [
  { id: "inicio", label: "Inicio", href: "/inicio", icon: iconInicio },
  {
    id: "movimientos",
    label: "Movimientos",
    href: "/movimientos",
    icon: iconReportes,
    ariaLabel: "Movimientos de ventas y pagos",
    // La ruta la integra el carril de movimientos; hasta el merge no se
    // prefetchea para no pedir un 404.
    prefetch: false,
  },
  { id: "caja", label: "Caja", href: "/caja", icon: iconCaja },
  { id: "ventas", label: "Ventas", href: "/ventas", icon: iconVentas },
  { id: "fiados", label: "Fiados", href: "/fiados", icon: iconFiado },
  {
    id: "corte",
    label: "Corte",
    href: "/corte",
    icon: iconMonedas,
    ariaLabel: "Corte de caja",
  },
  { id: "metas", label: "Metas", href: "/metas", icon: iconMetas },
  { id: "pendientes", label: "Pendientes", href: "/pendientes", icon: iconPendientes },
];

/** Destinos que no compiten con el hub: se agrupan en "Más". */
const satelliteNav: ShellNavItem[] = [appNav[4], appNav[5], appNav[7], appNav[6], appNav[3]];

/**
 * Sidebar de Inicio: primero el hub y Movimientos; los destinos satélite
 * quedan al pie, debajo del separador del shell.
 */
export const inicioNav: ShellNavItem[] = [appNav[0], appNav[1]];

export const cajaNav = appNav;
/** Mismo navegador para las pantallas operativas nuevas (Fiados, Corte, Metas, Pendientes). */
export const operationalNav = appNav;

/**
 * Pie del shell. Ayuda y Ajustes son pantallas nuevas con el mismo shell; ya
 * no abren la hoja heredada `/?ayuda=1` de la Caja clásica.
 */
export const appFoot: ShellNavItem[] = [
  { id: "ayuda", label: "Ayuda", href: "/ayuda", icon: iconAyuda },
  { id: "ajustes", label: "Ajustes", href: "/ajustes", icon: iconAjustes },
];

export const inicioFoot: ShellNavItem[] = [...satelliteNav, appNav[2], ...appFoot];
export const cajaFoot = appFoot;
export const operationalFoot = appFoot;

/**
 * Barra móvil de 5 posiciones: Inicio · Movimientos · [Cobrar con CoDi] ·
 * Caja · Más. El centro es el hub CoDi, que es el trabajo principal del día.
 */
export const mobilePrimary: ShellNavItem[] = [appNav[0], appNav[1], appNav[2]];

export const cajaMobilePrimary = mobilePrimary;
export const operationalMobilePrimary = mobilePrimary;

export const mobileMore: ShellNavItem[] = [...satelliteNav, ...appFoot];

export const cajaMobileMore = mobileMore;
export const operationalMobileMore = mobileMore;

/**
 * Activo por ruta: compara el pathname e ignora query/hash. Un href con query
 * solo se marca si coincide completo (salvaguarda para enlaces heredados).
 */
export function isNavItemActive(item: ShellNavItem, activeHref: string): boolean {
  if (item.href.includes("?")) return item.href === activeHref;
  const targetPath = item.href.split(/[?#]/, 1)[0];
  const activePath = activeHref.split(/[?#]/, 1)[0];
  return targetPath === activePath;
}
