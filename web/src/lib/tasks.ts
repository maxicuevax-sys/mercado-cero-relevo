import { isDemoMode } from "./config";
import { audit, getDb, newId, nowIso } from "./db";
import type { Task, TaskStatus } from "./types";

export const TASK_TITLE_MAX = 120;
export const TASK_NOTE_MAX = 500;
export const TASK_LIST_LIMIT = 50;

/**
 * Error de dominio de los pendientes. La ruta lo traduce a un status HTTP
 * claro; el mensaje está escrito para mostrarse tal cual a la comerciante.
 */
export class TaskError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(message: string, httpStatus = 400, code = "invalid_task") {
    super(message);
    this.name = "TaskError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

interface TaskRow {
  id: string;
  title: string;
  note: string | null;
  status: string;
  due_at: string | null;
  postponed_until: string | null;
  demo: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? null,
    status: row.status as TaskStatus,
    dueAt: row.due_at ?? null,
    postponedUntil: row.postponed_until ?? null,
    demo: Number(row.demo) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}

/**
 * Acepta `AAAA-MM-DD` o un ISO 8601 con hora. Las fechas sin hora se anclan a
 * mediodía de México para que el día no se mueva al mostrarlo en otra zona.
 * Las fechas con hora pero sin offset se interpretan como hora de México.
 */
export function parseTaskDate(value: string, field = "fecha"): Date {
  const trimmed = value.trim();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
      trimmed,
    );

  if (!match) {
    throw new TaskError(
      `La ${field} no es válida. Usa una fecha como 2026-11-07.`,
      400,
      "invalid_date",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  ) {
    throw new TaskError(
      `La ${field} no existe en el calendario.`,
      400,
      "invalid_date",
    );
  }

  if (match[4] === undefined) {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00-06:00`);
    if (Number.isNaN(date.getTime())) {
      throw new TaskError(`La ${field} no es válida.`, 400, "invalid_date");
    }
    return date;
  }

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new TaskError(
      `La ${field} tiene una hora que no existe.`,
      400,
      "invalid_date",
    );
  }

  const offset = match[8] ?? "-06:00";
  const date = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${String(
      second,
    ).padStart(2, "0")}${match[7] ? `.${match[7]}` : ""}${offset}`,
  );
  if (Number.isNaN(date.getTime())) {
    throw new TaskError(`La ${field} no es válida.`, 400, "invalid_date");
  }
  return date;
}

function normalizeTitle(value: string): string {
  const title = value.trim();
  if (!title) {
    throw new TaskError(
      "Escribe qué quieres recordar.",
      400,
      "title_required",
    );
  }
  if (title.length > TASK_TITLE_MAX) {
    throw new TaskError(
      `El título no puede pasar de ${TASK_TITLE_MAX} caracteres.`,
      400,
      "title_too_long",
    );
  }
  return title;
}

function normalizeNote(value: string | null | undefined): string | null {
  if (value == null) return null;
  const note = value.trim();
  if (!note) return null;
  if (note.length > TASK_NOTE_MAX) {
    throw new TaskError(
      `La nota no puede pasar de ${TASK_NOTE_MAX} caracteres.`,
      400,
      "note_too_long",
    );
  }
  return note;
}

function dueTime(task: Task): number | null {
  const value = task.postponedUntil ?? task.dueAt;
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/**
 * Abiertas primero. Dentro de abiertas: vencidas/por vencer por fecha, luego
 * las que no tienen fecha, luego por creación. Las hechas van por completion
 * más reciente.
 */
export function compareTasks(a: Task, b: Task): number {
  if (a.status !== b.status) return a.status === "open" ? -1 : 1;

  if (a.status === "done") {
    const aDone = a.completedAt ? Date.parse(a.completedAt) : 0;
    const bDone = b.completedAt ? Date.parse(b.completedAt) : 0;
    if (aDone !== bDone) return bDone - aDone;
    return b.createdAt.localeCompare(a.createdAt);
  }

  const aDue = dueTime(a);
  const bDue = dueTime(b);
  if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
  if (aDue !== null && bDue === null) return -1;
  if (aDue === null && bDue !== null) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export function listTasks(
  limit = TASK_LIST_LIMIT,
  offset = 0,
): Task[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeOffset = Math.max(0, Math.floor(offset));
  // El mismo orden de `compareTasks`, pero resuelto por SQLite para poder
  // paginar sin cargar la bandeja completa. Abiertas primero; vencidas por
  // fecha, luego sin fecha, luego creación. Las hechas, por completion.
  const demoFilter = isDemoMode() ? "" : "AND demo = 0";
  const rows = getDb()
    .prepare(
      `SELECT * FROM tasks
       WHERE status IN ('open', 'done') ${demoFilter}
       ORDER BY
         CASE WHEN status = 'open' THEN 0 ELSE 1 END ASC,
         CASE
           WHEN status != 'done' AND COALESCE(postponed_until, due_at) IS NULL
           THEN 1 ELSE 0
         END ASC,
         CASE
           WHEN status != 'done' THEN COALESCE(postponed_until, due_at)
         END ASC,
         CASE WHEN status = 'done' THEN completed_at END DESC,
         CASE WHEN status = 'done' THEN created_at END DESC,
         CASE WHEN status != 'done' THEN created_at END ASC
       LIMIT ? OFFSET ?`,
    )
    .all(safeLimit, safeOffset) as unknown as TaskRow[];
  return rows.map(mapTask);
}

export function countTasks(): number {
  const demoFilter = isDemoMode() ? "" : "AND demo = 0";
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks WHERE status IN ('open', 'done') ${demoFilter}`,
    )
    .get() as unknown as { n: number };
  return Number(row.n);
}

export function getTask(id: string): Task | null {
  const row = getDb()
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(id) as unknown as TaskRow | undefined;
  if (!row) return null;
  if (!isDemoMode() && Number(row.demo) === 1) return null;
  return mapTask(row);
}

export function createTask(input: {
  title: string;
  note?: string | null;
  dueAt?: string | null;
}): Task {
  const title = normalizeTitle(input.title);
  const note = normalizeNote(input.note);
  const dueAt = input.dueAt ? parseTaskDate(input.dueAt).toISOString() : null;
  const id = newId("task");
  const createdAt = nowIso();

  getDb()
    .prepare(
      `INSERT INTO tasks
       (id, title, note, status, due_at, postponed_until, demo, created_at, updated_at, completed_at, deleted_at)
       VALUES (?, ?, ?, 'open', ?, NULL, ?, ?, ?, NULL, NULL)`,
    )
    .run(id, title, note, dueAt, isDemoMode() ? 1 : 0, createdAt, createdAt);

  audit("task.create", "task", id, { title, dueAt });
  return getTask(id)!;
}

export function completeTask(id: string): Task {
  const task = getTask(id);
  if (!task || task.status === "deleted") {
    throw new TaskError("Ese pendiente no existe.", 404, "not_found");
  }
  if (task.status === "done") return task;

  const at = nowIso();
  getDb()
    .prepare(
      "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?",
    )
    .run(at, at, id);
  audit("task.complete", "task", id);
  return getTask(id)!;
}

export function reopenTask(id: string): Task {
  const task = getTask(id);
  if (!task || task.status === "deleted") {
    throw new TaskError("Ese pendiente no existe.", 404, "not_found");
  }
  if (task.status === "open") return task;

  getDb()
    .prepare(
      "UPDATE tasks SET status = 'open', completed_at = NULL, updated_at = ? WHERE id = ?",
    )
    .run(nowIso(), id);
  audit("task.reopen", "task", id);
  return getTask(id)!;
}

export function postponeTask(id: string, postponeUntil: string): Task {
  const task = getTask(id);
  if (!task || task.status === "deleted") {
    throw new TaskError("Ese pendiente no existe.", 404, "not_found");
  }
  if (task.status === "done") {
    throw new TaskError(
      "Ese pendiente ya está hecho. Reábrelo para posponerlo.",
      409,
      "task_done",
    );
  }

  const until = parseTaskDate(postponeUntil, "nueva fecha");
  if (until.getTime() <= Date.now()) {
    throw new TaskError(
      "La nueva fecha debe ser futura.",
      400,
      "date_not_future",
    );
  }

  const iso = until.toISOString();
  getDb()
    .prepare(
      "UPDATE tasks SET postponed_until = ?, updated_at = ? WHERE id = ?",
    )
    .run(iso, nowIso(), id);
  audit("task.postpone", "task", id, {
    postponeUntil: iso,
    previous: task.postponedUntil,
  });
  return getTask(id)!;
}

/** Soft delete idempotente: repetirlo devuelve la misma fila sin duplicar. */
export function deleteTask(id: string): Task {
  const task = getTask(id);
  if (!task) {
    throw new TaskError("Ese pendiente no existe.", 404, "not_found");
  }
  if (task.status === "deleted") return task;

  const at = nowIso();
  getDb()
    .prepare(
      "UPDATE tasks SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?",
    )
    .run(at, at, id);
  audit("task.delete", "task", id);
  return getTask(id)!;
}
