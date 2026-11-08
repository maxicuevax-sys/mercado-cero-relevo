"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Plus, ScanBarcode, Square, Store, X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { BusinessType } from "@/lib/business-profile";
import { BUSINESS_PRESETS } from "@/lib/business-presets";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { draftTotalCents, lineTotalCents, newLineId, type DraftLine } from "./types";
import { voiceDraft } from "./voice-draft";
import "./sale-voice-spec.css";

type Phase = "idle" | "permission" | "recording" | "transcribing" | "parsing";
const SUGGESTIONS = [
  { label: "Manzana", image: "manzana" },
  { label: "Jitomate", image: "jitomate" },
  { label: "Huevo", image: "huevo" },
];

/** Mismo MediaRecorder y APIs que Caja clásica. Solo propone conceptos, sin mutar pedidos. */
export function SaleVoice({ disabled, onAdd, businessType }: { disabled: boolean; onAdd: (lines: DraftLine[]) => boolean; businessType?: BusinessType }) {
  const preset = businessType ? BUSINESS_PRESETS[businessType] : null;
  const suggestions: readonly { label: string; text?: string; image?: string }[] = preset?.suggestions ?? SUGGESTIONS;
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<DraftLine[]>([]);
  const [notice, setNotice] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const busy = phase !== "idle";
  const invalidate = useCallback(() => { generation.current++; }, []);

  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const cancel = useCallback(() => {
    invalidate();
    request.current?.abort();
    request.current = null;
    const current = recorder.current;
    if (current) {
      current.onstop = null;
      current.ondataavailable = null;
      if (current.state !== "inactive") current.stop();
    }
    recorder.current = null;
    release();
    active.current = false;
    setPhase("idle");
    setNotice("Dictado cancelado. El ticket no cambió.");
  }, [invalidate, release]);

  useEffect(() => {
    if (disabled && active.current) cancel();
  }, [disabled, cancel]);

  useEffect(() => {
    function hidden() {
      if (!document.hidden || !active.current) return;
      invalidate();
      request.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      stream.current = null;
      active.current = false;
      setPhase("idle");
      setNotice("Dictado detenido al salir de la pantalla. Puedes volver a intentarlo.");
    }
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      invalidate();
      request.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [invalidate]);

  async function interpret(transcript: string, token: number) {
    if (!transcript.trim()) throw new Error("No escuché una venta. Puedes escribirla aquí.");
    setPhase("parsing");
    const response = await fetch("/api/voice/parse", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcript.trim() }), signal: request.current?.signal,
    });
    const value = await response.json();
    if (generation.current !== token) return;
    if (!response.ok) throw new Error(value.error || "No pude interpretar la venta.");
    const lines = voiceDraft(value).map((line) => ({ ...line, id: newLineId() }));
    setProposal(lines);
    setNotice("Revisa los conceptos y precios. Todavía no se añadieron al ticket.");
  }

  function failure(reason: unknown, token: number) {
    if (generation.current !== token) return;
    setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "La solicitud se canceló o tardó demasiado. Puedes escribir la venta o agregarla a mano.");
  }

  function finish(token: number) {
    if (generation.current !== token) return;
    release();
    request.current = null;
    active.current = false;
    setPhase("idle");
  }

  function beginRequest() {
    request.current = new AbortController();
    timer.current = setTimeout(() => request.current?.abort(), 45000);
  }

  async function parseText() {
    if (disabled || active.current || !text.trim()) return;
    active.current = true;
    const token = ++generation.current;
    setError(null); setProposal([]); setNotice(""); beginRequest();
    try { await interpret(text, token); } catch (reason) { failure(reason, token); } finally { finish(token); }
  }

  async function microphone() {
    if (phase === "recording") {
      if (timer.current) clearTimeout(timer.current);
      setPhase("transcribing");
      recorder.current?.stop();
      return;
    }
    if (disabled || active.current) return;
    if (!window.isSecureContext) {
      setError("El micrófono requiere HTTPS. Abre la app desde el enlace seguro de Tailscale.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador no permite grabar audio. Escribe la venta en el campo y pulsa Interpretar.");
      return;
    }
    const token = ++generation.current;
    active.current = true;
    setPhase("permission"); setError(null); setProposal([]); setNotice("");
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== token) { audio.getTracks().forEach((track) => track.stop()); return; }
      stream.current = audio;
      const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(audio, mime ? { mimeType: mime } : undefined);
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      capture.onerror = () => {
        if (generation.current !== token) return;
        failure(new Error("La grabación se interrumpió. Revisa el micrófono o escribe la venta."), token);
        generation.current++;
        capture.onstop = null;
        if (capture.state !== "inactive") capture.stop();
        recorder.current = null;
        release(); active.current = false; setPhase("idle");
      };
      capture.onstop = async () => {
        release(); recorder.current = null;
        if (generation.current !== token) return;
        const blob = new Blob(chunks, { type: capture.mimeType || "audio/webm" });
        setPhase("transcribing"); beginRequest();
        try {
          if (!blob.size) throw new Error("El audio salió vacío. Vuelve a dictar o escribe la venta.");
          const form = new FormData();
          form.append("audio", blob, capture.mimeType.includes("mp4") ? "venta.mp4" : "venta.webm");
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal: request.current?.signal });
          const value = await response.json();
          if (generation.current !== token) return;
          if (!response.ok || typeof value.text !== "string") throw new Error(value.error || "No pude transcribir el audio. Puedes escribir la venta.");
          setText(value.text);
          await interpret(value.text, token);
        } catch (reason) { failure(reason, token); } finally { finish(token); }
      };
      capture.start(); setPhase("recording");
      timer.current = setTimeout(() => { if (capture.state === "recording") capture.stop(); }, 30000);
    } catch (reason) {
      failure(reason instanceof DOMException && reason.name === "NotAllowedError" ? new Error("No se concedió permiso al micrófono. Revisa el permiso del navegador o escribe la venta.") : reason, token);
      finish(token);
    }
  }

  function openScanner() {
    if (disabled || busy) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("La cámara requiere HTTPS. Abre la app desde el enlace seguro de Tailscale.");
      return;
    }
    setError(null);
    setScannerOpen(true);
  }

  function openManual() {
    if (disabled || busy) return;
    const manual = document.getElementById("mc-caja-manual");
    if (manual instanceof HTMLDetailsElement) manual.open = true;
    document.getElementById("mc-caja-new-description")?.focus();
  }

  return (
    <section className="mc-sale-voice" aria-labelledby="mc-sale-voice-title">
      <h2 id="mc-sale-voice-title"><label htmlFor="mc-sale-voice-text">¿Qué vendiste?</label></h2>
      <div className="mc-sale-voice__field">
        <div className="mc-sale-voice__entry flex min-w-0 items-center">
        <button type="button" className="mc-sale-voice__manual hidden" aria-label="Abrir cámara para escanear código de barras" disabled={disabled || busy} onClick={openScanner}>
          <ScanBarcode aria-hidden="true" />
        </button>
        <input id="mc-sale-voice-text" aria-label="¿Qué vendiste? Describe los productos" placeholder={preset?.example ?? "Producto"} value={text} maxLength={2000}
          disabled={disabled || busy} aria-describedby={error ? "mc-sale-voice-hint mc-sale-voice-error" : "mc-sale-voice-hint"} onChange={(event) => { setText(event.target.value); setProposal([]); setError(null); }}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void parseText(); } }} />
        </div>
        <button type="button" className="mc-sale-voice__mic" aria-label={phase === "recording" ? "Detener dictado" : "Dictar venta"} aria-pressed={phase === "recording"} aria-describedby={error ? "mc-sale-voice-hint mc-sale-voice-error" : "mc-sale-voice-hint"}
          disabled={disabled || (busy && phase !== "recording")} onClick={() => void microphone()}>
          {phase === "recording" ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
        </button>
      </div>
      <div className="mc-sale-voice__phrases" aria-label="Productos sugeridos">
        {suggestions.map(({ label, text: suggestedText, image }) => <button type="button" key={label} className={`mc-sale-voice__chip mc-sale-voice__chip--${image ?? "general"}`} disabled={disabled || busy} onClick={() => { setText(suggestedText ?? label); setProposal([]); setError(null); document.getElementById("mc-sale-voice-text")?.focus(); }}>
          {/* Original reference crop; intentionally rendered at its requested 20px size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="mc-sale-voice__chip-art">{image ? <img src={`/assets/spec/caja-chip-${image}.png`} alt="" width={20} height={20} /> : <Store aria-hidden="true" />}</span>
          <span>{label}</span>
        </button>)}
        <button type="button" className="mc-sale-voice__chip mc-sale-voice__chip--more" disabled={disabled || busy} onClick={openManual}><Plus aria-hidden="true" /><span>Más</span></button>
      </div>
      {preset ? <p className="mc-sale-preset-note">Ejemplos editables: usa tus propias cantidades y precios.</p> : null}
      <div className={`mc-sale-voice__actions${!busy && !text.trim() ? " mc-sale-voice__actions--idle" : ""}`}>
        <p id="mc-sale-voice-hint" role="status">{phase === "recording" ? "Escuchando… Pulsa detener al terminar. Máximo 30 segundos." : phase === "permission" ? "Esperando permiso de micrófono…" : phase === "transcribing" ? "Transcribiendo audio…" : phase === "parsing" ? "Interpretando venta…" : "Pulsa el micrófono para dictar o escribe la venta."}</p>
        {busy ? <button type="button" className="mc-caja-clear" onClick={cancel}>Cancelar dictado</button> : text.trim() ? <button type="button" className="mc-caja-button mc-caja-button--secondary" disabled={disabled} onClick={() => void parseText()}>Interpretar</button> : null}
      </div>
      {error ? <p id="mc-sale-voice-error" className="mc-sale-voice__error" role="alert">{error}</p> : null}
      <p className="mc-sale-voice__notice" role="status">{notice}</p>
      {scannerOpen ? <BarcodeScanner onClose={() => setScannerOpen(false)} onDetect={(value) => { setText(value); setProposal([]); setScannerOpen(false); document.getElementById("mc-sale-voice-text")?.focus(); }} /> : null}
      {proposal.length ? <div className="mc-sale-voice__proposal">
        <h3>Revisa lo que entendí</h3>
        <ul>{proposal.map((line) => <li key={line.id}><span>{line.quantity} × {line.description}</span><CurrencyAmount cents={lineTotalCents(line)} /></li>)}</ul>
        <p>Total propuesto <CurrencyAmount cents={draftTotalCents(proposal)} />. Revisa los precios; el cobro se elige en el ticket.</p>
        <button type="button" className="mc-caja-button mc-caja-button--primary" disabled={disabled} onClick={() => { if (onAdd(proposal)) { setProposal([]); setText(""); setNotice("Conceptos añadidos al ticket. La venta todavía no está confirmada."); } }}>Añadir al ticket</button>
        <button type="button" className="mc-caja-clear" onClick={() => setProposal([])}>Descartar propuesta</button>
      </div> : null}
    </section>
  );
}


/** Lector de cámara sin dependencias: usa BarcodeDetector nativo si existe. */
function BarcodeScanner({ onClose, onDetect }: { onClose: () => void; onDetect: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectRef = useRef(onDetect);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [status, setStatus] = useState("Abriendo cámara…");

  useEffect(() => {
    detectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const Native = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        if (!Native) {
          // Fallback open source para navegadores sin BarcodeDetector (iOS/Android).
          setStatus("Apunta al código de barras…");
          const reader = new BrowserMultiFormatReader();
          const video = videoRef.current;
          if (!video) return;
          const controls = await reader.decodeFromVideoElement(video, (result) => {
            if (!active) return;
            const value = result?.getText()?.trim();
            if (value) detectRef.current(value);
          });
          if (active) controlsRef.current = controls;
          else controls.stop();
          return;
        }
        const detector = new Native({ formats: ["ean_13", "ean_8", "upc_a", "code_128", "qr_code"] });
        setStatus("Apunta al código de barras…");
        interval = setInterval(() => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          void detector.detect(videoRef.current).then((codes) => {
            const value = codes[0]?.rawValue?.trim();
            if (value) detectRef.current(value);
          }).catch(() => undefined);
        }, 450);
      } catch (reason) {
        setStatus(reason instanceof DOMException && reason.name === "NotAllowedError" ? "No se concedió permiso a la cámara. Revisa el permiso del navegador." : "No se pudo abrir la cámara. Revisa que estés en HTTPS y que el dispositivo tenga cámara.");
      }
    }
    void start();
    return () => { active = false; controlsRef.current?.stop(); if (interval) clearInterval(interval); streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  return <div className="mc-scan-overlay" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
    <div className="mc-scan-card">
      <button type="button" className="mc-scan-close" onClick={onClose} aria-label="Cerrar escáner"><X aria-hidden="true" /></button>
      <video ref={videoRef} className="mc-scan-video" playsInline muted />
      <p className="mc-scan-status" role="status">{status}</p>
      <p className="mc-scan-hint">También puedes escribir el producto o elegir una sugerencia.</p>
    </div>
  </div>;
}
