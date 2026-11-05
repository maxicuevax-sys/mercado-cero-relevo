import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { MaskIcon } from "@/components/ui/icon";
import { CreateGoalButton } from "@/components/metas/create-goal";
import { ContributeGoalButton } from "@/components/metas/contribute-goal";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatMxn } from "@/lib/format";
import { listGoals } from "@/lib/goals";
import { MEXICO_TZ } from "@/lib/mexico-date";
import type { Goal } from "@/lib/types";
import ahorroArt from "@/assets/brand/ilustraciones/transparent/ahorro.png";
import metaIcon from "@/assets/brand/iconos/transparent/meta.png";
import picadoArt from "@/assets/inicio/papel-picado.png";
import iconMetas from "@/assets/inicio/icons/metas.svg";
import iconMonedas from "@/assets/inicio/icons/monedas.svg";
import "./metas.css";

export const metadata: Metadata = {
  title: "Metas · Mercado Cero",
};

export const instant = false;

const deadlineFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: MEXICO_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

function deadlineLabel(goal: Goal): string {
  if (!goal.deadline) return "Sin fecha límite";
  const date = new Date(goal.deadline);
  if (Number.isNaN(date.getTime())) return "Sin fecha límite";
  return `Vence el ${deadlineFormatter.format(date).replace(/\.$/, "")}`;
}

type GoalStatusTone = "active" | "done" | "late";

function statusOf(goal: Goal): { label: string; tone: GoalStatusTone } {
  if (goal.remainingCents <= 0) {
    return { label: "Lograda", tone: "done" };
  }
  if (goal.deadline) {
    const deadline = Date.parse(goal.deadline);
    if (Number.isFinite(deadline) && deadline < Date.now()) {
      return { label: "Fecha vencida", tone: "late" };
    }
  }
  return { label: "En curso", tone: "active" };
}

/**
 * Texto de apoyo del pie de cada meta. `weeklyNeededCents` es `null` cuando
 * falta menos de una semana o no hay fecha: se distinguen ambos casos para no
 * decir "sin fecha límite" a una meta que vence esta semana.
 */
function goalHint(goal: Goal): string {
  if (goal.remainingCents <= 0) {
    return "Queda como referencia de lo que lograste.";
  }
  if (goal.weeklyNeededCents !== null) {
    return `Aparta ${formatMxn(goal.weeklyNeededCents)} por semana para llegar a tiempo.`;
  }
  if (goal.deadline) {
    return "La fecha límite está encima: aparta lo que puedas.";
  }
  return "Sin fecha límite: aparta a tu ritmo.";
}

export default async function MetasPage() {
  await connection();
  const goals = listGoals();
  const demo = isDemoMode();
  const savedTotal = goals.reduce((sum, goal) => sum + goal.savedCents, 0);
  const remainingTotal = goals.reduce((sum, goal) => sum + goal.remainingCents, 0);
  const activeCount = goals.filter((goal) => goal.remainingCents > 0).length;

  // Tarjeta protagonista: la primera meta activa; si todas están logradas, la
  // primera. Las demás pasan a la lista breve "Otras metas".
  const protagonist =
    goals.find((goal) => goal.remainingCents > 0) ?? goals[0] ?? null;
  const otherGoals = protagonist
    ? goals.filter((goal) => goal.id !== protagonist.id)
    : [];

  return (
    <OperationalPage
      activeHref="/metas"
      title="Metas"
      titleId="metas-title"
      eyebrow="AHORRO"
      subtitle="Organiza lo que quieres comprar o apartar para una emergencia. Se anota aquí; no es una cuenta bancaria."
      actions={
        goals.length > 0 ? (
          <CreateGoalButton label="Nueva meta" variant="secondary" />
        ) : undefined
      }
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      contentClassName="mc-metas-main"
    >
      <section
        className="mc-metas-hero"
        aria-labelledby="mc-metas-hero-title"
      >
        <Image
          src={picadoArt}
          alt=""
          aria-hidden="true"
          className="mc-metas-hero__picado"
          sizes="(max-width: 767px) 170px, 230px"
        />
        <div className="mc-metas-hero__art">
          <Image
            src={ahorroArt}
            alt=""
            aria-hidden="true"
            width={433}
            height={439}
            className="mc-metas-hero__art-img"
            sizes="(max-width: 767px) 170px, 250px"
          />
        </div>

        {protagonist ? (
          <div className="mc-metas-hero__copy">
            <p className="mc-metas-hero__kicker">Apartado en tu registro</p>
            <h2 id="mc-metas-hero-title" className="mc-metas-hero__title">
              {protagonist.title}
            </h2>
            <p className="mc-metas-hero__objective">
              <span className="mc-metas-objective">
                <Image
                  src={metaIcon}
                  alt=""
                  aria-hidden="true"
                  width={17}
                  height={18}
                  className="mc-metas-objective__icon"
                />
                Objetivo{" "}
                <CurrencyAmount
                  cents={protagonist.targetCents}
                  className="mc-metas-hero__objective-amount"
                />
              </span>
              <span className="mc-metas-hero__deadline">
                {deadlineLabel(protagonist)}
              </span>
            </p>
            <div className="mc-metas-hero__progress">
              <div className="mc-metas-hero__progress-head">
                <p className="mc-metas-hero__pct">
                  <span>{protagonist.progressPct}</span>%
                </p>
                <p className="mc-metas-hero__progress-label">apartado</p>
              </div>
              <ProgressIndicator
                value={protagonist.progressPct}
                label={`Progreso de ${protagonist.title}`}
                className="mc-metas-hero__bar"
                barClassName="mc-metas-hero__bar-fill"
              />
              <p className="mc-metas-hero__amounts">
                <CurrencyAmount
                  cents={protagonist.savedCents}
                  className="mc-metas-hero__saved"
                />{" "}
                de{" "}
                <CurrencyAmount cents={protagonist.targetCents} /> · falta{" "}
                {formatMxn(protagonist.remainingCents)}
              </p>
            </div>
            <div className="mc-metas-hero__actions">
              {protagonist.remainingCents > 0 ? (
                <ContributeGoalButton
                  goal={{
                    id: protagonist.id,
                    title: protagonist.title,
                    remainingCents: protagonist.remainingCents,
                  }}
                />
              ) : (
                <p className="mc-metas-hero__done">
                  Meta alcanzada. ¡Bien hecho!
                </p>
              )}
              <p className="mc-metas-hero__note">
                El efectivo sigue en tu caja: aquí solo anotas cuánto llevas
                apartado.
              </p>
            </div>
          </div>
        ) : (
          <div className="mc-metas-hero__copy">
            <p className="mc-metas-hero__kicker">Apartado en tu registro</p>
            <h2 id="mc-metas-hero-title" className="mc-metas-hero__title">
              Tu primera meta
            </h2>
            <p className="mc-metas-hero__intro">
              Elige algo concreto para tu puesto y apunta cuánto llevas
              apartado. Puedes empezar con 50 pesos.
            </p>
            <div className="mc-metas-hero__actions">
              <CreateGoalButton label="Crear mi primera meta" />
              <p className="mc-metas-hero__note">
                No es una cuenta bancaria: el dinero se queda en tu caja.
              </p>
            </div>
          </div>
        )}
      </section>

      {goals.length > 0 ? (
        <section className="mc-metas-summary" aria-label="Resumen de metas">
          <article className="mc-metas-summary__item">
            <span className="mc-metas-medallion mc-metas-medallion--saffron">
              <MaskIcon src={iconMonedas} className="mc-metas-medallion__glyph" />
            </span>
            <div className="mc-metas-summary__copy">
              <p className="mc-metas-summary__label">Ahorrado</p>
              <CurrencyAmount
                as="p"
                cents={savedTotal}
                className="mc-metas-summary__value"
              />
            </div>
          </article>
          <article className="mc-metas-summary__item">
            <span className="mc-metas-medallion mc-metas-medallion--green">
              <MaskIcon src={iconMetas} className="mc-metas-medallion__glyph" />
            </span>
            <div className="mc-metas-summary__copy">
              <p className="mc-metas-summary__label">Metas activas</p>
              <p className="mc-metas-summary__value">{activeCount}</p>
            </div>
          </article>
          <article className="mc-metas-summary__item">
            <span className="mc-metas-medallion mc-metas-medallion--clay">
              <Image
                src={metaIcon}
                alt=""
                aria-hidden="true"
                width={22}
                height={23}
                className="mc-metas-medallion__art"
              />
            </span>
            <div className="mc-metas-summary__copy">
              <p className="mc-metas-summary__label">Falta para tus metas</p>
              <CurrencyAmount
                as="p"
                cents={remainingTotal}
                className="mc-metas-summary__value"
              />
            </div>
          </article>
        </section>
      ) : null}

      {otherGoals.length > 0 ? (
        <section className="mc-metas-others" aria-labelledby="mc-metas-others-title">
          <h2 id="mc-metas-others-title" className="mc-metas-section-label">
            Otras metas
          </h2>
          <div className="mc-metas-others__card">
            <ul className="mc-metas-others__list">
              {otherGoals.map((goal) => {
                const status = statusOf(goal);
                return (
                  <li key={goal.id} className="mc-metas-other">
                    <span className="mc-metas-medallion mc-metas-medallion--clay mc-metas-medallion--sm">
                      <Image
                        src={metaIcon}
                        alt=""
                        aria-hidden="true"
                        width={18}
                        height={19}
                        className="mc-metas-medallion__art"
                      />
                    </span>
                    <div className="mc-metas-other__main">
                      <div className="mc-metas-other__title-row">
                        <h3 className="mc-metas-other__title">{goal.title}</h3>
                        <span
                          className={`mc-metas-sello mc-metas-sello--${status.tone}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mc-metas-other__meta">
                        {formatMxn(goal.savedCents)} de{" "}
                        {formatMxn(goal.targetCents)} · {deadlineLabel(goal)}
                      </p>
                      <ProgressIndicator
                        value={goal.progressPct}
                        label={`Progreso de ${goal.title}`}
                        className="mc-metas-other__bar"
                        barClassName="mc-metas-other__bar-fill"
                      />
                    </div>
                    <div className="mc-metas-other__side">
                      <p className="mc-metas-other__pct">{goal.progressPct}%</p>
                      {goal.remainingCents > 0 ? (
                        <ContributeGoalButton
                          goal={{
                            id: goal.id,
                            title: goal.title,
                            remainingCents: goal.remainingCents,
                          }}
                          variant="secondary"
                        />
                      ) : null}
                      <p className="mc-metas-other__hint">{goalHint(goal)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <p className="mc-metas-note">
        El apartado es un registro declarado: no es una cuenta bancaria, no
        genera intereses y el efectivo sigue en tu caja. El historial de
        movimientos no se muestra en esta pantalla.
      </p>
    </OperationalPage>
  );
}
