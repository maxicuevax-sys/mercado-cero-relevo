"use client";

import { useState } from "react";
import { Banknote, CreditCard, QrCode, ReceiptText } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import type { PaymentChoice } from "./types";

export function CajaSpecCheckout({ totalCents, method, disabled, onMethod, onReview }: {
  totalCents: number; changeCents: number; method: PaymentChoice;
  cashInput: string; creditInput: string; customerName: string; error: string | null;
  canConfirm: boolean; disabled: boolean; demo: boolean;
  onMethod: (method: PaymentChoice) => void; onCash: (value: string) => void;
  onCredit: (value: string) => void; onCustomer: (value: string) => void;
  onConfirm: () => Promise<void>; onReview: () => void;
}) {
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
    <button className="mc-spec-register" type="button" disabled={disabled || totalCents <= 0} onClick={onReview}><ReceiptText aria-hidden="true" /><span>Registrar venta</span></button>

  </section>;
}
