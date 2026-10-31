import { getDb, newId, nowIso } from "./db";
import type { Goal } from "./types";

interface GoalRow {
  id: string;
  title: string;
  target_cents: number;
  saved_cents: number;
  deadline: string | null;
  status: string;
  created_at: string;
}

function mapGoal(row: GoalRow): Goal {
  const targetCents = Number(row.target_cents);
  const savedCents = Number(row.saved_cents);
  const remainingCents = Math.max(0, targetCents - savedCents);
  const deadline = row.deadline;
  const weeksRemaining = deadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(deadline).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000),
        ),
      )
    : null;

  return {
    id: row.id,
    title: row.title,
    targetCents,
    savedCents,
    deadline,
    status: row.status,
    createdAt: row.created_at,
    progressPct:
      targetCents > 0 ? Math.min(100, Math.round((savedCents / targetCents) * 100)) : 0,
    remainingCents,
    weeksRemaining,
    weeklyNeededCents:
      remainingCents > 0 && weeksRemaining && weeksRemaining > 0
        ? Math.ceil(remainingCents / weeksRemaining)
        : null,
  };
}

export function listGoals(): Goal[] {
  const rows = getDb()
    .prepare("SELECT * FROM goals ORDER BY status ASC, created_at ASC")
    .all() as unknown as GoalRow[];
  return rows.map(mapGoal);
}

export function getGoal(id: string): Goal | null {
  const row = getDb()
    .prepare("SELECT * FROM goals WHERE id = ?")
    .get(id) as unknown as GoalRow | undefined;
  return row ? mapGoal(row) : null;
}

export function createGoal(input: {
  title: string;
  targetCents: number;
  deadline?: string | null;
}): Goal {
  const title = input.title.trim();
  if (!title) throw new Error("La meta necesita un nombre.");
  const targetCents = Math.round(input.targetCents);
  if (!Number.isFinite(targetCents) || targetCents <= 0) {
    throw new Error("El monto de la meta debe ser mayor a cero.");
  }

  const id = newId("goal");
  getDb()
    .prepare(
      "INSERT INTO goals (id, title, target_cents, saved_cents, deadline, status, created_at) VALUES (?, ?, ?, 0, ?, 'active', ?)",
    )
    .run(id, title, targetCents, input.deadline ?? null, nowIso());
  return getGoal(id)!;
}

export function contributeToGoal(
  goalId: string,
  amountCents: number,
  note?: string | null,
): Goal {
  const database = getDb();
  const goal = getGoal(goalId);
  if (!goal) throw new Error("Meta no encontrada.");
  const amount = Math.round(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("La aportación debe ser mayor a cero.");
  }

  database
    .prepare(
      "INSERT INTO goal_contributions (id, goal_id, amount_cents, note, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(newId("gctr"), goalId, amount, note?.trim() || null, nowIso());
  database
    .prepare("UPDATE goals SET saved_cents = saved_cents + ? WHERE id = ?")
    .run(amount, goalId);

  return getGoal(goalId)!;
}
