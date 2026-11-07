"use client";

import Image from "next/image";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import {
  addDaysToDateKey,
  mexicoDateKey,
  mexicoMidnight,
} from "@/lib/mexico-date";
import tasksArt from "@/assets/definitive-a/tasks.png";
import {
  composeTaskNote,
  humanError,
  parseMoneyInput,
  responseError,
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
} from "./task-money";

/*
 * Alta de /pendientes/nuevo (ref. 12).
 *
 * Usa el contrato existente `POST /api/tasks` ({ title, note, dueAt }).
 * El importe relacionado se guarda dentro de la nota con una etiqueta
 * legible porque la tabla de tareas no tiene columna de importe; así el dato
 * persiste de verdad y la bandeja lo puede mostrar sin inventar cifras.
 * "Recordarme" es solo un estado visual: no promete notificaciones.
 */

type When = "yesterday" | "today" | "tomorrow";
type ErrorField = "title" | "amount" | "time" | "form" | null;

const WHEN_OPTIONS: Array<{ value: When; label: string }> = [
  { value: "yesterday", label: "Ayer" },
  { value: "today", label: "Hoy" },
  { value: "tomorrow", label: "Mañana" },
];

function dueAtFrom(when: When, time: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  const todayKey = mexicoDateKey(new Date());
  const key =
    when === "yesterday"
      ? addDaysToDateKey(todayKey, -1)
      : when === "tomorrow"
        ? addDaysToDateKey(todayKey, 1)
        : todayKey;

  return new Date(
    mexicoMidnight(key).getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000,
  ).toISOString();
}

export function NewTaskForm() {
  const router = useRouter();
  const titleId = useId();
  const timeId = useId();
  const amountId = useId();
  const reminderLabelId = useId();
  const reminderHintId = useId();
  const errorId = useId();

  const titleRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [time, setTime] = useState("11:00");
  const [amount, setAmount] = useState("");
  const [reminder, setReminder] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [announcement, setAnnouncement] = useState("");

  function clearError() {
    if (error) {
      setError(null);
      setErrorField(null);
    }
  }

  function fail(field: ErrorField, message: string) {
    setError(message);
    setErrorField(field);
    if (field === "title") titleRef.current?.focus();
    if (field === "amount") amountRef.current?.focus();
    if (field === "time") timeRef.current?.focus();
  }

  function cancel() {
    if (saving) return;
    router.push("/pendientes");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submittingRef.current) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      fail("title", "Escribe qué tienes pendiente.");
      return;
    }
    if (cleanTitle.length > TASK_TITLE_MAX) {
      fail(
        "title",
        `El pendiente no puede pasar de ${TASK_TITLE_MAX} caracteres.`,
      );
      return;
    }

    const cleanAmount = amount.trim();
    let amountCents: number | null = null;
    if (cleanAmount) {
      amountCents = parseMoneyInput(cleanAmount);
      if (amountCents === null || amountCents <= 0) {
        fail("amount", "Escribe un importe válido, por ejemplo 50 o 50.50.");
        return;
      }
    }

    const note = composeTaskNote(null, amountCents);
    if (note && note.length > TASK_NOTE_MAX) {
      fail(
        "amount",
        "El importe es demasiado largo para guardarlo en la nota. Usa una cifra más corta.",
      );
      return;
    }

    const dueAt = dueAtFrom(when, time);
    if (!dueAt) {
      fail("time", "Elige una hora válida.");
      return;
    }

    setSaving(true);
    submittingRef.current = true;
    setError(null);
    setErrorField(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: cleanTitle, note, dueAt }),
      });

      if (!response.ok) {
        throw new Error(await responseError(response));
      }

      const body = (await response.json()) as {
        task?: { id?: unknown; title?: unknown };
      };
      if (!body.task || typeof body.task.id !== "string") {
        throw new Error("El servidor no devolvió el pendiente guardado.");
      }

      setAnnouncement(`Pendiente guardado: ${cleanTitle}.`);
      router.push("/pendientes");
      router.refresh();
    } catch (caught) {
      setError(
        humanError(caught, "No pude guardar el pendiente. Intenta de nuevo."),
      );
      setErrorField("form");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  const describedBy = (field: ErrorField) =>
    error && errorField === field ? errorId : undefined;

  return (
    <div className="mc-pend-nuevo">
      <Image
        src={tasksArt}
        alt=""
        aria-hidden="true"
        width={322}
        height={242}
        className="mc-pend-nuevo__art"
        sizes="(max-width: 599px) 112px, 150px"
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <form
        className="mc-pend-newform"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={saving}
      >
        <div className="mc-pend-newfield">
          <label htmlFor={titleId} className="mc-pend-newfield__label">
            ¿Qué tienes pendiente?
          </label>
          <input
            ref={titleRef}
            id={titleId}
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              clearError();
            }}
            maxLength={TASK_TITLE_MAX}
            autoComplete="off"
            placeholder="Recibir pedido de tortillas"
            className="mc-pend-input"
            aria-invalid={errorField === "title" ? true : undefined}
            aria-describedby={describedBy("title")}
            disabled={saving}
          />
        </div>

        <fieldset className="mc-pend-newfield">
          <legend className="mc-pend-newfield__label">¿Para cuándo?</legend>
          <div className="mc-pend-seg">
            {WHEN_OPTIONS.map((option) => (
              <span key={option.value} className="mc-pend-seg__option">
                <input
                  id={`${titleId}-${option.value}`}
                  className="mc-pend-seg__input"
                  type="radio"
                  name={`${titleId}-when`}
                  value={option.value}
                  checked={when === option.value}
                  onChange={() => {
                    setWhen(option.value);
                    clearError();
                  }}
                  disabled={saving}
                />
                <label
                  htmlFor={`${titleId}-${option.value}`}
                  className="mc-pend-seg__label"
                >
                  {option.label}
                </label>
              </span>
            ))}
          </div>
        </fieldset>

        <div className="mc-pend-timerow">
          <label htmlFor={timeId} className="mc-pend-newfield__label">
            ¿A qué hora?
          </label>
          <input
            ref={timeRef}
            id={timeId}
            type="time"
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              clearError();
            }}
            step={60}
            className="mc-pend-input mc-pend-input--time"
            aria-invalid={errorField === "time" ? true : undefined}
            aria-describedby={describedBy("time")}
            disabled={saving}
          />
        </div>

        <div className="mc-pend-newfield">
          <label htmlFor={amountId} className="mc-pend-newfield__label">
            Importe relacionado{" "}
            <span className="mc-pend-newfield__optional">(opcional)</span>
          </label>
          <div
            className="mc-pend-money"
            data-invalid={errorField === "amount" ? "true" : undefined}
          >
            <span className="mc-pend-money__prefix" aria-hidden="true">
              $
            </span>
            <input
              ref={amountRef}
              id={amountId}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                clearError();
              }}
              maxLength={14}
              autoComplete="off"
              placeholder="0.00"
              aria-invalid={errorField === "amount" ? true : undefined}
              aria-describedby={describedBy("amount")}
              disabled={saving}
            />
          </div>
        </div>

        <div className="mc-pend-switch-row">
          <div className="mc-pend-switch-row__copy">
            <p id={reminderLabelId} className="mc-pend-newfield__label">
              Recordarme
            </p>
            <p id={reminderHintId} className="mc-pend-newfield__hint">
              Por ahora no envía avisos: el interruptor es solo visual.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reminder}
            aria-labelledby={reminderLabelId}
            aria-describedby={reminderHintId}
            onClick={() => setReminder((current) => !current)}
            className="mc-pend-switch"
            disabled={saving}
          >
            <span aria-hidden="true">{reminder ? "ON" : "OFF"}</span>
            <span className="mc-pend-switch__track" aria-hidden="true">
              <span className="mc-pend-switch__thumb" />
            </span>
          </button>
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mc-pend-alert">
            <CircleAlert className="mc-pend-icon" aria-hidden="true" /> {error}
          </p>
        ) : null}

        <div className="mc-pend-newform__actions">
          <button
            type="submit"
            className="mc-pend-cta mc-pend-newform__submit"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? (
              <Loader2
                className="mc-pend-icon mc-pend-spin"
                aria-hidden="true"
              />
            ) : (
              <Check className="mc-pend-icon" aria-hidden="true" />
            )}
            {saving ? "Guardando…" : "Guardar pendiente"}
          </button>
          <button
            type="button"
            className="mc-pend-cta mc-pend-cta--secondary mc-pend-newform__submit"
            onClick={cancel}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
