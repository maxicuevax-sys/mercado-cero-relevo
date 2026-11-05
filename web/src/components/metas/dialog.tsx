"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Diálogo modal de Metas sobre `<dialog>` nativo.
 *
 * El elemento nativo aporta lo que no conviene reimplementar: backdrop,
 * contención del foco dentro del diálogo y `Escape` como evento `cancel`.
 * Aquí solo se sincroniza con React (apertura/cierre), se devuelve el foco al
 * disparador y se evita el cierre accidental desde el backdrop mientras se
 * envía el formulario.
 */
export function ModalDialog({
  open,
  title,
  description,
  onClose,
  closeDisabled = false,
  children,
}: {
  open: boolean;
  title: string;
  /** Texto de apoyo opcional, asociado con `aria-describedby`. */
  description?: string;
  onClose: () => void;
  /** Mientras se envía, Escape y backdrop no cierran el diálogo. */
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
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

    if (open) {
      // El disparador se guarda solo al abrir: en Strict Mode el efecto corre
      // dos veces y la segunda ya encontraría el foco dentro del diálogo.
      if (!wasOpenRef.current) {
        const active = document.activeElement;
        triggerRef.current = active instanceof HTMLElement ? active : null;
        wasOpenRef.current = true;
      }
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      }
      // El primer campo del formulario recibe el foco, no el botón de cerrar.
      const frame = window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (dialog.open) dialog.close();
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    // El foco vuelve al botón que abrió, incluso si el shell se re-renderizó.
    const frame = window.requestAnimationFrame(() => {
      if (trigger && trigger.isConnected) trigger.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      // Escape cierra el diálogo, salvo que la petición esté en vuelo.
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
      className="mc-metas-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="mc-metas-dialog__card">
        <div className="mc-metas-dialog__head">
          <h2 id={titleId} className="mc-metas-dialog__title">
            {title}
          </h2>
          <button
            type="button"
            className="mc-metas-dialog__close"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Cerrar"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {description ? (
          <p id={descriptionId} className="mc-metas-dialog__description">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </dialog>
  );
}
