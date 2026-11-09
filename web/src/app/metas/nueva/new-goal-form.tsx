"use client";

import Image from "next/image";
import { useClientReady } from "@/lib/use-client-ready";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Coins, Loader2, PiggyBank, Target } from "lucide-react";
import savingsNative from "@/assets/definitive-a/savings.png";
import { formatMxn } from "@/lib/format";

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

function deadlineFromDateInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00-06:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requestKey(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function NewGoalForm() {
  const ready = useClientReady();
  const router = useRouter();
  const titleId = useId();
  const targetId = useId();
  const initialId = useId();
  const deadlineId = useId();
  const errorId = useId();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [initial, setInitial] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const targetCents = parseAmount(target);
  const initialCents = initial.trim() ? parseAmount(initial) : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Ponle un nombre a la meta.");
      return;
    }
    if (targetCents === null || targetCents <= 0) {
      setError("Escribe un monto objetivo mayor a cero, por ejemplo 8000.");
      return;
    }
    if (initialCents === null) {
      setError("Revisa cuánto has apartado. Escribe un monto válido.");
      return;
    }
    if (initialCents > targetCents) {
      setError("El ahorro inicial no puede pasar del monto objetivo.");
      return;
    }
    const deadlineIso = deadline ? deadlineFromDateInput(deadline) : null;
    if (deadline && !deadlineIso) {
      setError("Elige una fecha límite válida.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          targetCents,
          ...(deadlineIso ? { deadline: deadlineIso } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        goal?: { id?: string };
        error?: string;
      };
      if (!response.ok || !body.goal?.id) {
        throw new Error(body.error ?? "No pude guardar la meta. Intenta de nuevo.");
      }
      if (initialCents > 0) {
        const contribution = await fetch(
          `/api/goals/${encodeURIComponent(body.goal.id)}/contribute`,
          {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({
              amountCents: initialCents,
              requestId: requestKey("gci"),
            }),
          },
        );
        if (!contribution.ok) {
          throw new Error(
            "La meta se creó, pero no pude registrar el ahorro inicial. Ábrela desde Metas para apartarlo.",
          );
        }
      }
      router.push("/metas?creada=1");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "No pude guardar la meta. Intenta de nuevo.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={!ready || saving} noValidate>
      <section className="mc-flow__hero" aria-label="Ahorra para tus objetivos">
        <Image src={savingsNative} alt="" aria-hidden="true" sizes="240px" />
        <div>
          <h2>Ahorra para tus objetivos</h2>
          <p>Define una meta, un monto y lleva el progreso.</p>
        </div>
      </section>

      <label className="mc-flow__label" htmlFor={titleId}>
        Nombre de la meta
      </label>
      <div className="mc-flow__field">
        <Target aria-hidden="true" />
        <input
          id={titleId}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
          maxLength={80}
          autoComplete="off"
          placeholder="Ej. Comprar refrigerador"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-autofocus
          disabled={!ready || saving}
        />
      </div>

      <label className="mc-flow__label" htmlFor={targetId}>
        Monto objetivo
      </label>
      <div className="mc-flow__field mc-flow__field--money">
        <Coins aria-hidden="true" />
        <input
          id={targetId}
          type="text"
          inputMode="decimal"
          value={target}
          onChange={(event) => {
            setTarget(event.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          placeholder="8,000.00"
          disabled={!ready || saving}
        />
      </div>

      <label className="mc-flow__label" htmlFor={initialId}>
        Ahorro inicial <span className="mc-flow__optional">(opcional)</span>
      </label>
      <div className="mc-flow__field mc-flow__field--money">
        <PiggyBank aria-hidden="true" />
        <input
          id={initialId}
          type="text"
          inputMode="decimal"
          value={initial}
          onChange={(event) => {
            setInitial(event.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          placeholder="0.00"
          disabled={!ready || saving}
        />
      </div>

      <label className="mc-flow__label" htmlFor={deadlineId}>
        Fecha límite <span className="mc-flow__optional">(opcional)</span>
      </label>
      <div className="mc-flow__field">
        <CalendarDays aria-hidden="true" />
        <input
          id={deadlineId}
          type="date"
          value={deadline}
          onChange={(event) => {
            setDeadline(event.target.value);
            if (error) setError(null);
          }}
          disabled={!ready || saving}
        />
      </div>

      <section className="mc-flow__card mc-flow__card--soft" aria-label="Vista previa de la meta">
        <div className="mc-flow__preview">
          <span className="mc-flow__preview-art" aria-hidden="true">
            <PiggyBank />
          </span>
          <div className="mc-flow__row-main">
            <strong>{title.trim() || "Tu nueva meta"}</strong>
            <span>
              {formatMxn(initialCents ?? 0)} de {formatMxn(targetCents ?? 0)}
            </span>
            <span className="mc-flow__bar" aria-hidden="true">
              <i
                style={{
                  width: `${targetCents && initialCents ? Math.min(100, Math.round((initialCents / targetCents) * 100)) : 0}%`,
                }}
              />
            </span>
          </div>
          <b className="mc-flow__pct">
            {targetCents && initialCents
              ? `${Math.min(100, Math.round((initialCents / targetCents) * 100))}%`
              : "0%"}
          </b>
        </div>
      </section>

      {error ? (
        <p id={errorId} role="alert" className="mc-flow__error">
          {error}
        </p>
      ) : null}

      <div className="mc-flow__actions">
        <button type="submit" className="mc-flow__primary" disabled={!ready || saving} aria-busy={saving}>
          {saving ? <Loader2 aria-hidden="true" /> : <Check aria-hidden="true" />}
          {saving ? "Guardando…" : "Crear meta"}
        </button>
        <Link className="mc-flow__secondary" href="/metas">
          Cancelar
        </Link>
      </div>
      <p className="mc-flow__note">
        Aquí anotas lo que apartas. No es una cuenta bancaria y el efectivo sigue en tu caja.
      </p>
    </form>
  );
}
