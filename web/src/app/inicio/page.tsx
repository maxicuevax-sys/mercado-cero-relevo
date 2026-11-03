import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Coins,
  Home,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  Plus,
  ReceiptText,
  Settings,
  ShoppingBag,
  Sparkles,
  Sun,
  Target,
  Truck,
  Wallet,
} from "lucide-react";
import { getDashboardData } from "@/lib/dashboard";
import { isDemoMode } from "@/lib/config";
import { listGoals } from "@/lib/goals";
import { listTasks } from "@/lib/tasks";
import { formatActivityDate, formatLongDate, formatMxn } from "@/lib/format";
import tiendaArt from "@/assets/brand/iconos/transparent/tienda.png";
import heroArt from "@/assets/inicio/hero-registradora.png";
import lupitaArt from "@/assets/inicio/sugerencia-lupita.png";
import picadoArt from "@/assets/inicio/papel-picado.png";
import plantsArt from "@/assets/inicio/sidebar-plantas.png";
import "./inicio.css";

export const metadata: Metadata = {
  title: "Inicio · Mercado Cero",
};

export const instant = false;

const nav = [
  { href: "/inicio", label: "Inicio", icon: Home, active: true },
  { href: "/", label: "Ventas", icon: ShoppingBag },
  { href: "/?tab=fiado", label: "Fiados", icon: NotebookPen },
  { href: "/", label: "Productos", icon: LayoutGrid, soon: true },
  { href: "/", label: "Proveedores", icon: Truck, soon: true },
  { href: "/", label: "Caja", icon: Wallet },
  { href: "/?tab=corte", label: "Reportes", icon: ReceiptText },
];

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
      }))
    : demo
      ? [
          { id: "fixture-1", title: "Recibir pedido", meta: "11:00 a.m." },
          { id: "fixture-2", title: "Cobrar a Juan", meta: "$50.00", done: true },
          { id: "fixture-3", title: "Revisar inventario", meta: "" },
        ]
      : [];
  const taskFixture = !tasks.length && demo;

  return (
    <div className="inicio-shell">
      <aside className="inicio-sidebar" aria-label="Navegación principal">
        <div className="inicio-brand">
          <div className="inicio-brand__mark">
            <Image src={tiendaArt} alt="" aria-hidden="true" sizes="48px" />
          </div>
          <p className="inicio-brand__name">
            Mercado
            <br />
            Cero <Sparkles className="inicio-brand__spark" aria-hidden="true" />
          </p>
        </div>

        <nav className="inicio-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            if (item.soon) {
              return (
                <span key={item.label} className="inicio-nav__soon" aria-disabled="true" title="Próximamente">
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              );
            }
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className="inicio-nav__item"
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="inicio-sidebar__foot">
          <Link className="inicio-nav__item" href="/?ayuda=1">
            <CircleHelp aria-hidden="true" />
            <span>Ayuda</span>
          </Link>
          <Link className="inicio-nav__item" href="/?ayuda=1">
            <Settings aria-hidden="true" />
            <span>Ajustes</span>
          </Link>
          <Image src={plantsArt} alt="" aria-hidden="true" className="inicio-sidebar__art" sizes="236px" />
        </div>
      </aside>

      <div className="inicio-main">
        <header className="inicio-topbar">
          <div className="inicio-topbar__merchant">
            <div className="inicio-topbar__icon">
              <Image src={tiendaArt} alt="" aria-hidden="true" sizes="28px" />
            </div>
            <div>
              <p className="inicio-topbar__name">
                {dashboard.merchant.name} <ChevronDown className="inicio-topbar__chevron" aria-hidden="true" />
              </p>
              <p className="inicio-topbar__address">{dashboard.merchant.address}</p>
            </div>
          </div>
          <div className="inicio-topbar__actions">
            {demo ? <span className="inicio-demo">DEMO</span> : null}
            <span className="inicio-bell" aria-hidden="true">
              <Bell />
            </span>
            <span className="inicio-avatar" aria-hidden="true">
              {initial}
            </span>
          </div>
        </header>

        <main className="inicio-content">
          <Image src={picadoArt} alt="" aria-hidden="true" className="inicio-picado" sizes="488px" />

          <section className="inicio-greeting" aria-labelledby="inicio-title">
            <Sun className="inicio-sun" aria-hidden="true" />
            <div>
              <h1 id="inicio-title">¡Buen día, {owner}!</h1>
              <p>
                {formatLongDate()}. <span className="inicio-greeting__demo">{demo ? "Datos demo" : "Datos reales"}</span>
              </p>
            </div>
          </section>

          <section className="inicio-kpis" aria-label="Resumen del negocio">
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon"><ShoppingBag aria-hidden="true" /></span>
                <span>Ventas hoy</span>
              </div>
              <p className="inicio-kpi__value">{formatMxn(summary.salesCents)}</p>
              <p className="inicio-kpi__note">Registradas, no necesariamente cobradas</p>
            </article>
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon"><Coins aria-hidden="true" /></span>
                <span>Cobrado hoy</span>
              </div>
              <p className="inicio-kpi__value">{formatMxn(confirmed)}</p>
              <p className="inicio-kpi__note">Efectivo + pagos verificados</p>
            </article>
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon"><ListChecks aria-hidden="true" /></span>
                <span>Por cobrar</span>
              </div>
              <p className="inicio-kpi__value">{formatMxn(dashboard.pendingCentsTotal)}</p>
              <p className="inicio-kpi__note">Saldo pendiente, sin sumarlo a la caja</p>
            </article>
            <article className="inicio-kpi">
              <div className="inicio-kpi__top">
                <span className="inicio-kpi__icon"><Target aria-hidden="true" /></span>
                <span>Meta del mes</span>
              </div>
              <p className="inicio-kpi__value">{goal ? `${goal.progressPct}%` : "—"}</p>
              <div className="inicio-goal" aria-hidden="true">
                <span style={{ width: `${goal ? Math.min(100, Math.max(0, goal.progressPct)) : 0}%` }} />
              </div>
              <p className="inicio-kpi__note">
                {goal ? goal.title : "Aún no hay una meta"}
              </p>
            </article>
          </section>

          <section className="inicio-row" aria-label="Acciones y pendientes">
            <article className="inicio-hero">
              <Image src={heroArt} alt="" aria-hidden="true" className="inicio-hero__art" sizes="280px" />
              <div className="inicio-hero__content">
                <h2>Nueva venta</h2>
                <p>Registra lo que vendiste y decide cómo cobrar.</p>
                <Link href="/" className="inicio-hero__cta">
                  <Plus aria-hidden="true" /> Registrar
                </Link>
              </div>
            </article>

            <article className="inicio-pending" aria-labelledby="inicio-pending-title">
              <div className="inicio-pending__head">
                <h2 id="inicio-pending-title">Pendientes</h2>
                <Link href="/?tab=pendientes">Ver todos</Link>
              </div>
              {homeTasks.length ? (
                <ul className="inicio-pending__list">
                  {homeTasks.map((task) => (
                    <li key={task.id} className="inicio-task">
                      <span className={`inicio-task__check${task.done ? " inicio-task__check--done" : ""}`} aria-hidden="true" />
                      <span className="inicio-task__title">{task.title}</span>
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
                <p className="inicio-pending__fixture">Ejemplos demo; no son tareas reales.</p>
              ) : null}
            </article>
          </section>

          <section className="inicio-suggestion" aria-labelledby="inicio-suggestion-title">
            <Image src={lupitaArt} alt="" aria-hidden="true" className="inicio-suggestion__art" sizes="340px" />
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



