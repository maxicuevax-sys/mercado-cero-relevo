import type { Metadata } from "next";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { CreateGoalButton } from "@/components/metas/create-goal";
import { ContributeGoalButton } from "@/components/metas/contribute-goal";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { formatMxn } from "@/lib/format";
import { listGoals } from "@/lib/goals";
import { MEXICO_TZ } from "@/lib/mexico-date";
import type { Goal } from "@/lib/types";
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
    return { label: "Meta alcanzada", tone: "done" };
  }
  if (goal.deadline) {
    const deadline = Date.parse(goal.deadline);
    if (Number.isFinite(deadline) && deadline < Date.now()) {
      return { label: "Fecha límite pasada", tone: "late" };
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
    return "Puedes dejar la meta como referencia de lo que lograste.";
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

  return (
    <OperationalPage
      activeHref="/metas"
      title="Metas"
      titleId="metas-title"
      eyebrow="Ahorro"
      subtitle="Un objetivo concreto y un avance visible. El apartado es un registro declarado: el efectivo sigue en tu resguardo."
      actions={<CreateGoalButton />}
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={demo}
    >
      <section className="mc-op-kpis" aria-label="Resumen de metas">
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Metas en curso</p>
          <p className="mc-op-kpi__value">{activeCount}</p>
          <p className="mc-op-kpi__note">
            {goals.length === 1
              ? "1 meta registrada en total"
              : `${goals.length} metas registradas en total`}
          </p>
        </article>
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Ahorrado</p>
          <CurrencyAmount as="p" cents={savedTotal} className="mc-op-kpi__value" />
          <p className="mc-op-kpi__note">Apartado declarado, no dinero custodiado</p>
        </article>
        <article className="mc-op-kpi">
          <p className="mc-op-kpi__label">Falta para tus metas</p>
          <CurrencyAmount
            as="p"
            cents={remainingTotal}
            className="mc-op-kpi__value"
          />
          <p className="mc-op-kpi__note">No se suma a la caja ni a lo cobrado</p>
        </article>
      </section>

      {goals.length === 0 ? (
        <div className="mc-op-empty" role="status">
          <p className="mc-op-empty__title">Aún no hay una meta.</p>
          <p className="mc-op-empty__body">
            La primera puede ser algo concreto para tu puesto: una sombrilla,
            una hielera, el enganche de una báscula. Define el monto y, si
            quieres, una fecha límite.
          </p>
          <div className="mc-op-empty__action">
            <CreateGoalButton label="Crear mi primera meta" variant="secondary" />
          </div>
        </div>
      ) : (
        <section className="mc-metas-list" aria-label="Tus metas">
          <div className="mc-metas-list__grid">
            {goals.map((goal) => {
              const status = statusOf(goal);
              return (
                <article
                  key={goal.id}
                  className="mc-op-panel mc-metas-goal"
                  aria-labelledby={`mc-metas-goal-${goal.id}`}
                >
                  <div className="mc-op-panel__head">
                    <h2
                      id={`mc-metas-goal-${goal.id}`}
                      className="mc-op-panel__title"
                    >
                      {goal.title}
                    </h2>
                    <span
                      className={`mc-metas-status mc-metas-status--${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="mc-op-panel__body">
                    <div className="mc-metas-goal__progress-row">
                      <p className="mc-metas-goal__amounts">
                        <CurrencyAmount
                          cents={goal.savedCents}
                          className="mc-metas-goal__saved"
                        />{" "}
                        de{" "}
                        <CurrencyAmount
                          cents={goal.targetCents}
                          className="mc-metas-goal__target"
                        />
                      </p>
                      <p className="mc-metas-goal__pct">{goal.progressPct}%</p>
                    </div>
                    <ProgressIndicator
                      value={goal.progressPct}
                      label={`Progreso de ${goal.title}`}
                      className="mc-metas-goal__progress"
                      barClassName="mc-metas-goal__progress-fill"
                    />

                    <dl className="mc-metas-goal__stats">
                      <div>
                        <dt>Falta</dt>
                        <dd className="tabular-nums">
                          {formatMxn(goal.remainingCents)}
                        </dd>
                      </div>
                      <div>
                        <dt>Fecha límite</dt>
                        <dd>{deadlineLabel(goal)}</dd>
                      </div>
                      <div>
                        <dt>Por semana</dt>
                        <dd className="tabular-nums">
                          {goal.weeklyNeededCents !== null
                            ? formatMxn(goal.weeklyNeededCents)
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mc-op-panel__foot mc-metas-goal__foot">
                    {goal.remainingCents > 0 ? (
                      <ContributeGoalButton
                        goal={{
                          id: goal.id,
                          title: goal.title,
                          remainingCents: goal.remainingCents,
                        }}
                      />
                    ) : (
                      <p className="mc-metas-goal__done">
                        Meta alcanzada. ¡Bien hecho!
                      </p>
                    )}
                    <p className="mc-metas-goal__hint">{goalHint(goal)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <p className="mc-metas-note">
        El ahorro es un apartado declarado en tu registro: no es una cuenta
        bancaria, no genera intereses y el efectivo sigue bajo tu resguardo.
      </p>
    </OperationalPage>
  );
}
