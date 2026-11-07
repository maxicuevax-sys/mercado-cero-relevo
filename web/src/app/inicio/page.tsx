import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Plus, QrCode, Sparkles, Mic, Package, Coins, ChartNoAxesColumnIncreasing } from "lucide-react";
import { getDashboardData } from "@/lib/dashboard";
import { isDemoMode } from "@/lib/config";
import { listGoals } from "@/lib/goals";
import { listTasks } from "@/lib/tasks";
import { formatActivityDate, formatLongDate } from "@/lib/format";
import heroArt from "@/assets/inicio/hero-registradora.png";
import lupitaArt from "@/assets/inicio/sugerencia-lupita.png";
import picadoArt from "@/assets/inicio/papel-picado.png";
import sunArt from "@/assets/inicio/icons/sol-bienvenida.svg";
import iconCompras from "@/assets/inicio/icons/compras.svg";
import iconMonedas from "@/assets/inicio/icons/monedas.svg";
import iconPendientes from "@/assets/inicio/icons/pendientes.svg";
import iconMetas from "@/assets/inicio/icons/metas.svg";
import botArt from "@/assets/brand/ilustraciones/transparent/bot.png";
import microphoneArt from "@/assets/brand/iconos/transparent/microfono.png";
import pendingPhoneArt from "@/assets/brand/iconos/transparent/qr-telefono.png";
import { AppShell } from "@/components/shell/app-shell";
import { TopBar } from "@/components/shell/top-bar";
import { MaskIcon } from "@/components/ui/icon";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import "./inicio.css";
import welcomeNative from "@/assets/definitive-a/welcome.png";
import registerNative from "@/assets/definitive-a/register.png";

export const metadata: Metadata = {
  title: "Inicio · Mercado Cero",
};

export const instant = false;

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
    <AppShell
      activeHref="/inicio"
      mainId="inicio-main"
      className="inicio-shell--compact"
      topbar={
        <TopBar
          merchant={dashboard.merchant.name}
          address={dashboard.merchant.address}
          initial={initial}
          demo={demo}
        />
      }
    >
      <section className="inicio-greeting" aria-labelledby="inicio-title">
        <Image
          src={sunArt}
          alt=""
          aria-hidden="true"
          className="inicio-sun"
          sizes="62px"
        />
        <div>
          <h1 id="inicio-title">¡Buen día<span className="inicio-greeting__owner">, {owner}</span>!</h1>
          <p>
            <span className="inicio-date-copy">{formatLongDate()}. </span><span className="inicio-native-subtitle">Así va tu negocio hoy.</span>{" "}
            <span className="inicio-greeting__demo">
              {demo ? "Datos demo" : "Datos reales"}
            </span>
          </p>
        </div>
        <Image
          src={picadoArt}
          alt=""
          aria-hidden="true"
          className="inicio-picado"
          sizes="250px"
        />
        <Image src={welcomeNative} alt="" aria-hidden="true" className="inicio-definitive-welcome-art" sizes="(max-width: 760px) 180px, 400px" />
      </section>

      <section className="inicio-kpis" aria-label="Resumen del negocio">
        <article className="inicio-kpi">
          <div className="inicio-kpi__top">
            <span className="inicio-kpi__icon">
              <MaskIcon src={iconCompras} className="inicio-kpi__glyph" />
            </span>
            <span>Ventas hoy</span>
          </div>
          <CurrencyAmount as="p" cents={summary.salesCents} className="inicio-kpi__value" />
          <p className="inicio-kpi__note">Registradas, no necesariamente cobradas</p>
        </article>
        <article className="inicio-kpi">
          <div className="inicio-kpi__top">
            <span className="inicio-kpi__icon">
              <MaskIcon src={iconMonedas} className="inicio-kpi__glyph" />
            </span>
            <span>Cobrado hoy</span>
          </div>
          <CurrencyAmount as="p" cents={confirmed} className="inicio-kpi__value" />
          <p className="inicio-kpi__note">Efectivo + pagos verificados</p>
        </article>
        <article className="inicio-kpi">
          <div className="inicio-kpi__top">
            <span className="inicio-kpi__icon">
              <Image src={pendingPhoneArt} alt="" aria-hidden="true" className="inicio-kpi__glyph" sizes="36px" />
            </span>
            <span>Por cobrar</span>
          </div>
          <CurrencyAmount
            as="p"
            cents={dashboard.pendingCentsTotal}
            className="inicio-kpi__value"
          />
          <p className="inicio-kpi__note">Saldo pendiente, sin sumarlo a la caja</p>
        </article>
        <article className="inicio-kpi">
          <div className="inicio-kpi__top">
            <span className="inicio-kpi__icon">
              <MaskIcon src={iconMetas} className="inicio-kpi__glyph" />
            </span>
            <span><span className="inicio-desktop-only">Meta del mes</span><span className="inicio-phone-only">Meta</span></span>
          </div>
          <p className="inicio-kpi__value">{goal ? `${goal.progressPct}%` : "—"}</p>
          <ProgressIndicator
            value={goal?.progressPct ?? 0}
            label={`Progreso de ${goal?.title ?? "la meta"}`}
            className="inicio-goal"
          />
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
        <Image src={registerNative} alt="" aria-hidden="true" className="inicio-native-register" sizes="130px" />
        <div className="inicio-hero__content">
          <h2 id="inicio-hero-title">Nueva venta</h2>
          <p>Registra y cobra en segundos.</p>
          <div className="inicio-hero__actions">
          <Link href="/caja" className="inicio-hero__cta">
            <Plus aria-hidden="true" /><MaskIcon src={iconCompras} className="inicio-hero__mobile-icon" /><span className="inicio-hero__desktop-label">Registrar</span><span className="inicio-hero__mobile-label">Nueva venta</span>
          </Link>
          <Link href="/caja" className="inicio-hero__mic" aria-label="Dictar una nueva venta"><Mic aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <nav className="inicio-shortcuts" aria-label="Accesos rápidos">
        <Link href="/caja#mc-caja-payment-summary"><QrCode aria-hidden="true" /><span>Cobrar</span></Link>
        <button type="button" disabled aria-label="Producto: módulo aún no disponible"><Package aria-hidden="true" /><span>Producto</span></button>
        <button type="button" disabled aria-label="Gasto: módulo aún no disponible"><Coins aria-hidden="true" /><span>Gasto</span></button>
        <button type="button" disabled aria-label="Reporte: módulo aún no disponible"><ChartNoAxesColumnIncreasing aria-hidden="true" /><span>Reporte</span></button>
      </nav>

      <section className="inicio-pending" aria-labelledby="inicio-pending-title">
        <SectionHeader
          className="inicio-pending__head"
          title="Pendientes"
          titleId="inicio-pending-title"
          titleClassName="inicio-pending__title"
          icon={<MaskIcon src={iconPendientes} className="inicio-pending__icon" />}
          action={<Link href="/pendientes">Ver todos</Link>}
        />
        {homeTasks.length ? (
          <ul className="inicio-pending__list">
            {homeTasks.map((task) => (
              <li key={task.id} className="inicio-task">
                <span
                  className={`inicio-task__check${task.done ? " inicio-task__check--done" : ""}`}
                  aria-hidden="true"
                />
                {task.done ? <span className="sr-only">Hecho: </span> : null}
                <span className="inicio-task__title">{task.title}</span>
                {task.fixture ? <span className="inicio-task__badge">Ejemplo</span> : null}
                <span className={`inicio-task__time${task.fixture && task.done ? " inicio-task__time--balance" : ""}`}>{task.meta}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="inicio-pending__empty"
            title="No hay pendientes abiertos."
          >
            Anota uno desde la pestaña Tareas.
          </EmptyState>
        )}
        {taskFixture ? (
          <p className="inicio-pending__fixture">
            Ejemplos demo; no son tareas reales. Se administran en Tareas.
          </p>
        ) : null}
      </section>

      <section className="inicio-suggestion" aria-label="Sugerencia">
        <Image
          src={lupitaArt}
          alt=""
          aria-hidden="true"
          className="inicio-suggestion__art"
          sizes="330px"
        />
        <div className="inicio-suggestion__content">
          <div className="inicio-suggestion__mobile-copy">
            <p className="inicio-suggestion__kicker">Sugerencia</p>
            <h2>Tu negocio, en orden.</h2>
            <p>Registra una venta o revisa tus pendientes antes de cerrar el día.</p>
          </div>
          <div className="inicio-suggestion__desktop-copy">
            <h2><Sparkles aria-hidden="true" />Sugerencia</h2>
            <p>Agrega un producto nuevo.</p>
          </div>
        </div>
        <Link href="/ventas" className="inicio-suggestion__cta">
          Ir a ventas <Plus aria-hidden="true" />
        </Link>
      </section>

      <section className="inicio-assistant" aria-labelledby="inicio-assistant-title">
        <Image src={botArt} alt="" aria-hidden="true" width={72} height={72} sizes="72px" />
        <div><h2 id="inicio-assistant-title">Asistente <span>(opcional)</span></h2><p>Consulta la guía o dicta una venta cuando lo necesites.</p></div>
        <Link href="/ayuda">Ver ayuda</Link>
        <Link href="/caja"><Image src={microphoneArt} alt="" aria-hidden="true" width={24} height={24} />Dictar venta</Link>
      </section>
    </AppShell>
  );
}
