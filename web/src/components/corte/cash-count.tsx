"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/format";
import type { CashClose, CashStatus } from "@/lib/types";
import registradoraIcon from "@/assets/brand/iconos/transparent/registradora.png";
import {
  DENOMINATIONS,
  denominationLabel,
  differenceNote,
  differenceWord,
  humanError,
  moneyFieldMessage,
  moneyInput,
  readCentsField,
  type ClosePayload,
  type MoneyField,
  type MoneyParseError,
} from "./money";

const CloseConfirmDialog = dynamic(
  () => import("./close-confirm-dialog").then((module) => module.CloseConfirmDialog),
  { loading: () => <p role="status">Abriendo la revisión del corte…</p> },
);

/**
 * Conteo del corte. Es el primer bloque del DOM y del orden de tabulación:
 * total contado → conteo por denominaciones → revisión de movimientos →
 * guardar. No escribe nada hasta que la persona confirma el diálogo, que es
 * quien calcula el preview con el servidor y manda la huella al guardar.
 */
export function CashCount({
  initialStatus,
  titleId,
}: {
  initialStatus: CashStatus;
  /** Id estable del H2 del conteo, para `focusTargetId` del wrapper. */
  titleId?: string;
}) {
  const router = useRouter();
  const baseId = useId();
  const headingId = titleId ?? `${baseId}-tally`;
  const countedRef = useRef<HTMLInputElement>(null);
  const openingRef = useRef<HTMLInputElement>(null);
  const expensesRef = useRef<HTMLInputElement>(null);
  const withdrawalsRef = useRef<HTMLInputElement>(null);
  const baseNextRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);

  const [status, setStatus] = useState<CashStatus>(initialStatus);
  const [opening, setOpening] = useState(() => moneyInput(initialStatus.openingCents));
  const [expenses, setExpenses] = useState(() => moneyInput(initialStatus.expensesCents));
  const [withdrawals, setWithdrawals] = useState(() =>
    moneyInput(initialStatus.withdrawalsCents),
  );
  const [baseNext, setBaseNext] = useState(() =>
    moneyInput(initialStatus.saved?.baseNextCents ?? initialStatus.openingCents),
  );
  const [counted, setCounted] = useState(() =>
    initialStatus.saved ? moneyInput(initialStatus.saved.countedCents) : "",
  );
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [showCounts, setShowCounts] = useState(false);
  const [applyPreviousWithdrawal, setApplyPreviousWithdrawal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{
    field: MoneyField;
    message: string;
  } | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<ClosePayload | null>(null);

  const openingField = readCentsField(opening);
  const expensesField = readCentsField(expenses);
  const withdrawalsField = readCentsField(withdrawals);
  const countedField = readCentsField(counted);
  const baseNextField = readCentsField(baseNext);
  const hasCounted = counted.trim() !== "";
  const hasInputError = [
    openingField.error,
    expensesField.error,
    withdrawalsField.error,
    countedField.error,
    baseNextField.error,
  ].some(Boolean);
  const previousWithdrawalCents = status.saved?.withdrawalNextCents ?? 0;
  const appliedPreviousWithdrawalCents = applyPreviousWithdrawal
    ? previousWithdrawalCents
    : 0;
  const effectiveWithdrawalsCents =
    withdrawalsField.cents + appliedPreviousWithdrawalCents;
  const expectedCents =
    openingField.cents +
    status.cashSalesCents +
    status.cashCreditCents -
    expensesField.cents -
    effectiveWithdrawalsCents;
  const differenceCents = countedField.cents - expectedCents;
  const canShowDifference = hasCounted && !hasInputError;
  const baseExceedsCounted =
    hasCounted && countedField.cents > 0 && baseNextField.cents > countedField.cents;
  const withdrawalNextCents = Math.max(0, countedField.cents - baseNextField.cents);
  const differenceTone =
    differenceCents === 0 ? "--ok" : differenceCents > 0 ? "--extra" : "--missing";

  function markDirty() {
    dirtyRef.current = true;
    setDirty(true);
    setFieldError(null);
    setError(null);
  }

  function fillFromStatus(data: CashStatus) {
    setOpening(moneyInput(data.openingCents));
    setExpenses(moneyInput(data.expensesCents));
    setWithdrawals(moneyInput(data.withdrawalsCents));
    setBaseNext(moneyInput(data.saved?.baseNextCents ?? data.openingCents));
    setCounted(data.saved ? moneyInput(data.saved.countedCents) : "");
    setCounts({});
    setApplyPreviousWithdrawal(false);
  }

  async function loadStatus(options?: { preserveFields?: boolean }) {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/cash", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("No pude leer los totales de la caja.");
      const data = (await response.json()) as CashStatus;
      setStatus(data);
      if (!options?.preserveFields) {
        fillFromStatus(data);
        dirtyRef.current = false;
        setDirty(false);
      }
      const message = options?.preserveFields
        ? "Totales actualizados. Tu conteo sigue igual."
        : "Totales de la caja actualizados.";
      setAnnouncement(message);
      router.refresh();
      return true;
    } catch (caught) {
      setError(
        humanError(caught, "No pude actualizar los totales. Revisa tu conexión."),
      );
      return false;
    } finally {
      setRefreshing(false);
    }
  }

  function updateCount(denomination: number, quantity: number) {
    const safeQuantity = Number.isFinite(quantity)
      ? Math.max(0, Math.floor(quantity))
      : 0;
    const next = { ...counts, [denomination]: safeQuantity };
    setCounts(next);
    const total = DENOMINATIONS.reduce(
      (sum, value) => sum + value * (next[value] ?? 0),
      0,
    );
    setCounted(moneyInput(total));
    markDirty();
  }

  function validateDraft(): ClosePayload | null {
    setFieldError(null);
    setError(null);

    const checks: Array<{
      field: MoneyField;
      parsed: { cents: number; error: MoneyParseError | null };
      ref: RefObject<HTMLInputElement | null>;
      positive?: boolean;
    }> = [
      { field: "opening", parsed: readCentsField(opening), ref: openingRef },
      { field: "expenses", parsed: readCentsField(expenses), ref: expensesRef },
      {
        field: "withdrawals",
        parsed: readCentsField(withdrawals),
        ref: withdrawalsRef,
      },
      {
        field: "counted",
        parsed: readCentsField(counted, true),
        ref: countedRef,
        positive: true,
      },
      { field: "baseNext", parsed: readCentsField(baseNext), ref: baseNextRef },
    ];

    for (const check of checks) {
      if (check.parsed.error || (check.positive && check.parsed.cents <= 0)) {
        const message = check.parsed.error
          ? moneyFieldMessage(check.field, check.parsed.error)
          : "Escribe cuánto contaste. El total contado debe ser mayor que cero.";
        setFieldError({ field: check.field, message });
        check.ref.current?.focus();
        return null;
      }
    }

    const countedTotal = readCentsField(counted).cents;
    const baseCents = readCentsField(baseNext).cents;
    if (baseCents > countedTotal) {
      const message = `La base para mañana (${formatMxn(
        baseCents,
      )}) no puede ser mayor que el total contado (${formatMxn(
        countedTotal,
      )}). Baja la base o corrige el conteo.`;
      setFieldError({ field: "baseNext", message });
      baseNextRef.current?.focus();
      return null;
    }

    return {
      openingCents: readCentsField(opening).cents,
      expensesCents: readCentsField(expenses).cents,
      withdrawalsCents: effectiveWithdrawalsCents,
      countedCents: countedTotal,
      baseNextCents: baseCents,
    };
  }

  function requestSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (refreshing) return;
    const payload = validateDraft();
    if (!payload) return;
    setConfirmPayload(payload);
  }

  function handleSaved(close: CashClose, nextStatus: CashStatus) {
    const usedPreviousWithdrawal = applyPreviousWithdrawal
      ? previousWithdrawalCents
      : 0;
    setStatus(nextStatus);
    setOpening(moneyInput(close.openingCents));
    setExpenses(moneyInput(close.expensesCents));
    setWithdrawals(moneyInput(close.withdrawalsCents));
    setCounted(moneyInput(close.countedCents));
    setBaseNext(moneyInput(close.baseNextCents));
    setCounts({});
    setApplyPreviousWithdrawal(false);
    dirtyRef.current = false;
    setDirty(false);
    setConfirmPayload(null);
    setFieldError(null);
    setError(null);
    const baseNotice = `Corte #${close.version} guardado. ${differenceNote(
      close.differenceCents,
    )}`;
    const notice =
      usedPreviousWithdrawal > 0
        ? `${baseNotice} Se sumó el retiro previo de ${formatMxn(
            usedPreviousWithdrawal,
          )} a retiros.`
        : baseNotice;
    setSavedNotice(notice);
    setAnnouncement(notice);
    router.refresh();
  }

  function handleConflict(message: string) {
    setConfirmPayload(null);
    setApplyPreviousWithdrawal(false);
    setError(message);
    setAnnouncement(message);
    void loadStatus({ preserveFields: true });
  }

  function fieldErrorText(field: MoneyField) {
    if (fieldError?.field !== field) return null;
    return (
      <p
        id={`${baseId}-${field}-error`}
        role="alert"
        className="mc-corte-field__error"
      >
        {fieldError.message}
      </p>
    );
  }

  function invalid(field: MoneyField): boolean {
    return fieldError?.field === field;
  }

  function describedBy(field: MoneyField, fallback?: string): string | undefined {
    if (invalid(field)) return `${baseId}-${field}-error`;
    return fallback;
  }

  return (
    <section className="mc-op-panel mc-corte-tally" aria-labelledby={headingId}>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement ?? ""}
      </p>

      <div className="mc-op-panel__head">
        <div className="mc-corte-tally__heading">
          <span className="mc-corte-tally__medallion" aria-hidden="true">
            <Image src={registradoraIcon} alt="" sizes="40px" />
          </span>
          <div className="mc-corte-tally__title">
            <p className="mc-corte-step">Paso 1 · Conteo</p>
            <h2 id={headingId} className="mc-op-panel__title">
              Cuenta el efectivo de hoy
            </h2>
          </div>
        </div>
        <button
          type="button"
          className="mc-corte-refresh"
          onClick={() => void loadStatus({ preserveFields: dirtyRef.current })}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          <RefreshCw className={cn("mc-corte-refresh__icon", refreshing && "mc-corte-spin")} aria-hidden="true" />
          {refreshing ? "Actualizando…" : "Actualizar totales"}
        </button>
      </div>

      <p className="mc-corte-lede">
        El conteo va primero: escribe el total contado o cuenta por billetes y
        monedas. Después revisa los movimientos y guarda. Nada se guarda solo.
      </p>

      {error ? (
        <p className="mc-corte-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {savedNotice ? (
        <p className="mc-corte-saved" role="status">
          {savedNotice}
        </p>
      ) : null}

      {dirty ? (
        <p className="mc-corte-dirty" role="status">
          Hay cambios sin guardar. “Actualizar totales” no borra tu conteo.
        </p>
      ) : null}

      <form className="mc-corte-form" onSubmit={requestSave} noValidate>
        <div className="mc-corte-count-block">
          <label className="mc-corte-field" htmlFor={`${baseId}-counted`}>
            <span className="mc-corte-field__label">Total contado</span>
            <span
              className={cn(
                "mc-corte-money mc-corte-money--counted",
                invalid("counted") && "mc-corte-money--invalid",
              )}
            >
              <span className="mc-corte-money__sign" aria-hidden="true">
                $
              </span>
              <input
                ref={countedRef}
                id={`${baseId}-counted`}
                className="mc-corte-money__input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={counted}
                onChange={(event) => {
                  setCounted(event.target.value);
                  setCounts({});
                  markDirty();
                }}
                aria-label="Total contado en pesos"
                aria-invalid={invalid("counted")}
                aria-describedby={describedBy("counted", `${baseId}-counted-help`)}
              />
            </span>
            <span id={`${baseId}-counted-help`} className="mc-corte-field__help">
              Escribe lo que hay en la caja, contado a mano.
            </span>
          </label>
          {fieldErrorText("counted")}

          {canShowDifference ? (
            <div
              className={`mc-corte-stamp mc-corte-stamp${differenceTone}`}
              role="status"
            >
              <p className="mc-corte-stamp__word">{differenceWord(differenceCents)}</p>
              <p className="mc-corte-stamp__amount">
                {formatMxn(Math.abs(differenceCents))}
              </p>
              <p className="mc-corte-stamp__note">{differenceNote(differenceCents)}</p>
            </div>
          ) : (
            <p className="mc-corte-hint">
              {hasInputError
                ? "Corrige los montos marcados para calcular la diferencia."
                : "Escribe el total contado para ver si cuadra."}
            </p>
          )}
          <p className="mc-corte-hint">
            La diferencia exacta la recalcula el servidor al confirmar; no se
            guarda nada hasta que tú lo pidas.
          </p>

          <button
            type="button"
            className="mc-corte-toggle"
            aria-expanded={showCounts}
            aria-controls={showCounts ? `${baseId}-denoms` : undefined}
            onClick={() => setShowCounts((value) => !value)}
          >
            {showCounts
              ? "Ocultar conteo por billetes y monedas"
              : "Contar por billetes y monedas"}
            {showCounts ? (
              <ChevronUp aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </button>

          {showCounts ? (
            <div id={`${baseId}-denoms`} className="mc-corte-denoms">
              <p className="mc-corte-denoms__hint">
                El conteo por billetes reemplaza el total contado.
              </p>
              <div className="mc-corte-denoms__grid">
                {DENOMINATIONS.map((denomination) => (
                  <label key={denomination} className="mc-corte-denom">
                    <span className="mc-corte-denom__label">
                      {denominationLabel(denomination)}
                    </span>
                    <input
                      className="mc-corte-denom__input"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={counts[denomination] ?? 0}
                      onChange={(event) =>
                        updateCount(denomination, Number(event.target.value))
                      }
                      aria-label={`Cantidad de ${denominationLabel(denomination)}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mc-corte-review" role="group" aria-labelledby={`${baseId}-review`}>
          <div className="mc-corte-review__head">
            <p className="mc-corte-step">Paso 2 · Revisión</p>
            <h3 id={`${baseId}-review`} className="mc-corte-review__title">
              De dónde sale el esperado
            </h3>
          </div>
          <dl className="mc-corte-review__sources">
            <div>
              <dt>Ventas en efectivo</dt>
              <dd>{formatMxn(status.cashSalesCents)}</dd>
            </div>
            <div>
              <dt>Abonos de fiado en efectivo</dt>
              <dd>{formatMxn(status.cashCreditCents)}</dd>
            </div>
          </dl>

          <div className="mc-corte-review__fields">
            <label className="mc-corte-field" htmlFor={`${baseId}-opening`}>
              <span className="mc-corte-field__label">Base inicial</span>
              <span
                className={cn(
                  "mc-corte-money",
                  invalid("opening") && "mc-corte-money--invalid",
                )}
              >
                <span className="mc-corte-money__sign" aria-hidden="true">
                  $
                </span>
                <input
                  ref={openingRef}
                  id={`${baseId}-opening`}
                  className="mc-corte-money__input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={opening}
                  onChange={(event) => {
                    setOpening(event.target.value);
                    markDirty();
                  }}
                  aria-label="Base inicial en pesos"
                  aria-invalid={invalid("opening")}
                  aria-describedby={describedBy("opening")}
                />
              </span>
              {fieldErrorText("opening")}
            </label>

            <label className="mc-corte-field" htmlFor={`${baseId}-expenses`}>
              <span className="mc-corte-field__label">Gastos de caja</span>
              <span
                className={cn(
                  "mc-corte-money",
                  invalid("expenses") && "mc-corte-money--invalid",
                )}
              >
                <span className="mc-corte-money__sign" aria-hidden="true">
                  $
                </span>
                <input
                  ref={expensesRef}
                  id={`${baseId}-expenses`}
                  className="mc-corte-money__input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={expenses}
                  onChange={(event) => {
                    setExpenses(event.target.value);
                    markDirty();
                  }}
                  aria-label="Gastos de caja en pesos"
                  aria-invalid={invalid("expenses")}
                  aria-describedby={describedBy("expenses")}
                />
              </span>
              {fieldErrorText("expenses")}
            </label>

            <label className="mc-corte-field" htmlFor={`${baseId}-withdrawals`}>
              <span className="mc-corte-field__label">Retiros</span>
              <span
                className={cn(
                  "mc-corte-money",
                  invalid("withdrawals") && "mc-corte-money--invalid",
                )}
              >
                <span className="mc-corte-money__sign" aria-hidden="true">
                  $
                </span>
                <input
                  ref={withdrawalsRef}
                  id={`${baseId}-withdrawals`}
                  className="mc-corte-money__input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={withdrawals}
                  onChange={(event) => {
                    setWithdrawals(event.target.value);
                    markDirty();
                  }}
                  aria-label="Retiros en pesos"
                  aria-invalid={invalid("withdrawals")}
                  aria-describedby={describedBy("withdrawals")}
                />
              </span>
              {fieldErrorText("withdrawals")}
            </label>
          </div>

          {status.saved && previousWithdrawalCents > 0 ? (
            <label className="mc-corte-previous">
              <input
                type="checkbox"
                checked={applyPreviousWithdrawal}
                onChange={(event) => {
                  setApplyPreviousWithdrawal(event.target.checked);
                  markDirty();
                }}
                className="mc-corte-previous__check"
              />
              <span className="mc-corte-previous__copy">
                <span className="mc-corte-previous__title">
                  Ya retiré {formatMxn(previousWithdrawalCents)} del corte #
                  {status.saved.version}
                </span>
                <span className="mc-corte-previous__note">
                  Súmalo a retiros y al esperado para no marcar un faltante falso.
                </span>
              </span>
            </label>
          ) : null}

          <div className="mc-corte-review__expected">
            <span className="mc-corte-review__expected-label">Debería haber</span>
            <strong className="mc-corte-review__expected-value">
              {formatMxn(expectedCents)}
            </strong>
          </div>
        </div>

        <label className="mc-corte-field mc-corte-field--base" htmlFor={`${baseId}-base-next`}>
          <span className="mc-corte-field__label">Base para mañana</span>
          <span
            className={cn(
              "mc-corte-money",
              (invalid("baseNext") || baseExceedsCounted) && "mc-corte-money--invalid",
            )}
          >
            <span className="mc-corte-money__sign" aria-hidden="true">
              $
            </span>
            <input
              ref={baseNextRef}
              id={`${baseId}-base-next`}
              className="mc-corte-money__input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={baseNext}
              onChange={(event) => {
                setBaseNext(event.target.value);
                markDirty();
              }}
              aria-label="Base para mañana en pesos"
              aria-invalid={invalid("baseNext") || baseExceedsCounted}
              aria-describedby={
                invalid("baseNext")
                  ? `${baseId}-baseNext-error`
                  : baseExceedsCounted
                    ? `${baseId}-base-warning`
                    : undefined
              }
            />
          </span>
          {fieldErrorText("baseNext")}
          {baseExceedsCounted && fieldError?.field !== "baseNext" ? (
            <p id={`${baseId}-base-warning`} role="alert" className="mc-corte-field__error">
              La base para mañana no puede ser mayor que el total contado. Baja
              la base o corrige el conteo.
            </p>
          ) : null}
        </label>
        {canShowDifference ? (
          <p className="mc-corte-hint">
            Retiro adicional después de la base:{" "}
            <strong>{formatMxn(withdrawalNextCents)}</strong>
          </p>
        ) : null}

        <button
          type="submit"
          className="mc-corte-save"
          disabled={refreshing || baseExceedsCounted}
        >
          {refreshing ? (
            <Loader2 className="mc-corte-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          {refreshing
            ? "Actualizando…"
            : status.saved
              ? "Corregir corte"
              : "Realizar corte"}
        </button>
        <p className="mc-corte-hint">
          Revisa los importes antes de pulsar «Guardar corte». Gastos, retiros y
          base se registran al confirmar.
        </p>
      </form>

      {confirmPayload ? (
        <CloseConfirmDialog
          payload={confirmPayload}
          saved={status.saved ?? null}
          onClose={() => setConfirmPayload(null)}
          onSaved={handleSaved}
          onConflict={handleConflict}
        />
      ) : null}
    </section>
  );
}
