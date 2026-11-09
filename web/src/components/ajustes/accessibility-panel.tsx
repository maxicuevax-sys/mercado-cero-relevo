"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { RefreshCw, Volume2 } from "lucide-react";
import { cn } from "@/lib/format";
import { applyBrowserPreferences, readBrowserPreferences, subscribeBrowserPreferences, updateBrowserPreferences, type BrowserPreferences } from "@/lib/browser-preferences";
import ajustesIcon from "@/assets/brand/iconos/transparent/ajustes.png";
import listaIcon from "@/assets/brand/iconos/transparent/lista.png";
import microfonoIcon from "@/assets/brand/iconos/transparent/microfono.png";

/**
 * Controles reales de accesibilidad de la app.
 *
 * Las llaves de `localStorage` son las mismas que ya usaba la Caja clÃ¡sica y
 * los valores son exactamente los que esperan el arranque del layout y el
 * shell. Al cambiar, ademÃ¡s de guardar, se aplican al `<html>` y se emite
 * `mercado-cero:preferences-changed` para que el shell (Worker A) re-aplique
 * sin recargar.
 */

type TextSize = BrowserPreferences["textSize"];
type ContrastMode = BrowserPreferences["contrast"];
type VoiceRate = BrowserPreferences["voiceRate"];
const DEFAULTS: BrowserPreferences = { textSize: "normal", contrast: "normal", voiceRate: "normal", muted: false };

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
  { id: "fast", label: "RÃ¡pida" },
];

const MUTED_OPTIONS: ReadonlyArray<{ id: "on" | "off"; label: string }> = [
  { id: "on", label: "Con voz" },
  { id: "off", label: "Silenciada" },
];

function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

export function AccessibilityPanel() {
  const headingId = useId();
  const [preferences, setPreferences] = useState<BrowserPreferences>(DEFAULTS);
  const [announcement, setAnnouncement] = useState("");
  const lastSpokenRef = useRef("");

  useEffect(() => {
    const synchronize = () => {
      const current = readBrowserPreferences();
      applyBrowserPreferences(current);
      setPreferences(current);
    };
    const unsubscribe = subscribeBrowserPreferences(synchronize);
    // Read browser-only state after hydration.
    synchronize();
    return unsubscribe;
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
      setAnnouncement("La voz estÃ¡ silenciada. ActÃ­vala para escuchar.");
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
      setAnnouncement("Leyendo en voz altaâ€¦");
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
      setAnnouncement("TodavÃ­a no he leÃ­do nada en esta pantalla.");
      return;
    }
    speak(last);
  }

  function update(patch: Partial<BrowserPreferences>, message: string) {
    const next = updateBrowserPreferences(patch);
    setPreferences(next);
    if (next.muted && speechSupported()) {
      window.speechSynthesis.cancel();
    }
    setAnnouncement(message);
  }

  function chooseTextSize(id: TextSize) {
    const label = TEXT_SIZE_OPTIONS.find((option) => option.id === id)?.label;
    update({ textSize: id }, `TamaÃ±o del texto: ${label ?? id}.`);
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
    <section className="mc-ajustes-panel" aria-labelledby={headingId}>
      <div className="mc-ajustes-panel__head">
        <div className="mc-ajustes-panel__heading">
          <h2 id={headingId} className="mc-art-section-title">
            Accesibilidad
          </h2>
          <p className="mc-ajustes-lead">
            Ajusta el texto, el contraste y la voz. Los cambios se aplican a toda
            la app. Se guardan en este dispositivo si el navegador lo permite.
          </p>
        </div>
        <span className="mc-art-stamp mc-art-stamp--green">
          Se aplica al instante
        </span>
      </div>

      <div className="mc-ajustes-groups">
        <section
          className="mc-art-paper mc-ajustes-card"
          aria-labelledby={`${headingId}-visual`}
        >
          <div className="mc-ajustes-card__head">
            <span className="mc-art-medallion">
              <Image
                src={ajustesIcon}
                alt=""
                aria-hidden="true"
                className="mc-art-medallion__icon"
                sizes="32px"
              />
            </span>
            <div className="mc-ajustes-card__copy">
              <h3 id={`${headingId}-visual`} className="mc-ajustes-card__title">
                Texto y contraste
              </h3>
              <p className="mc-ajustes-card__note">
                Para leer sin forzar la vista.
              </p>
            </div>
          </div>

          <div className="mc-ajustes-group">
            <p id={`${headingId}-size`} className="mc-ajustes-group__label">
              TamaÃ±o del texto
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
        </section>

        <section
          className="mc-art-paper mc-ajustes-card"
          aria-labelledby={`${headingId}-voice`}
        >
          <div className="mc-ajustes-card__head">
            <span className="mc-art-medallion mc-art-medallion--saffron">
              <Image
                src={microfonoIcon}
                alt=""
                aria-hidden="true"
                className="mc-art-medallion__icon"
                sizes="32px"
              />
            </span>
            <div className="mc-ajustes-card__copy">
              <h3 id={`${headingId}-voice`} className="mc-ajustes-card__title">
                Voz
              </h3>
              <p className="mc-ajustes-card__note">
                La lectura en voz alta, a tu ritmo.
              </p>
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
        </section>

        <section
          className="mc-art-paper mc-ajustes-card"
          aria-labelledby={`${headingId}-read`}
        >
          <div className="mc-ajustes-card__head">
            <span className="mc-art-medallion mc-art-medallion--clay">
              <Image
                src={listaIcon}
                alt=""
                aria-hidden="true"
                className="mc-art-medallion__icon"
                sizes="32px"
              />
            </span>
            <div className="mc-ajustes-card__copy">
              <h3 id={`${headingId}-read`} className="mc-ajustes-card__title">
                Leer y repetir
              </h3>
              <p className="mc-ajustes-card__note">
                Escucha esta pantalla con la voz de tu navegador.
              </p>
            </div>
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
              Repetir Ãºltimo aviso
            </button>
          </div>

          <p role="status" aria-live="polite" className="mc-ajustes-feedback">
            {announcement}
          </p>

          <p className="mc-ajustes-hint">
            La lectura en voz alta usa la voz de tu navegador; el texto no se
            envÃ­a a ningÃºn servidor desde esta pantalla.
          </p>
        </section>
      </div>
    </section>
  );
}
