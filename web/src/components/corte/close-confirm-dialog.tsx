"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { formatMxn } from "@/lib/format";
import type { CashClose, CashClosePreview, CashStatus } from "@/lib/types";
import { Dialog } from "./dialog";
import {
  differenceNote,
  differenceWord,
  humanError,
  newRequestId,
  type ClosePayload,
} from "./money";

interface PreviewResponse {
  preview?: CashClosePreview;
  issues?: Array<{ code: string; message: string }>;
  error?: string;
}

interface CloseResponse {
  close?: CashClose;
  status?: CashStatus;
  error?: string;
  code?: string;
}

/**
 * Confirmación del corte: calcula la diferencia con `POST /api/cash/preview`
 * (huella incluida), pide motivo si ya hay un corte del día y guarda con
 * `POST /api/cash/close` enviando `previewFingerprint`. El candado síncrono
 * evita el doble guardado y `requestId` se reutiliza en reintentos.
 */
export function CloseConfirmDialog({
  payload,
  saved,
  onClose,
  onSaved,
  onConflict,
}: {
  payload: ClosePayload;
  /** Último corte del día: si existe, guardar crea una versión con motivo. */
  saved: CashClose | null;
  onClose: () => void;
  onSaved: (close: CashClose, status: CashStatus) => void;
  /** Conflicto de versión o totales: el padre actualiza y muestra el mensaje. */
  onConflict: (message: string) => void;
}) {
  const reasonId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const tokenRef = useRef(0);
  const savingRef = useRef(false);

  const [preview, setPreview] = useState<CashClosePreview | null>(null);
  const [previewIssues, setPreviewIssues] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestId] = useState(() => newRequestId("close"));

  const fetchPreview = useCallback(async () => {
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setLoadingPreview(true);
    setPreview(null);
    setPreviewIssues(null);
    setPreviewError(null);
    try {
      const response = await fetch("/api/cash/preview", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as PreviewResponse;
      if (token !== tokenRef.current) return;
      if (!response.ok || !data.preview) {
        throw new Error(data.error ?? "No pude calcular el corte con el servidor.");
      }
      setPreview(data.preview);
      setPreviewIssues(data.issues?.[0]?.message ?? null);
    } catch (caught) {
      if (token !== tokenRef.current) return;
      setPreviewError(
        humanError(caught, "No pude calcular el corte con el servidor."),
      );
    } finally {
      if (token === tokenRef.current) setLoadingPreview(false);
    }
  }, [payload]);

  useEffect(() => {
    // El preview se pide en el siguiente tick para no encadenar estado dentro
    // del propio cuerpo del efecto; el token invalida respuestas tardías.
    const timer = window.setTimeout(() => {
      void fetchPreview();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      tokenRef.current += 1;
    };
  }, [fetchPreview]);

  async function saveClose() {
    if (savingRef.current) return;
    if (!preview?.fingerprint) {
      setSaveError("Vuelve a calcular la diferencia con el servidor antes de guardar.");
      return;
    }
    if (saved && !reason.trim()) {
      setReasonError(
        "Escribe el motivo de la corrección. No se puede guardar otra versión sin motivo.",
      );
      reasonRef.current?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setReasonError(null);
    try {
      const response = await fetch("/api/cash/close", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          reason: saved ? reason.trim() : undefined,
          requestId,
          expectedVersion: saved?.version ?? 0,
          previewFingerprint: preview.fingerprint,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as CloseResponse;

      if (!response.ok || !data.close || !data.status) {
        if (
          data.code === "reason_required" ||
          data.code === "version_conflict" ||
          data.code === "totals_changed"
        ) {
          const message =
            data.code === "reason_required"
              ? "Alguien guardó un corte antes. Actualiza los totales y escribe el motivo de la corrección."
              : data.code === "totals_changed"
                ? "Entraron ventas o abonos después del preview. Vuelve a revisar la diferencia; no se guardó nada."
                : "Otro corte se guardó antes. Actualicé los totales; revisa y vuelve a intentar.";
          onConflict(message);
          return;
        }
        if (response.status === 429) {
          throw new Error(
            "Demasiados intentos seguidos. Espera un momento y vuelve a intentar.",
          );
        }
        throw new Error(data.error ?? "No pude guardar el corte.");
      }

      onSaved(data.close, data.status);
    } catch (caught) {
      setSaveError(humanError(caught, "No pude guardar el corte. Revisa tu conexión."));
      // Se conserva la misma llave: si el guardado sí llegó al servidor y la
      // respuesta se perdió, el reintento devuelve el corte ya creado en vez
      // de escribir una versión nueva.
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const saveDisabled =
    saving || loadingPreview || Boolean(previewError) || Boolean(previewIssues);
  const stampTone =
    preview === null
      ? "--pending"
      : preview.differenceCents === 0
        ? "--ok"
        : preview.differenceCents > 0
          ? "--extra"
          : "--missing";

  return (
    <Dialog
      title={saved ? "Corregir corte" : "Confirmar corte"}
      description={
        saved
          ? `El corte #${saved.version} no se borra: se guarda una versión nueva con motivo.`
          : "Revisa el conteo antes de guardar. El corte queda registrado con estos montos."
      }
      onClose={onClose}
      closeDisabled={saving}
    >
      {loadingPreview ? (
        <p className="mc-corte-dialog__status" role="status">
          Calculando la diferencia con el servidor…
        </p>
      ) : null}

      {previewError ? (
        <div className="mc-corte-error" role="alert">
          <p>{previewError}</p>
          <button
            type="button"
            className="mc-corte-cancel"
            onClick={() => void fetchPreview()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {preview ? (
        <>
          <dl className="mc-corte-dialog__rows">
            <div>
              <dt>Gastos de caja</dt>
              <dd>{formatMxn(preview.expensesCents)}</dd>
            </div>
            <div>
              <dt>Retiros</dt>
              <dd>{formatMxn(preview.withdrawalsCents)}</dd>
            </div>
            <div>
              <dt>Debería haber</dt>
              <dd>{formatMxn(preview.expectedCents)}</dd>
            </div>
            <div>
              <dt>Total contado</dt>
              <dd>{formatMxn(preview.countedCents)}</dd>
            </div>
            <div>
              <dt>Base para mañana</dt>
              <dd>{formatMxn(preview.baseNextCents)}</dd>
            </div>
          </dl>

          <div
            className={`mc-corte-stamp mc-corte-stamp${stampTone} mc-corte-dialog__stamp`}
            role="status"
          >
            <p className="mc-corte-stamp__word">{differenceWord(preview.differenceCents)}</p>
            <p className="mc-corte-stamp__amount">
              {formatMxn(Math.abs(preview.differenceCents))}
            </p>
            <p className="mc-corte-stamp__note">{differenceNote(preview.differenceCents)}</p>
          </div>
          <p className="mc-corte-hint">
            Diferencia calculada por el servidor con los movimientos de ahora.
          </p>

          {previewIssues ? (
            <p className="mc-corte-error" role="alert">
              {previewIssues}
            </p>
          ) : null}
        </>
      ) : null}

      {saved ? (
        <div className="mc-corte-dialog__reason">
          <label className="mc-corte-field__label" htmlFor={reasonId}>
            Motivo de la corrección (obligatorio)
          </label>
          <textarea
            ref={reasonRef}
            id={reasonId}
            className="mc-corte-reason"
            rows={3}
            maxLength={280}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(null);
            }}
            aria-invalid={Boolean(reasonError)}
            aria-describedby={reasonError ? `${reasonId}-error` : undefined}
            placeholder="Ej. conté de nuevo y faltaba un billete."
            disabled={saving}
          />
          {reasonError ? (
            <p id={`${reasonId}-error`} role="alert" className="mc-corte-field__error">
              {reasonError}
            </p>
          ) : null}
        </div>
      ) : null}

      {saveError ? (
        <p className="mc-corte-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{saveError}</span>
        </p>
      ) : null}

      <div className="mc-corte-dialog__actions">
        <button
          type="button"
          className="mc-corte-save"
          onClick={() => void saveClose()}
          disabled={saveDisabled}
          aria-busy={saving}
        >
          {saving ? (
            <Loader2 className="mc-corte-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          {saving ? "Guardando…" : saved ? "Guardar corrección" : "Guardar corte"}
        </button>
        <button
          type="button"
          className="mc-corte-cancel"
          onClick={onClose}
          disabled={saving}
        >
          Volver a contar
        </button>
      </div>
    </Dialog>
  );
}
