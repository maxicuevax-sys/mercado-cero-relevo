"use client";

import { useId, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, BookOpen, ChevronRight, ShoppingBag, Wallet } from "lucide-react";
import botArt from "@/assets/brand/ilustraciones/transparent/bot.png";
import "./optional-assistant.css";

const KEY = "mercado-cero:assistant:enabled";
const EVENT = "mercado-cero:assistant-changed";
let sessionEnabled = false;
let sessionOnly = false;

function snapshot() {
  if (sessionOnly) return sessionEnabled;
  try { return localStorage.getItem(KEY) === "on"; }
  catch { return sessionEnabled; }
}

function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

function setEnabled(enabled: boolean) {
  sessionEnabled = enabled;
  try { localStorage.setItem(KEY, enabled ? "on" : "off"); sessionOnly = false; }
  catch { sessionOnly = true; }
  window.dispatchEvent(new Event(EVENT));
}

function useEnabled() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export function AssistantPreference() {
  const enabled = useEnabled();
  const descriptionId = useId();
  return (
    <div className="mc-assistant-preference">
      <button type="button" role="switch" aria-checked={enabled}
        aria-describedby={descriptionId} onClick={() => setEnabled(!enabled)}>
        <span>Asistente opcional</span>
        <span className="mc-assistant-switch" aria-hidden="true"><span /></span>
        <span>{enabled ? "Activado" : "Desactivado"}</span>
      </button>
      <p id={descriptionId}>Se activa solo si tú eliges. Caja y los avisos de dinero siguen disponibles. La elección se guarda en este navegador si permite almacenamiento.</p>
    </div>
  );
}

const TOPICS = [
  { title: "¿Cómo van mis ventas?", icon: BarChart3, terms: /venta|vend|cobr/i,
    answer: "En Ventas puedes consultar lo registrado y lo cobrado confirmado por separado. Una venta pendiente o demo no significa dinero recibido.", href: "/ventas", action: "Consultar Ventas" },
  { title: "¿Qué me falta pagar?", icon: Wallet, terms: /pagar|pendiente|debo|deuda|fiad/i,
    answer: "Pendientes muestra lo que falta revisar; Fiados muestra lo que tus clientes deben al negocio. Esta guía no consulta deudas con proveedores ni calcula cuánto debes pagar.", href: "/pendientes", action: "Revisar Pendientes" },
  { title: "Sugerencias de compra", icon: ShoppingBag, terms: /compra|inventario|producto|surtir/i,
    answer: "Todavía no hay recomendaciones de compra conectadas a tu inventario. Puedes anotar lo que necesitas en Pendientes y decidir tú qué comprar.", href: "/pendientes", action: "Abrir Pendientes" },
  { title: "Explicarme un reporte", icon: BookOpen, terms: /reporte|corte|efectivo|saldo/i,
    answer: "En Corte comparas el efectivo esperado con lo que contaste. Una diferencia se muestra para revisarla; la app no la ajusta sola. Los pagos demo se distinguen del dinero real.", href: "/corte", action: "Consultar Corte" },
] as const;

export function OptionalAssistant() {
  const enabled = useEnabled();
  const titleId = useId();
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{ question: string; topic: number | null } | null>(null);

  function answer(text: string) {
    const query = text.trim();
    if (!query) return;
    const index = TOPICS.findIndex(topic => topic.terms.test(query));
    setResult({ question: query, topic: index < 0 ? null : index });
  }

  const topic = result?.topic != null ? TOPICS[result.topic] : null;
  return (
    <section id="asistente" className="mc-assistant" aria-labelledby={titleId}>
      <div className="mc-assistant-head">
        <Image src={botArt} alt="" aria-hidden="true" width={64} height={64} />
        <div><h2 id={titleId}>Asistente <span>(opcional)</span></h2>
          <p>{enabled ? "¿En qué te ayudo hoy?" : "Consulta la guía cuando tú quieras."}</p></div>
      </div>
      <AssistantPreference />
      {enabled && <div className="mc-assistant-body">
        <p className="mc-assistant-note">Respuestas de la guía local. No consulta tus cifras ni confirma pagos.</p>
        <div className="mc-assistant-topics">
          {TOPICS.map((item, index) => <button key={item.title} type="button"
            onClick={() => setResult({ question: item.title, topic: index })}>
            <item.icon size={20} aria-hidden="true" /><span>{item.title}</span><ChevronRight size={18} aria-hidden="true" />
          </button>)}
        </div>
        <form onSubmit={event => { event.preventDefault(); answer(question); }}>
          <label htmlFor={inputId}>Escribe tu pregunta</label>
          <div className="mc-assistant-input"><input id={inputId} value={question} maxLength={300}
            onChange={event => setQuestion(event.target.value)} placeholder="Ventas, fiados o corte…" />
            <button type="submit" disabled={!question.trim()}>Consultar</button></div>
        </form>
        <div role="status" aria-live="polite" aria-atomic="true">
          {result && <div className="mc-assistant-answer"><p className="mc-assistant-question">{result.question}</p>
            <p>{topic?.answer ?? "No encontré esa pregunta en la guía local. Revisa las preguntas frecuentes; esta guía no ofrece respuestas generadas ni soporte en vivo."}</p>
            <p className="mc-assistant-source">Fuente: guía de uso de Mercado Cero.</p>
            <Link href={topic?.href ?? "#mc-ayuda-faq-title"}>{topic?.action ?? "Ver preguntas frecuentes"}<ChevronRight size={18} aria-hidden="true" /></Link>
          </div>}
        </div>
      </div>}
    </section>
  );
}
