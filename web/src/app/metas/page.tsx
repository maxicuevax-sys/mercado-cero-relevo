import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { CreateGoalButton } from "@/components/metas/create-goal";
import { ContributeGoalButton } from "@/components/metas/contribute-goal";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { listGoals } from "@/lib/goals";
import type { Goal } from "@/lib/types";
import ahorroArt from "@/assets/brand/ilustraciones/transparent/ahorro.png";
import metaIcon from "@/assets/brand/iconos/transparent/meta.png";
import picadoArt from "@/assets/inicio/papel-picado.png";
import "./metas.css";

export const metadata: Metadata = {
  title: "Metas · Mercado Cero",
};

export const instant = false;

type GoalStatusTone = "active" | "done" | "late";

function statusOf(goal: Goal): { label: string; tone: GoalStatusTone } {
  if (goal.remainingCents <= 0) {
    return { label: "Lograda", tone: "done" };
  }
  if (goal.deadline) {
    const deadline = Date.parse(goal.deadline);
    if (Number.isFinite(deadline) && deadline < Date.now()) {
      return { label: "Vencida", tone: "late" };
    }
  }
  return { label: "En curso", tone: "active" };
}

function GoalRing({ goal }: { goal: Goal }) {
  const pct = Math.min(100, Math.max(0, Math.round(goal.progressPct)));
  return (
    <div
      className="mc-metas-ring"
      role="img"
      aria-label={`${pct}% de ${goal.title}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--mc-metas-track)"
          strokeWidth="10"
        />
        {pct > 0 ? (
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(264 * pct) / 100} 264`}
            transform="rotate(-90 50 50)"
          />
        ) : null}
      </svg>
      <strong>{pct}%</strong>
    </div>
  );
}

export default async function MetasPage() {
  await connection();
  const goals = listGoals();
  const demo = isDemoMode();
  const savedTotal = goals.reduce((sum, goal) => sum + goal.savedCents, 0);
  const activeCount = goals.filter((goal) => goal.remainingCents > 0).length;

  return (
    <OperationalPage
      activeHref="/metas"
      title="Metas"
      titleId="metas-title"
      focusTargetId="metas-title"
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
      contentClassName="mc-metas-main mc-metas-index-main"
    >
      <div className="mc-metas-native mc-metas-app">
        <Image
          src={picadoArt}
          alt=""
          aria-hidden="true"
          className="mc-metas-page__picado"
          sizes="(max-width: 760px) 180px, 440px"
        />

        <section className="mc-metas-totals" aria-label="Resumen de metas">
          <div className="mc-metas-totals__art">
            <Image
              src={ahorroArt}
              alt=""
              aria-hidden="true"
              sizes="(max-width: 760px) 76px, 170px"
            />
          </div>
          <div className="mc-metas-totals__metric">
            <p className="mc-metas-totals__label">Ahorrado</p>
            <CurrencyAmount
              as="p"
              cents={savedTotal}
              className="mc-metas-totals__value"
            />
          </div>
          <div className="mc-metas-totals__metric">
            <p className="mc-metas-totals__label">Metas activas</p>
            <p className="mc-metas-totals__value">{activeCount}</p>
          </div>
        </section>

        {goals.length > 0 ? (
          <div className="mc-metas-list">
            {goals.map((goal) => {
              const status = statusOf(goal);
              return (
                <article key={goal.id} className="mc-metas-goal">
                  <div className="mc-metas-goal__art">
                    <Image
                      src={ahorroArt}
                      alt=""
                      aria-hidden="true"
                      sizes="(max-width: 760px) 84px, 210px"
                    />
                  </div>

                  <div className="mc-metas-goal__body">
                    <h2 className="mc-metas-goal__title">{goal.title}</h2>
                    <p className="mc-metas-goal__objective">
                      <Image
                        src={metaIcon}
                        alt=""
                        aria-hidden="true"
                        width={18}
                        height={18}
                        className="mc-metas-goal__objective-icon"
                      />
                      <span>
                        Objetivo{" "}
                        <CurrencyAmount
                          cents={goal.targetCents}
                          className="mc-metas-goal__objective-amount"
                        />
                      </span>
                    </p>
                    <ProgressIndicator
                      value={goal.progressPct}
                      label={`Progreso de ${goal.title}`}
                      className="mc-metas-goal__track"
                      barClassName="mc-metas-goal__fill"
                    />
                    <p className="mc-metas-goal__amounts">
                      <CurrencyAmount
                        cents={goal.savedCents}
                        className="mc-metas-goal__saved"
                      />{" "}
                      /{" "}
                      <CurrencyAmount cents={goal.targetCents} />
                    </p>
                  </div>

                  <div className="mc-metas-goal__side">
                    <GoalRing goal={goal} />
                    <span
                      className={`mc-metas-goal__status mc-metas-goal__status--${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="mc-metas-goal__action">
                    {goal.remainingCents > 0 ? (
                      <ContributeGoalButton
                        goal={{
                          id: goal.id,
                          title: goal.title,
                          remainingCents: goal.remainingCents,
                        }}
                        variant="secondary"
                      />
                    ) : (
                      <p className="mc-metas-goal__done">
                        Meta alcanzada. ¡Bien hecho!
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="mc-metas-empty" aria-labelledby="mc-metas-empty-title">
            <div className="mc-metas-empty__art">
              <Image
                src={ahorroArt}
                alt=""
                aria-hidden="true"
                sizes="(max-width: 760px) 96px, 168px"
              />
            </div>
            <div className="mc-metas-empty__copy">
              <h2 id="mc-metas-empty-title" className="mc-metas-empty__title">
                Tu primera meta
              </h2>
              <p className="mc-metas-empty__text">
                Elige algo concreto para tu puesto y apunta cuánto llevas
                apartado. Puedes empezar con 50 pesos.
              </p>
              <CreateGoalButton label="Crear mi primera meta" />
            </div>
          </section>
        )}

        {goals.length > 0 ? (
          <div className="mc-metas-new">
            <CreateGoalButton label="Nueva meta" />
          </div>
        ) : null}

        <p className="mc-metas-note">
          El apartado es un registro declarado: no es una cuenta bancaria, no
          genera intereses y el efectivo sigue en tu caja. El historial de
          movimientos no se muestra en esta pantalla.
        </p>
      </div>
    </OperationalPage>
  );
}
