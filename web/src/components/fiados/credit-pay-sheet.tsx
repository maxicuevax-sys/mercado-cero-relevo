"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  CreditCard,
  Loader2,
  Smartphone,
} from "lucide-react";
import { formatActivityDate, formatMxn, shortOrder } from "@/lib/format";
import type { Credit } from "@/lib/types";
import { SheetDialog } from "./dialog";

type PayMethod = "cash" | "codi" | "card";

const METHODS: ReadonlyArray<{
  id: PayMethod;
  label: string;
  hint: string;
  Icon: typeof Banknote;
}> = [
  {
    id: "cash",
    label: "Efectivo",
    hint: "Suma al efectivo de hoy y al corte de caja.",
    Icon: Banknote,
  },
  {
    id: "codi",
    label: "Digital",
    hint: "Queda como abono declarado; pey no lo verifica.",
    Icon: Smartphone,
  },
  {
    id: "card",
    label: "Tarjeta",
    hint: "Queda como abono declarado; pey no lo verifica.",
    Icon: CreditCard,
  },
];

interface CreditPayResponse {
  credit?: Credit;
  appliedCents?: number;
  balanceCents?: number;
  overpayCents?: number;
  duplicate?: boolean;
  error?: string;
}

function parseAmount(value: string): number | null {
  let clean = value.trim().replace(/[$\s]/g, "");
  if (!clean) return null;
  // Acepta "50", "50.5", "50.50" y "50,50". Si hay coma y punto, la coma es
  // separador de miles ("1,200.50"); si solo hay coma, es decimal.
  clean =
    clean.includes(",") && clean.includes(".")
      ? clean.replace(/,/g, "")
      : clean.replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{0,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cpa_${crypto.randomUUID()}`;
  }
  return `cpa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/failed to fetch|networkerror|load failed|fetch failed/i.test(error.message)) {
      return "No pude conectar con la caja. Revisa tu conexión e intenta de nuevo.";
    }
    return error.message;
  }
  return "No pude registrar el abono. Intenta de nuevo.";
}

/**
 * Hoja de abono de un fiado. Llama a la API existente
 * `POST /api/credits/[id]/pay` con `{ amountCents, method, note?, requestId?,
 * expectedBalanceCents? }` y conserva lo escrito si falla. `requestId` se
 * genera al abrir y no cambia durante la hoja: un reintento es idempotente.
 */
export function CreditPaySheet({
  credit,
  onClose,
  onSaved,
}: {
  credit: Credit;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const amountId = useId();
  const noteId = useId();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [requestId] = useState(newRequestId);
  const payingRef = useRef(false);

  const settled = credit.status === "settled" || credit.balanceCents <= 0;
  const requestedCents = parseAmount(amount);
  const appliedCents =
    requestedCents === null ? 0 : Math.min(requestedCents, credit.balanceCents);
  const returnedCents =
    requestedCents === null ? 0 : Math.max(0, requestedCents - appliedCents);
  const selectedMethod = METHODS.find((option) => option.id === method) ?? null;

  async function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (payingRef.current) return;
    if (settled) {
      setError("Ese fiado ya está saldado. No se registró nada.");
      return;
    }
    if (requestedCents === null || requestedCents <= 0) {
      setError("Escribe un monto mayor a cero.");
      return;
    }
    if (!method) {
      setError("Elige cómo recibiste el abono. No se registró nada.");
      return;
    }

    payingRef.current = true;
    setPaying(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/credits/${encodeURIComponent(credit.id)}/pay`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amountCents: requestedCents,
            method,
            note: note.trim() || undefined,
            requestId,
            expectedBalanceCents: credit.balanceCents,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as CreditPayResponse;

      if (!response.ok) {
        if (response.status === 409) {
          setError(
            body.error ??
              "El saldo cambió. Revisa el monto y confirma de nuevo. No se registró nada.",
          );
          router.refresh();
          return;
        }
        if (response.status === 429) {
          throw new Error(
            "Demasiados intentos seguidos. Espera un momento y vuelve a intentar.",
          );
        }
        throw new Error(body.error ?? "No pude registrar el abono.");
      }

      const applied =
        typeof body.appliedCents === "number" ? body.appliedCents : null;
      const balance =
        typeof body.balanceCents === "number" ? body.balanceCents : null;
      if (!body.credit || applied === null || balance === null) {
        throw new Error(
          "El abono se registró pero no pude leer el saldo nuevo. Actualiza la página.",
        );
      }

      const name = body.credit.customerName ?? credit.customerName ?? "Cliente";
      const parts: string[] = [
        body.duplicate ? "Abono ya registrado." : "Abono registrado.",
        `Se aplicaron ${formatMxn(applied)}.`,
      ];
      if (!body.duplicate) {
        const overpay =
          typeof body.overpayCents === "number"
            ? body.overpayCents
            : Math.max(0, requestedCents - applied);
        if (overpay > 0) parts.push(`Devuelve ${formatMxn(overpay)}.`);
      }
      parts.push(`${name} debe ${formatMxn(balance)}.`);
      if (balance <= 0) parts.push("Fiado saldado.");

      router.refresh();
      onSaved(parts.join(" "));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }

  return (
    <SheetDialog
      title="Registrar abono"
      description={`${credit.customerName ?? "Cliente"} · saldo ${formatMxn(
        credit.balanceCents,
      )}`}
      onClose={onClose}
      closeDisabled={paying}
    >
      <div className="mc-fiados-summary">
        <div className="mc-fiados-summary__row">
          <div className="mc-fiados-summary__copy">
            <p className="mc-fiados-summary__name">
              {credit.customerName ?? "Cliente"}
            </p>
            <p className="mc-fiados-summary__meta">
              {credit.orderId ? `Pedido ${shortOrder(credit.orderId)}` : "Sin pedido"}
              {" · desde "}
              {formatActivityDate(credit.createdAt)}
            </p>
          </div>
          <div className="mc-fiados-summary__amount">
            <p className="mc-fiados-summary__balance">
              {formatMxn(credit.balanceCents)}
            </p>
            <p className="mc-fiados-summary__label">saldo vivo</p>
          </div>
        </div>
        <p className="mc-fiados-summary__detail">
          Original {formatMxn(credit.originalCents)}
          {credit.originalCents > credit.balanceCents
            ? ` · abonado ${formatMxn(credit.originalCents - credit.balanceCents)}`
            : ""}
        </p>
      </div>

      <form className="mc-fiados-form" onSubmit={registerPayment} noValidate>
        <div className="mc-fiados-form__row">
          <label className="mc-fiados-field" htmlFor={amountId}>
            <span className="mc-fiados-field__label">Monto del abono</span>
            <span className="mc-fiados-money">
              <span className="mc-fiados-money__sign" aria-hidden="true">
                $
              </span>
              <input
                id={amountId}
                className="mc-fiados-money__input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                }}
                aria-describedby={`${amountId}-help`}
                data-autofocus
                disabled={paying}
              />
            </span>
            <span id={`${amountId}-help`} className="mc-fiados-field__help">
              Escribe el monto que recibiste. Si es mayor al saldo, se aplica
              solo el saldo.
            </span>
          </label>
          <button
            type="button"
            className="mc-fiados-quick"
            onClick={() => {
              setAmount((credit.balanceCents / 100).toFixed(2));
              setError(null);
            }}
            disabled={paying}
          >
            Usar todo el saldo ({formatMxn(credit.balanceCents)})
          </button>
        </div>

        {requestedCents !== null && requestedCents > 0 ? (
          <div className="mc-fiados-applied" role="status">
            <p>
              Se aplican <strong>{formatMxn(appliedCents)}</strong> al saldo vivo.
            </p>
            {returnedCents > 0 ? (
              <p>
                Recibiste {formatMxn(requestedCents)}: devuelve{" "}
                <strong>{formatMxn(returnedCents)}</strong>. El saldo no queda
                negativo.
              </p>
            ) : null}
          </div>
        ) : null}

        <fieldset className="mc-fiados-methods" disabled={paying}>
          <legend className="mc-fiados-field__label">¿Cómo lo recibiste?</legend>
          <div className="mc-fiados-methods__options">
            {METHODS.map((option) => {
              const Icon = option.Icon;
              const selected = method === option.id;
              return (
                <label
                  key={option.id}
                  className="mc-fiados-method"
                  data-selected={selected ? "true" : "false"}
                >
                  <input
                    type="radio"
                    name="mc-fiados-pay-method"
                    value={option.id}
                    checked={selected}
                    onChange={() => {
                      setMethod(option.id);
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          <p className="mc-fiados-method__hint">
            {selectedMethod
              ? selectedMethod.hint
              : "Elige un método para registrar el abono."}
          </p>
        </fieldset>

        <label className="mc-fiados-field" htmlFor={noteId}>
          <span className="mc-fiados-field__label">Nota (opcional)</span>
          <textarea
            id={noteId}
            className="mc-fiados-note-input"
            rows={2}
            maxLength={280}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. abonó la mitad, queda para el viernes"
            disabled={paying}
          />
        </label>

        {error ? (
          <p className="mc-fiados-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mc-fiados-form__foot">
          <button
            type="submit"
            className="mc-fiados-submit"
            disabled={paying}
            aria-busy={paying}
          >
            {paying ? (
              <Loader2 className="mc-fiados-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {paying ? "Registrando…" : "Registrar abono"}
          </button>
          <button
            type="button"
            className="mc-fiados-cancel"
            onClick={onClose}
            disabled={paying}
          >
            Cancelar
          </button>
        </div>

        <p className="mc-fiados-fineprint">
          Se registra el monto aplicado, no el billete completo. Un abono reduce
          la deuda y no crea una venta nueva. Si fue en efectivo, suma al
          efectivo de hoy; digital o tarjeta quedan como abono declarado, sin
          verificación de pey.
        </p>
      </form>
    </SheetDialog>
  );
}
