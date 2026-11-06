"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { ModalDialog } from "./dialog";
import {
  deadlineFromDateInput,
  humanError,
  MAX_GOAL_TITLE_CHARS,
  parseMoneyInput,
  responseError,
} from "./money";

/**
 * CTA "Nueva meta" + diálogo de creación.
 * `POST /api/goals` `{ title, targetCents, deadline? }`.
 */
export function CreateGoalButton({
  label = "Nueva meta",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const titleId = useId();
  const targetId = useId();
  const deadlineId = useId();
  const errorId = useId();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Ponle un nombre a la meta.");
      return;
    }
    if (cleanTitle.length > MAX_GOAL_TITLE_CHARS) {
      setError(`El nombre no puede pasar de ${MAX_GOAL_TITLE_CHARS} caracteres.`);
      return;
    }

    const targetCents = parseMoneyInput(target);
    if (targetCents === null || targetCents <= 0) {
      setError("Escribe un monto objetivo mayor a cero, por ejemplo 1800.");
      return;
    }

    let deadlineIso: string | null = null;
    if (deadline) {
      deadlineIso = deadlineFromDateInput(deadline);
      if (!deadlineIso) {
        setError("Elige una fecha límite válida.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: cleanTitle,
          targetCents,
          ...(deadlineIso ? { deadline: deadlineIso } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response));
      }
      const body = (await response.json()) as { goal?: { title?: unknown } };
      const createdTitle =
        typeof body.goal?.title === "string" ? body.goal.title : cleanTitle;
      setTitle("");
      setTarget("");
      setDeadline("");
      setOpen(false);
      setAnnouncement(`Meta creada: ${createdTitle}.`);
      router.refresh();
    } catch (caught) {
      setError(humanError(caught, "No pude guardar la meta. Intenta de nuevo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`mc-metas-cta${variant === "secondary" ? " mc-metas-cta--secondary" : ""}`}
        onClick={openDialog}
        aria-haspopup="dialog"
      >
        <Plus className="mc-metas-cta__icon" aria-hidden="true" />
        {label}
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ModalDialog
        open={open}
        title="Nueva meta"
        description="Un objetivo concreto y medible. Puedes apartar poco a poco sin mover el efectivo de tu resguardo."
        onClose={closeDialog}
        closeDisabled={saving}
      >
        <form className="mc-metas-form" onSubmit={handleSubmit} noValidate>
          <div className="mc-metas-field">
            <label htmlFor={titleId} className="mc-metas-field__label">
              ¿Qué quieres lograr?
            </label>
            <input
              id={titleId}
              data-autofocus
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={MAX_GOAL_TITLE_CHARS}
              autoComplete="off"
              placeholder="Mi primera sombrilla"
              className="mc-metas-input"
              aria-invalid={error !== null ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <p className="mc-metas-field__hint">
              {title.length}/{MAX_GOAL_TITLE_CHARS} caracteres
            </p>
          </div>

          <div className="mc-metas-field">
            <label htmlFor={targetId} className="mc-metas-field__label">
              Monto objetivo
            </label>
            <div className="mc-metas-money">
              <span className="mc-metas-money__prefix" aria-hidden="true">
                $
              </span>
              <input
                id={targetId}
                type="text"
                inputMode="decimal"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="1800"
                autoComplete="off"
                className="mc-metas-money__input"
                aria-invalid={error !== null ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <p className="mc-metas-field__hint">En pesos, por ejemplo 1800 o 1800.50.</p>
          </div>

          <div className="mc-metas-field">
            <label htmlFor={deadlineId} className="mc-metas-field__label">
              Fecha límite <span className="mc-metas-field__optional">(opcional)</span>
            </label>
            <input
              id={deadlineId}
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="mc-metas-input mc-metas-input--date"
            />
            <p className="mc-metas-field__hint">
              Sin fecha no calculamos cuánto apartar por semana.
            </p>
          </div>

          {error ? (
            <p id={errorId} role="alert" className="mc-metas-error">
              {error}
            </p>
          ) : null}

          <div className="mc-metas-form__actions">
            <button
              type="submit"
              className="mc-metas-cta"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? (
                <Loader2 className="mc-metas-cta__icon mc-metas-spin" aria-hidden="true" />
              ) : null}
              {saving ? "Guardando…" : "Guardar meta"}
            </button>
            <button
              type="button"
              className="mc-metas-cta mc-metas-cta--secondary"
              onClick={closeDialog}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
