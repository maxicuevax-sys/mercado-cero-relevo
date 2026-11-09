"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatMxn } from "@/lib/format";
import type { DemoCheckoutData } from "@/lib/demo-checkout-data";

const METHODS = [{ value: "codi", label: "CoDi" }, { value: "card", label: "Tarjeta" }, { value: "wallet", label: "Wallet" }] as const;
export default function DemoCheckout() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<DemoCheckoutData | null>(null);
  const [method, setMethod] = useState<"codi" | "card" | "wallet">("codi");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const settled = data !== null && data.dueCents === 0;
  const invalidate = useCallback(() => { generation.current++; request.current?.abort(); }, []);

  useEffect(() => {
    const read = () => {
      invalidate();
      const hash = window.location.hash.slice(1);
      setToken(hash.length <= 1024 && /^v1\.[A-Za-z0-9_-]+$/.test(hash) ? hash : "");
      setData(null); setError(""); setBusy(false);
    };
    read(); window.addEventListener("hashchange", read);
    return () => { invalidate(); window.removeEventListener("hashchange", read); };
  }, [invalidate]);

  useEffect(() => {
    if (!token || settled || busy) return;
    let active = true;
    const controller = new AbortController();
    async function load() {
      if (document.visibilityState === "hidden") return;
      const current = generation.current;
      try {
        const response = await fetch("/api/demo-checkout", { credentials: "omit", cache: "no-store", headers: { "X-Trangui-Demo-Checkout": token! }, signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Este cobro demo no está disponible.");
        if (active && generation.current === current) { setData(body); setError(""); }
      } catch (cause) {
        if (active && generation.current === current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo consultar el cobro.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    document.addEventListener("visibilitychange", load);
    return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, [token, retry, settled, busy]);

  useEffect(() => { if (settled) heading.current?.focus(); }, [settled]);

  async function pay() {
    if (!token || !data || settled || busy) return;
    const current = generation.current;
    request.current = new AbortController();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/demo-checkout", {
        method: "POST", credentials: "omit", cache: "no-store", signal: request.current.signal,
        headers: { "Content-Type": "application/json", "X-Trangui-Demo-Checkout": token },
        body: JSON.stringify({ method }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo registrar la simulación.");
      if (generation.current === current) setData(body);
    } catch (cause) {
      if (generation.current === current) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "Consulta el estado antes de reintentar.");
    } finally { if (generation.current === current) setBusy(false); }
  }

  return <main className="pay-shell mc-demo-checkout">
    <section className="receipt-paper mc-demo-checkout__paper" aria-labelledby="demo-checkout-title">
      <p className="stamp stamp--demo">Trangui · DEMO</p>
      <h1 id="demo-checkout-title" ref={heading} tabIndex={-1}>{settled ? "Cobro DEMO registrado" : "Revisa tu cobro DEMO"}</h1>
      {token === null ? <p role="status">Abriendo cobro…</p> : !token ? <p role="alert">El enlace está incompleto. Pide a quien cobra que renueve el QR.</p> : null}
      {data ? <>
        <p>Referencia {data.reference}</p>
        <ul className="mc-demo-checkout__items">{data.items.map((item, index) => <li key={index}><span>{item.quantity} × {item.description}</span><strong>{formatMxn(item.totalCents)}</strong></li>)}</ul>
        <p className="mc-demo-checkout__amount">{settled ? "Total de la operación" : "Por cobrar"}<strong>{formatMxn(settled ? data.totalCents : data.dueCents)}</strong></p>
        {settled ? <p role="status">La simulación quedó registrada. Puedes cerrar esta pestaña.</p> : <>
          <fieldset disabled={busy}><legend>Método de simulación</legend><div className="mc-demo-checkout__methods">{METHODS.map(option => <label key={option.value}><input type="radio" name="demo-method" checked={method === option.value} onChange={() => setMethod(option.value)} />{option.label}</label>)}</div></fieldset>
          <button className="mc-demo-checkout__pay" type="button" disabled={busy || Boolean(error)} onClick={() => void pay()}>{busy ? "Registrando…" : "Simular pago"}</button>
        </>}
        <p>Esta operación es una simulación.</p>
      </> : token && !error ? <p role="status">Consultando el importe…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {token && !busy && !settled ? <button type="button" onClick={() => { setError(""); setRetry(value => value + 1); }}>Consultar estado</button> : null}
    </section>
  </main>;
}
