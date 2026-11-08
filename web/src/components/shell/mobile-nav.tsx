"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, QrCode } from "lucide-react";
import { MaskIcon } from "@/components/ui/icon";
import { isNavItemActive, type ShellMobileCenter, type ShellNavItem } from "./nav";
import reportIcon from "@/assets/inicio/icons/reportes.svg";
import shopIcon from "@/assets/inicio/brand-shop-cream.svg";
import "./shell.css";

export function MobileNav({
  primary,
  more,
  activeHref,
  center,
}: {
  primary: ShellNavItem[];
  more: ShellNavItem[];
  activeHref: string;
  /** Acción central de la barra. Si falta, cae al enlace histórico a Caja. */
  center?: ShellMobileCenter;
}) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  // Compatibilidad con las pantallas que aún no declaran centro explícito.
  const fallbackSale = center ? undefined : primary.find((item) => item.href === "/caja");
  const action =
    center ??
    (fallbackSale
      ? {
          label: "Vender",
          href: fallbackSale.href,
          ariaLabel: "Nueva venta",
          glyph: "plus" as const,
        }
      : null);
  const destinations = fallbackSale
    ? primary.filter((item) => item !== fallbackSale)
    : primary;

  function destination(item: ShellNavItem) {
    const active = isNavItemActive(item, activeHref);
    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={item.ariaLabel}
        prefetch={item.prefetch}
        className="mc-mobile-nav__item"
      >
        <MaskIcon src={item.id === "ventas" ? shopIcon : item.icon} className="mc-mobile-nav__icon" />
        <span>{item.label}</span>
      </Link>
    );
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const details = moreRef.current;
      if (!details?.open) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    }

    function closeOnOutside(event: PointerEvent) {
      const details = moreRef.current;
      if (!details?.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      details.open = false;
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, []);

  return (
    <nav className="mc-mobile-nav" aria-label="Principal">
      {destinations.slice(0, 2).map(destination)}
      {action ? (
        <Link
          href={action.href}
          aria-label={action.ariaLabel ?? action.label}
          className="mc-mobile-nav__item mc-mobile-nav__sale"
          onClick={() => {
            const hash = action.href.split("#")[1];
            if (!hash) return;
            const target = document.getElementById(hash);
            if (target) window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
          }}
        >
          <span className="mc-mobile-nav__sale-circle">
            {action.glyph === "qr" ? <QrCode aria-hidden="true" /> : <Plus aria-hidden="true" />}
          </span>
          <span className="sr-only">{action.label}</span>
        </Link>
      ) : null}
      {destinations.slice(2).map(destination)}
      <details className="mc-mobile-nav__more" ref={moreRef}>
        <summary className="mc-mobile-nav__item" aria-current={more.some((item) => isNavItemActive(item, activeHref)) ? "page" : undefined}>
          <MaskIcon src={reportIcon} className="mc-mobile-nav__icon" />
          <span>Más</span>
        </summary>
        <div className="mc-mobile-nav__panel">
          {more.map((item) => {
            const active = isNavItemActive(item, activeHref);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.ariaLabel}
                className="mc-mobile-nav__link"
                onClick={() => { if (moreRef.current) moreRef.current.open = false; }}
              >
                <MaskIcon src={item.icon} className="mc-mobile-nav__link-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </details>
    </nav>
  );
}
