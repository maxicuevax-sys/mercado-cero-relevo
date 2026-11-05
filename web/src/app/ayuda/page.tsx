import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArtBanner } from "@/components/shell/art-banner";
import { OperationalPage } from "@/components/shell/operational-page";
import { HelpFaq } from "@/components/ayuda/help-faq";
import { MERCHANT, isDemoMode } from "@/lib/config";
import botArt from "@/assets/brand/ilustraciones/transparent/bot.png";
import qrArt from "@/assets/brand/ilustraciones/transparent/qr.png";
import ajustesIcon from "@/assets/brand/iconos/transparent/ajustes.png";
import reciboIcon from "@/assets/brand/iconos/transparent/recibo.png";
import qrTelefonoIcon from "@/assets/brand/iconos/transparent/qr-telefono.png";
import registradoraIcon from "@/assets/brand/iconos/transparent/registradora.png";
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
  medallion: "green" | "saffron" | "clay";
  tone: "attention" | "green";
  icon: StaticImageData;
}> = [
  {
    eyebrow: "Registrar",
    title: "La venta queda en tu libreta.",
    note: "Todavía no es dinero recibido.",
    medallion: "green",
    tone: "green",
    icon: registradoraIcon,
  },
  {
    eyebrow: "Cobrar",
    title: "Solo se marca verificado con pey.",
    note: "Un demo o una captura no cuentan.",
    medallion: "saffron",
    tone: "attention",
    icon: qrTelefonoIcon,
  },
  {
    eyebrow: "Fiar",
    title: "Queda como deuda.",
    note: "Un abono no crea una venta nueva.",
    medallion: "clay",
    tone: "attention",
    icon: reciboIcon,
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
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={isDemoMode()}
    >
      <div className="mc-ayuda-layout">
        <ArtBanner
          art={botArt}
          invert
          kicker="La caja que habla"
          title="Vender, cobrar y fiar, sin letras chiquitas."
          className="mc-ayuda-hero"
        >
          <p className="mc-ayuda-hero__lead">
            Esta ayuda es fija y verificada. Si algo no se siente claro, cambia
            el texto, el contraste y la voz desde Ajustes.
          </p>
          <p className="mc-ayuda-hero__chip">
            <Image
              src={qrArt}
              alt=""
              aria-hidden="true"
              className="mc-ayuda-hero__qr"
              sizes="64px"
            />
            <span>
              <strong>Cobra con QR o link.</strong> Un pago solo se marca
              verificado cuando llega la confirmación firmada de pey.
            </span>
          </p>
        </ArtBanner>

        <section className="mc-ayuda-steps" aria-labelledby="mc-ayuda-steps-title">
          <div className="mc-art-head">
            <h2 id="mc-ayuda-steps-title" className="mc-art-section-title">
              Tres cosas que conviene tener claras
            </h2>
            <span className="mc-art-stamp mc-art-stamp--clay">
              Sin letras chiquitas
            </span>
          </div>
          <div className="mc-ayuda-steps__grid">
            {STEPS.map((step) => (
              <article key={step.eyebrow} className="mc-art-paper mc-ayuda-step">
                <span className={`mc-art-medallion mc-art-medallion--${step.medallion}`}>
                  <Image
                    src={step.icon}
                    alt=""
                    aria-hidden="true"
                    className="mc-art-medallion__icon"
                    sizes="30px"
                  />
                </span>
                <p className={`mc-ayuda-step__eyebrow mc-ayuda-step__eyebrow--${step.tone}`}>
                  {step.eyebrow}
                </p>
                <p className="mc-ayuda-step__title">{step.title}</p>
                <p className="mc-ayuda-step__note">{step.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="mc-ayuda-first"
          aria-labelledby="mc-ayuda-first-title"
        >
          <div className="mc-art-head">
            <h2 id="mc-ayuda-first-title" className="mc-art-section-title">
              Primeros pasos
            </h2>
            <span className="mc-art-stamp mc-art-stamp--green">
              Tu primer día, en orden
            </span>
          </div>
          <ol className="mc-art-paper mc-ayuda-first__list">
            {FIRST_STEPS.map((step, index) => (
              <li key={step} className="mc-ayuda-first__item">
                <span className="mc-ayuda-first__number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="mc-art-paper mc-ayuda-faq"
          aria-labelledby="mc-ayuda-faq-title"
        >
          <div className="mc-art-paper__head">
            <h2 id="mc-ayuda-faq-title" className="mc-art-paper__title">
              Preguntas frecuentes
            </h2>
            <span className="mc-art-stamp mc-art-stamp--green">7 respuestas</span>
          </div>
          <p className="mc-art-paper__note">
            Respuestas fijas y verificadas: la app no usa el modelo para decidir
            si un pago llegó.
          </p>
          <HelpFaq />
          <p className="mc-ayuda-note">
            ¿Tu duda no está aquí? En Ajustes cambias cómo se lee la app; en Caja
            practicas el recorrido completo.
          </p>
        </section>

        <section
          className="mc-art-paper mc-ayuda-cta"
          aria-labelledby="mc-ayuda-cta-title"
        >
          <span className="mc-art-medallion mc-art-medallion--saffron">
            <Image
              src={ajustesIcon}
              alt=""
              aria-hidden="true"
              className="mc-art-medallion__icon"
              sizes="30px"
            />
          </span>
          <div className="mc-ayuda-cta__copy">
            <h2 id="mc-ayuda-cta-title" className="mc-art-paper__title">
              ¿Necesitas otra letra o menos contraste?
            </h2>
            <p className="mc-art-paper__note">
              En Ajustes cambias el tamaño, el contraste y la velocidad de la
              voz. Se guarda solo en este dispositivo.
            </p>
          </div>
          <div className="mc-ayuda-cta__actions">
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
    </OperationalPage>
  );
}
