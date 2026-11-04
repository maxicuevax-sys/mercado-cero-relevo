import type { StaticImageData } from "next/image";
import iconInicio from "@/assets/inicio/icons/inicio.svg";
import iconVentas from "@/assets/inicio/icons/ventas.svg";
import iconFiado from "@/assets/inicio/icons/fiado.svg";
import iconCaja from "@/assets/inicio/icons/caja.svg";
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
 * Navegación real de la fundación. Solo destinos con pantalla y recorrido.
 * `/productos`, `/proveedores` y `/reportes` no se muestran hasta que existan;
 * `/caja` queda reservada para cuando Caja se separe de Ventas.
 */
export const inicioNav: ShellNavItem[] = [
  { id: "inicio", label: "Inicio", href: "/inicio", icon: iconInicio },
  { id: "ventas", label: "Ventas", href: "/ventas", icon: iconVentas },
  { id: "fiados", label: "Fiados", href: "/fiados", icon: iconFiado },
  {
    id: "corte",
    label: "Corte",
    href: "/corte",
    icon: iconCaja,
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

export const inicioFoot: ShellNavItem[] = [
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

export const mobilePrimary: ShellNavItem[] = [
  inicioNav[0],
  inicioNav[1],
  inicioNav[2],
  inicioNav[3],
];

export const mobileMore: ShellNavItem[] = [
  inicioNav[4],
  inicioNav[5],
  ...inicioFoot,
];
