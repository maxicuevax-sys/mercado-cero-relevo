"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/** App-owned confirmation; the modal element contains focus and makes the page inert. */
export function DiscardDialog({ title, description, confirmLabel, onCancel, onConfirm }: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    cancelRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="mc-caja-discard"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Keep the boundary inside the card, including browsers that otherwise
        // move focus to browser chrome before cycling through a native dialog.
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="mc-caja-discard__card">
        <div className="mc-caja-discard__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="mc-caja-discard__close" aria-label="Cerrar" onClick={onCancel}><X aria-hidden="true" /></button>
        </div>
        <p id={descriptionId}>{description}</p>
        <div className="mc-caja-discard__actions">
          <button ref={cancelRef} type="button" className="mc-caja-button mc-caja-button--primary" onClick={onCancel}>Seguir con la venta</button>
          <button type="button" className="mc-caja-button mc-caja-button--secondary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
