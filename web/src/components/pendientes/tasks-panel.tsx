"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";
import {
  addDaysToDateKey,
  MEXICO_TZ,
  mexicoAt,
  mexicoDateKey,
} from "@/lib/mexico-date";
import type { Task } from "@/lib/types";

/*
 * Panel de Tareas de /pendientes.
 *
 * Se escribe aquí en lugar de reutilizar `components/pending-tasks.tsx` porque
 * ese componente monta su propio `ScreenHeading` con un `<h1>` y estilos del
 * shell clásico: dentro del wrapper operativo nuevo duplicaría el H1 y
 * rompería la composición. Las llamadas a la API son las mismas
 * (`POST/PATCH /api/tasks`), sin tocar endpoints ni lógica.
 */

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const TITLE_MAX = 120;
const NOTE_MAX = 500;

const shortDateFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: MEXICO_TZ,
  day: "numeric",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: MEXICO_TZ,
  hour: "2-digit",
  minute: "2-digit",
});

function subscribeToClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}

function clockSnapshot(): number {
  return Math.floor(Date.now() / MINUTE_MS);
}

function serverClockSnapshot(): null {
  return null;
}

/** Hora del cliente sin leer `Date.now()` durante el render (sin hydration mismatch). */
function useClock(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    clockSnapshot,
    serverClockSnapshot,
  );
}

function shortDate(date: Date): string {
  return shortDateFormatter.format(date).replace(/\.$/, "");
}

function taskDueTime(task: Task): number | null {
  const value = task.postponedUntil ?? task.dueAt;
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/** Mismo orden que `compareTasks` de `lib/tasks.ts` (que no puede entrar al bundle). */
function sortTasks(a: Task, b: Task): number {
  if (a.status !== b.status) return a.status === "open" ? -1 : 1;
  if (a.status === "done") {
    const aDone = a.completedAt ? Date.parse(a.completedAt) : 0;
    const bDone = b.completedAt ? Date.parse(b.completedAt) : 0;
    if (aDone !== bDone) return bDone - aDone;
    return b.createdAt.localeCompare(a.createdAt);
  }
  const aDue = taskDueTime(a);
  const bDue = taskDueTime(b);
  if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
  if (aDue !== null && bDue === null) return -1;
  if (aDue === null && bDue !== null) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

type DueTone = "overdue" | "today" | "soon" | "none";

function dueMeta(
  task: Task,
  now: Date | null,
): { text: string; tone: DueTone } {
  const iso = task.postponedUntil ?? task.dueAt;
  if (!iso) return { text: "Sin fecha", tone: "none" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { text: "Sin fecha", tone: "none" };

  if (!now) {
    return { text: `Vence el ${shortDate(date)}`, tone: "soon" };
  }

  const today = mexicoDateKey(now);
  const due = mexicoDateKey(date);

  if (due < today) {
    return { text: `Venció el ${shortDate(date)}`, tone: "overdue" };
  }
  if (due === today) {
    return { text: `Para hoy, ${timeFormatter.format(date)}`, tone: "today" };
  }
  if (due === addDaysToDateKey(today, 1)) {
    return { text: "Para mañana", tone: "soon" };
  }
  return { text: `Vence el ${shortDate(date)}`, tone: "soon" };
}

function completedLabel(task: Task, now: Date | null): string {
  if (!task.completedAt) return "Hecha";
  const date = new Date(task.completedAt);
  if (Number.isNaN(date.getTime())) return "Hecha";
  if (now && mexicoDateKey(date) === mexicoDateKey(now)) return "Hecha hoy";
  return `Hecha el ${shortDate(date)}`;
}

function dateInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00-06:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (mexicoDateKey(date) !== value) return null;
  return date.toISOString();
}

function laterTodayIso(): string {
  return new Date(Date.now() + 3 * HOUR_MS).toISOString();
}

function isFutureIso(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Respuesta sin JSON: usamos el texto genérico.
  }
  if (response.status === 404) return "Esa tarea ya no existe.";
  if (response.status === 409) return "Esa tarea ya cambió. Actualiza e intenta de nuevo.";
  if (response.status === 429) return "Demasiados intentos seguidos. Espera un momento.";
  return "No pude completar la acción. Intenta de nuevo.";
}

function humanError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    if (/failed to fetch|networkerror|load failed|fetch failed/i.test(error.message)) {
      return "No pude conectar. Revisa tu conexión e intenta de nuevo.";
    }
    return error.message;
  }
  return fallback;
}

export function TasksPanel({
  initialTasks,
  totalCount,
}: {
  /** Tareas ya leídas en el servidor (`listTasks`). */
  initialTasks: Task[];
  /** Total de tareas registradas (`countTasks`), para el resumen del panel. */
  totalCount: number;
}) {
  const headingId = useId();
  const formTitleId = useId();
  const formNoteId = useId();
  const formDateId = useId();
  const formErrorId = useId();

  const rootRef = useRef<HTMLElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const [tasks, setTasks] = useState<Task[]>(() =>
    [...initialTasks].sort(sortTasks),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [postponeId, setPostponeId] = useState<string | null>(null);
  const [pickingDateId, setPickingDateId] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const clock = useClock();
  const now = clock === null ? null : new Date(clock * MINUTE_MS);
  const todayKey = now ? mexicoDateKey(now) : undefined;

  const openTasks = tasks.filter((task) => task.status === "open");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const actionsDisabled = busyId !== null || saving;
  const totalLabel =
    totalCount > tasks.length
      ? ` · ${totalCount} en total`
      : "";

  const commit = useCallback((next: Task[]) => {
    setTasks(next.filter((task) => task.status !== "deleted").sort(sortTasks));
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    titleInputRef.current?.focus();
  }, [formOpen]);

  useEffect(() => {
    if (!focusTarget) return;
    const root = rootRef.current;
    if (!root) return;
    const element = Array.from(
      root.querySelectorAll<HTMLElement>("[data-focus]"),
    ).find((node) => node.dataset.focus === focusTarget);
    if (element) {
      element.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, tasks]);

  function openForm() {
    setActionError(null);
    setDeleteId(null);
    setPostponeId(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormError(null);
    setFocusTarget("create");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Escribe qué quieres recordar.");
      titleInputRef.current?.focus();
      return;
    }
    if (cleanTitle.length > TITLE_MAX) {
      setFormError(`El título no puede pasar de ${TITLE_MAX} caracteres.`);
      titleInputRef.current?.focus();
      return;
    }
    if (note.trim().length > NOTE_MAX) {
      setFormError(`La nota no puede pasar de ${NOTE_MAX} caracteres.`);
      return;
    }

    let dueAt: string | null = null;
    if (dueDate) {
      dueAt = dateInputToIso(dueDate);
      if (!dueAt) {
        setFormError("Elige una fecha válida.");
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: cleanTitle, note: note.trim() || null, dueAt }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response));
      }
      const body = (await response.json()) as { task?: Task };
      if (!body.task) {
        throw new Error("El servidor no devolvió la tarea guardada.");
      }
      const created = body.task;
      commit([...tasks.filter((task) => task.id !== created.id), created]);
      setTitle("");
      setNote("");
      setDueDate("");
      setFormOpen(false);
      setAnnouncement(`Tarea anotada: ${created.title}.`);
      setFocusTarget(`complete-${created.id}`);
    } catch (caught) {
      setFormError(humanError(caught, "No pude guardar la tarea."));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    id: string,
    action: "complete" | "reopen" | "postpone" | "delete",
    postponeUntil?: string,
  ) {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setBusyId(id);
    setActionError(null);

    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          action === "postpone" ? { action, postponeUntil } : { action },
        ),
      });
      if (!response.ok) {
        throw new Error(await responseError(response));
      }
      const body = (await response.json()) as { task?: Task };
      if (!body.task) {
        throw new Error("El servidor no devolvió la tarea actualizada.");
      }
      const updated = body.task;
      const next =
        action === "delete"
          ? tasks.filter((task) => task.id !== id)
          : [...tasks.filter((task) => task.id !== id), updated];
      commit(next);

      const nextOpen = next.find((task) => task.status === "open");
      if (action === "delete") {
        setDeleteId(null);
        setFocusTarget(nextOpen ? `complete-${nextOpen.id}` : "create");
        setAnnouncement("Tarea eliminada.");
      } else if (action === "complete") {
        setDoneOpen(true);
        setFocusTarget(nextOpen ? `complete-${nextOpen.id}` : "create");
        setAnnouncement("Tarea completada. Queda en Hechas.");
      } else if (action === "reopen") {
        setFocusTarget(`complete-${id}`);
        setAnnouncement("Tarea reabierta.");
      } else {
        setPostponeId(null);
        setPickingDateId(null);
        setPickedDate("");
        setFocusTarget(`postpone-${id}`);
        setAnnouncement("Tarea pospuesta.");
      }
    } catch (caught) {
      setActionError(humanError(caught, "No pude actualizar la tarea."));
    } finally {
      inFlight.current.delete(id);
      setBusyId(null);
    }
  }

  function startPostpone(id: string) {
    setActionError(null);
    setDeleteId(null);
    setPickingDateId(null);
    setPickedDate("");
    setPostponeId((current) => (current === id ? null : id));
    if (postponeId !== id) setFocusTarget(`postpone-first-${id}`);
  }

  function closePostpone(id: string) {
    setPostponeId(null);
    setPickingDateId(null);
    setPickedDate("");
    setFocusTarget(`postpone-${id}`);
  }

  function submitPickedDate(id: string) {
    const iso = dateInputToIso(pickedDate);
    if (!iso) {
      setActionError("Elige una fecha válida.");
      setFocusTarget(`pick-date-${id}`);
      return;
    }
    if (!isFutureIso(iso)) {
      setActionError("Elige una fecha futura.");
      setFocusTarget(`pick-date-${id}`);
      return;
    }
    void runAction(id, "postpone", iso);
  }

  function startDelete(id: string) {
    setActionError(null);
    setPostponeId(null);
    setPickingDateId(null);
    setDeleteId(id);
    setFocusTarget(`delete-cancel-${id}`);
  }

  function cancelDelete(id: string) {
    setDeleteId(null);
    setFocusTarget(`delete-${id}`);
  }

  return (
    <section
      ref={rootRef}
      className="mc-op-panel mc-pend-tasks"
      aria-labelledby={headingId}
    >
      <div className="mc-op-panel__head">
        <h2 id={headingId} className="mc-op-panel__title">
          Tareas
        </h2>
        <p className="mc-op-panel__meta">
          {openTasks.length} {openTasks.length === 1 ? "abierta" : "abiertas"} ·{" "}
          {doneTasks.length} {doneTasks.length === 1 ? "hecha" : "hechas"}
          {totalLabel}
        </p>
      </div>

      <div className="mc-op-panel__body">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {!formOpen ? (
          <div className="mc-pend-tasks__toolbar">
            <button
              type="button"
              data-focus="create"
              onClick={openForm}
              className="mc-pend-cta"
            >
              <Plus className="mc-pend-icon" aria-hidden="true" />
              Anotar tarea
            </button>
          </div>
        ) : null}

        {formOpen ? (
          <form
            id={`${headingId}-form`}
            className="mc-pend-form"
            onSubmit={handleCreate}
            noValidate
          >
            <div className="mc-pend-field">
              <label htmlFor={formTitleId} className="mc-pend-field__label">
                ¿Qué quieres recordar?
              </label>
              <input
                ref={titleInputRef}
                id={formTitleId}
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={TITLE_MAX}
                autoComplete="off"
                placeholder="Pagar al proveedor"
                className="mc-pend-input"
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? formErrorId : undefined}
              />
            </div>
            <div className="mc-pend-field">
              <label htmlFor={formNoteId} className="mc-pend-field__label">
                Nota <span className="mc-pend-field__optional">(opcional)</span>
              </label>
              <textarea
                id={formNoteId}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={NOTE_MAX}
                rows={2}
                placeholder="A las 11, por la puerta de atrás"
                className="mc-pend-input mc-pend-textarea"
              />
            </div>
            <div className="mc-pend-field">
              <label htmlFor={formDateId} className="mc-pend-field__label">
                Fecha <span className="mc-pend-field__optional">(opcional)</span>
              </label>
              <input
                id={formDateId}
                type="date"
                value={dueDate}
                min={todayKey}
                onChange={(event) => {
                  setDueDate(event.target.value);
                  if (formError) setFormError(null);
                }}
                className="mc-pend-input mc-pend-input--date"
              />
              <p className="mc-pend-field__hint">
                Sin fecha queda en la lista sin día.
              </p>
            </div>

            {formError ? (
              <p id={formErrorId} role="alert" className="mc-pend-alert">
                {formError}
              </p>
            ) : null}

            <div className="mc-pend-form__actions">
              <button
                type="submit"
                className="mc-pend-cta"
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? (
                  <Loader2 className="mc-pend-icon mc-pend-spin" aria-hidden="true" />
                ) : (
                  <Check className="mc-pend-icon" aria-hidden="true" />
                )}
                {saving ? "Guardando…" : "Guardar tarea"}
              </button>
              <button
                type="button"
                className="mc-pend-button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {actionError ? (
          <div role="alert" className="mc-pend-alert mc-pend-alert--row">
            <span className="mc-pend-alert__text">
              <CircleAlert className="mc-pend-icon" aria-hidden="true" />
              {actionError}
            </span>
            <button
              type="button"
              className="mc-pend-button mc-pend-button--quiet"
              onClick={() => setActionError(null)}
            >
              <X className="mc-pend-icon" aria-hidden="true" />
              Cerrar
            </button>
          </div>
        ) : null}

        {openTasks.length === 0 ? (
          <div className="mc-op-empty">
            <p className="mc-op-empty__title">
              {tasks.length === 0
                ? "Aún no hay tareas."
                : "No hay tareas abiertas."}
            </p>
            <p className="mc-op-empty__body">
              {tasks.length === 0
                ? "Aquí van los recordatorios del puesto: pagar al proveedor, recoger un pedido, llamar a un cliente."
                : "Las hechas quedan abajo. Anota otra cuando algo quede para después."}
            </p>
            {!formOpen ? (
              <div className="mc-op-empty__action">
                <button
                  type="button"
                  className="mc-pend-cta"
                  onClick={openForm}
                >
                  <Plus className="mc-pend-icon" aria-hidden="true" />
                  Anotar tarea
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="mc-pend-task-list" aria-label="Tareas abiertas">
            {openTasks.map((task) => {
              const due = dueMeta(task, now);
              const isBusy = busyId === task.id;
              const isPostponing = postponeId === task.id;
              const isPickingDate = pickingDateId === task.id;
              const isDeleting = deleteId === task.id;

              return (
                <li
                  key={task.id}
                  className="mc-pend-task"
                  aria-busy={isBusy}
                >
                  <div className="mc-pend-task__row">
                    <button
                      type="button"
                      aria-label={`Completar: ${task.title}`}
                      title={`Completar: ${task.title}`}
                      data-focus={`complete-${task.id}`}
                      disabled={actionsDisabled}
                      onClick={() => void runAction(task.id, "complete")}
                      className="mc-pend-task__check"
                    >
                      <Check className="mc-pend-icon" aria-hidden="true" />
                    </button>

                    <div className="mc-pend-task__main">
                      <h3 className="mc-pend-task__title">{task.title}</h3>
                      {task.note ? (
                        <p className="mc-pend-task__note">{task.note}</p>
                      ) : null}

                      <p
                        className={cn(
                          "mc-pend-task__due",
                          `mc-pend-task__due--${due.tone}`,
                        )}
                      >
                        <Clock3 className="mc-pend-icon" aria-hidden="true" />
                        <span>{due.text}</span>
                        {task.postponedUntil ? (
                          <span className="mc-pend-chip">Pospuesta</span>
                        ) : null}
                        {isBusy ? (
                          <span className="mc-pend-task__busy">
                            <Loader2
                              className="mc-pend-icon mc-pend-spin"
                              aria-hidden="true"
                            />
                            Guardando…
                          </span>
                        ) : null}
                      </p>

                      {!isDeleting ? (
                        <div className="mc-pend-task__actions">
                          <button
                            type="button"
                            data-focus={`postpone-${task.id}`}
                            onClick={() => startPostpone(task.id)}
                            disabled={actionsDisabled}
                            aria-expanded={isPostponing}
                            aria-controls={
                              isPostponing ? `postpone-${task.id}` : undefined
                            }
                            className="mc-pend-task__action"
                          >
                            <CalendarDays
                              className="mc-pend-icon"
                              aria-hidden="true"
                            />
                            Posponer
                          </button>
                          <button
                            type="button"
                            data-focus={`delete-${task.id}`}
                            onClick={() => startDelete(task.id)}
                            disabled={actionsDisabled}
                            className="mc-pend-task__action mc-pend-task__action--danger"
                          >
                            <Trash2 className="mc-pend-icon" aria-hidden="true" />
                            Eliminar
                          </button>
                        </div>
                      ) : (
                        <div
                          className="mc-pend-confirm"
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              cancelDelete(task.id);
                            }
                          }}
                        >
                          <p className="mc-pend-confirm__title">
                            ¿Eliminar “{task.title}”?
                          </p>
                          <p className="mc-pend-confirm__note">
                            Dejará de aparecer en tu lista. No se puede
                            deshacer desde aquí.
                          </p>
                          <div className="mc-pend-confirm__actions">
                            <button
                              type="button"
                              data-focus={`delete-cancel-${task.id}`}
                              onClick={() => cancelDelete(task.id)}
                              className="mc-pend-button"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteId(null);
                                void runAction(task.id, "delete");
                              }}
                              disabled={actionsDisabled}
                              className="mc-pend-button mc-pend-button--danger"
                            >
                              <Trash2
                                className="mc-pend-icon"
                                aria-hidden="true"
                              />
                              Sí, eliminar
                            </button>
                          </div>
                        </div>
                      )}

                      {isPostponing ? (
                        <div
                          id={`postpone-${task.id}`}
                          className="mc-pend-postpone"
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              closePostpone(task.id);
                            }
                          }}
                        >
                          <p className="mc-pend-postpone__title">
                            ¿Para cuándo?
                          </p>
                          <div className="mc-pend-postpone__choices">
                            <button
                              type="button"
                              data-focus={`postpone-first-${task.id}`}
                              onClick={() => void runAction(task.id, "postpone", laterTodayIso())}
                              disabled={actionsDisabled}
                              className="mc-pend-postpone__choice"
                            >
                              Más tarde hoy
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void runAction(
                                  task.id,
                                  "postpone",
                                  mexicoAt(1, 9).toISOString(),
                                )
                              }
                              disabled={actionsDisabled}
                              className="mc-pend-postpone__choice"
                            >
                              Mañana
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void runAction(
                                  task.id,
                                  "postpone",
                                  mexicoAt(7, 9).toISOString(),
                                )
                              }
                              disabled={actionsDisabled}
                              className="mc-pend-postpone__choice"
                            >
                              En una semana
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPickingDateId(task.id);
                                setPickedDate("");
                                setFocusTarget(`pick-date-${task.id}`);
                              }}
                              disabled={actionsDisabled}
                              className="mc-pend-postpone__choice"
                            >
                              Elegir fecha
                            </button>
                          </div>

                          {isPickingDate ? (
                            <div className="mc-pend-postpone__date">
                              <label
                                htmlFor={`pick-date-${task.id}`}
                                className="mc-pend-field__label"
                              >
                                Nueva fecha
                              </label>
                              <input
                                id={`pick-date-${task.id}`}
                                data-focus={`pick-date-${task.id}`}
                                type="date"
                                value={pickedDate}
                                min={todayKey}
                                onChange={(event) =>
                                  setPickedDate(event.target.value)
                                }
                                className="mc-pend-input mc-pend-input--date"
                              />
                              <div className="mc-pend-confirm__actions">
                                <button
                                  type="button"
                                  onClick={() => submitPickedDate(task.id)}
                                  disabled={actionsDisabled || !pickedDate}
                                  className="mc-pend-cta"
                                >
                                  Guardar fecha
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPickingDateId(null);
                                    setPickedDate("");
                                    setFocusTarget(`postpone-first-${task.id}`);
                                  }}
                                  className="mc-pend-button"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="mc-pend-postpone__close">
                            <button
                              type="button"
                              onClick={() => closePostpone(task.id)}
                              className="mc-pend-button mc-pend-button--quiet"
                            >
                              Cerrar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <section
          className="mc-pend-done"
          aria-labelledby={`${headingId}-done`}
        >
          <h3 id={`${headingId}-done`} className="mc-pend-done__heading">
            <button
              type="button"
              data-focus="done-toggle"
              onClick={() => setDoneOpen((open) => !open)}
              aria-expanded={doneOpen}
              aria-controls={`${headingId}-done-list`}
              className="mc-pend-done__toggle"
            >
              <span className="mc-pend-done__label">
                <Check className="mc-pend-icon" aria-hidden="true" />
                Hechas
                <span className="mc-pend-count">{doneTasks.length}</span>
              </span>
              <ChevronDown
                className={cn("mc-pend-icon", doneOpen && "mc-pend-done__chevron--open")}
                aria-hidden="true"
              />
            </button>
          </h3>

          <div id={`${headingId}-done-list`} hidden={!doneOpen}>
            {doneTasks.length === 0 ? (
              <p className="mc-pend-done__empty">
                Aún no has completado tareas.
              </p>
            ) : (
              <ul className="mc-pend-done__list" aria-label="Tareas hechas">
                {doneTasks.map((task) => (
                  <li key={task.id} className="mc-pend-done__item">
                    <div className="mc-pend-done__copy">
                      <span className="mc-pend-done__icon" aria-hidden="true">
                        <Check className="mc-pend-icon" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="mc-pend-done__title">{task.title}</p>
                        <p className="mc-pend-done__meta">
                          {completedLabel(task, now)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-focus={`reopen-${task.id}`}
                      onClick={() => void runAction(task.id, "reopen")}
                      disabled={actionsDisabled}
                      className="mc-pend-task__action"
                    >
                      <RotateCcw className="mc-pend-icon" aria-hidden="true" />
                      Reabrir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
