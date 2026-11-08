"use client";

import { useState } from "react";
import { Banknote, CreditCard, QrCode, ReceiptText } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { QuickAmounts } from "./quick-amounts";
import type { PaymentChoice } from "./types";

export function CajaSpecCheckout({ totalCents, method, disabled, onMethod, onReview, onClear, canQuickCash, onQuickCash, onQuickAdd }: {
  totalCents: number; method: PaymentChoice; disabled: boolean;
  onMethod: (method: PaymentChoice) => void; onReview: () => void;
  onClear: () => void; canQuickCash: boolean; onQuickCash: () => void; onQuickAdd: (cents: number) => void;
}) {
  const [digitalKind, setDigitalKind] = useState<"card" | "digital">("digital");
  function select(value: "cash" | "card" | "digital") {
    if (value !== "cash") setDigitalKind(value);
    onMethod(value === "cash" ? "cash" : "digital");
  }
  return <section className="mc-spec-checkout" aria-label="Total y cobro">
    <div className="mc-spec-total"><span>Total</span><CurrencyAmount cents={totalCents} /></div>
    <fieldset className="mc-spec-methods"><legend>Cobro</legend><div>
      {([{ id: "cash", label: "Efectivo", Icon: Banknote }, { id: "card", label: "Tarjeta", Icon: CreditCard }, { id: "digital", label: "QR CoDi", Icon: QrCode }] as const).map(({ id, label, Icon }) => {
        const selected = id === "cash" ? method === "cash" : method === "digital" && digitalKind === id;
        return <button key={id} type="button" aria-pressed={selected} disabled={disabled} onClick={() => select(id)}><Icon aria-hidden="true" /><span>{label}</span></button>;
      })}
    </div></fieldset>
    {totalCents <= 0 ? <p className="mc-spec-methods-hint" role="status">Agrega un producto para registrar la venta. Ya puedes elegir cómo cobrar.</p> : null}
    {totalCents <= 0 ? <QuickAmounts disabled={disabled} onAdd={onQuickAdd} /> : null}
    {canQuickCash ? <button type="button" className="mc-caja-button mc-caja-button--secondary mc-caja-quick-cash" disabled={disabled} onClick={onQuickCash}><Banknote aria-hidden="true" /><span>Cobrar efectivo exacto</span></button> : null}
    <button className="mc-spec-register" type="button" disabled={disabled || totalCents <= 0} onClick={onReview}><ReceiptText aria-hidden="true" /><span>Registrar venta</span></button>
    <button className="mc-spec-clear" type="button" disabled={disabled} onClick={onClear}>Descartar venta</button>
  </section>;
}
