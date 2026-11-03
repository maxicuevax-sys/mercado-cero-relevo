"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  addDaysToDateKey,
  mexicoAt,
  mexicoDateKey,
  MEXICO_TZ,
} from "@/lib/mexico-date";
import { formatMxn, shortOrder } from "@/lib/format";
import type { Order, Task } from "@/lib/types";

const MINUTE_MS = 60 * 1000;
const TOMORROW_LIMIT = 5;
const DISMISS_KEY = "mercado-cero:antes-de-cerrar:oculto:v1";
const SUGGESTIONS_KEY = "mercado-cero:companion:suggestions";

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

type TaskGroup = "overdue" | "today" | "tomorrow";
type TaskAction = "complete" | "postpone";

interface ClosingChecklistProps {
  /** Solo se lee y se muestra cuando la pestaña Corte está activa. */
  active: boolean;
  /** Cobros ya cargados por el dashboard; no se pide otra lectura. */
  pendingOrders: Order[];
  onOpenOrder: (order: Order) => void;
  onGoToTasks: () => void;
}

function subscribeToClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

function clockSnapshot(): number {
  return Math.floor(Date.now() / MINUTE_MS);
}

function serverClockSnapshot(): null {
  return null;
}

function useClock(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    clockSnapshot,
    serverClockSnapshot,
  );
}

/**
 * Preferencia compartida con el carril de acompañamiento. Solo se lee: si la
 * persona apagó las sugerencias, esta tarjeta no aparece. Los avisos críticos
 * de dinero viven fuera de ella y no se tocan.
 */
function suggestionsAreOff(): boolean {
  try {
    return (
      window.localStorage.getItem(SUGGESTIONS_KEY) === "off"
    );
  } catch {
    return false;
  }
}

function subscribeToSuggestions(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener("focus", handler);
  // Evento para una futura pantalla de preferencias en la misma pestaña.
  window.addEventListener("mercado:preferences", handler);
  window.addEventListener("mercado-cero:companion-changed", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("focus", handler);
    window.removeEventListener("mercado:preferences", handler);
    window.removeEventListener("mercado-cero:companion-changed", handler);
  };
}

function serverSuggestionsOff(): boolean {
  return false;
}

function useSuggestionsOff(): boolean {
  return useSyncExternalStore(
    subscribeToSuggestions,
    suggestionsAreOff,
    serverSuggestionsOff,
  );
}

function taskDueIso(task: Task): string | null {
  return task.postponedUntil ?? task.dueAt;
}

function taskDueTime(task: Task): number | null {
  const iso = taskDueIso(task);
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

function taskGroup(task: Task, now: Date): TaskGroup | null {
  const iso = taskDueIso(task);
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const today = mexicoDateKey(now);
  const dueKey = mexicoDateKey(due);
  if (dueKey < today) return "overdue";
  if (dueKey === today) return "today";
  if (dueKey === addDaysToDateKey(today, 1)) return "tomorrow";
  return null;
}

function dueLabel(task: Task, group: TaskGroup): string {
  const iso = taskDueIso(task);
  if (!iso) return "Sin fecha";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "Sin fecha";
  const date = shortDateFormatter.format(due).replace(/\.$/, "");
  if (group === "overdue") return `Venció el ${date}`;
  if (group === "tomorrow") {
    return `Para mañana, ${timeFormatter.format(due)}`;
  }
  return `Para hoy, ${timeFormatter.format(due)}`;
}

/** Saldo digital por cobrar. No incluye el fiado: ese vive en su libreta. */
function pendingBalanceCents(order: Order): number {
  const total = Number.isFinite(order.totalCents) ? order.totalCents : 0;
  const paid = Number.isFinite(order.paidCents) ? order.paidCents : 0;
  const credit = Number.isFinite(order.creditCents) ? order.creditCents : 0;
  return Math.max(0, total - paid - credit);
}

function isUnconfirmedOrder(order: Order): boolean {
  return (
    (order.status === "confirmed" ||
      order.status === "payment_pending" ||
      order.status === "partially_paid") &&
    pendingBalanceCents(order) > 0
  );
}

function compareTasks(a: Task, b: Task): number {
  const aDue = taskDueTime(a) ?? Number.MAX_SAFE_INTEGER;
  const bDue = taskDueTime(b) ?? Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;
  return a.title.localeCompare(b.title, "es") || a.id.localeCompare(b.id);
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Respuesta sin JSON: se usa el mensaje neutro.
  }
  if (response.status === 404) return "Ese pendiente ya no existe.";
  return "No pude actualizar el pendiente. Intenta de nuevo.";
}

function actionErrorMessage(error: unknown, action: TaskAction): string {
  const verb = action === "complete" ? "completar" : "posponer";
  if (
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|networkerror|load failed|fetch failed/i.test(error.message))
  ) {
    return `No pude ${verb} el pendiente. Revisa tu conexión e intenta de nuevo.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return `No pude ${verb} el pendiente. Intenta de nuevo.`;
}

/**
 * Lista determinista de lo que conviene revisar antes del corte. No usa IA ni
 * infiere estados: solo muestra tareas con fecha de hoy, vencidas o de mañana
 * (máximo 5), y los cobros que el dashboard ya reporta como no confirmados.
 */
export function ClosingChecklist({
  active,
  pendingOrders,
  onOpenOrder,
  onGoToTasks,
}: ClosingChecklistProps) {
  const titleId = useId();
  const tomorrowId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const loadSeq = useRef(0);
  const suggestionsOff = useSuggestionsOff();

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState<{ id: string; action: TaskAction } | null>(
    null,
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    const seq = ++loadSeq.current;
    setLoadState("loading");
    setLoadError(null);
    try {
      const response = await fetch("/api/tasks?limit=200", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        throw new Error("No pude leer los pendientes.");
      }
      const body = (await response.json()) as { tasks?: unknown };
      if (!Array.isArray(body.tasks)) {
        throw new Error("No pude leer los pendientes.");
      }
      if (seq !== loadSeq.current) return;
      setTasks(
        (body.tasks as Task[]).filter((task) => task.status === "open"),
      );
      setLoadState("ready");
    } catch {
      if (signal?.aborted || seq !== loadSeq.current) return;
      setLoadError("No pude leer los pendientes. Puedes cerrar igual.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!active || dismissed || suggestionsOff) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, dismissed, load, suggestionsOff]);

  const clock = useClock();
  const groups = useMemo(() => {
    const result: Record<TaskGroup, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
    };
    if (clock === null) return result;
    const now = new Date(clock * MINUTE_MS);
    for (const task of tasks) {
      const group = taskGroup(task, now);
      if (group) result[group].push(task);
    }
    result.overdue.sort(compareTasks);
    result.today.sort(compareTasks);
    result.tomorrow.sort(compareTasks);
    return result;
  }, [clock, tasks]);

  const chargeRows = useMemo(
    () =>
      pendingOrders
        .filter(isUnconfirmedOrder)
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id),
        ),
    [pendingOrders],
  );

  const tomorrowExtra = Math.max(0, groups.tomorrow.length - TOMORROW_LIMIT);
  const visibleTomorrow = groups.tomorrow.slice(0, TOMORROW_LIMIT);
  const hasTasks =
    groups.overdue.length > 0 ||
    groups.today.length > 0 ||
    visibleTomorrow.length > 0;
  const nothingToShow = loadState === "ready" && !hasTasks && chargeRows.length === 0;

  function dismissCard() {
    setDismissed(true);
    setAnnouncement(
      "Lista oculta en esta sesión. Los cobros pendientes siguen en Caja.",
    );
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sin sessionStorage, se oculta solo en esta vista.
    }
    window.requestAnimationFrame(() => {
      document.getElementById("corte-heading")?.focus();
    });
  }

  async function runTaskAction(task: Task, action: TaskAction) {
    if (busy) return;
    setBusy({ id: task.id, action });
    setActionError(null);
    try {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(task.id)}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            action === "postpone"
              ? { action, postponeUntil: mexicoAt(1, 9).toISOString() }
              : { action },
          ),
        },
      );
      if (!response.ok) {
        if (response.status === 404 || response.status === 409) {
          void load();
        }
        throw new Error(await responseError(response));
      }
      const body = (await response.json()) as { task?: Task };
      if (!body.task) {
        throw new Error("El servidor no devolvió el pendiente actualizado.");
      }
      if (action === "complete") {
        setTasks((current) => current.filter((item) => item.id !== task.id));
        setAnnouncement(`Completado: ${task.title}.`);
      } else {
        // La tarea sigue visible, ahora en “Para mañana”.
        setTasks((current) =>
          current.map((item) => (item.id === task.id ? body.task! : item)),
        );
        setAnnouncement(`Pospuesto para mañana: ${task.title}.`);
      }
      headingRef.current?.focus();
    } catch (error) {
      const message = actionErrorMessage(error, action);
      setActionError(message);
      setAnnouncement(message);
    } finally {
      setBusy(null);
    }
  }

  if (!active || suggestionsOff) return null;

  const taskRow = (task: Task, group: TaskGroup) => {
    const isBusy = busy?.id === task.id;
    const isCompleteBusy = isBusy && busy?.action === "complete";
    const isPostponeBusy = isBusy && busy?.action === "postpone";
    return (
      <li key={task.id} className="border-t border-separator py-3 first:border-t-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="break-words text-[1.0625rem] font-semibold leading-snug text-ink">
              {task.title}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {dueLabel(task, group)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runTaskAction(task, "complete")}
              disabled={Boolean(busy)}
              aria-label={`Completar: ${task.title}`}
              aria-busy={isCompleteBusy}
              className="on-accent inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              {isCompleteBusy ? "Completando…" : "Completar"}
            </button>
            <button
              type="button"
              onClick={() => void runTaskAction(task, "postpone")}
              disabled={Boolean(busy)}
              aria-label={`Posponer a mañana: ${task.title}`}
              aria-busy={isPostponeBusy}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              {isPostponeBusy ? "Posponiendo…" : "Posponer a mañana"}
            </button>
            <a
              href="#pendientes-heading"
              onClick={(event) => {
                event.preventDefault();
                onGoToTasks();
              }}
              className="inline-flex min-h-12 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-2 hover:text-ink"
            >
              Ver en Pendientes
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {dismissed ? null : (
        <section
          aria-labelledby={titleId}
          className="book-sheet border border-separator p-4 sm:p-[20px]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                ref={headingRef}
                id={titleId}
                tabIndex={-1}
                className="text-[1.375rem] font-semibold tracking-tight text-ink"
              >
                Antes de cerrar
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Lo que vence hoy, lo vencido y lo de mañana. También los cobros
                por confirmar.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissCard}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-separator bg-surface px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              Ahora no
            </button>
          </div>

          {loadState === "loading" ? (
            <p role="status" className="mt-4 text-sm text-ink-2">
              Revisando pendientes de hoy y de mañana…
            </p>
          ) : null}

          {loadState === "error" ? (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-attention/30 bg-terracotta-soft/70 px-4 py-3"
            >
              <div className="flex min-w-0 gap-2">
                <CircleAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-attention"
                  aria-hidden="true"
                />
                <p className="min-w-0 text-sm font-medium text-ink">
                  {loadError ?? "No pude leer los pendientes. Puedes cerrar igual."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reintentar
              </button>
            </div>
          ) : null}

          {loadState === "ready" && hasTasks ? (
            <div className="mt-4 space-y-4">
              {groups.overdue.length > 0 ? (
                <section aria-labelledby={`${titleId}-vencidos`}>
                  <h3
                    id={`${titleId}-vencidos`}
                    className="text-sm font-bold uppercase tracking-wide text-ink-2"
                  >
                    Vencidos
                  </h3>
                  <ul className="mt-1">
                    {groups.overdue.map((task) => taskRow(task, "overdue"))}
                  </ul>
                </section>
              ) : null}

              {groups.today.length > 0 ? (
                <section aria-labelledby={`${titleId}-hoy`}>
                  <h3
                    id={`${titleId}-hoy`}
                    className="text-sm font-bold uppercase tracking-wide text-ink-2"
                  >
                    Para hoy
                  </h3>
                  <ul className="mt-1">
                    {groups.today.map((task) => taskRow(task, "today"))}
                  </ul>
                </section>
              ) : null}

              {visibleTomorrow.length > 0 ? (
                <section aria-labelledby={tomorrowId}>
                  <h3
                    id={tomorrowId}
                    className="text-sm font-bold uppercase tracking-wide text-ink-2"
                  >
                    Para mañana
                  </h3>
                  <ul className="mt-1">
                    {visibleTomorrow.map((task) =>
                      taskRow(task, "tomorrow"),
                    )}
                  </ul>
                  {tomorrowExtra > 0 ? (
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">
                      Hay {tomorrowExtra}{" "}
                      {tomorrowExtra === 1 ? "pendiente más" : "pendientes más"}{" "}
                      para mañana.{" "}
                      <a
                        href="#pendientes-heading"
                        onClick={(event) => {
                          event.preventDefault();
                          onGoToTasks();
                        }}
                        className="inline-flex min-h-12 items-center font-semibold text-ink underline underline-offset-2"
                      >
                        Ver en Pendientes
                      </a>
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}

          {chargeRows.length > 0 ? (
            <section
              aria-labelledby={`${titleId}-cobros`}
              className="mt-4 border-t border-separator pt-4"
            >
              <h3
                id={`${titleId}-cobros`}
                className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-2"
              >
                <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
                Cobros por confirmar
              </h3>
              <ul className="mt-1">
                {chargeRows.map((order) => {
                  const balance = pendingBalanceCents(order);
                  return (
                    <li
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-separator py-3 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <p className="tabular text-[1.0625rem] font-semibold text-ink">
                          {formatMxn(balance)}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-2">
                          <span className="inline-flex items-center gap-1 font-semibold text-attention">
                            <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                            Esperando confirmación
                          </span>
                          <span>Pedido {shortOrder(order.id)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenOrder(order)}
                        aria-label={`Ver cobro: ${shortOrder(order.id)}, ${formatMxn(balance)}`}
                        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-separator bg-surface px-3 text-sm font-semibold text-accent hover:bg-green-soft hover:text-accent-press"
                      >
                        Ver
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {actionError ? (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-attention/30 bg-terracotta-soft/70 px-4 py-3"
            >
              <div className="flex min-w-0 gap-2">
                <CircleAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-attention"
                  aria-hidden="true"
                />
                <p className="min-w-0 text-sm font-medium text-ink">
                  {actionError}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-semibold text-ink-2 hover:text-ink"
              >
                Cerrar
              </button>
            </div>
          ) : null}

          {nothingToShow ? (
            <p className="mt-4 rounded-xl border border-dashed border-separator px-4 py-4 text-sm leading-relaxed text-ink-2">
              No hay pendientes para hoy. Puedes cerrar cuando quieras.
            </p>
          ) : null}
        </section>
      )}
    </>
  );
}

export default ClosingChecklist;
