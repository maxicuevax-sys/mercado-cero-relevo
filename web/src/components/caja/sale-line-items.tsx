"use client";

import Image from "next/image";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { lineTotalCents, newLineId, parseMoneyCents, parseQuantity, QUANTITY_ERROR, type DraftLine } from "./types";
import tacosArt from "@/assets/brand/ilustraciones/transparent/tacos.png";
import "./sale-line-items-spec.css";

function productPresentation(description: string, quantity: string) {
  const name = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (/^tortillas?(?:\s+\d+(?:[.,]\d+)?\s*kg)?$/.test(name)) {
    return { image: "tortilla", detail: `${quantity} kg` };
  }
  if (/^huevos?(?:\s+(?:\d+\s+)?cajas?)?$/.test(name)) {
    return { image: "huevo", detail: `${quantity} ${quantity === "1" ? "caja" : "cajas"}` };
  }
  if (/^refresco(?:\s+600\s*ml)?$/.test(name)) {
    return { image: "refresco", detail: "600 ml" };
  }
  return { image: null, detail: "Editar precio" };
}

export function SaleLineItems({
  lines,
  errors,
  disabled,
  onAdd,
  onUpdate,
  onRemove,
}: {
  lines: DraftLine[];
  errors: Record<string, string>;
  disabled: boolean;
  onAdd: (line: DraftLine) => void;
  onUpdate: (id: string, patch: Partial<DraftLine>) => void;
  onRemove: (id: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);

  function stepQuantity(line: DraftLine, direction: -1 | 1) {
    const current = parseQuantity(line.quantity);
    const next = Math.min(999, Math.round((current + direction) * 1000) / 1000);
    if (next > 0) onUpdate(line.id, { quantity: String(next) });
  }

  function addLine() {
    const cleanDescription = description.trim();
    if (!cleanDescription) {
      setAddError("Escribe qué vendiste.");
      return;
    }
    if (!parseQuantity(quantity)) {
      setAddError(QUANTITY_ERROR);
      return;
    }
    if (parseMoneyCents(price) <= 0) {
      setAddError("El precio debe ser mayor que cero.");
      return;
    }
    setAddError(null);
    onAdd({
      id: newLineId(),
      description: cleanDescription,
      quantity,
      price,
    });
    setDescription("");
    setQuantity("1");
    setPrice("");
  }

  return (
    <section className={`mc-caja-card mc-caja-items${lines.length === 0 ? " mc-caja-items--empty" : ""}`} aria-labelledby="mc-caja-items-title">
      <div className="mc-caja-card__head">
        <div>
          <p className="mc-caja-eyebrow">Conceptos</p>
          <h2 id="mc-caja-items-title">Ticket de venta</h2>
        </div>
        <span className="mc-caja-count" aria-live="polite">
          {lines.length} {lines.length === 1 ? "concepto" : "conceptos"}
        </span>
      </div>

      <details id="mc-caja-manual" className="mc-caja-manual">
        <summary>Agregar concepto a mano</summary>
      <div className="mc-caja-add">
        <div className="mc-caja-add__grid">
          <label className="mc-caja-field mc-caja-add__description">
            <span>Producto o servicio</span>
            <input
              id="mc-caja-new-description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setAddError(null);
              }}
              placeholder="Ej. Quesadilla"
              autoComplete="off"
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? "mc-caja-add-error" : undefined}
            />
          </label>
          <label className="mc-caja-field">
            <span>Cantidad</span>
            <input
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setAddError(null);
              }}
              inputMode="decimal"
            />
          </label>
          <label className="mc-caja-field">
            <span>Precio unitario</span>
            <input
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                setAddError(null);
              }}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <button type="button" className="mc-caja-button mc-caja-button--secondary" onClick={addLine} disabled={disabled}>
            <span aria-hidden="true">+</span>
            <span className="mc-caja-add__button-label">Agregar</span>
          </button>
        </div>
        {addError ? (
          <p id="mc-caja-add-error" className="mc-caja-field-error" role="alert">
            {addError}
          </p>
        ) : null}
      </div>

      </details>

      {lines.length === 0 ? (
        <div className="mc-caja-empty">
          <Image
            src={tacosArt}
            alt=""
            aria-hidden="true"
            width={112}
            height={106}
            className="mc-caja-empty__art"
            sizes="112px"
          />
          <div className="mc-caja-empty__copy">
            <p className="mc-caja-empty__title">Aún no hay conceptos.</p>
            <p>Dicta la venta arriba o agrega un concepto a mano.</p>
          </div>
        </div>
      ) : (
        <ul className="mc-caja-lines">
          <li className="mc-caja-lines__head" aria-hidden="true">
            <span>Concepto</span>
            <span>Cantidad</span>
            <span>Precio</span>
            <span>Importe</span>
            <span />
          </li>
          {lines.map((line) => {
            const product = productPresentation(line.description, line.quantity);
            const baseError = errors[line.id];
            const descriptionInvalid = Boolean(
              baseError && /concepto|qué vendiste/i.test(baseError),
            );
            const quantityError =
              line.quantity !== "" && !parseQuantity(line.quantity)
                ? QUANTITY_ERROR
                : baseError && /cantidad/i.test(baseError)
                  ? baseError
                  : null;
            const priceError =
              line.price !== "" && parseMoneyCents(line.price) <= 0
                ? "El precio debe ser mayor que cero."
                : baseError && /precio/i.test(baseError)
                  ? baseError
                  : null;
            const showBaseError = Boolean(baseError) && !quantityError && !priceError;
            return (
              <li
                key={line.id}
                className={`mc-caja-line${baseError ? " mc-caja-line--error" : ""}`}
              >
                <div className="mc-caja-line__art" aria-hidden="true">
                  {product.image ? (
                    <Image src={`/assets/spec/caja-producto-${product.image}.png`} alt="" width={44} height={44} sizes="44px" unoptimized />
                  ) : null}
                </div>
                <label className="mc-caja-field mc-caja-field--description">
                  <span>Concepto</span>
                  <textarea
                    id={`line-description-${line.id}`}
                    rows={1}
                    value={line.description}
                    onChange={(event) => onUpdate(line.id, { description: event.target.value })}
                    aria-invalid={descriptionInvalid ? true : undefined}
                    aria-describedby={descriptionInvalid ? `line-error-${line.id}` : undefined}
                    autoComplete="off"
                    disabled={disabled}
                  />
                </label>
                <button
                  type="button"
                  className="mc-caja-line__price-toggle"
                  aria-label={`${product.detail}: editar precio de ${line.description || "concepto"}`}
                  aria-expanded={editingPrice === line.id || Boolean(priceError)}
                  aria-controls={`line-price-field-${line.id}`}
                  onClick={() => setEditingPrice(editingPrice === line.id ? null : line.id)}
                  disabled={disabled}
                >
                  {product.detail}
                </button>
                <div className="mc-caja-line__quantity">
                  <button
                    type="button"
                    className="mc-caja-line__step"
                    aria-label={`− Reducir cantidad de ${line.description || "concepto"}`}
                    onClick={() => stepQuantity(line, -1)}
                    disabled={disabled || parseQuantity(line.quantity) <= 1}
                  >−</button>
                <label className="mc-caja-field mc-caja-field--qty">
                  <span>Cantidad</span>
                  <input
                    id={`line-quantity-${line.id}`}
                    value={line.quantity}
                    onChange={(event) => onUpdate(line.id, { quantity: event.target.value })}
                    inputMode="decimal"
                    aria-invalid={quantityError ? true : undefined}
                    aria-describedby={quantityError ? `line-qty-error-${line.id}` : undefined}
                    disabled={disabled}
                  />
                </label>
                  <button
                    type="button"
                    className="mc-caja-line__step"
                    aria-label={`+ Aumentar cantidad de ${line.description || "concepto"}`}
                    onClick={() => stepQuantity(line, 1)}
                    disabled={disabled || parseQuantity(line.quantity) >= 999}
                  >+</button>
                </div>
                <label id={`line-price-field-${line.id}`} className={`mc-caja-field mc-caja-field--price${editingPrice === line.id || priceError ? " mc-caja-field--price-open" : ""}`}>
                  <span>Precio</span>
                  <input
                    id={`line-price-${line.id}`}
                    value={line.price}
                    onChange={(event) => onUpdate(line.id, { price: event.target.value })}
                    inputMode="decimal"
                    aria-invalid={priceError ? true : undefined}
                    aria-describedby={priceError ? `line-price-error-${line.id}` : undefined}
                    disabled={disabled}
                  />
                  {priceError ? (
                    <span id={`line-price-error-${line.id}`} className="mc-caja-field-error">
                      {priceError}
                    </span>
                  ) : null}
                </label>
                <div className="mc-caja-line__total">
                  <span className="mc-caja-line__label">Importe</span>
                  <CurrencyAmount cents={lineTotalCents(line)} />
                </div>
                <button
                  type="button"
                  className="mc-caja-icon-button mc-caja-icon-button--danger"
                  onClick={() => onRemove(line.id)}
                  disabled={disabled}
                  aria-label={`Quitar ${line.description || "concepto"}`}
                >
                  <Trash2 aria-hidden="true" focusable="false" />
                </button>
                {quantityError ? (
                  <p id={`line-qty-error-${line.id}`} className="mc-caja-field-error" role="alert">
                    {quantityError}
                  </p>
                ) : null}
                {showBaseError ? (
                  <p id={`line-error-${line.id}`} className="mc-caja-field-error" role="alert">
                    {baseError}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}


    </section>
  );
}
