"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronRight, ClipboardCheck, MessageCircle, QrCode, ReceiptText, Search, Target, TriangleAlert, Wallet } from "lucide-react";
import { HelpFaq } from "./help-faq";

const topics = [
  { title: "Registrar una venta", Icon: ReceiptText, text: "En Caja, dicta o escribe los productos. Revisa cantidades, precios y total antes de registrar.", href: "/caja" },
  { title: "Cobro digital", Icon: QrCode, text: "Genera un link o QR desde el pedido. Por cobrar no es pagado. Solo la confirmación válida de pey verifica el pago; demo no es dinero real.", href: "/caja" },
  { title: "Fiados", Icon: Wallet, text: "Consulta deudas y abonos. Un fiado es deuda, no dinero recibido, y un abono no crea otra venta.", href: "/fiados" },
  { title: "Corte de caja", Icon: ClipboardCheck, text: "Cuenta tu efectivo y compáralo con el esperado. Revisa las diferencias antes de cerrar.", href: "/corte" },
  { title: "Metas", Icon: Target, text: "Anota lo que quieres apartar. Una meta no guarda ni custodia dinero.", href: "/metas" },
];
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function HelpHome() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [support, setSupport] = useState("");
  const matches = topics.filter(topic => normalize(topic.title + " " + topic.text).includes(normalize(query.trim())));
  return <div className="mc-help-home">
    <label className="mc-help-search"><Search aria-hidden="true" /><span className="sr-only">Buscar ayuda</span><input type="search" placeholder="Buscar ayuda" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="mc-help-welcome"><Image src="/assets/spec/b-help-bot.png" alt="" width={133} height={95} /><div><h2>¡Hola! Soy el asistente de Trangui</h2><p>Puedo explicar funciones y guiarte en el uso de la app.</p></div></div>
    <div className="mc-help-section-head"><h2>Temas frecuentes</h2><button type="button" onClick={() => { setQuery(""); setSelected(null); }}>Ver todos</button></div>
    <div className="mc-help-topics">{matches.map(topic => <button type="button" key={topic.title} aria-expanded={selected === topics.indexOf(topic)} aria-controls="mc-help-topic-answer" onClick={() => setSelected(selected === topics.indexOf(topic) ? null : topics.indexOf(topic))}><topic.Icon aria-hidden="true" /><span>{topic.title}</span><ChevronRight aria-hidden="true" /></button>)}</div>
    {query ? <p role="status">{matches.length} temas encontrados.</p> : null}
    {selected !== null ? <section id="mc-help-topic-answer" className="mc-help-answer"><h3>{topics[selected].title}</h3><p>{topics[selected].text}</p><Link href={topics[selected].href}>Abrir {topics[selected].title}</Link></section> : <div id="mc-help-topic-answer" hidden />}
    <h2>¿Necesitas más ayuda?</h2>
    <div className="mc-help-support"><a href="#mc-help-guide"><BookOpen aria-hidden="true" />Ver guía</a><button type="button" onClick={() => setSupport("El soporte por mensaje aún no está conectado. Puedes consultar el asistente y la guía local.")}><MessageCircle aria-hidden="true" />Enviar mensaje</button><button type="button" onClick={() => setSupport("Para reportar un problema, anota la pantalla, lo que intentabas hacer y el error. Este prototipo aún no envía reportes.")}><TriangleAlert aria-hidden="true" />Reportar problema</button></div>
    <p role="status">{support}</p>
    <details id="mc-help-guide" className="mc-help-guide"><summary>Tutoriales y consejos · Aprende paso a paso</summary><p>Registra la venta, elige el método de pago y revisa el resultado antes de entregar. La demo es una simulación.</p><h2 id="mc-ayuda-faq-title">Preguntas frecuentes</h2><HelpFaq /></details>
  </div>;
}
