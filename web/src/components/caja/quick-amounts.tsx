"use client";

import "./quick-amounts.css";

export const QUICK_AMOUNTS = [2000, 5000, 10000, 20000] as const;

/** Adds an editable draft concept only. Never creates or confirms an order. */
export function QuickAmounts({ disabled, onAdd }: { disabled: boolean; onAdd: (cents: number) => void }) {
  return <div className="mc-caja-quick-amounts" role="group" aria-label="Montos rápidos directos">
    <p>Monto directo</p>
    <div>{QUICK_AMOUNTS.map(cents => <button key={cents} type="button" aria-label={`Agregar monto $${cents / 100}`} disabled={disabled} onClick={() => onAdd(cents)}>${cents / 100}</button>)}</div>
    <small>Se agrega al ticket para que lo revises. Todavía no es una venta registrada.</small>
  </div>;
}
