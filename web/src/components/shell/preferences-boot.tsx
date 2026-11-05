"use client";

import { useEffect } from "react";

/** Claves exactas que guardan Ajustes y la Caja clásica en localStorage. */
export const PREFERENCE_KEYS = {
  textSize: "mercado-cero:text-size",
  contrast: "mercado-cero:contrast",
  voiceRate: "mercado-cero:voice-rate",
  muted: "mercado-cero:muted",
} as const;

/** Evento que se emite al guardar una preferencia (Ajustes / cualquier pantalla). */
export const PREFERENCES_CHANGED_EVENT = "mercado-cero:preferences-changed";

export type StoredPreferences = {
  textSize: string | null;
  contrast: string | null;
  voiceRate: string | null;
  muted: string | null;
};

/** Snapshot de preferencias; tolera storage no disponible (modo privado, etc.). */
export function readStoredPreferences(): StoredPreferences {
  try {
    const storage = window.localStorage;
    return {
      textSize: storage.getItem(PREFERENCE_KEYS.textSize),
      contrast: storage.getItem(PREFERENCE_KEYS.contrast),
      voiceRate: storage.getItem(PREFERENCE_KEYS.voiceRate),
      muted: storage.getItem(PREFERENCE_KEYS.muted),
    };
  } catch {
    return { textSize: null, contrast: null, voiceRate: null, muted: null };
  }
}

/**
 * Aplica al documento las preferencias visuales. `layout.tsx` ya las aplica
 * antes del primer paint; repetirlo aquí conserva el estado al navegar por SPA
 * y al cambiarlas desde Ajustes. El alto contraste forzado de /inicio lo
 * gobierna `layout.tsx` (`data-forced-contrast`): aquí no se pisa.
 */
function applyVisualPreferences(preferences: StoredPreferences): void {
  try {
    const root = document.documentElement;
    if (preferences.textSize === "large" || preferences.textSize === "xlarge") {
      root.dataset.textSize = preferences.textSize;
    } else {
      root.removeAttribute("data-text-size");
    }

    if (root.dataset.forcedContrast === "1") return;
    if (preferences.contrast === "high") {
      root.dataset.contrast = "high";
    } else {
      root.removeAttribute("data-contrast");
    }
  } catch {
    // Sin DOM accesible no hay preferencias visuales que aplicar.
  }
}

/**
 * Puente único entre las preferencias guardadas y el documento. Se monta una
 * vez dentro de `AppShell`, así todas las pantallas nuevas respetan tamaño de
 * texto y contraste al cargar y al navegar. No renderiza UI.
 */
export function PreferencesBoot() {
  useEffect(() => {
    const sync = () => applyVisualPreferences(readStoredPreferences());
    sync();
    window.addEventListener(PREFERENCES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, sync);
  }, []);

  return null;
}
