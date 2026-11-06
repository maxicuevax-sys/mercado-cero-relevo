"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Plus, ScanBarcode, Square } from "lucide-react";
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
export function SaleVoice({ disabled, onAdd }: { disabled: boolean; onAdd: (lines: DraftLine[]) => boolean }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<DraftLine[]>([]);
  const [notice, setNotice] = useState("");
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
        <button type="button" className="mc-sale-voice__manual hidden" aria-label="Escribir un producto a mano" disabled={disabled || busy} onClick={openManual}>
          <ScanBarcode aria-hidden="true" />
        </button>
        <input id="mc-sale-voice-text" aria-label="Describe lo que vendiste" placeholder="Producto" value={text} maxLength={2000}
          disabled={disabled || busy} aria-describedby={error ? "mc-sale-voice-hint mc-sale-voice-error" : "mc-sale-voice-hint"} onChange={(event) => { setText(event.target.value); setProposal([]); setError(null); }}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void parseText(); } }} />
        </div>
        <button type="button" className="mc-sale-voice__mic" aria-label={phase === "recording" ? "Detener dictado" : "Dictar venta"} aria-pressed={phase === "recording"} aria-describedby={error ? "mc-sale-voice-hint mc-sale-voice-error" : "mc-sale-voice-hint"}
          disabled={disabled || (busy && phase !== "recording")} onClick={() => void microphone()}>
          {phase === "recording" ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
        </button>
      </div>
      <div className="mc-sale-voice__phrases" aria-label="Productos sugeridos">
        {SUGGESTIONS.map(({ label, image }) => <button type="button" key={label} className={`mc-sale-voice__chip mc-sale-voice__chip--${image}`} disabled={disabled || busy} onClick={() => { setText(label); setProposal([]); setError(null); document.getElementById("mc-sale-voice-text")?.focus(); }}>
          {/* Original reference crop; intentionally rendered at its requested 20px size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="mc-sale-voice__chip-art"><img src={`/assets/spec/caja-chip-${image}.png`} alt="" width={20} height={20} /></span>
          <span>{label}</span>
        </button>)}
        <button type="button" className="mc-sale-voice__chip mc-sale-voice__chip--more" disabled={disabled || busy} onClick={openManual}><Plus aria-hidden="true" /><span>Más</span></button>
      </div>
      <div className={`mc-sale-voice__actions${!busy && !text.trim() ? " mc-sale-voice__actions--idle" : ""}`}>
        <p id="mc-sale-voice-hint" role="status">{phase === "recording" ? "Escuchando… Pulsa detener al terminar. Máximo 30 segundos." : phase === "permission" ? "Esperando permiso de micrófono…" : phase === "transcribing" ? "Transcribiendo audio…" : phase === "parsing" ? "Interpretando venta…" : "Pulsa el micrófono para dictar o escribe la venta."}</p>
        {busy ? <button type="button" className="mc-caja-clear" onClick={cancel}>Cancelar dictado</button> : text.trim() ? <button type="button" className="mc-caja-button mc-caja-button--secondary" disabled={disabled} onClick={() => void parseText()}>Interpretar</button> : null}
      </div>
      {error ? <p id="mc-sale-voice-error" className="mc-sale-voice__error" role="alert">{error}</p> : null}
      <p className="mc-sale-voice__notice" role="status">{notice}</p>
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
