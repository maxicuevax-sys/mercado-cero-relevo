"use client";

import Image from "next/image";
import { Banknote } from "lucide-react";
import { QuickAmounts } from "./quick-amounts";
import iconCash from "@/assets/brand/iconos/transparent/caja.png";
import iconDigital from "@/assets/brand/iconos/transparent/qr-telefono.png";
import iconCredit from "@/assets/brand/iconos/transparent/libreta.png";
import iconMixed from "@/assets/brand/iconos/transparent/registradora.png";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { formatMxn } from "@/lib/format";
import { parseMoneyCents, type PaymentChoice } from "./types";

const METHODS: Array<{ id: PaymentChoice; label: string; icon: typeof iconCash }> = [
  { id: "cash", label: "Efectivo", icon: iconCash },
  { id: "digital", label: "Digital", icon: iconDigital },
  { id: "credit", label: "Fiado", icon: iconCredit },
  { id: "mixed", label: "Mixto", icon: iconMixed },
];

export function SaleSummary({
  totalCents,
  appliedCashCents,
  appliedCreditCents,
  changeCents,
  digitalDueCents,
  method,
  cashInput,
  creditInput,
  customerName,
  error,
  saving,
  locked = false,
  onMethod,
  onCash,
  onCredit,
  onCustomer,
  onClear,
  canQuickCash,
  onQuickCash,
  onQuickAdd,
}: {
  totalCents: number;
  appliedCashCents: number;
  appliedCreditCents: number;
  changeCents: number;
  digitalDueCents: number;
  method: PaymentChoice;
  cashInput: string;
  creditInput: string;
  customerName: string;
  error: string | null;
  saving: boolean;
  locked?: boolean;
  onMethod: (method: PaymentChoice) => void;
  onCash: (value: string) => void;
  onCredit: (value: string) => void;
  onCustomer: (value: string) => void;
  onClear: () => void;
  canQuickCash: boolean;
  onQuickCash: () => void;
  onQuickAdd: (cents: number) => void;
}) {
  const cashShortfall = method === "cash" ? Math.max(0, totalCents - appliedCashCents) : 0;
  const creditEnteredCents = parseMoneyCents(creditInput);
  const cashEnteredCents = parseMoneyCents(cashInput);
  const creditOverpay = creditEnteredCents > totalCents;
  const creditCoversAllWithCash =
    method === "mixed" &&
    totalCents > 0 &&
    appliedCreditCents >= totalCents &&
    cashEnteredCents > 0;
  const creditShortfall =
    method === "credit" ? Math.max(0, totalCents - appliedCreditCents) : 0;
  const needsCustomer = appliedCreditCents > 0 && customerName.trim().length === 0;

  return (
    <aside
      id="mc-caja-payment-summary"
      className="mc-caja-card mc-caja-summary"
      tabIndex={-1}
      aria-labelledby="mc-caja-summary-title"
    >
      <div className="mc-caja-summary__body">
      <div className="mc-caja-summary__receipt">
        <p className="mc-caja-eyebrow">Cobro</p>
        <h2 id="mc-caja-summary-title">Total de la venta</h2>
        <CurrencyAmount as="p" cents={totalCents} className="mc-caja-total" />
        <p className="mc-caja-total__note">Lo que el cliente debe pagar. No es dinero recibido.</p>
      </div>
      {totalCents <= 0 ? <QuickAmounts disabled={saving || locked} onAdd={onQuickAdd} /> : null}
      {canQuickCash ? <button type="button" className="mc-caja-button mc-caja-button--secondary mc-caja-quick-cash" disabled={saving || locked} onClick={onQuickCash}><Banknote aria-hidden="true" /><span>Cobrar efectivo exacto</span></button> : null}
      <div className="mc-caja-receipt__rule" aria-hidden="true" />
      <p className="mc-caja-receipt__micro">
        Elige cómo te pagan. El importe ya está calculado.
      </p>

      <fieldset className="mc-caja-methods">
        <legend>Cómo se paga</legend>
        <div className="mc-caja-methods__grid">
          {METHODS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`mc-caja-method${method === id ? " mc-caja-method--active" : ""}`}
              aria-pressed={method === id}
              onClick={() => onMethod(id)}
              disabled={saving || locked}
            >
              <Image src={icon} alt="" aria-hidden="true" width={28} height={28} className="mc-caja-method__icon" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {method === "cash" || method === "mixed" ? (
        <label className="mc-caja-field">
          <span>Efectivo recibido</span>
          <input
            value={cashInput}
            onChange={(event) => onCash(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            disabled={saving || locked}
          />
        </label>
      ) : null}

      {method === "cash" && totalCents > 0 ? (
        <div className="mc-caja-change" aria-live="polite">
          {cashShortfall > 0 ? (
            <p className="mc-caja-change__missing">
              Faltan <CurrencyAmount cents={cashShortfall} /> para completar el cobro. Escribe más
              efectivo o elige Digital, Fiado o Mixto.
            </p>
          ) : changeCents > 0 ? (
            <p className="mc-caja-change__ok">
              Cambio a devolver <CurrencyAmount cents={changeCents} />. Recibiste{" "}
              <CurrencyAmount cents={cashInput ? parseMoneyCents(cashInput) : totalCents} />; se
              aplicaron <CurrencyAmount cents={appliedCashCents} />.
            </p>
          ) : (
            <p className="mc-caja-change__ok">Efectivo exacto. No hay cambio.</p>
          )}
        </div>
      ) : null}

      {method === "mixed" && changeCents > 0 ? (
        <div className="mc-caja-change" aria-live="polite">
          <p className="mc-caja-change__ok">
            Cambio a devolver <CurrencyAmount cents={changeCents} />. Se aplicaron{" "}
            <CurrencyAmount cents={appliedCashCents} /> al cobro.
          </p>
        </div>
      ) : null}

      {method === "cash" && totalCents > 0 && cashInput === "" ? (
        <p className="mc-caja-hint">
          Escribe el efectivo que te dieron o elige otro método.
        </p>
      ) : null}

      {creditOverpay ? (
        <p className="mc-caja-alert" role="alert">
          El fiado no puede ser mayor que el total ({formatMxn(totalCents)}). Ajusta el monto o
          elige Mixto.
        </p>
      ) : null}

      {creditShortfall > 0 && !creditOverpay ? (
        <p className="mc-caja-hint">
          El fiado no cubre el total. Faltan {formatMxn(creditShortfall)}; elige Mixto para
          combinar efectivo y fiado.
        </p>
      ) : null}

      {creditCoversAllWithCash ? (
        <p className="mc-caja-alert" role="alert">
          El fiado ya cubre el total ({formatMxn(totalCents)}) y no se aplicó el efectivo.
          Reduce el monto a fiado o el efectivo; no se registrará un cambio que no corresponde.
        </p>
      ) : null}

      {method === "mixed" && appliedCashCents === 0 && appliedCreditCents === 0 ? (
        <p className="mc-caja-hint">
          Agrega efectivo o fiado, o elige Digital para cobrar todo con link o QR.
        </p>
      ) : null}

      {method === "credit" || method === "mixed" ? (
        <>
          <label className="mc-caja-field">
            <span>Monto a fiado</span>
            <input
              value={creditInput}
              onChange={(event) => onCredit(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              disabled={saving || locked}
            />
          </label>
          <label className="mc-caja-field">
            <span>¿Quién queda a deber?</span>
            <input
              value={customerName}
              onChange={(event) => onCustomer(event.target.value)}
              placeholder="Ej. Juan"
              autoComplete="off"
              aria-describedby={needsCustomer ? "mc-caja-customer-hint" : undefined}
              disabled={saving || locked}
            />
          </label>
          {needsCustomer ? (
            <span id="mc-caja-customer-hint" className="mc-caja-hint">
              Escribe quién te queda a deber para anotar el fiado.
            </span>
          ) : null}
        </>
      ) : null}

      {method === "digital" ? (
        <p className="mc-caja-digital-note">
          Se generará un link o QR. El pago queda pendiente hasta que el banco lo confirme; una
          captura o un botón no confirman nada.
        </p>
      ) : null}

      {method === "mixed" && digitalDueCents > 0 ? (
        <p className="mc-caja-digital-note">
          Quedan <CurrencyAmount cents={digitalDueCents} /> por cobrar en digital. Se generará un
          cobro pendiente después de registrar la venta.
        </p>
      ) : null}

      {appliedCreditCents > 0 && appliedCashCents > 0 ? (
        <dl className="mc-caja-split">
          <div>
            <dt>Efectivo</dt>
            <dd>
              <CurrencyAmount cents={appliedCashCents} />
            </dd>
          </div>
          <div>
            <dt>Fiado</dt>
            <dd>
              <CurrencyAmount cents={appliedCreditCents} />
            </dd>
          </div>
        </dl>
      ) : null}

      {error ? (
        <p className="mc-caja-alert" role="alert">
          {error}
        </p>
      ) : null}
      </div>

      <div className="mc-caja-summary__footer">
        <button type="button" className="mc-caja-clear" onClick={onClear} disabled={saving || locked}>
          Descartar venta
        </button>
      </div>
    </aside>
  );
}
