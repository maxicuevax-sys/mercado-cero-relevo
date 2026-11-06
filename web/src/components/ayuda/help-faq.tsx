"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Preguntas frecuentes de la ayuda. El texto es fijo y verificado: la app no
 * usa el modelo para decidir si un pago llegó. Acordeón con `aria-expanded` y
 * `aria-controls`; el panel siempre existe y se oculta con `hidden`.
 */
const FAQS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "¿Cómo cobro?",
    answer:
      "Dicta o escribe la venta, confirma el total y genera un link o QR. El cliente paga desde su banco o wallet.",
  },
  {
    question: "¿Cuándo está pagado?",
    answer:
      "Solo cuando la app muestra “Pago verificado por pey”: llegó un evento firmado de pey. “Por cobrar” y “Pago demo (simulado)” no son entregables.",
  },
  {
    question: "¿Qué es un pago demo?",
    answer:
      "Es una simulación para probar la app. No es dinero real, no se entrega y no cuenta como cobrado confirmado.",
  },
  {
    question: "¿Puedo cobrar en efectivo?",
    answer:
      "Sí. El efectivo se registra como recibido; no es una confirmación bancaria. El corte separa efectivo, pagos verificados por pey, declarado y fiado.",
  },
  {
    question: "¿Qué es el fiado?",
    answer:
      "Es una libreta de deudas y abonos. Un abono reduce el saldo, pero no cuenta como venta nueva ni como pago bancario verificado.",
  },
  {
    question: "¿La cuenta es de mi hija?",
    answer:
      "La app muestra únicamente los cobros generados por el negocio. No accede al saldo ni a los movimientos personales del titular.",
  },
  {
    question: "¿Qué es el corte?",
    answer:
      "Base inicial más ventas en efectivo y abonos de fiado, menos gastos y retiros. Si lo contado no coincide, se muestra la diferencia; no se ajusta sola.",
  },
];

export function HelpFaq() {
  const baseId = useId();
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="mc-ayuda-faq">
      {FAQS.map((item, index) => {
        const open = expanded === index;
        const buttonId = `${baseId}-q${index}`;
        const panelId = `${baseId}-a${index}`;
        return (
          <div key={item.question} className="mc-ayuda-faq__item">
            <h3 className="mc-ayuda-faq__heading">
              <button
                type="button"
                id={buttonId}
                className="mc-ayuda-faq__button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setExpanded(open ? null : index)}
              >
                <span className="mc-ayuda-faq__question">{item.question}</span>
                <ChevronDown
                  className={cn(
                    "mc-ayuda-faq__icon",
                    open && "mc-ayuda-faq__icon--open",
                  )}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!open}
              className="mc-ayuda-faq__panel"
            >
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
