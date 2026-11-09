"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Calculator,
  Check,
  CreditCard,
  Loader2,
  Smartphone,
  ShoppingBag,
} from "lucide-react";
import { formatMxn } from "@/lib/format";
import type { Credit } from "@/lib/types";

type Method = "cash" | "card" | "codi";

const QUICK = [5000, 20000, 30000, 50000];

/** Etiqueta corta de los montos rápidos, como la referencia ($50, no $50.00). */
function shortMxn(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatMxn(cents);
}

const METHODS: Array<{ id: Method; label: string; Icon: typeof Banknote }> = [
  { id: "cash", label: "Efectivo", Icon: Banknote },
  { id: "card", label: "Tarjeta", Icon: CreditCard },
  { id: "codi", label: "Digital recibido", Icon: Smartphone },
];

function parseAmount(value: string): number | null {
  let clean = value.trim().replace(/[$\s]/g, "");
  if (!clean) return null;
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

export function AbonoForm({ credit, initialMethod = "cash" }: { credit: Credit; initialMethod?: Method }) {
  const router = useRouter();
  const amountId = useId();
  const errorId = useId();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>(initialMethod);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestId] = useState(newRequestId);

  const cents = parseAmount(amount) ?? 0;
  const appliedCents = Math.min(cents, credit.balanceCents);
  const nextBalance = Math.max(0, credit.balanceCents - appliedCents);
  const name = credit.customerName?.trim() || "Cliente";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (cents <= 0) {
      setError("Escribe un monto mayor a cero.");
      return;
    }
    if (cents > credit.balanceCents) {
      setError(
        `El abono no puede pasar del saldo (${formatMxn(credit.balanceCents)}). Ajusta el monto.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/credits/${encodeURIComponent(credit.id)}/pay`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          method,
          requestId,
          expectedBalanceCents: credit.balanceCents,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "No pude registrar el abono. Intenta de nuevo.");
      }
      router.push(`/fiados/${encodeURIComponent(credit.id)}?abonoRequestId=${encodeURIComponent(requestId)}`);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "No pude registrar el abono. Intenta de nuevo.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <section
        className="mc-flow__row mc-flow__row--soft"
        aria-label={`${name}, saldo ${formatMxn(credit.balanceCents)}`}
      >
        <Image src="/assets/spec/fiados-avatar-juan.png" width={121} height={111} alt="" unoptimized />
        <div className="mc-flow__row-main">
          <strong>{name}</strong>
          <span>Saldo actual</span>
          <b className="mc-flow__row-amount">{formatMxn(credit.balanceCents)}</b>
        </div>
        <div className="mc-flow__row-side">
          <ShoppingBag aria-hidden="true" />
          <span>Total del fiado</span>
          <strong>{formatMxn(credit.originalCents)}</strong>
        </div>
      </section>

      <label className="mc-flow__label" htmlFor={amountId}>
        Monto del abono
      </label>
      <div className="mc-flow__field mc-flow__field--money mc-flow__field--money-soft">
        <span className="mc-flow__sign" aria-hidden="true">$</span>
        <input
          id={amountId}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            if (error) setError(null);
          }}
          placeholder="0.00"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-autofocus
          disabled={saving}
        />
      </div>

      <div className="mc-flow__chips" role="group" aria-label="Montos rápidos">
        {QUICK.map((value) => (
          <button
            key={value}
            type="button"
            className={cents === value ? "mc-flow__chip is-active" : "mc-flow__chip"}
            aria-label={`Abonar ${formatMxn(value)}`}
            title={value > credit.balanceCents ? "Mayor al saldo pendiente" : undefined}
            onClick={() => {
              setAmount((value / 100).toFixed(2));
              if (error) setError(null);
            }}
            disabled={saving || value > credit.balanceCents}
          >
            {shortMxn(value)}
          </button>
        ))}
      </div>
      {QUICK.some((value) => value > credit.balanceCents) ? (
        <p className="mc-flow__hint">
          Los montos mayores al saldo ({formatMxn(credit.balanceCents)}) quedan deshabilitados.
        </p>
      ) : null}

      <p className="mc-flow__label">Método de pago</p>
      <div className="mc-flow__methods" role="group" aria-label="Método de pago">
        {METHODS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={method === id ? "mc-flow__method is-active" : "mc-flow__method"}
            aria-pressed={method === id}
            onClick={() => setMethod(id)}
            disabled={saving}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            {method === id ? <Check aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <p className="mc-flow__hint">
        {method === "cash"
          ? "Suma al efectivo de hoy y al corte de caja."
          : "Registra un pago que ya recibiste. Queda como abono declarado; pey no lo verifica y esta pantalla no genera un QR."}
      </p>

      <section className="mc-flow__balance" aria-label="Nuevo saldo">
        <span className="mc-flow__balance-icon" aria-hidden="true">
          <Calculator />
        </span>
        <span className="mc-flow__balance-label">Nuevo saldo del cliente</span>
        <strong className="mc-flow__balance-value">{formatMxn(nextBalance)}</strong>
      </section>

      {error ? (
        <p id={errorId} role="alert" className="mc-flow__error">
          {error}
        </p>
      ) : null}

      <div className="mc-flow__actions">
        <button type="submit" className="mc-flow__primary" disabled={saving} aria-busy={saving}>
          {saving ? <Loader2 aria-hidden="true" /> : <Check aria-hidden="true" />}
          {saving ? "Registrando…" : "Registrar abono"}
        </button>
        <Link className="mc-flow__secondary" href={`/fiados/${credit.id}`}>
          Cancelar
        </Link>
      </div>
      <p className="mc-flow__note">
        Se registra el monto aplicado, no el billete completo. Un abono reduce
        la deuda y no crea una venta nueva.
      </p>
    </form>
  );
}
