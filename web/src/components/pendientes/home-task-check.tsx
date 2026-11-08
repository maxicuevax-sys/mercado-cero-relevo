"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

/** Checkbox real de una tarea del Inicio; persiste con PATCH /api/tasks/[id]. */
export function HomeTaskCheck({
  taskId,
  initialDone,
  label,
  fixture = false,
}: {
  taskId: string;
  initialDone: boolean;
  label: string;
  fixture?: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy || pending) return;
    if (fixture) {
      // Los ejemplos no existen en la base; no se finge persistencia.
      setDone((value) => !value);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: done ? "reopen" : "complete" }),
      });
      if (!response.ok) throw new Error("No se pudo actualizar el pendiente.");
      const next = !done;
      setDone(next);
      startTransition(() => router.refresh());
    } catch {
      // Mantiene el estado anterior si el servidor rechaza el cambio.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`inicio-task__check${done ? " inicio-task__check--done" : ""}`}
      aria-label={done ? `Reabrir pendiente: ${label}` : `Marcar como hecho: ${label}`}
      aria-pressed={done}
      aria-busy={busy || pending}
      disabled={busy || pending}
      onClick={() => void toggle()}
    >
      {busy || pending ? (
        <Loader2 className="inicio-task__check-spin" aria-hidden="true" />
      ) : done ? (
        <Check aria-hidden="true" />
      ) : null}
    </button>
  );
}
