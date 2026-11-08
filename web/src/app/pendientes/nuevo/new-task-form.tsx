"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Clock3, Loader2, NotebookPen } from "lucide-react";
import tasksNative from "@/assets/definitive-a/tasks.png";
import { addDaysToDateKey, mexicoDateKey } from "@/lib/mexico-date";

type DayChoice = "yesterday" | "today" | "tomorrow";

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

function dueIso(day: DayChoice, time: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const today = mexicoDateKey(new Date());
  const key =
    day === "yesterday"
      ? addDaysToDateKey(today, -1)
      : day === "tomorrow"
        ? addDaysToDateKey(today, 1)
        : today;
  const date = new Date(`${key}T${time}:00-06:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function NewTaskForm() {
  const router = useRouter();
  const titleId = useId();
  const timeId = useId();
  const amountId = useId();
  const errorId = useId();
  const [title, setTitle] = useState("");
  const [day, setDay] = useState<DayChoice>("today");
  const [time, setTime] = useState("11:00");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Escribe qué tienes pendiente.");
      return;
    }
    const iso = dueIso(day, time);
    if (!iso) {
      setError("Elige una hora válida.");
      return;
    }
    const amountCents = amount.trim() ? parseAmount(amount) : null;
    if (amount.trim() && (amountCents === null || amountCents <= 0)) {
      setError("El importe relacionado no es un monto válido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          note: amountCents ? `Importe relacionado: $${(amountCents / 100).toFixed(2)}` : null,
          dueAt: iso,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "No pude guardar el pendiente. Intenta de nuevo.");
      }
      router.push("/pendientes?creada=1");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "No pude guardar el pendiente. Intenta de nuevo.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <section className="mc-flow__hero" aria-label="Nuevo pendiente">
        <Image src={tasksNative} alt="" aria-hidden="true" sizes="240px" />
        <div>
          <h2>Anota lo que sigue</h2>
          <p>Anota lo que queda por hacer en tu puesto. Esto no mueve el dinero de la caja.</p>
        </div>
      </section>

      <label className="mc-flow__label" htmlFor={titleId}>
        ¿Qué tienes pendiente?
      </label>
      <div className="mc-flow__field">
        <NotebookPen aria-hidden="true" />
        <input
          id={titleId}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
          maxLength={120}
          autoComplete="off"
          placeholder="Recibir pedido de tortillas"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-autofocus
          disabled={saving}
        />
      </div>

      <p className="mc-flow__label">¿Para cuándo?</p>
      <div className="mc-flow__segmented" role="group" aria-label="Día">
        {(
          [
            ["yesterday", "Ayer"],
            ["today", "Hoy"],
            ["tomorrow", "Mañana"],
          ] as Array<[DayChoice, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={day === value}
            className={day === value ? "is-active" : undefined}
            onClick={() => setDay(value)}
            disabled={saving}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mc-flow__split">
        <label className="mc-flow__label" htmlFor={timeId}>
          ¿A qué hora?
        </label>
        <div className="mc-flow__field mc-flow__field--time">
          <Clock3 aria-hidden="true" />
          <input
            id={timeId}
            type="time"
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              if (error) setError(null);
            }}
            disabled={saving}
          />
        </div>
      </div>

      <label className="mc-flow__label" htmlFor={amountId}>
        Importe relacionado <span className="mc-flow__optional">(opcional)</span>
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
          placeholder="0.00"
          disabled={saving}
        />
      </div>

      <p className="mc-flow__note">
        El recordatorio se ve en Pendientes. No enviamos notificaciones ni
        movemos saldos: es una nota, no un cobro.
      </p>

      {error ? (
        <p id={errorId} role="alert" className="mc-flow__error">
          {error}
        </p>
      ) : null}

      <div className="mc-flow__actions">
        <button type="submit" className="mc-flow__primary" disabled={saving} aria-busy={saving}>
          {saving ? <Loader2 aria-hidden="true" /> : <Check aria-hidden="true" />}
          {saving ? "Guardando…" : "Guardar pendiente"}
        </button>
        <Link className="mc-flow__secondary" href="/pendientes">
          Cancelar
        </Link>
      </div>

      <p className="mc-flow__note">
        <CalendarDays aria-hidden="true" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} />
        La fecha se guarda con la hora de México.
      </p>
    </form>
  );
}
