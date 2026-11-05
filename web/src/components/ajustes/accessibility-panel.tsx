"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RefreshCw, Volume2 } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Controles reales de accesibilidad de la app.
 *
 * Las llaves de `localStorage` son las mismas que ya usaba la Caja clásica y
 * los valores son exactamente los que esperan el arranque del layout y el
 * shell. Al cambiar, además de guardar, se aplican al `<html>` y se emite
 * `mercado-cero:preferences-changed` para que el shell (Worker A) re-aplique
 * sin recargar.
 */

const TEXT_SIZE_KEY = "mercado-cero:text-size";
const CONTRAST_KEY = "mercado-cero:contrast";
const VOICE_RATE_KEY = "mercado-cero:voice-rate";
const MUTED_KEY = "mercado-cero:muted";

export const PREFERENCES_CHANGED_EVENT = "mercado-cero:preferences-changed";

type TextSize = "normal" | "large" | "xlarge";
type ContrastMode = "normal" | "high";
type VoiceRate = "slow" | "normal" | "fast";

type Preferences = {
  textSize: TextSize;
  contrast: ContrastMode;
  voiceRate: VoiceRate;
  muted: boolean;
};

const DEFAULTS: Preferences = {
  textSize: "normal",
  contrast: "normal",
  voiceRate: "normal",
  muted: false,
};

const TEXT_SIZE_OPTIONS: ReadonlyArray<{ id: TextSize; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "large", label: "Grande" },
  { id: "xlarge", label: "Muy grande" },
];

const CONTRAST_OPTIONS: ReadonlyArray<{ id: ContrastMode; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "high", label: "Alto" },
];

const VOICE_RATE_OPTIONS: ReadonlyArray<{ id: VoiceRate; label: string }> = [
  { id: "slow", label: "Lenta" },
  { id: "normal", label: "Normal" },
  { id: "fast", label: "Rápida" },
];

const MUTED_OPTIONS: ReadonlyArray<{ id: "on" | "off"; label: string }> = [
  { id: "on", label: "Con voz" },
  { id: "off", label: "Silenciada" },
];

function readStoredPreferences(): Preferences {
  try {
    const textSize = window.localStorage.getItem(TEXT_SIZE_KEY);
    const contrast = window.localStorage.getItem(CONTRAST_KEY);
    const voiceRate = window.localStorage.getItem(VOICE_RATE_KEY);
    return {
      textSize:
        textSize === "large" || textSize === "xlarge" ? textSize : "normal",
      contrast: contrast === "high" ? "high" : "normal",
      voiceRate:
        voiceRate === "slow" || voiceRate === "fast" ? voiceRate : "normal",
      muted: window.localStorage.getItem(MUTED_KEY) === "1",
    };
  } catch {
    // Sin almacenamiento local se usan los valores por defecto.
    return DEFAULTS;
  }
}

function applyToDocument(preferences: Preferences): void {
  const root = document.documentElement;
  root.dataset.textSize = preferences.textSize;
  root.dataset.contrast = preferences.contrast;
}

function persistPreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(TEXT_SIZE_KEY, preferences.textSize);
    window.localStorage.setItem(CONTRAST_KEY, preferences.contrast);
    window.localStorage.setItem(VOICE_RATE_KEY, preferences.voiceRate);
    window.localStorage.setItem(MUTED_KEY, preferences.muted ? "1" : "0");
  } catch {
    // La app sigue funcionando en esta sesión aunque no haya almacenamiento.
  }
}

function broadcastPreferences(preferences: Preferences): void {
  try {
    window.dispatchEvent(
      new CustomEvent(PREFERENCES_CHANGED_EVENT, {
        detail: {
          textSize: preferences.textSize,
          contrast: preferences.contrast,
          voiceRate: preferences.voiceRate,
          muted: preferences.muted,
        },
      }),
    );
  } catch {
    // Sin CustomEvent queda aplicado el documento y guardado el valor.
  }
}

function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

export function AccessibilityPanel() {
  const headingId = useId();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [announcement, setAnnouncement] = useState("");
  const lastSpokenRef = useRef("");

  useEffect(() => {
    const stored = readStoredPreferences();
    // Refleja lo guardado sin reescribirlo ni emitir eventos: de eso se
    // encarga el arranque del layout. Se hace tras montar para no romper la
    // hidratación, porque en el servidor no existe localStorage.
    applyToDocument(stored);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(stored);
  }, []);

  useEffect(() => {
    return () => {
      if (speechSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  function speak(text: string) {
    if (!text) {
      setAnnouncement("No hay texto para leer en esta pantalla.");
      return;
    }
    if (preferences.muted) {
      setAnnouncement("La voz está silenciada. Actívala para escuchar.");
      return;
    }
    if (!speechSupported()) {
      setAnnouncement("Este dispositivo no puede leer en voz alta.");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = "es-MX";
      utterance.rate =
        preferences.voiceRate === "slow"
          ? 0.85
          : preferences.voiceRate === "fast"
            ? 1.15
            : 1;
      lastSpokenRef.current = text;
      window.speechSynthesis.speak(utterance);
      setAnnouncement("Leyendo en voz alta…");
    } catch {
      setAnnouncement("No pude leer en voz alta en este dispositivo.");
    }
  }

  function readScreen() {
    const main = document.querySelector("main");
    if (!main) {
      speak("");
      return;
    }
    const parts = Array.from(
      main.querySelectorAll<HTMLElement>("h1, h2, h3, p"),
    )
      .filter(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.closest("[aria-live]") &&
          !element.closest("dialog") &&
          !element.closest("[aria-hidden='true']"),
      )
      .map((element) => element.innerText.trim())
      .filter(Boolean);
    const text = Array.from(new Set(parts)).join(". ").slice(0, 900);
    speak(text);
  }

  function repeatLast() {
    const last = lastSpokenRef.current;
    if (!last) {
      setAnnouncement("Todavía no he leído nada en esta pantalla.");
      return;
    }
    speak(last);
  }

  function update(patch: Partial<Preferences>, message: string) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    persistPreferences(next);
    applyToDocument(next);
    broadcastPreferences(next);
    if (next.muted && speechSupported()) {
      window.speechSynthesis.cancel();
    }
    setAnnouncement(message);
  }

  function chooseTextSize(id: TextSize) {
    const label = TEXT_SIZE_OPTIONS.find((option) => option.id === id)?.label;
    update({ textSize: id }, `Tamaño del texto: ${label ?? id}.`);
  }

  function chooseContrast(id: ContrastMode) {
    const label = CONTRAST_OPTIONS.find((option) => option.id === id)?.label;
    update({ contrast: id }, `Contraste: ${label ?? id}.`);
  }

  function chooseVoiceRate(id: VoiceRate) {
    const label = VOICE_RATE_OPTIONS.find((option) => option.id === id)?.label;
    update({ voiceRate: id }, `Velocidad de la voz: ${label ?? id}.`);
  }

  function chooseMuted(muted: boolean) {
    update({ muted }, muted ? "Voz silenciada." : "Voz activada.");
  }

  return (
    <section
      className="mc-op-panel mc-ajustes-panel"
      aria-labelledby={headingId}
    >
      <div className="mc-op-panel__head">
        <h2 id={headingId} className="mc-op-panel__title">
          Accesibilidad
        </h2>
        <p className="mc-op-panel__meta">Se guarda en este dispositivo</p>
      </div>

      <div className="mc-op-panel__body">
        <p className="mc-ajustes-lead">
          Ajusta el texto, el contraste y la voz. Los cambios se aplican a toda
          la app y quedan guardados en este dispositivo.
        </p>

        <div className="mc-ajustes-group">
          <p id={`${headingId}-size`} className="mc-ajustes-group__label">
            Tamaño del texto
          </p>
          <div
            role="group"
            aria-labelledby={`${headingId}-size`}
            className="mc-ajustes-options"
          >
            {TEXT_SIZE_OPTIONS.map((option) => {
              const pressed = preferences.textSize === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => chooseTextSize(option.id)}
                  className={cn(
                    "mc-ajustes-option",
                    pressed && "mc-ajustes-option--active",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mc-ajustes-group">
          <p id={`${headingId}-contrast`} className="mc-ajustes-group__label">
            Contraste
          </p>
          <div
            role="group"
            aria-labelledby={`${headingId}-contrast`}
            className="mc-ajustes-options"
          >
            {CONTRAST_OPTIONS.map((option) => {
              const pressed = preferences.contrast === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => chooseContrast(option.id)}
                  className={cn(
                    "mc-ajustes-option",
                    pressed && "mc-ajustes-option--active",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mc-ajustes-group">
          <p id={`${headingId}-rate`} className="mc-ajustes-group__label">
            Velocidad de la voz
          </p>
          <div
            role="group"
            aria-labelledby={`${headingId}-rate`}
            className="mc-ajustes-options"
          >
            {VOICE_RATE_OPTIONS.map((option) => {
              const pressed = preferences.voiceRate === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => chooseVoiceRate(option.id)}
                  className={cn(
                    "mc-ajustes-option",
                    pressed && "mc-ajustes-option--active",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mc-ajustes-group">
          <p id={`${headingId}-muted`} className="mc-ajustes-group__label">
            Silencio
          </p>
          <div
            role="group"
            aria-labelledby={`${headingId}-muted`}
            className="mc-ajustes-options"
          >
            {MUTED_OPTIONS.map((option) => {
              const pressed =
                option.id === "off" ? preferences.muted : !preferences.muted;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => chooseMuted(option.id === "off")}
                  className={cn(
                    "mc-ajustes-option",
                    pressed && "mc-ajustes-option--active",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mc-ajustes-hint">
            Silenciar la voz no apaga los avisos de dinero, pagos ni cobros
            pendientes: solo la lectura en voz alta.
          </p>
        </div>

        <div className="mc-ajustes-actions">
          <button
            type="button"
            onClick={readScreen}
            className="mc-ajustes-speech"
          >
            <Volume2 className="mc-ajustes-icon" aria-hidden="true" />
            Leer esta pantalla
          </button>
          <button
            type="button"
            onClick={repeatLast}
            className="mc-ajustes-speech"
          >
            <RefreshCw className="mc-ajustes-icon" aria-hidden="true" />
            Repetir último aviso
          </button>
        </div>

        <p role="status" aria-live="polite" className="mc-ajustes-feedback">
          {announcement}
        </p>

        <p className="mc-ajustes-hint">
          La lectura en voz alta usa la voz de tu navegador; el texto no se
          envía a ningún servidor desde esta pantalla.
        </p>
      </div>
    </section>
  );
}
