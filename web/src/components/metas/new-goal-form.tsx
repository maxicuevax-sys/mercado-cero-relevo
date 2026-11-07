"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Coins,
  Loader2,
  PiggyBank,
  Target,
} from "lucide-react";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { formatMxn } from "@/lib/format";
import metaIcon from "@/assets/brand/iconos/transparent/meta.png";
import ahorroArt from "@/assets/brand/ilustraciones/transparent/ahorro.png";
import {
  deadlineFromDateInput,
  humanError,
  MAX_GOAL_TITLE_CHARS,
  newRequestId,
  parseMoneyInput,
  responseError,
} from "./money";

type ErrorField = "title" | "target" | "initial" | "deadline" | "form" | null;

type CreatedGoal = { id: string; title: string };

/**
 * Formulario de la ruta `/metas/nueva`.
 *
 * Crea la meta con `POST /api/goals` (contrato existente) y, si hay ahorro
 * inicial, registra la primera aportación con
 * `POST /api/goals/[id]/contribute` usando una llave idempotente. No inventa
 * datos: si la aportación falla, la meta queda creada y se avisa para que se
 * registre desde "Apartar".
 */
export function NewGoalForm() {
  const router = useRouter();
  const titleId = useId();
  const targetId = useId();
  const initialId = useId();
  const deadlineId = useId();
  const errorId = useId();
  const previewTitleId = useId();

  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [initial, setInitial] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [announcement, setAnnouncement] = useState("");
  const [created, setCreated] = useState<CreatedGoal | null>(null);
  const submitLock = useRef(false);

  const targetCents = parseMoneyInput(target);
  const initialCents = initial.trim() ? parseMoneyInput(initial) : 0;
  const previewTarget = targetCents && targetCents > 0 ? targetCents : 0;
  const previewSaved =
    initialCents && initialCents > 0
      ? Math.min(initialCents, previewTarget || initialCents)
      : 0;
  const previewPct =
    previewTarget > 0
      ? Math.min(100, Math.round((previewSaved / previewTarget) * 100))
      : 0;
  const previewName = title.trim() || "Tu nueva meta";

  function clearError() {
    if (error) {
      setError(null);
      setErrorField(null);
    }
  }

  function fail(field: ErrorField, message: string) {
    setError(message);
    setErrorField(field);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || created || submitLock.current) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      fail("title", "Ponle un nombre a la meta.");
      return;
    }
    if (cleanTitle.length > MAX_GOAL_TITLE_CHARS) {
      fail(
        "title",
        `El nombre no puede pasar de ${MAX_GOAL_TITLE_CHARS} caracteres.`,
      );
      return;
    }

    if (targetCents === null || targetCents <= 0) {
      fail(
        "target",
        "Escribe un monto objetivo mayor a cero, por ejemplo 1800.",
      );
      return;
    }

    if (initial.trim()) {
      if (initialCents === null || initialCents < 0) {
        fail(
          "initial",
          "Escribe un ahorro inicial válido, por ejemplo 150 o 150.50.",
        );
        return;
      }
      if (initialCents > targetCents) {
        fail(
          "initial",
          "El ahorro inicial no puede ser mayor que el monto objetivo.",
        );
        return;
      }
    }

    let deadlineIso: string | null = null;
    if (deadline) {
      deadlineIso = deadlineFromDateInput(deadline);
      if (!deadlineIso) {
        fail("deadline", "Elige una fecha límite válida.");
        return;
      }
    }

    setSaving(true);
    submitLock.current = true;
    setError(null);
    setErrorField(null);

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

      const body = (await response.json()) as {
        goal?: { id?: unknown; title?: unknown };
      };
      const goalId = typeof body.goal?.id === "string" ? body.goal.id : null;
      const createdTitle =
        typeof body.goal?.title === "string" ? body.goal.title : cleanTitle;
      const initialAmount = initialCents ?? 0;

      if (initialAmount > 0) {
        if (!goalId) {
          setCreated({ id: "", title: createdTitle });
          setAnnouncement(`Meta creada: ${createdTitle}.`);
          fail(
            "form",
            "La meta se creó, pero no se pudo registrar el ahorro inicial. Entra a Metas y usa Apartar.",
          );
          return;
        }

        const contribution = await fetch(
          `/api/goals/${encodeURIComponent(goalId)}/contribute`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amountCents: initialAmount,
              note: "Ahorro inicial",
              requestId: newRequestId("goal-initial"),
            }),
          },
        );

        if (!contribution.ok) {
          setCreated({ id: goalId, title: createdTitle });
          setAnnouncement(`Meta creada: ${createdTitle}.`);
          fail(
            "form",
            "La meta se creó, pero no se pudo guardar el ahorro inicial. Entra a Metas y usa Apartar para registrarlo.",
          );
          return;
        }
      }

      setAnnouncement(`Meta creada: ${createdTitle}.`);
      router.push("/metas");
      router.refresh();
    } catch (caught) {
      setError(
        humanError(caught, "No pude guardar la meta. Intenta de nuevo."),
      );
      setErrorField("form");
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  const describedBy = error ? errorId : undefined;
  const invalid = (field: ErrorField) =>
    errorField === field ? true : undefined;

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <section
        className="mc-metas-banner"
        aria-labelledby="mc-metas-banner-title"
      >
        <div className="mc-metas-banner__art">
          <Image
            src={ahorroArt}
            alt=""
            aria-hidden="true"
            sizes="(max-width: 760px) 132px, 300px"
          />
        </div>
        <div className="mc-metas-banner__copy">
          <h2 id="mc-metas-banner-title" className="mc-metas-banner__title">
            Ahorra para tus objetivos
          </h2>
          <p className="mc-metas-banner__text">
            Define una meta, un monto y lleva el progreso.
          </p>
        </div>
      </section>

      {created ? (
        <section
          className="mc-metas-created"
          aria-labelledby="mc-metas-created-title"
          role="alert"
        >
          <CheckCircle2
            className="mc-metas-created__icon"
            aria-hidden="true"
          />
          <div className="mc-metas-created__copy">
            <h2 id="mc-metas-created-title" className="mc-metas-created__title">
              Meta creada
            </h2>
            <p className="mc-metas-created__text">
              {created.title} ya aparece en Metas.
              {error ? ` ${error}` : ""}
            </p>
          </div>
          <Link href="/metas" className="mc-metas-cta mc-metas-created__cta">
            Ir a Metas
          </Link>
        </section>
      ) : null}

      {!created ? (
        <form
          className="mc-metas-nueva-form"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={saving}
        >
        <div className="mc-metas-field">
          <label htmlFor={titleId} className="mc-metas-field__label">
            Nombre de la meta
          </label>
          <div className="mc-metas-control">
            <Target className="mc-metas-control__icon" aria-hidden="true" />
            <input
              id={titleId}
              data-autofocus
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                clearError();
              }}
              maxLength={MAX_GOAL_TITLE_CHARS}
              autoComplete="off"
              placeholder="Ej. Comprar refrigerador"
              className="mc-metas-control__input"
              required
              aria-invalid={invalid("title")}
              aria-describedby={describedBy}
              disabled={saving || created !== null}
            />
          </div>
        </div>

        <div className="mc-metas-field">
          <label htmlFor={targetId} className="mc-metas-field__label">
            Monto objetivo
          </label>
          <div className="mc-metas-control">
            <Coins className="mc-metas-control__icon" aria-hidden="true" />
            <span className="mc-metas-control__prefix" aria-hidden="true">
              $
            </span>
            <input
              id={targetId}
              type="text"
              inputMode="decimal"
              value={target}
              onChange={(event) => {
                setTarget(event.target.value);
                clearError();
              }}
              placeholder="0.00"
              autoComplete="off"
              className="mc-metas-control__input mc-metas-control__input--money"
              required
              aria-invalid={invalid("target")}
              aria-describedby={describedBy}
              disabled={saving || created !== null}
            />
          </div>
          <p className="mc-metas-field__hint">
            En pesos, por ejemplo 1800 o 1800.50.
          </p>
        </div>

        <div className="mc-metas-field">
          <label htmlFor={initialId} className="mc-metas-field__label">
            Ahorro inicial{" "}
            <span className="mc-metas-field__optional">(opcional)</span>
          </label>
          <div className="mc-metas-control">
            <PiggyBank className="mc-metas-control__icon" aria-hidden="true" />
            <span className="mc-metas-control__prefix" aria-hidden="true">
              $
            </span>
            <input
              id={initialId}
              type="text"
              inputMode="decimal"
              value={initial}
              onChange={(event) => {
                setInitial(event.target.value);
                clearError();
              }}
              placeholder="0.00"
              autoComplete="off"
              className="mc-metas-control__input mc-metas-control__input--money"
              aria-invalid={invalid("initial")}
              aria-describedby={describedBy}
              disabled={saving || created !== null}
            />
          </div>
          <p className="mc-metas-field__hint">
            Lo que ya tienes apartado para esta meta.
          </p>
        </div>

        <div className="mc-metas-field">
          <label htmlFor={deadlineId} className="mc-metas-field__label">
            Fecha límite{" "}
            <span className="mc-metas-field__optional">(opcional)</span>
          </label>
          <div className="mc-metas-control">
            <CalendarDays
              className="mc-metas-control__icon"
              aria-hidden="true"
            />
            <input
              id={deadlineId}
              type="date"
              value={deadline}
              onChange={(event) => {
                setDeadline(event.target.value);
                clearError();
              }}
              className="mc-metas-control__input mc-metas-control__input--date"
              aria-invalid={invalid("deadline")}
              aria-describedby={describedBy}
              disabled={saving || created !== null}
            />
          </div>
          <p className="mc-metas-field__hint">
            Sin fecha no calculamos cuánto apartar por semana.
          </p>
        </div>

        {error && !created ? (
          <p id={errorId} role="alert" className="mc-metas-error">
            {error}
          </p>
        ) : null}

        <section
          className="mc-metas-preview"
          aria-labelledby={previewTitleId}
        >
          <div className="mc-metas-preview__icon">
            <Image
              src={metaIcon}
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
            />
          </div>
          <div className="mc-metas-preview__body">
            <h2 id={previewTitleId} className="mc-metas-preview__title">
              {previewName}
            </h2>
            <p className="mc-metas-preview__amounts">
              {formatMxn(previewSaved)} de {formatMxn(previewTarget)}
            </p>
          </div>
          <p className="mc-metas-preview__pct">{previewPct}%</p>
          <ProgressIndicator
            value={previewPct}
            label={`Vista previa del avance de ${previewName}`}
            className="mc-metas-preview__track"
            barClassName="mc-metas-preview__fill"
          />
        </section>

        <div className="mc-metas-form__actions">
          <button
            type="submit"
            className="mc-metas-cta mc-metas-submit"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? (
              <Loader2
                className="mc-metas-cta__icon mc-metas-spin"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="mc-metas-cta__icon"
                aria-hidden="true"
              />
            )}
            {saving ? "Creando…" : "Crear meta"}
          </button>
          <Link
            href="/metas"
            className="mc-metas-cta mc-metas-cta--secondary mc-metas-submit"
            aria-disabled={saving || undefined}
            tabIndex={saving ? -1 : undefined}
            onClick={(event) => {
              if (saving) event.preventDefault();
            }}
          >
            Cancelar
          </Link>
        </div>
        </form>
      ) : null}
    </>
  );
}
