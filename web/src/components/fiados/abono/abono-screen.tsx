"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Calculator,
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import { formatMxn } from "@/lib/format";
import { FiadosMobileBar } from "./fiados-mobile-chrome";
import { firstName, nameSlug, parseCents } from "./flow-utils";
import "./abono.css";

type PayMethod = "cash" | "card" | "codi";

const METHODS: ReadonlyArray<{
  id: PayMethod;
  label: string;
  Icon: typeof Banknote;
}> = [
  { id: "cash", label: "Efectivo", Icon: Banknote },
  { id: "card", label: "Tarjeta", Icon: CreditCard },
  { id: "codi", label: "QR", Icon: QrCode },
];

const QUICK_CENTS = [5_000, 20_000, 30_000, 50_000] as const;
const PORTRAITS = ["juan", "maria", "carlos", "elena", "ana"] as const;

function portraitFor(name: string): string {
  const slug = nameSlug(firstName(name));
  return PORTRAITS.find((portrait) => portrait === slug) ?? "juan";
}

interface CreditPayResponse {
  appliedCents?: number;
  balanceCents?: number;
  duplicate?: boolean;
  error?: string;
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

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cpa_${crypto.randomUUID()}`;
  }
  return `cpa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pantalla 18 · Registrar abono.
 *
 * Reutiliza el flujo real `POST /api/credits/[id]/pay` (idempotente con
 * `requestId`) y, al confirmar, navega al recibo con las claves del registro.
 * El recibo vuelve a leer el abono y saldo en la libreta del servidor.
 */
export function AbonoScreen({
  credit,
  initial,
  backHref,
  prefillCents,
}: {
  credit: {
    id: string;
    name: string;
    balanceCents: number;
    originalCents: number;
  };
  initial: string;
  backHref: string;
  prefillCents: number;
}) {
  const router = useRouter();
  const amountId = useId();
  const errorId = useId();
  const [amount, setAmount] = useState(
    prefillCents > 0 ? (prefillCents / 100).toFixed(2) : "",
  );
  const [method, setMethod] = useState<PayMethod>("cash");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestId] = useState(newRequestId);
  const savingRef = useRef(false);

  const requestedCents = parseCents(amount);
  const appliedCents =
    requestedCents === null ? 0 : Math.min(requestedCents, credit.balanceCents);
  const returnedCents =
    requestedCents === null ? 0 : Math.max(0, requestedCents - appliedCents);
  const nextBalanceCents = Math.max(0, credit.balanceCents - appliedCents);
  const portrait = portraitFor(credit.name);
  const firstNameOnly = firstName(credit.name) || credit.name;

  async function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    if (requestedCents === null || requestedCents <= 0) {
      setError("Escribe un monto mayor a cero. No se registró nada.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
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

      if (typeof body.appliedCents !== "number") {
        throw new Error(
          "El abono se registró pero no pude leer el importe aplicado. Revisa la libreta.",
        );
      }

      const params = new URLSearchParams({
        tipo: "abono",
        creditId: credit.id,
        requestId,
      });
      router.push(`/fiados/registrado?${params.toString()}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mc-flow mc-abono">
      <FiadosMobileBar initial={initial} />

      <div className="mc-abono__sheet">
        <header className="mc-abono__head">
          <Link className="mc-abono__back" href={backHref} prefetch={false} aria-label={`Volver a fiados de ${firstNameOnly}`}>
            <ArrowLeft aria-hidden="true" />
          </Link>
          <h1 className="mc-abono__title">Registrar abono</h1>
        </header>

        <div className="mc-abono__body">
          <section className="mc-abono__client" aria-label={`Fiado de ${credit.name}`}>
            <Image
              src={`/assets/spec/fiados-retrato-${portrait}.png`}
              width={121}
              height={111}
              alt=""
              unoptimized
              className="mc-abono__portrait"
            />
            <div className="mc-abono__client-main">
              <p className="mc-abono__client-name">{credit.name}</p>
              <p className="mc-abono__client-label">Saldo actual</p>
              <p className="mc-abono__client-balance">{formatMxn(credit.balanceCents)}</p>
            </div>
            <div className="mc-abono__client-total">
              <ShoppingBag aria-hidden="true" />
              <p className="mc-abono__client-total-label">Total del fiado</p>
              <p className="mc-abono__client-total-value">{formatMxn(credit.originalCents)}</p>
            </div>
          </section>

          <form className="mc-abono__form" onSubmit={registerPayment} noValidate>
            <label className="mc-abono__amount" htmlFor={amountId}>
              <span className="mc-abono__step">Monto del abono</span>
              <span className="mc-abono__field">
                <span className="mc-abono__sign" aria-hidden="true">$</span>
                <input
                  id={amountId}
                  className="mc-abono__input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setTouched(true);
                    setError(null);
                  }}
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={error ? true : undefined}
                  disabled={saving}
                  data-autofocus
                />
              </span>
            </label>

            <div className="mc-abono__quick" role="group" aria-label="Montos rápidos">
              {QUICK_CENTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  className="mc-abono__chip"
                  aria-pressed={requestedCents === cents}
                  onClick={() => {
                    setAmount((cents / 100).toFixed(2));
                    setTouched(true);
                    setError(null);
                  }}
                  disabled={saving}
                >
                  ${cents / 100}
                </button>
              ))}
            </div>

            {touched && returnedCents > 0 ? (
              <p className="mc-abono__notice" role="status">
                Recibes {formatMxn(requestedCents ?? 0)}: se aplican{" "}
                <strong>{formatMxn(appliedCents)}</strong> y devuelves{" "}
                <strong>{formatMxn(returnedCents)}</strong>. El saldo no queda negativo.
              </p>
            ) : null}

            <fieldset className="mc-abono__methods" disabled={saving}>
              <legend className="mc-abono__step mc-abono__step--legend">Método de pago</legend>
              <div className="mc-abono__methods-options">
                {METHODS.map((option) => {
                  const Icon = option.Icon;
                  const selected = method === option.id;
                  return (
                    <label
                      key={option.id}
                      className="mc-abono__method"
                      data-selected={selected ? "true" : "false"}
                    >
                      <input
                        type="radio"
                        name="mc-abono-method"
                        value={option.id}
                        checked={selected}
                        onChange={() => setMethod(option.id)}
                        className="sr-only"
                      />
                      <Icon aria-hidden="true" />
                      <span>{option.label}</span>
                      {selected ? <CheckCircle2 aria-hidden="true" className="mc-abono__method-check" /> : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <section className="mc-abono__newbalance" aria-label="Nuevo saldo del cliente">
              <Calculator aria-hidden="true" />
              <p className="mc-abono__newbalance-copy">
                Nuevo saldo
                <br />
                del cliente
              </p>
              <p className="mc-abono__newbalance-value" aria-live="polite">
                {formatMxn(nextBalanceCents)}
              </p>
            </section>

            {error ? (
              <p id={errorId} className="mc-abono__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mc-abono__cta">
              <button type="submit" className="mc-abono__submit" disabled={saving} aria-busy={saving}>
                {saving ? (
                  <Loader2 className="mc-abono__spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 aria-hidden="true" />
                )}
                {saving ? "Registrando…" : "Registrar abono"}
              </button>
              <Link className="mc-abono__cancel" href={backHref} prefetch={false}>
                Cancelar
              </Link>
            </div>

            <p className="mc-abono__fineprint">
              Un abono reduce la deuda y no crea una venta nueva. En efectivo suma al
              efectivo de hoy; tarjeta y QR quedan como abono declarado, sin
              verificación de pey.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
