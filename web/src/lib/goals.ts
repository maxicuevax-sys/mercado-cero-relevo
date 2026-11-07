import { isDemoMode } from "./config";
import { audit, getDb, newId, nowIso } from "./db";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { requestPayloadHash } from "./request-hash";
import type { Goal } from "./types";

export const MAX_GOAL_TITLE_CHARS = 120;
export const MAX_GOAL_NOTE_CHARS = 200;
export const MAX_GOAL_CONTRIBUTION_CENTS = 100_000_000;
export const MAX_REQUEST_ID_CHARS = 128;

interface GoalRow {
  id: string;
  title: string;
  target_cents: number;
  saved_cents: number;
  deadline: string | null;
  status: string;
  demo: number;
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
    demo: Number(row.demo) === 1 || row.id.startsWith("demo_seed_"),
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
  const demoFilter = isDemoMode() ? "" : "WHERE demo = 0";
  const rows = getDb()
    .prepare(`SELECT * FROM goals ${demoFilter} ORDER BY status ASC, created_at ASC`)
    .all() as unknown as GoalRow[];
  return rows.map(mapGoal);
}

export function getGoal(id: string): Goal | null {
  const row = getDb()
    .prepare("SELECT * FROM goals WHERE id = ?")
    .get(id) as unknown as GoalRow | undefined;
  if (!row) return null;
  if (!isDemoMode() && (Number(row.demo) === 1 || id.startsWith("demo_seed_"))) {
    return null;
  }
  return mapGoal(row);
}

export function createGoal(input: {
  title: string;
  targetCents: number;
  deadline?: string | null;
}): Goal {
  const title = input.title.trim();
  if (!title) throw new ValidationError("La meta necesita un nombre.");
  if (title.length > MAX_GOAL_TITLE_CHARS) {
    throw new ValidationError(
      `El nombre de la meta no puede pasar de ${MAX_GOAL_TITLE_CHARS} caracteres.`,
      "title_too_long",
    );
  }
  const targetCents = Math.round(input.targetCents);
  if (!Number.isFinite(targetCents) || targetCents <= 0) {
    throw new ValidationError("El monto de la meta debe ser mayor a cero.");
  }

  const id = newId("goal");
  getDb()
    .prepare(
      "INSERT INTO goals (id, title, target_cents, saved_cents, deadline, status, demo, created_at) VALUES (?, ?, ?, 0, ?, 'active', ?, ?)",
    )
    .run(id, title, targetCents, input.deadline ?? null, isDemoMode() ? 1 : 0, nowIso());
  return getGoal(id)!;
}

/**
 * Registra una aportación en una sola transacción. `requestId` es obligatorio:
 * repetirlo devuelve la meta actual sin insertar otra aportación, así que un
 * doble clic (o un reintento tras perder la respuesta) no infla el ahorro.
 */
export function contributeToGoal(
  goalId: string,
  amountCents: number,
  note?: string | null,
  requestId?: string | null,
): Goal {
  const amount = Math.round(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("La aportación debe ser mayor a cero.");
  }
  if (amount > MAX_GOAL_CONTRIBUTION_CENTS) {
    throw new ValidationError(
      "La aportación es demasiado grande.",
      "contribution_too_large",
    );
  }

  const cleanNote = (note ?? "").trim() || null;
  if (cleanNote && cleanNote.length > MAX_GOAL_NOTE_CHARS) {
    throw new ValidationError(
      `La nota no puede pasar de ${MAX_GOAL_NOTE_CHARS} caracteres.`,
      "note_too_long",
    );
  }

  const request = (requestId ?? "").trim() || null;
  if (!request) {
    // Defensa extra además del esquema de la ruta: sin llave no hay forma de
    // distinguir un reintento de una segunda aportación.
    throw new ValidationError(
      "Falta la llave de la aportación. Vuelve a intentarlo desde la caja.",
      "request_id_required",
    );
  }
  if (request.length > MAX_REQUEST_ID_CHARS) {
    throw new ValidationError(
      `El identificador de la solicitud no puede pasar de ${MAX_REQUEST_ID_CHARS} caracteres.`,
      "request_id_too_long",
    );
  }
  const requestHash = request
    ? requestPayloadHash({ goalId, amountCents: amount, note: cleanNote })
    : null;

  const database = getDb();
  const demo = isDemoMode() ? 1 : 0;
  let committed = false;
  database.exec("BEGIN IMMEDIATE");
  try {
    if (request && requestHash) {
      const existing = database
        .prepare(
          "SELECT goal_id, amount_cents, note, request_hash, demo FROM goal_contributions WHERE request_id = ?",
        )
        .get(request) as
        | {
            goal_id: string;
            amount_cents: number;
            note: string | null;
            request_hash: string | null;
            demo: number;
          }
        | undefined;
      if (existing) {
        if (existing.goal_id !== goalId || Number(existing.demo) !== demo) {
          throw new ConflictError(
            "Ese requestId ya se usó en otra meta o en el otro modo. No se registró nada.",
            "request_id_conflict",
          );
        }
        const storedHash =
          existing.request_hash ??
          requestPayloadHash({
            goalId: existing.goal_id,
            amountCents: Number(existing.amount_cents),
            note: existing.note ?? null,
          });
        if (storedHash !== requestHash) {
          throw new ConflictError(
            "Ese requestId ya se usó con otro monto o nota. No se registró nada.",
            "request_id_conflict",
          );
        }
        database.exec("COMMIT");
        committed = true;
        const goal = getGoal(goalId);
        if (!goal) throw new NotFoundError("Meta no encontrada.", "goal_not_found");
        return goal;
      }
    }

    const goalRow = database
      .prepare("SELECT id, demo FROM goals WHERE id = ?")
      .get(goalId) as { id: string; demo: number } | undefined;
    if (!goalRow || Number(goalRow.demo) !== demo) {
      throw new NotFoundError("Meta no encontrada.", "goal_not_found");
    }

    database
      .prepare(
        "INSERT INTO goal_contributions (id, goal_id, amount_cents, note, request_id, request_hash, demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        newId("gctr"),
        goalId,
        amount,
        cleanNote,
        request,
        requestHash,
        demo,
        nowIso(),
      );
    database
      .prepare("UPDATE goals SET saved_cents = saved_cents + ? WHERE id = ?")
      .run(amount, goalId);

    audit("goal.contribution", "goal", goalId, {
      amountCents: amount,
      note: cleanNote,
      requestId: request,
    });

    database.exec("COMMIT");
    committed = true;
  } finally {
    if (!committed) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Si SQLite ya cerró la transacción, conservamos el error original.
      }
    }
  }

  const goal = getGoal(goalId);
  if (!goal) throw new NotFoundError("Meta no encontrada.", "goal_not_found");
  return goal;
}
