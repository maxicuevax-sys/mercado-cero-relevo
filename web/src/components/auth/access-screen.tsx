"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Store, UserRound } from "lucide-react";
import { AuthBrandbar, BrandRays } from "./auth-brandbar";
import { clearAppBrowserState } from "@/lib/auth/browser-state";

export function AccessScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<"email" | "password" | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    if (!email || !emailInput.validity.valid) {
      setInvalidField("email");
      setError("Escribe un correo electrónico válido.");
      emailInput.focus();
      return;
    }
    setInvalidField(null);
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/access/sign-in", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (response.status === 503 && data?.code === "access_not_open") {
        setError("El acceso de prueba todavía no está abierto.");
        return;
      }
      if (response.ok && data?.ok === true) {
        clearAppBrowserState();
        // A full navigation discards the previous account's in-memory client state.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/inicio");
        return;
      }
      setError(typeof data?.error === "string" ? data.error : "No pudimos iniciar sesión. Inténtalo de nuevo más tarde.");
    } catch {
      setError("No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function guest() {
    if (guestBusy) return;
    setGuestBusy(true);
    setError("");
    try {
      const response = await fetch("/api/access/guest", { method: "POST", credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        setError(typeof data?.error === "string" ? data.error : "No pudimos abrir la demo sin cuenta. Inténtalo de nuevo.");
        return;
      }
      clearAppBrowserState();
      window.location.assign("/onboarding");
    } catch {
      setError("No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setGuestBusy(false);
    }
  }

  return (
    <main className="access-page">
      <article className="access-screen" aria-labelledby="access-title">
        <AuthBrandbar />
        <div className="access-paper">
          <div className="access-heading">
            <p className="access-eyebrow">Tu mostrador digital</p>
            <h1 id="access-title"><span>Qué gusto verte</span> <span>de nuevo.</span></h1>
            <p className="access-subtitle">Entra y continúa con tu demo.</p>
          </div>
          <div className="access-illustration">
            <Image
              src="/assets/auth/access-reference.png"
              alt="Comerciante atendiendo su puesto de frutas y verduras en un tianguis de la CDMX"
              width={941}
              height={1672}
              sizes="(max-width: 560px) 100vw, 480px"
              preload
            />
          </div>
          <form className="access-form" action="/api/access/sign-in" method="post" onSubmit={signIn} noValidate aria-busy={busy}>
            <div className="access-field">
              <label htmlFor="access-email"><Mail aria-hidden="true" /><span>Correo electrónico</span></label>
              <input id="access-email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="tucorreo@ejemplo.com" maxLength={254} required aria-invalid={invalidField === "email"} aria-describedby={error ? "access-error" : undefined} />
            </div>
            <div className="access-field">
              <label htmlFor="access-password"><LockKeyhole aria-hidden="true" /><span>Contraseña</span></label>
              <div className="access-password-wrap">
                <input id="access-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contraseña" required aria-invalid={invalidField === "password"} aria-describedby={error ? "access-error" : undefined} />
                <button className="access-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>
            {error ? <p className="access-message access-message--error" id="access-error" role="alert">{error}</p> : null}
            <button className="access-submit" type="submit" disabled={busy}><ArrowRight aria-hidden="true" /><span>{busy ? "Conectando…" : "Entrar a mi demo"}</span></button>
          </form>
          <button className="access-register access-guest" type="button" onClick={() => void guest()} disabled={guestBusy}>
            <UserRound aria-hidden="true" />
            <span>{guestBusy ? "Abriendo demo…" : "Entrar sin cuenta"}</span>
          </button>
          <div className="access-divider"><span>¿Es tu primera visita?</span></div>
          <Link className="access-register" href="/registro"><UserRound aria-hidden="true" /><span>Crear cuenta de prueba</span></Link>
          <aside className="access-promise" aria-label="Sobre la demo"><div className="access-promise-mark"><Store aria-hidden="true" /><BrandRays /></div><p>Cada persona prueba con sus propios datos. Siempre en modo demo.</p></aside>
        </div>
      </article>
    </main>
  );
}
