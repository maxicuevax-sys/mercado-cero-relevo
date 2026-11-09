"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readBrowserPreferences } from "@/lib/browser-preferences";
import { toSpeechText } from "@/lib/speech";

export function ReadReceipt({ text }: { text: string }) {
  const active = useRef<SpeechSynthesisUtterance | null>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (active.current) {
        active.current = null;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggleReading() {
    if (active.current) {
      active.current = null;
      window.speechSynthesis.cancel();
      setReading(false);
      setMessage("");
      return;
    }

    const { muted, voiceRate: rate } = readBrowserPreferences();
    if (muted) {
      setMessage("La voz está silenciada en Ajustes.");
      return;
    }
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
      setMessage("Este navegador no admite lectura en voz alta.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(toSpeechText(text));
    utterance.lang = "es-MX";
    utterance.rate = rate === "slow" ? 0.85 : rate === "fast" ? 1.15 : 1;
    function finish(error = "") {
      if (active.current !== utterance) return;
      active.current = null;
      setReading(false);
      setMessage(error);
    }
    utterance.onend = () => finish();
    utterance.onerror = () => finish("No se pudo reproducir la voz en este navegador.");
    active.current = utterance;
    setReading(true);
    setMessage("");
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish("No se pudo reproducir la voz en este navegador.");
    }
  }

  return (
    <div className="mc-corte-receipt__voice">
      <button
        type="button"
        className="mc-corte-refresh"
        onClick={toggleReading}
        aria-label={reading ? "Detener lectura del resumen" : "Escuchar resumen del día"}
      >
        {reading ? (
          <Square className="mc-corte-refresh__icon" aria-hidden="true" />
        ) : (
          <Volume2 className="mc-corte-refresh__icon" aria-hidden="true" />
        )}
        {reading ? "Detener" : "Escuchar"}
      </button>
      <p className="mc-corte-receipt__voice-status" role="status">{message}</p>
    </div>
  );
}
