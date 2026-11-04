"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { MaskIcon } from "@/components/ui/icon";
import type { ShellNavItem } from "./nav";
import "./shell.css";

export function MobileNav({
  primary,
  more,
  activeHref,
}: {
  primary: ShellNavItem[];
  more: ShellNavItem[];
  activeHref: string;
}) {
  const moreRef = useRef<HTMLDetailsElement>(null);

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
      {primary.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.legacy ? undefined : item.ariaLabel}
            className="mc-mobile-nav__item"
          >
            <MaskIcon src={item.icon} className="mc-mobile-nav__icon" />
            <span>{item.label}</span>
            {item.legacy ? (
              <>
                <span className="mc-mobile-nav__legacy">Clásica</span>
                <span className="sr-only">
                  {item.ariaLabel ? `${item.ariaLabel}, ` : ""}abre la Caja clásica.
                </span>
              </>
            ) : null}
          </Link>
        );
      })}
      <details className="mc-mobile-nav__more" ref={moreRef}>
        <summary className="mc-mobile-nav__item">
          <MoreHorizontal className="mc-mobile-nav__icon" aria-hidden="true" />
          <span>Más</span>
        </summary>
        <div className="mc-mobile-nav__panel">
          {more.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.legacy ? undefined : item.ariaLabel}
                className="mc-mobile-nav__link"
              >
                <MaskIcon src={item.icon} className="mc-mobile-nav__link-icon" />
                <span>{item.label}</span>
                {item.legacy ? (
                  <>
                    <span className="mc-mobile-nav__legacy">Clásica</span>
                    <span className="sr-only">
                      {item.ariaLabel ? `${item.ariaLabel}, ` : ""}abre la Caja clásica.
                    </span>
                  </>
                ) : null}
              </Link>
            );
          })}
        </div>
      </details>
    </nav>
  );
}

