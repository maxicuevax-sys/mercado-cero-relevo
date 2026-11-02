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
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";
import type { Task } from "@/lib/types";

const MEXICO_TZ = "America/Mexico_City";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MEXICO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

function mexicoDateKey(date: Date): string {
  const parts = dateKeyFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function mexicoMidnight(key: string): Date {
  // México ya no usa horario de verano: UTC-6 todo el año.
  return new Date(`${key}T00:00:00-06:00`);
}

function mexicoAt(daysAhead: number, hour: number, now = new Date()): Date {
  return new Date(
    mexicoMidnight(mexicoDateKey(now)).getTime() +
      daysAhead * DAY_MS +
      hour * HOUR_MS,
  );
}

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

/**
 * Hora del cliente sin leer `Date.now()` durante el render: el snapshot del
 * servidor es null y el primer render hidratado coincide. Después se actualiza
 * cada minuto. Evita que Next prerenderice “hoy” con la hora del build.
 */
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
type FormErrorField = "title" | "note" | "date";

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
  if (!task.completedAt) return "Hecho";
  const date = new Date(task.completedAt);
  if (Number.isNaN(date.getTime())) return "Hecho";
  if (now && mexicoDateKey(date) === mexicoDateKey(now)) return "Hecho hoy";
  return `Hecho el ${shortDate(date)}`;
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
  if (response.status === 404) return "Ese pendiente ya no existe.";
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

export interface PendingTasksPanelProps {
  /** Ruta base de la API. Por defecto `/api/tasks`. */
  apiBase?: string;
  /** Id del h1 para que el shell pueda enfocarlo al cambiar de tab. */
  headingId?: string;
  /** Se llama con la lista vigente después de cargar o cambiar algo. */
  onTasksChange?: (tasks: Task[]) => void;
}

export function PendingTasksPanel({
  apiBase = "/api/tasks",
  headingId,
  onTasksChange,
}: PendingTasksPanelProps) {
  const generatedHeadingId = useId();
  const resolvedHeadingId = headingId ?? generatedHeadingId;
  const formTitleId = useId();
  const formNoteId = useId();
  const formDateId = useId();
  const formErrorId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const onTasksChangeRef = useRef(onTasksChange);
  const inFlight = useRef<Set<string>>(new Set());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorField, setFormErrorField] = useState<FormErrorField | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const [postponeId, setPostponeId] = useState<string | null>(null);
  const [pickingDateId, setPickingDateId] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  useEffect(() => {
    onTasksChangeRef.current = onTasksChange;
  }, [onTasksChange]);

  const commit = useCallback((next: Task[]) => {
    setTasks(next);
    onTasksChangeRef.current?.(next);
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(apiBase, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        });
        if (!response.ok) {
          throw new Error(await responseError(response));
        }
        const body = (await response.json()) as { tasks?: unknown };
        if (!Array.isArray(body.tasks)) {
          throw new Error("La respuesta del servidor no trae la lista de pendientes.");
        }
        const next = (body.tasks as Task[])
          .filter((task) => task.status === "open" || task.status === "done")
          .sort(sortTasks);
        commit(next);
        setLoadState("ready");
      } catch (error) {
        if (signal?.aborted) return;
        setLoadError(
          humanError(error, "No pude cargar tus pendientes. Intenta de nuevo."),
        );
        setLoadState("error");
      }
    },
    [apiBase, commit],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Diferido un tick para no encadenar renders desde el cuerpo del efecto.
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const retryLoad = useCallback(() => {
    setLoadState("loading");
    setLoadError(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (formOpen) titleInputRef.current?.focus();
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

  const openTasks = tasks.filter((task) => task.status === "open");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const actionsDisabled = busyId !== null || saving;
  const clock = useClock();
  const now = clock === null ? null : new Date(clock * MINUTE_MS);
  const todayKey = now ? mexicoDateKey(now) : undefined;

  function openForm() {
    setFormError(null);
    setFormErrorField(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormError(null);
    setFormErrorField(null);
    setFocusTarget("create");
  }

  function clearFormError() {
    if (formError) {
      setFormError(null);
      setFormErrorField(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormErrorField(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Escribe qué quieres recordar.");
      setFormErrorField("title");
      titleInputRef.current?.focus();
      return;
    }
    if (cleanTitle.length > 120) {
      setFormError("El título no puede pasar de 120 caracteres.");
      setFormErrorField("title");
      titleInputRef.current?.focus();
      return;
    }
    if (note.trim().length > 500) {
      setFormError("La nota no puede pasar de 500 caracteres.");
      setFormErrorField("note");
      return;
    }

    let dueAt: string | null = null;
    if (dueDate) {
      dueAt = dateInputToIso(dueDate);
      if (!dueAt) {
        setFormError("Elige una fecha válida.");
        setFormErrorField("date");
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: cleanTitle,
          note: note.trim() || null,
          dueAt,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = (await response.json()) as { task?: Task };
      if (!body.task) {
        throw new Error("El servidor no devolvió el pendiente guardado.");
      }
      const created = body.task;
      commit(
        [...tasks.filter((task) => task.id !== created.id), created].sort(
          sortTasks,
        ),
      );
      setTitle("");
      setNote("");
      setDueDate("");
      setFormOpen(false);
      setFormErrorField(null);
      setAnnouncement(`Pendiente anotado: ${created.title}.`);
      setFocusTarget(`complete-${created.id}`);
    } catch (error) {
      setFormError(humanError(error, "No pude guardar el pendiente."));
      setFormErrorField(null);
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
      const response = await fetch(`${apiBase}/${encodeURIComponent(id)}`, {
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
        if (response.status === 404) {
          commit(tasks.filter((task) => task.id !== id));
        }
        throw new Error(await responseError(response));
      }

      const body = (await response.json()) as { task?: Task };
      if (!body.task) {
        throw new Error("El servidor no devolvió el pendiente actualizado.");
      }

      const updated = body.task;
      const next =
        action === "delete"
          ? tasks.filter((task) => task.id !== id)
          : [...tasks.filter((task) => task.id !== id), updated].sort(sortTasks);
      commit(next);

      if (action === "delete") {
        setDeleteId(null);
        const nextOpen = next.find((task) => task.status === "open");
        setFocusTarget(nextOpen ? `complete-${nextOpen.id}` : "create");
        setAnnouncement("Pendiente eliminado.");
      } else if (action === "complete") {
        setDoneOpen(true);
        const nextOpen = next.find((task) => task.status === "open");
        setFocusTarget(nextOpen ? `complete-${nextOpen.id}` : "create");
        setAnnouncement("Pendiente completado. Lo encuentras en Hechas.");
      } else if (action === "reopen") {
        setFocusTarget(`complete-${id}`);
        setAnnouncement("Pendiente reabierto.");
      } else {
        setPostponeId(null);
        setPickingDateId(null);
        setPickedDate("");
        setFocusTarget(`postpone-${id}`);
        setAnnouncement("Pendiente pospuesto.");
      }
    } catch (error) {
      setActionError(humanError(error, "No pude actualizar el pendiente."));
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

  function postponeTo(id: string, iso: string) {
    void runAction(id, "postpone", iso);
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
    postponeTo(id, iso);
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

  const dateTone: Record<DueTone, string> = {
    overdue: "text-danger",
    today: "text-attention",
    soon: "text-ink-2",
    none: "text-ink-2",
  };

  return (
    <div ref={rootRef} className="min-w-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            id={resolvedHeadingId}
            data-sheet-fallback
            tabIndex={-1}
            className="heading-in min-w-0 text-[1.75rem] font-semibold leading-tight tracking-tight text-ink outline-none"
          >
            Pendientes
          </h1>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
            Lo que queda para después.
          </p>
        </div>
        <button
          type="button"
          data-focus="create"
          onClick={openForm}
          aria-expanded={formOpen}
          aria-controls="pendientes-form"
          className="on-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-press"
        >
          <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
          Anotar pendiente
        </button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {formOpen ? (
        <form
          id="pendientes-form"
          onSubmit={handleCreate}
          noValidate
          className="mb-5 rounded-2xl border border-separator bg-surface p-4 shadow-card"
        >
          <div className="min-w-0">
            <label
              htmlFor={formTitleId}
              className="block text-sm font-semibold text-ink"
            >
              ¿Qué quieres recordar?
            </label>
            <input
              ref={titleInputRef}
              id={formTitleId}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                clearFormError();
              }}
              maxLength={120}
              autoComplete="off"
              aria-invalid={formErrorField === "title"}
              aria-describedby={
                formErrorField === "title" ? formErrorId : undefined
              }
              className="mt-1.5 min-h-12 w-full rounded-xl border border-separator bg-canvas px-3 py-2 text-ink placeholder:text-ink-2/70"
              placeholder="Pagar al proveedor"
            />
            <p className="mt-1 text-right text-xs text-ink-2">
              {title.length}/120
            </p>
          </div>

          <div className="mt-3 min-w-0">
            <label
              htmlFor={formNoteId}
              className="block text-sm font-semibold text-ink"
            >
              Nota <span className="font-normal text-ink-2">(opcional)</span>
            </label>
            <textarea
              id={formNoteId}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                clearFormError();
              }}
              maxLength={500}
              rows={2}
              aria-invalid={formErrorField === "note"}
              aria-describedby={
                formErrorField === "note" ? formErrorId : undefined
              }
              className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-separator bg-canvas px-3 py-2 text-ink placeholder:text-ink-2/70"
              placeholder="A las 11, por la puerta de atrás"
            />
            <p className="mt-1 text-right text-xs text-ink-2">
              {note.length}/500
            </p>
          </div>

          <div className="mt-3 min-w-0">
            <label
              htmlFor={formDateId}
              className="block text-sm font-semibold text-ink"
            >
              Fecha <span className="font-normal text-ink-2">(opcional)</span>
            </label>
            <input
              id={formDateId}
              type="date"
              value={dueDate}
              min={todayKey}
              onChange={(event) => {
                setDueDate(event.target.value);
                clearFormError();
              }}
              aria-invalid={formErrorField === "date"}
              aria-describedby={
                formErrorField === "date" ? formErrorId : undefined
              }
              className="mt-1.5 min-h-12 w-full rounded-xl border border-separator bg-canvas px-3 py-2 text-ink sm:max-w-64"
            />
            <p className="mt-1 text-xs text-ink-2">
              Si no eliges fecha, queda en la lista sin día.
            </p>
          </div>

          {formError ? (
            <p
              id={formErrorId}
              role="alert"
              className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2 text-sm font-medium text-danger"
            >
              {formError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="on-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-5 w-5" aria-hidden="true" />
              )}
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-5 w-5" aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-danger/30 bg-terracotta-soft px-4 py-3"
        >
          <div className="flex min-w-0 gap-2">
            <CircleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-danger"
              aria-hidden="true"
            />
            <p className="min-w-0 text-sm font-medium text-danger">
              {actionError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="inline-flex min-h-12 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-danger hover:bg-white/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cerrar
          </button>
        </div>
      ) : null}

      {loadState === "error" && tasks.length > 0 ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-terracotta-soft px-4 py-3"
        >
          <p className="min-w-0 text-sm font-medium text-danger">
            No pude actualizar tus pendientes. Esto es lo último que vi.
          </p>
          <button
            type="button"
            onClick={retryLoad}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-danger/40 bg-surface px-3 text-sm font-semibold text-danger hover:bg-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : null}

      {loadState === "loading" && tasks.length === 0 ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando pendientes…</span>
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="shimmer h-24 rounded-2xl border border-separator bg-surface-2"
              />
            ))}
          </div>
        </div>
      ) : loadState === "error" && tasks.length === 0 ? (
        <div
          role="alert"
          className="rounded-2xl border border-danger/30 bg-terracotta-soft p-4"
        >
          <div className="flex gap-3">
            <CircleAlert
              className="mt-0.5 h-6 w-6 shrink-0 text-danger"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-danger">
                No pude cargar tus pendientes
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                {loadError ?? "Revisa tu conexión e intenta de nuevo."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-danger/40 bg-surface px-4 text-sm font-semibold text-danger hover:bg-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : loadState === "ready" && openTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-separator bg-surface px-5 py-6 text-center">
          <p className="text-[1.0625rem] font-semibold text-ink">
            {doneTasks.length > 0
              ? "No hay pendientes abiertos."
              : "No hay pendientes."}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Anota algo para después.
          </p>
          <button
            type="button"
            onClick={openForm}
            className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-press"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            Anotar pendiente
          </button>
        </div>
      ) : (
        <ul aria-label="Pendientes abiertos" className="motion-list space-y-3">
          {openTasks.map((task) => {
            const due = dueMeta(task, now);
            const isBusy = busyId === task.id;
            const isPostponing = postponeId === task.id;
            const isPickingDate = pickingDateId === task.id;
            const isDeleting = deleteId === task.id;

            return (
              <li
                key={task.id}
                aria-busy={isBusy}
                className={cn(
                  "rounded-2xl border border-separator bg-surface p-3 shadow-card transition sm:p-4",
                  isBusy && "opacity-70",
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={false}
                    aria-label={`Completar: ${task.title}`}
                    title={`Completar: ${task.title}`}
                    data-focus={`complete-${task.id}`}
                    disabled={actionsDisabled}
                    onClick={() => void runAction(task.id, "complete")}
                    className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-separator bg-surface text-ink-2 transition hover:border-accent hover:bg-green-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-[1.0625rem] font-semibold leading-snug text-ink">
                      {task.title}
                    </h2>
                    {task.note ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">
                        {task.note}
                      </p>
                    ) : null}

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          dateTone[due.tone],
                        )}
                      >
                        <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {due.text}
                      </span>
                      {task.postponedUntil ? (
                        <span className="rounded-full bg-blue-soft px-2 py-0.5 text-xs font-semibold text-info">
                          Pospuesto
                        </span>
                      ) : null}
                      {isBusy ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          Guardando…
                        </span>
                      ) : null}
                    </div>

                    {!isDeleting ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-focus={`postpone-${task.id}`}
                          onClick={() => startPostpone(task.id)}
                          disabled={actionsDisabled}
                          aria-expanded={isPostponing}
                          aria-controls={`postpone-${task.id}`}
                          className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CalendarDays
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          Posponer
                        </button>
                        <button
                          type="button"
                          data-focus={`delete-${task.id}`}
                          onClick={() => startDelete(task.id)}
                          disabled={actionsDisabled}
                          className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger transition hover:bg-terracotta-soft disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <div
                        className="mt-2 rounded-xl border border-danger/30 bg-terracotta-soft p-3"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            cancelDelete(task.id);
                          }
                        }}
                      >
                        <p className="text-sm font-semibold text-ink">
                          ¿Eliminar “{task.title}”?
                        </p>
                        <p className="mt-0.5 text-xs text-ink-2">
                          Dejará de aparecer en tu lista. No se puede deshacer
                          desde aquí.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-focus={`delete-cancel-${task.id}`}
                            onClick={() => cancelDelete(task.id)}
                            className="inline-flex min-h-12 items-center rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
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
                            className="on-accent inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-danger px-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2
                              className="h-4 w-4 shrink-0"
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
                        className="mt-2 rounded-xl border border-separator bg-surface-2 p-2"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            closePostpone(task.id);
                          }
                        }}
                      >
                        <p className="px-2 pb-1 text-xs font-semibold text-ink-2">
                          ¿Para cuándo?
                        </p>
                        <div className="grid gap-1 sm:grid-cols-2">
                          <button
                            type="button"
                            data-focus={`postpone-first-${task.id}`}
                            onClick={() =>
                              postponeTo(task.id, laterTodayIso())
                            }
                            disabled={actionsDisabled}
                            className="inline-flex min-h-12 items-center rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Más tarde hoy
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              postponeTo(task.id, mexicoAt(1, 9).toISOString())
                            }
                            disabled={actionsDisabled}
                            className="inline-flex min-h-12 items-center rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Mañana
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              postponeTo(task.id, mexicoAt(7, 9).toISOString())
                            }
                            disabled={actionsDisabled}
                            className="inline-flex min-h-12 items-center rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="inline-flex min-h-12 items-center rounded-lg px-2 text-left text-sm font-semibold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Elegir fecha
                          </button>
                        </div>

                        {isPickingDate ? (
                          <div className="mt-2 rounded-lg border border-separator bg-surface p-2">
                            <label
                              htmlFor={`pick-date-${task.id}`}
                              className="block text-xs font-semibold text-ink"
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
                              className="mt-1 min-h-12 w-full rounded-lg border border-separator bg-canvas px-2 py-1 text-sm text-ink"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => submitPickedDate(task.id)}
                                disabled={actionsDisabled || !pickedDate}
                                className="on-accent inline-flex min-h-12 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
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
                                className="inline-flex min-h-12 items-center rounded-lg border border-separator bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => closePostpone(task.id)}
                            className="inline-flex min-h-12 items-center rounded-lg px-2 text-sm font-semibold text-ink-2 hover:text-ink"
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

      <section className="mt-8" aria-labelledby={`${resolvedHeadingId}-hechas`}>
        <h2 id={`${resolvedHeadingId}-hechas`} className="text-base">
          <button
            type="button"
            data-focus="done-toggle"
            onClick={() => setDoneOpen((open) => !open)}
            aria-expanded={doneOpen}
            aria-controls="pendientes-hechas"
            className="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-separator bg-surface px-3 text-left text-sm font-semibold text-ink transition hover:bg-surface-2"
          >
            <span className="inline-flex items-center gap-2">
              <Check className="h-5 w-5 text-accent" aria-hidden="true" />
              Hechas
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                {doneTasks.length}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 text-ink-2 transition-transform",
                doneOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        </h2>

        <div id="pendientes-hechas" hidden={!doneOpen} className="mt-2">
          {doneTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-separator px-4 py-4 text-sm text-ink-2">
              Aún no has completado pendientes.
            </p>
          ) : (
            <ul aria-label="Pendientes hechos" className="motion-list space-y-2">
              {doneTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-separator bg-surface px-3 py-2"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-soft text-accent">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-ink-2">
                        {task.title}
                      </p>
                      <p className="text-xs text-ink-2">
                        {completedLabel(task, now)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-focus={`reopen-${task.id}`}
                    onClick={() => void runAction(task.id, "reopen")}
                    disabled={actionsDisabled}
                    className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Reabrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default PendingTasksPanel;
