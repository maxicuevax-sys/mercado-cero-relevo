import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { HelpFaq } from "@/components/ayuda/help-faq";
import { MERCHANT, isDemoMode } from "@/lib/config";
import botArt from "@/assets/brand/ilustraciones/transparent/bot.png";
import qrArt from "@/assets/brand/ilustraciones/transparent/qr.png";
import "./ayuda.css";

export const metadata: Metadata = {
  title: "Ayuda · Mercado Cero",
  description:
    "Cómo registrar, cobrar y fiar en Mercado Cero, y cómo ajustar el texto, el contraste y la voz.",
};

export const instant = false;

const STEPS: ReadonlyArray<{
  eyebrow: string;
  title: string;
  note: string;
  tone: "attention" | "green";
}> = [
  {
    eyebrow: "Registrar",
    title: "La venta queda en tu libreta.",
    note: "Todavía no es dinero recibido.",
    tone: "attention",
  },
  {
    eyebrow: "Cobrar",
    title: "Solo se marca verificado con pey.",
    note: "Un demo o una captura no cuentan.",
    tone: "green",
  },
  {
    eyebrow: "Fiar",
    title: "Queda como deuda.",
    note: "Un abono no crea una venta nueva.",
    tone: "attention",
  },
];

const FIRST_STEPS = [
  "Dicta o escribe una venta.",
  "Genera el link o QR y compártelo.",
  "Espera el webhook firmado: solo entonces está pagado.",
  "Al final del día, cuenta tu efectivo y cierra caja.",
];

export default async function AyudaPage() {
  await connection();

  return (
    <OperationalPage
      activeHref="/ayuda"
      title="Ayuda"
      titleId="ayuda-title"
      eyebrow="Ayuda"
      subtitle="Cómo registrar, cobrar y fiar; y cómo leer la app a tu manera."
      actions={
        <>
          <Link href="/ajustes" className="mc-ayuda-action mc-ayuda-action--primary">
            Cambiar texto, contraste o voz
          </Link>
          <Link href="/caja" className="mc-ayuda-action mc-ayuda-action--secondary">
            Volver a Caja
          </Link>
        </>
      }
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={isDemoMode()}
    >
      <div className="mc-ayuda-layout">
        <div className="mc-ayuda-col">
          <section
            className="mc-op-panel mc-ayuda-intro"
            aria-labelledby="mc-ayuda-intro-title"
          >
            <div className="mc-op-panel__body mc-ayuda-intro__body">
              <div className="mc-ayuda-intro__copy">
                <h2
                  id="mc-ayuda-intro-title"
                  className="mc-op-panel__title"
                >
                  La caja que habla
                </h2>
                <p className="mc-ayuda-intro__lead">
                  Ayuda sin letras chiquitas. Si algo no se siente claro,
                  pregunta o cambia el texto, el contraste y la voz.
                </p>
              </div>
              <div className="mc-ayuda-intro__art">
                <Image
                  src={botArt}
                  alt=""
                  aria-hidden="true"
                  width={96}
                  height={96}
                  className="mc-ayuda-intro__bot"
                  sizes="128px"
                />
                <Image
                  src={qrArt}
                  alt=""
                  aria-hidden="true"
                  width={72}
                  height={72}
                  className="mc-ayuda-intro__qr"
                  sizes="96px"
                />
              </div>
            </div>
          </section>

          <section
            className="mc-ayuda-steps"
            aria-labelledby="mc-ayuda-steps-title"
          >
            <h2 id="mc-ayuda-steps-title" className="mc-ayuda-section-title">
              Tres cosas que conviene tener claras
            </h2>
            <div className="mc-ayuda-steps__grid">
              {STEPS.map((step) => (
                <article key={step.eyebrow} className="mc-ayuda-step">
                  <p
                    className={`mc-ayuda-step__eyebrow mc-ayuda-step__eyebrow--${step.tone}`}
                  >
                    {step.eyebrow}
                  </p>
                  <p className="mc-ayuda-step__title">{step.title}</p>
                  <p className="mc-ayuda-step__note">{step.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            className="mc-op-panel"
            aria-labelledby="mc-ayuda-first-title"
          >
            <div className="mc-op-panel__head">
              <h2 id="mc-ayuda-first-title" className="mc-op-panel__title">
                Primeros pasos
              </h2>
              <p className="mc-op-panel__meta">Tu primer día, en orden</p>
            </div>
            <div className="mc-op-panel__body">
              <ol className="mc-ayuda-first">
                {FIRST_STEPS.map((step, index) => (
                  <li key={step} className="mc-ayuda-first__item">
                    <span className="mc-ayuda-first__number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>

        <div className="mc-ayuda-col">
          <section
            className="mc-op-panel"
            aria-labelledby="mc-ayuda-faq-title"
          >
            <div className="mc-op-panel__head">
              <h2 id="mc-ayuda-faq-title" className="mc-op-panel__title">
                Preguntas frecuentes
              </h2>
              <p className="mc-op-panel__meta">7 respuestas fijas</p>
            </div>
            <div className="mc-op-panel__body">
              <HelpFaq />
            </div>
            <div className="mc-op-panel__foot">
              <p className="mc-ayuda-note">
                Las respuestas son fijas y verificadas. La app no usa el modelo
                para decidir si un pago llegó.
              </p>
            </div>
          </section>

          <section
            className="mc-op-panel mc-ayuda-ajustes"
            aria-labelledby="mc-ayuda-ajustes-title"
          >
            <div className="mc-op-panel__head">
              <h2
                id="mc-ayuda-ajustes-title"
                className="mc-op-panel__title"
              >
                ¿Necesitas otra letra o menos contraste?
              </h2>
            </div>
            <div className="mc-op-panel__body">
              <p className="mc-ayuda-ajustes__text">
                En Ajustes puedes cambiar el tamaño del texto, el contraste y la
                velocidad de la voz. Se guarda solo en este dispositivo.
              </p>
            </div>
            <div className="mc-op-panel__foot">
              <Link
                href="/ajustes"
                className="mc-ayuda-action mc-ayuda-action--primary"
              >
                Ir a Ajustes
              </Link>
              <Link
                href="/caja"
                className="mc-ayuda-action mc-ayuda-action--secondary"
              >
                Volver a Caja
              </Link>
            </div>
          </section>
        </div>
      </div>
    </OperationalPage>
  );
}
