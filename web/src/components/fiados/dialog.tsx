"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

/**
 * Hoja modal de Fiados sobre `<dialog>` nativo.
 *
 * El elemento nativo aporta lo que no conviene reimplementar: backdrop,
 * contención del foco y `Escape` como evento `cancel`. Aquí solo se sincroniza
 * con React, se enfoca el primer campo (`[data-autofocus]`), se bloquea el
 * scroll de fondo y se devuelve el foco al disparador al cerrar.
 *
 * Se monta únicamente cuando la hoja está abierta (render condicional desde
 * `CreditPayButton`), por eso el efecto de apertura corre una sola vez.
 */
export function SheetDialog({
  title,
  description,
  onClose,
  closeDisabled = false,
  children,
}: {
  title: string;
  /** Texto de apoyo corto bajo el título, asociado con `aria-describedby`. */
  description?: string;
  onClose: () => void;
  /** Mientras se envía, Escape y backdrop no cierran la hoja. */
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  }, [onClose, closeDisabled]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    const frame = window.requestAnimationFrame(() => {
      const target =
        dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog;
      target.focus();
    });

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frame);
      body.style.overflow = previousOverflow;
      // El foco vuelve al botón que abrió, incluso tras un `router.refresh()`.
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      // Escape cierra la hoja, salvo que la petición esté en vuelo.
      event.preventDefault();
      if (!closeDisabledRef.current) onCloseRef.current();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget || closeDisabled) return;
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="mc-fiados-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onClick={handleBackdropClick}
    >
      <div className="mc-fiados-dialog__card">
        <div className="mc-fiados-dialog__head">
          <div className="mc-fiados-dialog__copy">
            <h2 id={titleId} className="mc-fiados-dialog__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mc-fiados-dialog__description">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="mc-fiados-dialog__close"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Cerrar"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="mc-fiados-dialog__body">{children}</div>
      </div>
    </dialog>
  );
}
