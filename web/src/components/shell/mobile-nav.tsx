"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, Coins } from "lucide-react";
import { MaskIcon } from "@/components/ui/icon";
import { isNavItemActive, type ShellNavItem } from "./nav";
import reportIcon from "@/assets/inicio/icons/reportes.svg";
import shopIcon from "@/assets/inicio/brand-shop-cream.svg";
import "./shell.css";

export function MobileNav({
  primary,
  more,
  activeHref,
  referenceA = false,
}: {
  primary: ShellNavItem[];
  more: ShellNavItem[];
  activeHref: string;
  referenceA?: boolean;
}) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  const sale = primary.find((item) => item.href === "/caja");
  const destinations = primary.filter((item) => item !== sale);

  function destination(item: ShellNavItem) {
    const active = isNavItemActive(item, activeHref);
    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={item.ariaLabel}
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
      {sale ? (
          <Link
            href={sale.href}
            aria-current={isNavItemActive(sale, activeHref) ? "page" : undefined}
            aria-label="Nueva venta"
            className="mc-mobile-nav__item mc-mobile-nav__sale"
          >
            <span className="mc-mobile-nav__sale-circle"><Plus aria-hidden="true" /></span>
            <span className="sr-only">Vender</span>
          </Link>
      ) : null}
      {referenceA ? <button type="button" className="mc-mobile-nav__item" disabled aria-label="Gastos: módulo aún no disponible"><Coins className="mc-mobile-nav__icon" aria-hidden="true" /><span>Gastos</span></button> : destinations.slice(2).map(destination)}
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
