"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import {
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  Coins,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/format";
import {
  addDaysToDateKey,
  MEXICO_TZ,
  mexicoAt,
  mexicoDateKey,
} from "@/lib/mexico-date";
import type { Task } from "@/lib/types";
import listaIcon from "@/assets/brand/iconos/transparent/lista.png";
import tasksArt from "@/assets/definitive-a/tasks.png";
import { humanError, responseError, splitTaskNote } from "./task-money";

/*
 * Bandeja de /pendientes (ref. 08).
 *
 * La pestaña "Hoy" muestra las tareas abiertas y "Completados" las hechas.
 * Completar y reabrir persisten con `PATCH /api/tasks/[id]`; posponer y
 * eliminar conservan la lógica que ya existía. El alta vive en
 * `/pendientes/nuevo` con `POST /api/tasks` (contrato sin cambios).
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type Tab = "open" | "done";

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

/** Hora del cliente sin leer `Date.now()` durante el render. */
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

/** Mismo orden que `compareTasks` de `lib/tasks.ts` (no entra al bundle). */
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

function dueInfo(
  task: Task,
  now: Date | null,
): { full: string; short: string; tone: DueTone } {
  const iso = task.postponedUntil ?? task.dueAt;
  if (!iso) return { full: "Sin fecha", short: "", tone: "none" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { full: "Sin fecha", short: "", tone: "none" };
  }

  if (!now) {
    return {
      full: `Vence el ${shortDate(date)}`,
      short: shortDate(date),
      tone: "soon",
    };
  }

  const today = mexicoDateKey(now);
  const due = mexicoDateKey(date);

  if (due < today) {
    return {
      full: `Venció el ${shortDate(date)}`,
      short: due === addDaysToDateKey(today, -1) ? "Ayer" : shortDate(date),
      tone: "overdue",
    };
  }
  if (due === today) {
    const time = timeFormatter.format(date);
    return { full: `Para hoy, ${time}`, short: time, tone: "today" };
  }
  if (due === addDaysToDateKey(today, 1)) {
    return { full: "Para mañana", short: "Mañana", tone: "soon" };
  }
  return {
    full: `Vence el ${shortDate(date)}`,
    short: shortDate(date),
    tone: "soon",
  };
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

export function TasksPanel({
  initialTasks,
  totalCount,
}: {
  /** Tareas ya leídas en el servidor (`listTasks`). */
  initialTasks: Task[];
  /** Total de tareas registradas (`countTasks`), para la nota al pie. */
  totalCount: number;
}) {
  const base = useId();
  const summaryTitleId = `${base}-summary`;
  const tabOpenId = `${base}-tab-open`;
  const tabDoneId = `${base}-tab-done`;
  const panelOpenId = `${base}-panel-open`;
  const panelDoneId = `${base}-panel-done`;
  const searchId = `${base}-search`;

  const rootRef = useRef<HTMLElement>(null);
  const tabOpenRef = useRef<HTMLButtonElement>(null);
  const tabDoneRef = useRef<HTMLButtonElement>(null);

  const [tasks, setTasks] = useState<Task[]>(() =>
    [...initialTasks].sort(sortTasks),
  );
  const [tab, setTab] = useState<Tab>("open");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [postponeId, setPostponeId] = useState<string | null>(null);
  const [pickingDateId, setPickingDateId] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const clock = useClock();
  const now = clock === null ? null : new Date(clock * MINUTE_MS);
  const todayKey = now ? mexicoDateKey(now) : undefined;

  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
  const matches = (task: Task) => {
    if (!normalizedQuery) return true;
    const { note } = splitTaskNote(task.note);
    return `${task.title} ${note ?? ""}`
      .toLocaleLowerCase("es-MX")
      .includes(normalizedQuery);
  };

  const openAll = tasks.filter((task) => task.status === "open");
  const doneAll = tasks.filter((task) => task.status === "done");
  const openTasks = openAll.filter(matches);
  const doneTasks = doneAll.filter(matches);
  const amountsCents = openAll.reduce(
    (sum, task) => sum + (splitTaskNote(task.note).amountCents ?? 0),
    0,
  );
  const actionsDisabled = busyId !== null;
  const totalLabel =
    totalCount > tasks.length
      ? `Mostrando ${tasks.length} de ${totalCount} pendientes.`
      : null;

  const commit = useCallback((next: Task[]) => {
    setTasks(next.filter((task) => task.status !== "deleted").sort(sortTasks));
  }, []);

  useEffect(() => {
    if (!focusTarget) return;
    const root = rootRef.current;
    if (!root) return;
    const element = Array.from(
      root.querySelectorAll<HTMLElement>("[data-focus]"),
    ).find(
      (node) =>
        node.dataset.focus === focusTarget && node.getClientRects().length > 0,
    );
    if (element) {
      element.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, tasks, tab]);

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    if (
      key !== "ArrowLeft" &&
      key !== "ArrowRight" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const next: Tab =
      key === "Home"
        ? "open"
        : key === "End"
          ? "done"
          : tab === "open"
            ? "done"
            : "open";
    setTab(next);
    (next === "open" ? tabOpenRef.current : tabDoneRef.current)?.focus();
  }

  function toggleMenu(id: string) {
    setActionError(null);
    setDeleteId(null);
    setPostponeId(null);
    setPickingDateId(null);
    setPickedDate("");
    setMenuId((current) => (current === id ? null : id));
  }

  function closeMenu(id?: string) {
    setMenuId(null);
    if (id) setFocusTarget(`menu-${id}`);
  }

  function startPostpone(id: string) {
    setActionError(null);
    setMenuId(null);
    setDeleteId(null);
    setPickingDateId(null);
    setPickedDate("");
    setPostponeId(id);
    setFocusTarget(`postpone-first-${id}`);
  }

  function closePostpone(id: string) {
    setPostponeId(null);
    setPickingDateId(null);
    setPickedDate("");
    setFocusTarget(`menu-${id}`);
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
    setMenuId(null);
    setPostponeId(null);
    setPickingDateId(null);
    setDeleteId(id);
    setFocusTarget(`delete-cancel-${id}`);
  }

  function cancelDelete(id: string) {
    setDeleteId(null);
    setFocusTarget(`menu-${id}`);
  }

  async function runAction(
    id: string,
    action: "complete" | "reopen" | "postpone" | "delete",
    postponeUntil?: string,
  ) {
    // El control se deshabilita con `actionsDisabled`; este guardia evita
    // además una segunda acción mientras la primera está en vuelo.
    if (busyId !== null) return;
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
        setMenuId(null);
        setFocusTarget(nextOpen ? `check-${nextOpen.id}` : "new");
        setAnnouncement("Pendiente eliminado.");
      } else if (action === "complete") {
        setMenuId(null);
        setFocusTarget(nextOpen ? `check-${nextOpen.id}` : "new");
        setAnnouncement("Pendiente completado. Queda en Completados.");
      } else if (action === "reopen") {
        setTab("open");
        setMenuId(null);
        setFocusTarget(`check-${id}`);
        setAnnouncement("Pendiente reabierto. Vuelve a Hoy.");
      } else {
        setPostponeId(null);
        setPickingDateId(null);
        setPickedDate("");
        setFocusTarget(`menu-${id}`);
        setAnnouncement("Pendiente pospuesto.");
      }
    } catch (caught) {
      setActionError(humanError(caught, "No pude actualizar el pendiente."));
    } finally {
      setBusyId(null);
    }
  }

  function clearSearch() {
    setQuery("");
    setFocusTarget("search");
  }

  function renderEmptyOpen() {
    const isFiltered = normalizedQuery.length > 0;
    return (
      <div className="mc-pend-empty" role="status">
        <Image
          src={listaIcon}
          alt=""
          aria-hidden="true"
          width={88}
          height={108}
          className="mc-pend-empty__art"
          sizes="(max-width: 479px) 44px, 72px"
        />
        <div className="mc-pend-empty__copy">
          <p className="mc-pend-empty__title">
            {isFiltered
              ? "Nada coincide con la búsqueda."
              : tasks.length === 0
                ? "Aún no hay pendientes."
                : "No hay pendientes abiertos."}
          </p>
          <p className="mc-pend-empty__text">
            {isFiltered
              ? `No encontré “${query.trim()}” en los pendientes de hoy.`
              : tasks.length === 0
                ? "Anota el primero: pagar al proveedor, recibir un pedido o llamar a un cliente."
                : "Revisa las tareas terminadas en Completados. Anota aquí lo que dejes para después."}
          </p>
          {isFiltered ? (
            <div className="mc-pend-empty__actions">
              <button
                type="button"
                className="mc-pend-cta mc-pend-cta--secondary"
                onClick={clearSearch}
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderEmptyDone() {
    const isFiltered = normalizedQuery.length > 0;
    return (
      <div className="mc-pend-empty" role="status">
        <Image
          src={listaIcon}
          alt=""
          aria-hidden="true"
          width={88}
          height={108}
          className="mc-pend-empty__art"
          sizes="(max-width: 479px) 44px, 72px"
        />
        <div className="mc-pend-empty__copy">
          <p className="mc-pend-empty__title">
            {isFiltered
              ? "Nada coincide en completados."
              : "Aún no has completado pendientes."}
          </p>
          <p className="mc-pend-empty__text">
            {isFiltered
              ? `No encontré “${query.trim()}” entre las tareas hechas.`
              : "Cuando completes una tarea, aparecerá aquí con la fecha en que la terminaste."}
          </p>
          <div className="mc-pend-empty__actions">
            {isFiltered ? (
              <button
                type="button"
                className="mc-pend-cta mc-pend-cta--secondary"
                onClick={clearSearch}
              >
                Limpiar búsqueda
              </button>
            ) : (
              <button
                type="button"
                className="mc-pend-cta mc-pend-cta--secondary"
                onClick={() => {
                  setTab("open");
                  tabOpenRef.current?.focus();
                }}
              >
                Ver pendientes de hoy
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderTask(task: Task) {
    const isDone = task.status === "done";
    const { amountCents, note } = splitTaskNote(task.note);
    const due = dueInfo(task, now);
    const isBusy = busyId === task.id;
    const isMenuOpen = menuId === task.id;
    const isPostponing = postponeId === task.id;
    const isPickingDate = pickingDateId === task.id;
    const isDeleting = deleteId === task.id;
    const meta = amountCents !== null ? formatMxn(amountCents) : isDone ? "" : due.short;
    const hiddenDue =
      amountCents !== null && !isDone && due.full !== "Sin fecha"
        ? due.full
        : null;

    return (
      <li
        key={task.id}
        className={cn("mc-pend-item", isDone && "mc-pend-item--done")}
        aria-busy={isBusy ? true : undefined}
      >
        <div className="mc-pend-item__row">
          <span className="mc-pend-check">
            <input
              type="checkbox"
              checked={isDone}
              disabled={actionsDisabled}
              onChange={() =>
                void runAction(task.id, isDone ? "reopen" : "complete")
              }
              aria-label={`${isDone ? "Reabrir" : "Completar"}: ${task.title}`}
              data-focus={`check-${task.id}`}
            />
            <Check
              className="mc-pend-check__icon"
              aria-hidden="true"
            />
          </span>

          <div className="mc-pend-item__body">
            <p className="mc-pend-item__title">{task.title}</p>
            {note ? <p className="mc-pend-item__note">{note}</p> : null}

            {isDone ? (
              <p className="mc-pend-item__sub">{completedLabel(task, now)}</p>
            ) : task.postponedUntil ? (
              <p className="mc-pend-item__sub">
                <span className="mc-pend-chip">Pospuesta</span>
                {hiddenDue ? (
                  <span className="sr-only">{hiddenDue}</span>
                ) : null}
              </p>
            ) : hiddenDue ? (
              <span className="sr-only">{hiddenDue}</span>
            ) : null}

            {isBusy ? (
              <p className="mc-pend-busy">
                <Loader2
                  className="mc-pend-icon mc-pend-spin"
                  aria-hidden="true"
                />
                Guardando…
              </p>
            ) : null}
          </div>

          {meta ? (
            <p
              className={cn(
                "mc-pend-item__meta",
                amountCents !== null && "mc-pend-item__meta--amount",
              )}
              title={hiddenDue ?? undefined}
            >
              {meta}
            </p>
          ) : (
            <span aria-hidden="true" />
          )}

          {isDone ? (
            <span aria-hidden="true" />
          ) : (
            <button
              type="button"
              className="mc-pend-item__menu"
              aria-label={`Opciones de ${task.title}`}
              aria-expanded={isMenuOpen}
              aria-controls={
                isMenuOpen ? `${base}-menu-${task.id}` : undefined
              }
              data-focus={`menu-${task.id}`}
              disabled={actionsDisabled}
              onClick={() => toggleMenu(task.id)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && isMenuOpen) {
                  event.stopPropagation();
                  closeMenu(task.id);
                }
              }}
            >
              <MoreHorizontal aria-hidden="true" />
            </button>
          )}
        </div>

        {isMenuOpen ? (
          <div
            id={`${base}-menu-${task.id}`}
            className="mc-pend-item__panel"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closeMenu(task.id);
              }
            }}
          >
            <button
              type="button"
              className="mc-pend-action"
              onClick={() => startPostpone(task.id)}
              disabled={actionsDisabled}
              data-focus={`postpone-${task.id}`}
            >
              <CalendarDays className="mc-pend-icon" aria-hidden="true" />
              Posponer
            </button>
            <button
              type="button"
              className="mc-pend-action mc-pend-action--danger"
              onClick={() => startDelete(task.id)}
              disabled={actionsDisabled}
              data-focus={`delete-${task.id}`}
            >
              <Trash2 className="mc-pend-icon" aria-hidden="true" />
              Eliminar
            </button>
            <button
              type="button"
              className="mc-pend-button mc-pend-button--quiet"
              onClick={() => closeMenu(task.id)}
            >
              Cerrar
            </button>
          </div>
        ) : null}

        {isDeleting ? (
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
              Dejará de aparecer en tu lista. No se puede deshacer desde aquí.
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
                <Trash2 className="mc-pend-icon" aria-hidden="true" />
                Sí, eliminar
              </button>
            </div>
          </div>
        ) : null}

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
            <p className="mc-pend-postpone__title">¿Para cuándo?</p>
            <div className="mc-pend-postpone__choices">
              <button
                type="button"
                data-focus={`postpone-first-${task.id}`}
                onClick={() =>
                  void runAction(task.id, "postpone", laterTodayIso())
                }
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
                  className="mc-pend-newfield__label"
                >
                  Nueva fecha
                </label>
                <input
                  id={`pick-date-${task.id}`}
                  data-focus={`pick-date-${task.id}`}
                  type="date"
                  value={pickedDate}
                  min={todayKey}
                  onChange={(event) => setPickedDate(event.target.value)}
                  className="mc-pend-date-input"
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
      </li>
    );
  }

  return (
    <section
      ref={rootRef}
      id="mc-pend-tareas"
      className="mc-pend-board"
      aria-labelledby={summaryTitleId}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div
        className="mc-pend-tabs"
        role="tablist"
        aria-label="Pendientes por estado"
      >
        <button
          ref={tabOpenRef}
          type="button"
          role="tab"
          id={tabOpenId}
          aria-selected={tab === "open"}
          aria-controls={panelOpenId}
          tabIndex={tab === "open" ? 0 : -1}
          className="mc-pend-tab"
          onClick={() => setTab("open")}
          onKeyDown={handleTabKey}
        >
          <CalendarDays aria-hidden="true" />
          Hoy
          <span className="sr-only">
            : {openAll.length} {openAll.length === 1 ? "pendiente" : "pendientes"}
          </span>
        </button>
        <button
          ref={tabDoneRef}
          type="button"
          role="tab"
          id={tabDoneId}
          aria-selected={tab === "done"}
          aria-controls={panelDoneId}
          tabIndex={tab === "done" ? 0 : -1}
          className="mc-pend-tab"
          onClick={() => setTab("done")}
          onKeyDown={handleTabKey}
        >
          <CircleCheck aria-hidden="true" />
          Completados
          <span className="sr-only">
            : {doneAll.length} {doneAll.length === 1 ? "pendiente" : "pendientes"}
          </span>
        </button>
      </div>

      <label className="mc-pend-search" htmlFor={searchId}>
        <Search aria-hidden="true" />
        <span className="sr-only">Buscar pendiente</span>
        <input
          id={searchId}
          data-focus="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pendiente"
          autoComplete="off"
        />
      </label>

      <div className="mc-pend-summary">
        <Image
          src={tasksArt}
          alt=""
          aria-hidden="true"
          width={322}
          height={242}
          className="mc-pend-summary__art"
          sizes="(max-width: 479px) 92px, (max-width: 767px) 92px, 38vw"
        />
        <div className="mc-pend-summary__copy">
          <h2 id={summaryTitleId} className="mc-pend-summary__title">
            Pendientes de hoy
          </h2>
          <ul className="mc-pend-summary__stats">
            <li className="mc-pend-summary__stat">
              <span className="mc-pend-summary__icon">
                <CircleCheck aria-hidden="true" />
              </span>
              <span className="mc-pend-summary__value">{openAll.length}</span>
              <span className="mc-pend-summary__label">
                {openAll.length === 1 ? "tarea" : "tareas"}
              </span>
            </li>
            <li className="mc-pend-summary__stat">
              <span className="mc-pend-summary__icon">
                <Coins aria-hidden="true" />
              </span>
              <span className="mc-pend-summary__value">
                {formatMxn(amountsCents)}
              </span>
              <span className="mc-pend-summary__label">por cobrar</span>
            </li>
          </ul>
        </div>
      </div>

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

      <div
        role="tabpanel"
        id={panelOpenId}
        aria-labelledby={tabOpenId}
        hidden={tab !== "open"}
      >
        {openTasks.length === 0 ? (
          renderEmptyOpen()
        ) : (
          <ul className="mc-pend-list" aria-label="Pendientes de hoy">
            {openTasks.map(renderTask)}
          </ul>
        )}
      </div>

      <div
        role="tabpanel"
        id={panelDoneId}
        aria-labelledby={tabDoneId}
        hidden={tab !== "done"}
      >
        {doneTasks.length === 0 ? (
          renderEmptyDone()
        ) : (
          <ul className="mc-pend-list" aria-label="Pendientes completados">
            {doneTasks.map(renderTask)}
          </ul>
        )}
      </div>

      <Link
        href="/pendientes/nuevo"
        className="mc-pend-cta mc-pend-new"
        data-focus="new"
        prefetch={false}
      >
        <Plus className="mc-pend-icon" aria-hidden="true" />
        Nuevo pendiente
      </Link>

      {totalLabel ? <p className="mc-pend-footnote">{totalLabel}</p> : null}
    </section>
  );
}
