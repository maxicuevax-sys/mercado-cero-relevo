"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ChartNoAxesColumnIncreasing,
  MapPin,
  NotebookPen,
  ReceiptText,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { formatMxn } from "@/lib/format";
import {
  readOnboardingProfile,
  saveOnboardingProfile,
  type OnboardingSampleSale,
} from "@/lib/onboarding-profile";
import shopArt from "@/assets/brand/ilustraciones/transparent/puesto.png";
import tacoArt from "@/assets/brand/ilustraciones/transparent/tacos.png";
import brandShop from "@/assets/inicio/brand-shop-cream.svg";
import "./onboarding.css";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: "Bienvenida",
  2: "Conozcamos tu negocio",
  3: "Primera venta de ejemplo",
  4: "Listo",
};

const GIROS = [
  "Comida / Antojitos",
  "Abarrotes",
  "Frutería y verdulería",
  "Panadería",
  "Tortillería",
  "Café",
  "Ropa y calzado",
  "Belleza y cuidado personal",
  "Servicios",
  "Otro",
] as const;

const SAMPLE = {
  description: "2 quesadillas",
  quantity: 2,
  unitCents: 3500,
  totalCents: 7000,
} as const;

function BrandHeader() {
  return (
    <header className="onb-header">
      <div className="onb-brand" aria-label="Mercado Cero">
        <Image
          src={brandShop}
          alt=""
          aria-hidden="true"
          className="onb-brand__mark"
          sizes="(max-width: 760px) 64px, 190px"
          loading="eager"
        />
        <span className="onb-brand__wordmark">
          <span className="onb-brand__name">
            Mercado
            <br />
            Cero
          </span>
          <svg
            className="onb-brand__rays"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 5.5l8 4M2 13h9M6 21l5.5-6" />
          </svg>
        </span>
      </div>
    </header>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <>
      <p className="onb-progress-label">
        Paso {step} de 4: {STEP_LABELS[step]}
      </p>
      <div className="onb-progress" aria-hidden="true">
        {[1, 2, 3, 4].map((dot) => (
          <span
            key={dot}
            className={`onb-dot${dot === step ? " onb-dot--current" : ""}`}
          />
        ))}
      </div>
    </>
  );
}

function CheckBurst() {
  return (
    <svg
      className="onb-check-burst"
      viewBox="0 0 260 260"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeLinecap="round" fill="none">
        <path d="M66 26 79 47" stroke="#e5a91f" strokeWidth="16" />
        <path d="M130 6v27" stroke="#e5a91f" strokeWidth="16" />
        <path d="M196 28l-14 21" stroke="#e5a91f" strokeWidth="16" />
        <path d="M38 96 15 84" stroke="#c1492e" strokeWidth="14" />
        <path d="M222 96l23-12" stroke="#c1492e" strokeWidth="14" />
        <path d="M39 170 19 186" stroke="#c1492e" strokeWidth="13" />
        <path d="M216 173l19 15" stroke="#e5a91f" strokeWidth="13" />
        <path d="M78 224l-8 21" stroke="#7fa06b" strokeWidth="13" />
        <path d="M184 224l7 20" stroke="#e5a91f" strokeWidth="13" />
        <path d="M18 134H2" stroke="#7fa06b" strokeWidth="13" />
        <path d="M258 134h-16" stroke="#7fa06b" strokeWidth="13" />
      </g>
      <circle cx="130" cy="130" r="62" fill="#0f5a3d" />
      <circle cx="130" cy="130" r="55" fill="#0b6b45" />
      <path
        d="M102 131l19 20 39-42"
        fill="none"
        stroke="#ffffff"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OnboardingFlow() {
  const [initialProfile] = useState(() => readOnboardingProfile());
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [giro, setGiro] = useState(initialProfile?.giro ?? "");
  const [sampleSale, setSampleSale] = useState<OnboardingSampleSale | null>(
    initialProfile?.sampleSale ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const giroRef = useRef<HTMLSelectElement>(null);
  const mounted = useRef(false);
  const nameId = useId();
  const giroId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  function goBack() {
    if (step === 2) goTo(1);
    if (step === 3) goTo(2);
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Escribe el nombre de tu negocio para continuar.");
      nameRef.current?.focus();
      return;
    }
    if (!giro) {
      setError("Elige a qué te dedicas para continuar.");
      giroRef.current?.focus();
      return;
    }

    const saved = saveOnboardingProfile({ name: cleanName, giro });
    setName(saved.name);
    setGiro(saved.giro);
    goTo(3);
  }

  function registerSampleSale() {
    const createdAt = new Date().toISOString();
    const sale: OnboardingSampleSale = {
      id: `onboarding-demo-${Date.now()}`,
      description: SAMPLE.description,
      quantity: SAMPLE.quantity,
      unitCents: SAMPLE.unitCents,
      totalCents: SAMPLE.totalCents,
      kind: "onboarding-demo",
      demo: true,
      createdAt,
    };

    const saved = saveOnboardingProfile({
      name: name.trim(),
      giro,
      sampleSale: sale,
      completedAt: createdAt,
    });
    setSampleSale(saved.sampleSale);
    setAnnouncement("Venta de ejemplo guardada. No es un cobro real.");
    goTo(4);
  }

  const plain = step === 4;

  return (
    <main className={`onb-shell${plain ? " onb-shell--plain" : ""}`}>
      {!plain ? <BrandHeader /> : null}

      <div className="onb-card">
        {step === 2 || step === 3 ? (
          <button type="button" className="onb-back" onClick={goBack}>
            <ArrowLeft aria-hidden="true" />
            <span>Atrás</span>
          </button>
        ) : null}

        {step === 1 ? (
          <section className="onb-step" aria-labelledby="onb-title-1">
            <Image
              src={shopArt}
              alt=""
              aria-hidden="true"
              className="onb-art onb-art--welcome"
              sizes="(max-width: 760px) 270px, 700px"
              loading="eager"
            />
            <h1
              id="onb-title-1"
              className="onb-title"
              ref={headingRef}
              tabIndex={-1}
            >
              Tu negocio,
              <br />
              más claro,
              <br />
              más libre.
            </h1>
            <p className="onb-copy">
              Vende, cobra, lleva tus cuentas y organiza tu día, en un solo
              lugar.
            </p>
            <button type="button" className="onb-cta" onClick={() => goTo(2)}>
              Empezar
            </button>
            <Link className="onb-text-link" href="/inicio">
              Ya tengo una cuenta
            </Link>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="onb-step" aria-labelledby="onb-title-2">
            <h1
              id="onb-title-2"
              className="onb-title onb-title--center"
              ref={headingRef}
              tabIndex={-1}
            >
              Conozcamos
              <br />
              tu negocio
            </h1>
            <div className="onb-art-wrap">
              <Image
                src={shopArt}
                alt=""
                aria-hidden="true"
                className="onb-art onb-art--store"
                sizes="(max-width: 760px) 220px, 520px"
                loading="eager"
              />
              <MapPin className="onb-pin" aria-hidden="true" />
            </div>
            <form className="onb-form" onSubmit={handleProfileSubmit} noValidate>
              <label className="onb-label" htmlFor={nameId}>
                ¿Cómo se llama tu negocio?
              </label>
              <input
                id={nameId}
                ref={nameRef}
                className="onb-input"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Antojitos de Lupita"
                autoComplete="organization"
                maxLength={80}
                aria-invalid={error !== null && !name.trim()}
                aria-describedby={error ? errorId : undefined}
              />

              <label className="onb-label" htmlFor={giroId}>
                ¿A qué te dedicas?
              </label>
              <select
                id={giroId}
                ref={giroRef}
                className="onb-input onb-select"
                value={giro}
                onChange={(event) => {
                  setGiro(event.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={error !== null && !giro}
                aria-describedby={error ? errorId : undefined}
              >
                <option value="">Elige una opción</option>
                {GIROS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              {error ? (
                <p className="onb-error" id={errorId} role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="onb-cta">
                Continuar
              </button>
            </form>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="onb-step" aria-labelledby="onb-title-3">
            <h1
              id="onb-title-3"
              className="onb-title onb-title--center"
              ref={headingRef}
              tabIndex={-1}
            >
              Hagamos tu
              <br />
              primera venta
            </h1>
            <Image
              src={tacoArt}
              alt=""
              aria-hidden="true"
              className="onb-art onb-art--sale"
              sizes="(max-width: 760px) 220px, 560px"
              loading="eager"
            />
            <p className="onb-copy onb-copy--center">
              Prueba registrar una venta de ejemplo. Así verás lo fácil que es.
            </p>
            <div className="onb-example">
              <p className="onb-example__label">Ejemplo:</p>
              <p className="onb-example__row">
                <span>{SAMPLE.description}</span>
                <strong className="tabular">{formatMxn(SAMPLE.totalCents)}</strong>
              </p>
              <p className="onb-example__note">
                Es un ejemplo: no se cobra ni se marca como pagado.
              </p>
            </div>
            <button type="button" className="onb-cta onb-cta--icon" onClick={registerSampleSale}>
              <ReceiptText aria-hidden="true" />
              <span>Registrar venta</span>
            </button>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="onb-step onb-step--done" aria-labelledby="onb-title-4">
            <CheckBurst />
            <h1
              id="onb-title-4"
              className="onb-title onb-title--center"
              ref={headingRef}
              tabIndex={-1}
            >
              ¡Listo!
            </h1>
            <p className="onb-copy onb-copy--center">
              Ya sabes registrar una venta. Ahora puedes configurar el resto a
              tu ritmo.
            </p>

            {sampleSale ? (
              <p className="onb-saved" aria-live="polite">
                Guardamos tu venta de ejemplo: {sampleSale.description} ·{" "}
                <span className="tabular">{formatMxn(sampleSale.totalCents)}</span>. No es un
                cobro real.
              </p>
            ) : null}

            <ul className="onb-choices">
              <li>
                <Link href="/caja">
                  <span className="onb-choice-icon" aria-hidden="true">
                    <ReceiptText />
                  </span>
                  Registrar otra venta
                </Link>
              </li>
              <li>
                <Link href="/fiados">
                  <span className="onb-choice-icon" aria-hidden="true">
                    <NotebookPen />
                  </span>
                  Revisar mis fiados
                </Link>
              </li>
              <li>
                <Link href="/corte">
                  <span className="onb-choice-icon" aria-hidden="true">
                    <ChartNoAxesColumnIncreasing />
                  </span>
                  Ver mi corte del día
                </Link>
              </li>
            </ul>

            <Link className="onb-cta" href="/inicio">
              Ir a mi negocio
            </Link>
          </section>
        ) : null}

        <Progress step={step} />
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}
