import Image from "next/image";
import Link from "next/link";
import plantsArt from "@/assets/inicio/sidebar-plantas.png";
import { MaskIcon } from "@/components/ui/icon";
import { BrandLockup } from "./brand-lockup";
import type { ShellNavItem } from "./nav";

export function Sidebar({
  items,
  foot,
  activeHref,
  className = "",
}: {
  items: ShellNavItem[];
  foot: ShellNavItem[];
  activeHref: string;
  className?: string;
}) {
  return (
    <aside className={`inicio-sidebar ${className}`.trim()}>
      <BrandLockup />
      <nav className="inicio-nav" aria-label="Principal">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={navAriaLabel(item)}
              className="inicio-nav__item"
            >
              <MaskIcon src={item.icon} className="inicio-nav__icon" />
              <span>{item.label}</span>
              {item.legacy ? <span className="inicio-nav__legacy">Clásica</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="inicio-sidebar__foot">
        {foot.map((item) => (
          <Link
            key={item.id}
            className="inicio-nav__item"
            href={item.href}
            aria-label={navAriaLabel(item)}
          >
            <MaskIcon src={item.icon} className="inicio-nav__icon" />
            <span>{item.label}</span>
            {item.legacy ? <span className="inicio-nav__legacy">Clásica</span> : null}
          </Link>
        ))}
        <Image
          src={plantsArt}
          alt=""
          aria-hidden="true"
          className="inicio-sidebar__art"
          sizes="236px"
        />
      </div>
    </aside>
  );
}

function navAriaLabel(item: ShellNavItem): string | undefined {
  const base = item.ariaLabel ?? item.label;
  return item.legacy ? `${base} (abre la Caja clásica)` : item.ariaLabel;
}
