"use client";

import Image from "next/image";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { lineTotalCents, newLineId, parseMoneyCents, parseQuantity, type DraftLine } from "./types";
import tacosArt from "@/assets/brand/ilustraciones/transparent/tacos.png";

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

  function addLine() {
    const cleanDescription = description.trim();
    if (!cleanDescription) {
      setAddError("Escribe qué vendiste.");
      return;
    }
    if (!parseQuantity(quantity)) {
      setAddError("La cantidad debe ser mayor que cero.");
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
    <section className="mc-caja-card mc-caja-items" aria-labelledby="mc-caja-items-title">
      <div className="mc-caja-card__head">
        <div>
          <p className="mc-caja-eyebrow">Conceptos</p>
          <h2 id="mc-caja-items-title">Qué estás vendiendo</h2>
        </div>
        <span className="mc-caja-count" aria-live="polite">
          {lines.length} {lines.length === 1 ? "concepto" : "conceptos"}
        </span>
      </div>

      <div className="mc-caja-add">
        <p className="mc-caja-add__title">Agregar concepto</p>
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
            <p>Agrega uno a mano. No necesitas inventario ni micrófono.</p>
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
            const baseError = errors[line.id];
            const descriptionInvalid = Boolean(
              baseError && /concepto|qué vendiste/i.test(baseError),
            );
            const quantityError =
              line.quantity !== "" && !parseQuantity(line.quantity)
                ? "La cantidad debe ser mayor que cero."
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
                <label className="mc-caja-field mc-caja-field--description">
                  <span>Concepto</span>
                  <input
                    id={`line-description-${line.id}`}
                    value={line.description}
                    onChange={(event) => onUpdate(line.id, { description: event.target.value })}
                    aria-invalid={descriptionInvalid ? true : undefined}
                    aria-describedby={descriptionInvalid ? `line-error-${line.id}` : undefined}
                    autoComplete="off"
                    disabled={disabled}
                  />
                </label>
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
                  {quantityError ? (
                    <span id={`line-qty-error-${line.id}`} className="mc-caja-field-error">
                      {quantityError}
                    </span>
                  ) : null}
                </label>
                <label className="mc-caja-field mc-caja-field--price">
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
