"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Banknote, CalendarDays, QrCode, ReceiptText } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import type { PaymentChoice } from "./types";

type Props = {
  totalCents: number; changeCents: number; method: PaymentChoice;
  cashInput: string; creditInput: string; customerName: string; error: string | null;
  canConfirm: boolean; disabled: boolean; demo: boolean;
  onMethod: (value: PaymentChoice) => void; onCash: (value: string) => void;
  onCredit: (value: string) => void; onCustomer: (value: string) => void;
  onConfirm: () => Promise<void>;
  canQuickCash: boolean; onQuickCash: () => void;
};

/** M03 is a distinct view. Continue never changes payment status. */
export function PaymentMethodScreen(p: Props) {
  const [review, setReview] = useState(false);
  return <section className="mc-payment-method" aria-label="Elegir método de pago">
    <div className="mc-payment-total"><ReceiptText aria-hidden="true" /><span>Total de la venta</span><CurrencyAmount cents={p.totalCents} /></div>
    <fieldset className="mc-payment-options"><legend className="sr-only">Método de pago</legend>
      {([{ id: "cash", label: "Efectivo", art: "cash", Icon: Banknote }, { id: "digital", label: "Pago digital", art: "digital", Icon: QrCode }, { id: "credit", label: "Fiado", art: "credit", Icon: CalendarDays }] as const).map(({ id, label, art, Icon }) => <label key={id} className="mc-payment-option" data-selected={p.method === id}>
        <Image src={`/assets/spec/b-method-${art}.png`} alt="" width={125} height={88} />
        <Icon aria-hidden="true" /><span>{label}</span><input type="radio" name="payment-method" value={id} checked={p.method === id} disabled={p.disabled} onChange={() => { p.onMethod(id); setReview(false); }} />
      </label>)}
    </fieldset>
    <details className="mc-payment-mixed"><summary>Otros métodos de cobro</summary><button type="button" aria-pressed={p.method === "mixed"} disabled={p.disabled} onClick={() => { p.onMethod("mixed"); setReview(true); }}>Mixto</button></details>
    {p.canQuickCash ? <button type="button" className="mc-caja-button mc-caja-button--secondary mc-caja-quick-cash" disabled={p.disabled} onClick={p.onQuickCash}><Banknote aria-hidden="true" /><span>Cobrar efectivo exacto</span></button> : null}
    {!review ? <button type="button" className="mc-caja-button mc-caja-button--primary mc-payment-continue" disabled={p.disabled} onClick={() => { setReview(true); window.requestAnimationFrame(() => document.getElementById("mc-method-review")?.focus()); }}>Continuar <ArrowRight aria-hidden="true" /></button> : null}
    {review ? <section id="mc-method-review" tabIndex={-1} className="mc-payment-review" aria-label="Revisar cobro">
      <h2>Revisa el cobro</h2>
      {p.method === "cash" || p.method === "mixed" ? <><label>Efectivo recibido<input value={p.cashInput} inputMode="decimal" disabled={p.disabled} onChange={e => p.onCash(e.target.value)} /></label><button type="button" disabled={p.disabled} onClick={() => p.onCash((p.totalCents / 100).toFixed(2))}>Efectivo exacto</button>{p.changeCents > 0 ? <p>Cambio a devolver <CurrencyAmount cents={p.changeCents} /></p> : null}</> : null}
      {p.method === "credit" || p.method === "mixed" ? <><label>Monto a fiado<input value={p.creditInput} inputMode="decimal" disabled={p.disabled} onChange={e => p.onCredit(e.target.value)} /></label><label>Nombre del cliente<input value={p.customerName} disabled={p.disabled} onChange={e => p.onCustomer(e.target.value)} /></label></> : null}
      {p.method === "digital" ? <p>Se registrará el pedido para generar un link o QR. Seguirá por cobrar hasta la confirmación del proveedor.</p> : null}
      {p.error ? <p role="alert">{p.error}</p> : null}
      <button type="button" className="mc-caja-button mc-caja-button--primary" disabled={p.disabled || !p.canConfirm} onClick={() => void p.onConfirm()}>{p.disabled ? "Registrando…" : "Registrar venta"}</button>
      {!p.canConfirm ? <p>Completa el cobro y revisa los conceptos antes de registrar.</p> : null}
    </section> : null}
    {p.demo ? <p className="mc-payment-demo">Modo demo · datos simulados, sin dinero real.</p> : null}
  </section>;
}
