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
 * Diálogo modal de Corte sobre `<dialog>` nativo.
 *
 * El elemento nativo aporta backdrop, contención del foco y `Escape` como
 * evento `cancel`. Aquí solo se sincroniza con React, se enfoca el diálogo
 * (no el botón de guardar) y se devuelve el foco al disparador al cerrar.
 * Se monta únicamente mientras la confirmación está abierta.
 */
export function Dialog({
  title,
  description,
  onClose,
  closeDisabled = false,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  /** Mientras se guarda, Escape y backdrop no cierran el diálogo. */
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

    // El diálogo recibe el foco, no la acción destructiva: la persona lee la
    // diferencia y decide con Tab dentro del diálogo.
    const frame = window.requestAnimationFrame(() => dialog.focus());

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frame);
      body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
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
      className="mc-corte-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onClick={handleBackdropClick}
    >
      <div className="mc-corte-dialog__card">
        <div className="mc-corte-dialog__head">
          <div className="mc-corte-dialog__copy">
            <h2 id={titleId} className="mc-corte-dialog__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mc-corte-dialog__description">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="mc-corte-dialog__close"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Cerrar"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="mc-corte-dialog__body">{children}</div>
      </div>
    </dialog>
  );
}
