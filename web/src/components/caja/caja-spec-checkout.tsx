"use client";

import { useRef, useState } from "react";
import { Banknote, CreditCard, QrCode, ReceiptText, X } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import type { PaymentChoice } from "./types";

export function CajaSpecCheckout({ totalCents, changeCents, method, cashInput, creditInput, customerName, error, canConfirm, disabled, demo, onMethod, onCash, onCredit, onCustomer, onConfirm }: {
  totalCents: number; changeCents: number; method: PaymentChoice;
  cashInput: string; creditInput: string; customerName: string; error: string | null;
  canConfirm: boolean; disabled: boolean; demo: boolean;
  onMethod: (method: PaymentChoice) => void; onCash: (value: string) => void;
  onCredit: (value: string) => void; onCustomer: (value: string) => void;
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [digitalKind, setDigitalKind] = useState<"card" | "digital">("digital");
  function select(value: "cash" | "card" | "digital") {
    if (value !== "cash") setDigitalKind(value);
    onMethod(value === "cash" ? "cash" : "digital");
  }
  return <section className="mc-spec-checkout" aria-label="Total y cobro">
    <div className="mc-spec-total"><span>Total</span><CurrencyAmount cents={totalCents} /></div>
    <fieldset className="mc-spec-methods"><legend>Cobro</legend><div>
      {([{ id: "cash", label: "Efectivo", Icon: Banknote }, { id: "card", label: "Tarjeta", Icon: CreditCard }, { id: "digital", label: "Digital", Icon: QrCode }] as const).map(({ id, label, Icon }) => {
        const selected = id === "cash" ? method === "cash" : method === "digital" && digitalKind === id;
        return <button key={id} type="button" aria-pressed={selected} disabled={disabled} onClick={() => select(id)}><Icon aria-hidden="true" /><span>{label}</span></button>;
      })}
    </div></fieldset>
    <button className="mc-spec-register" type="button" disabled={disabled || totalCents <= 0} onClick={() => dialog.current?.showModal()}><ReceiptText aria-hidden="true" /><span>Registrar venta</span></button>
    <dialog ref={dialog} className="mc-spec-review" aria-labelledby="mc-spec-review-title">
      <div className="mc-spec-review__head"><h2 id="mc-spec-review-title">Registrar venta</h2><button type="button" aria-label="Cerrar revisión de cobro" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button></div>
      <p>Total <CurrencyAmount cents={totalCents} /></p>
      {demo ? <p>Modo demo: se registrará una venta simulada, sin dinero real.</p> : null}
      {method === "cash" || method === "mixed" ? <>
        <label>Efectivo recibido<input value={cashInput} inputMode="decimal" onChange={e => onCash(e.target.value)} disabled={disabled} /></label>
        <button type="button" className="mc-spec-exact-cash" disabled={disabled} onClick={() => onCash((totalCents / 100).toFixed(2))}>Efectivo exacto</button>
        {changeCents > 0 ? <p>Cambio a devolver <CurrencyAmount cents={changeCents} /></p> : null}
      </> : null}
      {method === "digital" ? <p>{digitalKind === "card" ? "La tarjeta se cobra mediante el flujo digital disponible. " : "Se generará un link o QR. "}El pago seguirá pendiente hasta la confirmación del proveedor.</p> : null}
      <details><summary>Otros métodos de cobro</summary>
        <div className="mc-spec-review__other"><button type="button" disabled={disabled} aria-pressed={method === "credit"} onClick={() => onMethod("credit")}>Fiado</button><button type="button" disabled={disabled} aria-pressed={method === "mixed"} onClick={() => onMethod("mixed")}>Mixto</button></div>
      </details>
      {method === "credit" || method === "mixed" ? <><label>Monto a fiado<input value={creditInput} inputMode="decimal" onChange={e => onCredit(e.target.value)} disabled={disabled} /></label><label>Nombre del cliente<input value={customerName} onChange={e => onCustomer(e.target.value)} disabled={disabled} /></label></> : null}
      {error ? <p role="alert" className="mc-spec-review__error">{error}</p> : null}
      <button type="button" className="mc-spec-register" disabled={disabled || !canConfirm} onClick={() => void onConfirm()}>Registrar venta</button>
      {!canConfirm ? <p className="mc-spec-review__hint">Revisa los conceptos y completa el cobro antes de registrar.</p> : null}
    </dialog>
  </section>;
}
