import type { StaticImageData } from "next/image";
import iconInicio from "@/assets/inicio/icons/inicio.svg";
import iconVentas from "@/assets/inicio/icons/ventas.svg";
import iconFiado from "@/assets/inicio/icons/fiado.svg";
import iconCaja from "@/assets/inicio/icons/caja.svg";
import iconReportes from "@/assets/inicio/icons/reportes.svg";
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
};

/**
 * Navegación operativa única para Inicio y Caja.
 * Solo destinos con pantalla y recorrido. `/productos`, `/proveedores` y
 * `/reportes` no se muestran hasta que existan.
 */
export const appNav: ShellNavItem[] = [
  { id: "inicio", label: "Inicio", href: "/inicio", icon: iconInicio },
  { id: "caja", label: "Caja", href: "/caja", icon: iconCaja },
  { id: "ventas", label: "Ventas", href: "/ventas", icon: iconVentas },
  { id: "fiados", label: "Fiados", href: "/fiados", icon: iconFiado },
  {
    id: "corte",
    label: "Corte",
    href: "/corte",
    icon: iconReportes,
    ariaLabel: "Corte de caja",
  },
  { id: "metas", label: "Metas", href: "/metas", icon: iconMetas },
  {
    id: "pendientes",
    label: "Pendientes",
    href: "/pendientes",
    icon: iconPendientes,
  },
];

export const inicioNav = appNav;
export const cajaNav = appNav;

export const appFoot: ShellNavItem[] = [
  {
    id: "ayuda",
    label: "Ayuda",
    href: "/?ayuda=1",
    icon: iconAyuda,
  },
  {
    id: "ajustes",
    label: "Ajustes",
    href: "/?ayuda=1#ajustes",
    icon: iconAjustes,
  },
];

export const inicioFoot = appFoot;
export const cajaFoot = appFoot;

export const mobilePrimary: ShellNavItem[] = [
  appNav[0],
  appNav[1],
  appNav[2],
  appNav[3],
];

export const cajaMobilePrimary = mobilePrimary;

export const mobileMore: ShellNavItem[] = [
  appNav[4],
  appNav[5],
  appNav[6],
  ...appFoot,
];

export const cajaMobileMore = mobileMore;
