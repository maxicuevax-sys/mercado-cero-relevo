"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, ShoppingBag, Soup, Sprout, Store } from "lucide-react";
import type { BusinessProfile, BusinessType } from "@/lib/business-profile";
import shopArt from "@/assets/brand/ilustraciones/transparent/puesto.png";
import brandShop from "@/assets/inicio/brand-shop-cream.svg";
import "./onboarding.css";

const choices = [
  { value: "produce", title: "Frutas y verduras", detail: "Fruta, verdura y productos frescos", Icon: Sprout },
  { value: "food", title: "Comida y bebidas", detail: "Tacos, antojitos, pan y bebidas", Icon: Soup },
  { value: "goods", title: "Ropa y artículos", detail: "Ropa, calzado y cosas para el hogar", Icon: ShoppingBag },
  { value: "general", title: "Un poco de todo", detail: "Abarrotes, servicios u otro giro", Icon: Store },
] as const;

export function OnboardingFlow({ profile }: { profile: BusinessProfile | null }) {
  const [selected, setSelected] = useState<BusinessType | "">(profile?.businessType ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!selected) {
      setError("Elige la opción que más se parezca a tu puesto.");
      document.getElementById("business-produce")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/business-profile", {
        method: "PUT", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType: selected }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.profile?.businessType !== selected) {
        setError(response.status === 401 ? "Tu sesión terminó. Inicia sesión para guardar tu elección." : "No pudimos guardar tu giro. Tu elección sigue aquí; vuelve a intentarlo.");
        return;
      }
      // Discard cached pages so Caja receives this account's saved profile.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/inicio");
    } catch {
      setError("No pudimos conectarnos. Tu elección sigue aquí; revisa tu conexión y vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="onb-shell" id="onboarding-main">
    <header className="onb-header">
      <div className="onb-brand"><Image src={brandShop} alt="" width={44} height={44} aria-hidden="true" /><span>Trangui</span><span className="onb-rays" aria-hidden="true">✳</span></div>
      <span className="onb-demo">DEMO</span>
    </header>
    <article className="onb-card" aria-labelledby="onb-title">
      <div className="onb-intro">
        <p className="onb-eyebrow">Tu puesto, a tu manera</p>
        <h1 id="onb-title">¿Qué vendes<br />en tu puesto?</h1>
        <p className="onb-copy">Te sugeriremos productos y ejemplos para tu negocio.</p>
        <Image src={shopArt} alt="" aria-hidden="true" className="onb-art" sizes="(max-width: 760px) 100px, 360px" />
      </div>
      <form className="onb-form" onSubmit={submit} aria-busy={busy} noValidate>
        <fieldset aria-describedby={`onb-hint${error ? " onb-error" : ""}`}>
          <legend className="onb-sr-only">¿Qué vendes en tu puesto?</legend>
          <div className="onb-choices">{choices.map(({ value, title, detail, Icon }) => <label key={value} className={`onb-choice${selected === value ? " onb-choice--selected" : ""}`}>
            <input id={`business-${value}`} type="radio" name="businessType" aria-label={title} value={value} checked={selected === value} disabled={busy} onChange={() => { setSelected(value); setError(""); }} />
            <span className={`onb-choice-icon onb-choice-icon--${value}`}><Icon aria-hidden="true" /></span>
            <span className="onb-choice-copy"><strong>{title}</strong><span>{detail}</span></span>
            {selected === value ? <Check className="onb-choice-check" aria-hidden="true" /> : null}
          </label>)}</div>
        </fieldset>
        <p className="onb-hint" id="onb-hint">Elige la que más se parezca. Puedes cambiarla después en Ajustes.</p>
        {error ? <p className="onb-error" id="onb-error" role="alert">{error}</p> : null}
        {error && error.startsWith("Tu sesión") ? <Link className="onb-login" href="/acceso">Iniciar sesión</Link> : null}
        <button className="onb-cta" type="submit" disabled={busy}><span>{busy ? "Guardando tu giro…" : "Empezar con mi puesto"}</span><ArrowRight aria-hidden="true" /></button>
        <p className="onb-demo-note">Estás en modo demo. Aquí no se activa ningún cobro real.</p>
        {profile ? <Link className="onb-cancel" href="/inicio">Volver sin cambiar</Link> : null}
      </form>
    </article>
  </main>;
}
