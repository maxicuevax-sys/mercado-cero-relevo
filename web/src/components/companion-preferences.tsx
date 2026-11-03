"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/format";

/**
 * Preferencias de acompañamiento. La llave JSON es la fuente de verdad; la
 * llave de sugerencias existe para que la tarjeta "Antes de cerrar" de otro
 * carril pueda consultarla sin acoplarse a este componente.
 */
export const COMPANION_PREFERENCES_KEY = "mercado-cero:companion:v1";
export const COMPANION_SUGGESTIONS_KEY = "mercado-cero:companion:suggestions";
export const COMPANION_CHANGED_EVENT = "mercado-cero:companion-changed";

interface CompanionPreferencesValue {
  suggestions: boolean;
  reminders: boolean;
  explanations: boolean;
}

type PreferenceId = keyof CompanionPreferencesValue;

const DEFAULTS: CompanionPreferencesValue = {
  suggestions: true,
  reminders: true,
  explanations: true,
};

const PREFERENCES: Array<{
  id: PreferenceId;
  title: string;
  description: string;
}> = [
  {
    id: "suggestions",
    title: "Sugerencias para revisar",
    description:
      "Muestra la tarjeta “Antes de cerrar” con ideas pequeñas para revisar tu día.",
  },
  {
    id: "reminders",
    title: "Recordatorios de pendientes",
    description:
      "Guarda tu preferencia para recordar pendientes dentro de la app. Por ahora no enviamos notificaciones push.",
  },
  {
    id: "explanations",
    title: "Explicaciones en contexto",
    description:
      "Muestra textos breves que explican lo que ves. No cambia las operaciones ni los avisos críticos.",
  },
];

function readPreferences(): CompanionPreferencesValue {
  try {
    const raw = window.localStorage.getItem(COMPANION_PREFERENCES_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const value = parsed as Record<string, unknown>;
    if (value.v !== 1) return DEFAULTS;
    return {
      suggestions: value.suggestions !== false,
      reminders: value.reminders !== false,
      explanations: value.explanations !== false,
    };
  } catch {
    // El almacenamiento no es esencial: se usan los valores por defecto.
    return DEFAULTS;
  }
}

function persistPreferences(value: CompanionPreferencesValue): void {
  try {
    window.localStorage.setItem(
      COMPANION_PREFERENCES_KEY,
      JSON.stringify({ v: 1, ...value }),
    );
    window.localStorage.setItem(
      COMPANION_SUGGESTIONS_KEY,
      value.suggestions ? "on" : "off",
    );
  } catch {
    // Sin almacenamiento local la app sigue funcionando en esta sesión.
  }
}

export function CompanionPreferences() {
  const [preferences, setPreferences] =
    useState<CompanionPreferencesValue>(DEFAULTS);
  const headingId = useId();
  const descriptionBase = useId();

  useEffect(() => {
    const stored = readPreferences();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(stored);
    // Reconciliamos la llave compartida para que otro carril vea la
    // preferencia guardada aunque el espejo se haya perdido.
    try {
      window.localStorage.setItem(
        COMPANION_SUGGESTIONS_KEY,
        stored.suggestions ? "on" : "off",
      );
    } catch {
      // Sin almacenamiento local no hay nada que reconciliar.
    }
  }, []);

  const toggle = (id: PreferenceId) => {
    const next = { ...preferences, [id]: !preferences[id] };
    setPreferences(next);
    persistPreferences(next);
    // Un consumidor montado en la misma pestaña (por ejemplo, la tarjeta
    // "Antes de cerrar") puede releer sin esperar a recargar.
    try {
      window.dispatchEvent(
        new CustomEvent(COMPANION_CHANGED_EVENT, {
          detail: { v: 1, ...next },
        }),
      );
    } catch {
      // Si el navegador no permite el evento, queda la llave persistida.
    }
  };

  return (
    <section
      id="companion-preferences"
      aria-labelledby={headingId}
      className="rounded-xl border border-separator bg-surface p-4"
    >
      <h3 id={headingId} className="text-base font-bold text-ink">
        ¿Cómo quieres que te ayude?
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        Elige el acompañamiento que quieres. Se guarda solo en este dispositivo
        y puedes cambiarlo cuando quieras.
      </p>

      <div className="mt-3 space-y-2">
        {PREFERENCES.map((preference) => {
          const pressed = preferences[preference.id];
          const descriptionId = `${descriptionBase}-${preference.id}`;
          return (
            <button
              key={preference.id}
              type="button"
              aria-pressed={pressed}
              aria-describedby={descriptionId}
              onClick={() => toggle(preference.id)}
              className={cn(
                "flex min-h-14 w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-3.5 py-2.5 text-left",
                pressed
                  ? "border-accent bg-green-soft/40"
                  : "border-separator bg-surface-2",
              )}
            >
              <span className="min-w-0 flex-1 basis-[12rem]">
                <span className="block text-sm font-semibold text-ink">
                  {preference.title}
                </span>
                <span
                  id={descriptionId}
                  className="mt-0.5 block text-sm leading-relaxed text-ink-2"
                >
                  {preference.description}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-11 items-center rounded-full border px-0.5",
                    pressed
                      ? "justify-end border-accent bg-accent"
                      : "justify-start border-control-border bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full",
                      pressed ? "bg-surface" : "bg-control-border",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    pressed ? "text-accent" : "text-ink-2",
                  )}
                >
                  {pressed ? "Activado" : "Desactivado"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        Estas preferencias no apagan los avisos críticos de dinero, pagos ni
        cobros pendientes.
      </p>

      <div className="mt-3 border-t border-separator pt-3">
        <p className="text-sm font-semibold text-ink">Voz y privacidad</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          La voz ya se ajusta arriba: el botón de la barra superior la silencia
          y “Velocidad de la voz” cambia el ritmo.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          El audio que grabas mientras mantienes el micrófono se envía a OpenAI
          para transcribirlo. La app no guarda el audio. Si prefieres, escribe
          la venta.
        </p>
      </div>
    </section>
  );
}
