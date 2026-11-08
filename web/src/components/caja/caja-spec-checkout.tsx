"use client";

import { useState } from "react";
import { Banknote, CreditCard, QrCode, ReceiptText, Zap } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import type { PaymentChoice } from "./types";

export function CajaSpecCheckout({
  totalCents,
  method,
  disabled,
  onMethod,
  onReview,
  onQuickPay,
  onQuickAdd,
  onClear,
}: {
  totalCents: number;
  method: PaymentChoice;
  disabled: boolean;
  onMethod: (method: PaymentChoice) => void;
  onReview: () => void;
  onQuickPay: () => void;
  onQuickAdd?: (cents: number) => void;
  onClear: () => void;
}) {
  const [digitalKind, setDigitalKind] = useState<"card" | "digital">("digital");
  function select(value: "cash" | "card" | "digital") {
    if (value !== "cash") setDigitalKind(value);
    onMethod(value === "cash" ? "cash" : "digital");
  }

  const quickPayLabel =
    method === "digital"
      ? digitalKind === "card"
        ? "⚡ Cobro rápido (Tarjeta)"
        : "⚡ Cobro rápido (QR CoDi)"
      : "⚡ Cobro rápido (Efectivo exacto)";

  return (
    <section className="mc-spec-checkout" aria-label="Total y cobro">
      <div className="mc-spec-total">
        <span>Total</span>
        <CurrencyAmount cents={totalCents} />
      </div>
      <fieldset className="mc-spec-methods">
        <legend>Cobro</legend>
        <div>
          {(
            [
              { id: "cash", label: "Efectivo", Icon: Banknote },
              { id: "card", label: "Tarjeta", Icon: CreditCard },
              { id: "digital", label: "QR CoDi", Icon: QrCode },
            ] as const
          ).map(({ id, label, Icon }) => {
            const selected =
              id === "cash"
                ? method === "cash"
                : method === "digital" && digitalKind === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => select(id)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {totalCents <= 0 ? (
        <div className="mc-spec-empty-hint">
          <p className="mc-spec-methods-hint" role="status">
            Agrega un producto o usa un monto rápido para cobrar al instante.
          </p>
          <div className="mc-spec-quick-amounts" role="group" aria-label="Montos rápidos directos">
            <span className="mc-spec-quick-label">Monto rápido:</span>
            <div className="mc-spec-quick-chips">
              {[2000, 5000, 10000, 20000].map((cents) => (
                <button
                  key={cents}
                  type="button"
                  className="mc-spec-chip"
                  disabled={disabled}
                  onClick={() => onQuickAdd?.(cents)}
                >
                  +${cents / 100}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <button
        className="mc-spec-quick-pay"
        type="button"
        disabled={disabled || totalCents <= 0}
        onClick={onQuickPay}
      >
        <Zap aria-hidden="true" />
        <span>{quickPayLabel}</span>
      </button>
      <button
        className="mc-spec-register"
        type="button"
        disabled={disabled || totalCents <= 0}
        onClick={onReview}
      >
        <ReceiptText aria-hidden="true" />
        <span>Registrar venta</span>
      </button>
      <button className="mc-spec-clear" type="button" disabled={disabled} onClick={onClear}>
        Descartar venta
      </button>
    </section>
  );
}
