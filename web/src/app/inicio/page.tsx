import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronDown, Plus } from "lucide-react";
import { getDashboardData } from "@/lib/dashboard";
import { isDemoMode } from "@/lib/config";
import { listGoals } from "@/lib/goals";
import { listTasks } from "@/lib/tasks";
import { formatActivityDate, formatLongDate, formatMxn } from "@/lib/format";
import brandShop from "@/assets/inicio/brand-shop-cream.svg";
import heroArt from "@/assets/inicio/hero-registradora.png";
import lupitaArt from "@/assets/inicio/sugerencia-lupita.png";
import picadoArt from "@/assets/inicio/papel-picado.png";
import plantsArt from "@/assets/inicio/sidebar-plantas.png";
import logoInk from "@/assets/inicio/logo-simbolo.svg";
import sunArt from "@/assets/inicio/icons/sol-bienvenida.svg";
import iconInicio from "@/assets/inicio/icons/inicio.svg";
import iconVentas from "@/assets/inicio/icons/ventas.svg";
import iconFiado from "@/assets/inicio/icons/fiado.svg";
import iconInventario from "@/assets/inicio/icons/inventario.svg";
import iconProveedores from "@/assets/inicio/icons/proveedores.svg";
import iconCaja from "@/assets/inicio/icons/caja.svg";
import iconReportes from "@/assets/inicio/icons/reportes.svg";
import iconAyuda from "@/assets/inicio/icons/ayuda.svg";
import iconAjustes from "@/assets/inicio/icons/ajustes.svg";
import iconCompras from "@/assets/inicio/icons/compras.svg";
import iconMonedas from "@/assets/inicio/icons/monedas.svg";
import iconPendientes from "@/assets/inicio/icons/pendientes.svg";
import iconMetas from "@/assets/inicio/icons/metas.svg";
import iconCampana from "@/assets/inicio/icons/campana.svg";
import "./inicio.css";

export const metadata: Metadata = {
  title: "Inicio · Mercado Cero",
};

export const instant = false;

type NavItem = {
  href: string;
  label: string;
  icon: StaticImageData;
  active?: boolean;
  soon?: boolean;
  ariaLabel?: string;
};

const nav: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: iconInicio, active: true },
  { href: "/?tab=caja", label: "Ventas", icon: iconVentas },
  { href: "/?tab=fiado", label: "Fiados", icon: iconFiado },
  { href: "/", label: "Productos", icon: iconInventario, soon: true },
  { href: "/", label: "Proveedores", icon: iconProveedores, soon: true },
  {
    href: "/?tab=corte",
    label: "Caja",
    icon: iconCaja,
    ariaLabel: "Caja y corte",
  },
  {
    href: "/?tab=corte",
    label: "Reportes",
    icon: iconReportes,
    ariaLabel: "Reportes del día, dentro de Corte",
  },
];

function MaskIcon({
  src,
  className = "",
}: {
  src: StaticImageData;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inicio-icon ${className}`.trim()}
      style={{ "--inicio-icon": `url("${src.src}")` } as CSSProperties}
    />
  );
}

export default async function InicioPage() {
  await connection();
  const dashboard = getDashboardData({ compactPending: true });
  const goal = listGoals()[0] ?? null;
  const tasks = listTasks(8)
    .filter((task) => task.status === "open")
    .slice(0, 3);
  const summary = dashboard.summary;
  const owner = dashboard.merchant.owner || "comerciante";
  const confirmed = summary.cashCents + summary.verifiedDigitalCents;
  const initial = owner.trim().charAt(0).toUpperCase() || "M";
  const demo = dashboard.demoMode ?? isDemoMode();
  const homeTasks = tasks.length
    ? tasks.map((task) => ({
        id: task.id,
        title: task.title,
        meta: formatActivityDate(task.dueAt ?? task.postponedUntil ?? task.createdAt),
        done: false,
        fixture: false,
      }))
    : demo
      ? [
          { id: "fixture-1", title: "Recibir pedido", meta: "11:00 a.m.", done: false, fixture: true },
          { id: "fixture-2", title: "Cobrar a Juan", meta: "$50.00", done: true, fixture: true },
          { id: "fixture-3", title: "Revisar inventario", meta: "", done: false, fixture: true },
        ]
      : [];
  const taskFixture = !tasks.length && demo;

  return (
    <div className="inicio-shell">
      <a className="inicio-skip" href="#inicio-main">
        Saltar al contenido
      </a>

      <aside className="inicio-sidebar" aria-label="Navegación principal">
        <Link className="inicio-brand" href="/inicio" aria-label="Mercado Cero, ir a Inicio">
          <Image
            src={brandShop}
            alt=""
            aria-hidden="true"
            className="inicio-brand__mark"
            sizes="76px"
          />
          <span className="inicio-brand__wordmark">
            <span className="inicio-brand__name">
              Mercado{" "}
              <br />
              Cero
            </span>
            <svg
              className="inicio-brand__rays"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 5.5l8 4M2 13h9M6 21l5.5-6" />
            </svg>
          </span>
        </Link>

        <nav className="inicio-nav" aria-label="Secciones">
          {nav.map((item) => {
            if (item.soon) {
              return (
                <span
                  key={item.label}
                  className="inicio-nav__soon"
                  aria-disabled="true"
                  title="Próximamente"
                >
                  <MaskIcon src={item.icon} className="inicio-nav__icon" />
                  <span>{item.label}</span>
                </span>
              );
            }
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.ariaLabel}
                className="inicio-nav__item"
              >
                <MaskIcon src={item.icon} className="inicio-nav__icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="inicio-sidebar__foot">
          <Link className="inicio-nav__item" href="/?ayuda=1">
            <MaskIcon src={iconAyuda} className="inicio-nav__icon" />
            <span>Ayuda</span>
          </Link>
          <Link className="inicio-nav__item" href="/?ayuda=1#ajustes">
            <MaskIcon src={iconAjustes} className="inicio-nav__icon" />
            <span>Ajustes</span>
          </Link>
          <Image
            src={plantsArt}
            alt=""
            aria-hidden="true"
            className="inicio-sidebar__art"
            sizes="236px"
          />
        </div>
      </aside>

      <div className="inicio-main">
        <header className="inicio-topbar">
          <div className="inicio-topbar__merchant">
            <span className="inicio-topbar__icon">
              <Image src={logoInk} alt="" aria-hidden="true" sizes="40px" />
            </span>
            <div className="inicio-topbar__copy">
              <p className="inicio-topbar__name">
                {dashboard.merchant.name}{" "}
                <ChevronDown className="inicio-topbar__chevron" aria-hidden="true" />
              </p>
              <p className="inicio-topbar__address">{dashboard.merchant.address}</p>
            </div>
          </div>
          <div className="inicio-topbar__actions">
            {demo ? <span className="inicio-demo">DEMO</span> : null}
            <span className="inicio-bell" aria-hidden="true">
              <MaskIcon src={iconCampana} className="inicio-bell__icon" />
            </span>
            <span className="inicio-avatar" aria-hidden="true">
              {initial}
            </span>
          </div>
        </header>

        <main id="inicio-main" tabIndex={-1} className="inicio-content">
          <Image
            src={picadoArt}
            alt=""
            aria-hidden="true"
            className="inicio-picado"
            sizes="463px"
          />

          <section className="inicio-greeting" aria-labelledby="inicio-title">
            <Image
              src={sunArt}
              alt=""
              aria-hidden="true"
              className="inicio-sun"
              sizes="62px"
            />
            <div>
              <h1 id="inicio-title">¡Buen día, {owner}!</h1>
              <p>
                {formatLongDate()}.{" "}
                <span className="inicio-greeting__demo">
                  {demo ? "Datos demo" : "Datos reales"}
                </span>
              </p>
            </div>
          </section>

          <section className="inicio-kpis" aria-label="Resumen del negocio">
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon">
                  <MaskIcon src={iconCompras} className="inicio-kpi__glyph" />
                </span>
                <span>Ventas hoy</span>
              </div>
              <p className="inicio-kpi__value">{formatMxn(summary.salesCents)}</p>
              <p className="inicio-kpi__note">Registradas, no necesariamente cobradas</p>
            </article>
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon">
                  <MaskIcon src={iconMonedas} className="inicio-kpi__glyph" />
                </span>
                <span>Cobrado hoy</span>
              </div>
              <p className="inicio-kpi__value">{formatMxn(confirmed)}</p>
              <p className="inicio-kpi__note">Efectivo + pagos verificados</p>
            </article>
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon">
                  <MaskIcon src={iconPendientes} className="inicio-kpi__glyph" />
                </span>
                <span>Por cobrar</span>
              </div>
              <p className="inicio-kpi__value">{formatMxn(dashboard.pendingCentsTotal)}</p>
              <p className="inicio-kpi__note">Saldo pendiente, sin sumarlo a la caja</p>
            </article>
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon">
                  <MaskIcon src={iconMetas} className="inicio-kpi__glyph" />
                </span>
                <span>Meta del mes</span>
              </div>
              <p className="inicio-kpi__value">{goal ? `${goal.progressPct}%` : "—"}</p>
              <div className="inicio-goal" aria-hidden="true">
                <span style={{ width: `${goal ? Math.min(100, Math.max(0, goal.progressPct)) : 0}%` }} />
              </div>
              <p className="inicio-kpi__note">{goal ? goal.title : "Aún no hay una meta"}</p>
            </article>
          </section>

          <section className="inicio-hero" aria-labelledby="inicio-hero-title">
            <Image
              src={heroArt}
              alt=""
              aria-hidden="true"
              className="inicio-hero__art"
              sizes="269px"
            />
            <div className="inicio-hero__content">
              <h2 id="inicio-hero-title">Nueva venta</h2>
              <p>Registra lo que vendiste y decide cómo cobrar.</p>
              <Link href="/" className="inicio-hero__cta">
                <Plus aria-hidden="true" /> Registrar
              </Link>
            </div>
          </section>

          <section className="inicio-pending" aria-labelledby="inicio-pending-title">
            <div className="inicio-pending__head">
              <div className="inicio-pending__title">
                <MaskIcon src={iconPendientes} className="inicio-pending__icon" />
                <h2 id="inicio-pending-title">Pendientes</h2>
              </div>
              <Link href="/?tab=pendientes">Ver todos</Link>
            </div>
            {homeTasks.length ? (
              <ul className="inicio-pending__list">
                {homeTasks.map((task) => (
                  <li key={task.id} className="inicio-task">
                    <span
                      className={`inicio-task__check${task.done ? " inicio-task__check--done" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="inicio-task__title">{task.title}</span>
                    {task.fixture ? <span className="inicio-task__badge">Ejemplo</span> : null}
                    <span className="inicio-task__time">{task.meta}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="inicio-pending__empty">
                No hay pendientes abiertos. Anota uno desde la pestaña Tareas.
              </p>
            )}
            {taskFixture ? (
              <p className="inicio-pending__fixture">
                Ejemplos demo; no son tareas reales. Se administran en Tareas.
              </p>
            ) : null}
          </section>

          <section className="inicio-suggestion" aria-labelledby="inicio-suggestion-title">
            <Image
              src={lupitaArt}
              alt=""
              aria-hidden="true"
              className="inicio-suggestion__art"
              sizes="330px"
            />
            <div className="inicio-suggestion__content">
              <p className="inicio-suggestion__kicker">Sugerencia</p>
              <h2 id="inicio-suggestion-title">Tu negocio, en orden.</h2>
              <p>Registra una venta o revisa tus pendientes antes de cerrar el día.</p>
            </div>
            <Link href="/" className="inicio-suggestion__cta">
              Ir a ventas <Plus aria-hidden="true" />
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
