"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronRight, Loader2, Plus, UserRound } from "lucide-react";
import registerNative from "@/assets/definitive-a/register.png";
import { formatMxn } from "@/lib/format";

type ApiError = { error?: string };

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cred_${crypto.randomUUID()}`;
  }
  return `cred_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

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

export function NewCreditForm({
  todayLabel,
  customers,
}: {
  todayLabel: string;
  customers: Array<{ name: string; balanceCents: number }>;
}) {
  const router = useRouter();
  const customerId = useId();
  const amountId = useId();
  const noteId = useId();
  const errorId = useId();
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestId] = useState(newRequestId);

  const cents = parseAmount(amount);
  const known = customers.find(
    (item) => item.name.toLocaleLowerCase("es-MX") === customer.trim().toLocaleLowerCase("es-MX"),
  );
  const nextBalance = (known?.balanceCents ?? 0) + (cents ?? 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const cleanCustomer = customer.trim();
    if (!cleanCustomer) {
      setError("Escribe el nombre del cliente.");
      return;
    }
    if (cents === null || cents <= 0) {
      setError("Escribe un monto mayor a cero, por ejemplo 150.00.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              description: note.trim() ? `Fiado: ${note.trim()}` : "Venta a fiado",
              quantity: 1,
              unitPriceCents: cents,
            },
          ],
          creditCents: cents,
          customerName: cleanCustomer,
          requestId,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        order?: { creditId?: string | null };
      } & ApiError;
      if (!response.ok || !body.order?.creditId) {
        throw new Error(body.error ?? "No pude registrar el fiado. Intenta de nuevo.");
      }
      const params = new URLSearchParams({
        creditId: body.order.creditId,
        amount: String(cents),
      });
      if (note.trim()) params.set("note", note.trim());
      router.push(`/fiados/registrado?${params.toString()}`);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "No pude registrar el fiado. Intenta de nuevo.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <section className="mc-flow__hero" aria-label="Vende ahora y cobra después">
        <Image src={registerNative} alt="" aria-hidden="true" sizes="240px" />
        <div>
          <h2>Vende ahora y cobra después</h2>
          <p>Registra una venta a crédito para tus clientes de confianza.</p>
        </div>
      </section>

      <label className="mc-flow__label" htmlFor={customerId}>
        Cliente
      </label>
      <div className="mc-flow__field">
        <UserRound aria-hidden="true" />
        <input
          id={customerId}
          type="text"
          value={customer}
          onChange={(event) => {
            setCustomer(event.target.value);
            if (error) setError(null);
          }}
          list={`${customerId}-known`}
          autoComplete="off"
          placeholder="Ej. Juan"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-autofocus
          disabled={saving}
        />
        <datalist id={`${customerId}-known`}>
          {customers.map((item) => (
            <option key={item.name} value={item.name} />
          ))}
        </datalist>
        <ChevronRight className="mc-flow__chevron" aria-hidden="true" />
      </div>
      {known ? (
        <p className="mc-flow__hint">Saldo actual de {known.name}: {formatMxn(known.balanceCents)}</p>
      ) : null}

      <label className="mc-flow__label" htmlFor={amountId}>
        Monto del fiado
      </label>
      <div className="mc-flow__field mc-flow__field--money">
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
          autoComplete="off"
          placeholder="150.00"
          disabled={saving}
        />
      </div>

      <label className="mc-flow__label" htmlFor={noteId}>
        Nota <span className="mc-flow__optional">(opcional)</span>
      </label>
      <div className="mc-flow__field">
        <input
          id={noteId}
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder="Ej. 2 kg de tortilla"
          disabled={saving}
        />
      </div>

      <p className="mc-flow__label">Fecha</p>
      <div className="mc-flow__field">
        <CalendarDays aria-hidden="true" />
        <span>{todayLabel}</span>
      </div>

      <section className="mc-flow__card mc-flow__card--soft" aria-label="Nuevo saldo">
        <p className="mc-flow__row-main">
          <span>Nuevo saldo de {customer.trim() || "tu cliente"}</span>
          <strong style={{ display: "block", marginTop: 6, font: "700 2.4rem/1.1 Georgia, serif", color: "var(--flow-green)" }}>
            {formatMxn(nextBalance)}
          </strong>
        </p>
      </section>

      {error ? (
        <p id={errorId} role="alert" className="mc-flow__error">
          {error}
        </p>
      ) : null}

      <div className="mc-flow__actions">
        <button type="submit" className="mc-flow__primary" disabled={saving} aria-busy={saving}>
          {saving ? <Loader2 className="mc-flow__spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {saving ? "Registrando…" : "Registrar fiado"}
        </button>
        <Link className="mc-flow__secondary" href="/fiados">
          <Check aria-hidden="true" />
          Cancelar
        </Link>
      </div>
    </form>
  );
}
