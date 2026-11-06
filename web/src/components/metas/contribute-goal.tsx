"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { formatMxn } from "@/lib/format";
import { ModalDialog } from "./dialog";
import {
  humanError,
  MAX_GOAL_CONTRIBUTION_CENTS,
  newRequestId,
  parseMoneyInput,
  responseError,
} from "./money";

export type ContributeGoalTarget = {
  id: string;
  title: string;
  remainingCents: number;
};

/**
 * CTA "Apartar" + diálogo de apartado a una meta.
 * `POST /api/goals/[id]/contribute` `{ amountCents, note?, requestId }`.
 *
 * `requestId` es idempotente: si el envío falla sin respuesta cierta, el
 * reintento con el mismo monto y nota reutiliza la llave y el servidor no
 * duplica la aportación.
 */
export function ContributeGoalButton({
  goal,
  variant = "primary",
}: {
  goal: ContributeGoalTarget;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const amountId = useId();
  const noteId = useId();
  const errorId = useId();
  const hintId = useId();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const requestRef = useRef<{ signature: string; requestId: string } | null>(null);

  const remaining = Math.max(0, goal.remainingCents);

  function openDialog() {
    setError(null);
    setAmount("");
    setNote("");
    setOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amountCents = parseMoneyInput(amount);
    if (amountCents === null || amountCents <= 0) {
      setError("Escribe un monto mayor a cero.");
      return;
    }
    if (amountCents > remaining) {
      setError(`Solo faltan ${formatMxn(remaining)} para esta meta.`);
      return;
    }
    if (amountCents > MAX_GOAL_CONTRIBUTION_CENTS) {
      setError("La aportación es demasiado grande.");
      return;
    }
    const cleanNote = note.trim();
    if (cleanNote.length > 200) {
      setError("La nota no puede pasar de 200 caracteres.");
      return;
    }

    const payload = { amountCents, note: cleanNote || null };
    const signature = JSON.stringify(payload);
    const previousRequest = requestRef.current;
    const requestId =
      previousRequest && previousRequest.signature === signature
        ? previousRequest.requestId
        : newRequestId("goal");
    requestRef.current = { signature, requestId };

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/goals/${encodeURIComponent(goal.id)}/contribute`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, requestId }),
        },
      );
      if (!response.ok) {
        const message = await responseError(response);
        // 409: la llave ya se usó con otros datos; 404: la meta desapareció.
        // En ambos casos el siguiente intento debe estrenar llave.
        if (response.status === 409 || response.status === 404) {
          requestRef.current = null;
        }
        throw new Error(message);
      }
      requestRef.current = null;
      setAmount("");
      setNote("");
      setOpen(false);
      setAnnouncement(
        `Apartaste ${formatMxn(amountCents)} a ${goal.title}.`,
      );
      router.refresh();
    } catch (caught) {
      setError(humanError(caught, "No pude registrar el apartado."));
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
        aria-describedby={hintId}
      >
        <Plus className="mc-metas-cta__icon" aria-hidden="true" />
        Apartar
      </button>
      <span id={hintId} className="sr-only">
        Apartar a {goal.title}. Faltan {formatMxn(remaining)}.
      </span>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ModalDialog
        open={open}
        title={`Apartar a ${goal.title}`}
        description={`Faltan ${formatMxn(remaining)} para llegar a la meta. El apartado es un registro declarado: el efectivo sigue en tu resguardo.`}
        onClose={closeDialog}
        closeDisabled={saving}
      >
        <form className="mc-metas-form" onSubmit={handleSubmit} noValidate>
          <div className="mc-metas-field">
            <label htmlFor={amountId} className="mc-metas-field__label">
              ¿Cuánto apartaste?
            </label>
            <div className="mc-metas-money">
              <span className="mc-metas-money__prefix" aria-hidden="true">
                $
              </span>
              <input
                id={amountId}
                data-autofocus
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="150"
                autoComplete="off"
                className="mc-metas-money__input"
                aria-invalid={error !== null ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <p className="mc-metas-field__hint">
              Falta {formatMxn(remaining)} para completar esta meta.
            </p>
          </div>

          <div className="mc-metas-field">
            <label htmlFor={noteId} className="mc-metas-field__label">
              Nota <span className="mc-metas-field__optional">(opcional)</span>
            </label>
            <input
              id={noteId}
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              autoComplete="off"
              placeholder="De la venta del sábado"
              className="mc-metas-input"
            />
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
              {saving ? "Apartando…" : "Apartar"}
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
