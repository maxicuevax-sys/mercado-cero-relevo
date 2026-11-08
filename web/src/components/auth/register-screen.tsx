"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Info, LockKeyhole, Mail, UserRound } from "lucide-react";
import { validateRegistration } from "@/lib/auth/register-validation";
import { clearAppBrowserState } from "@/lib/auth/browser-state";
import { AuthBrandbar } from "./auth-brandbar";

export function RegisterScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<string | null>(null);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const result = validateRegistration({ name: String(fields.get("name") ?? ""), email: String(fields.get("email") ?? ""), password: String(fields.get("password") ?? "") });
    if (!result.ok) {
      setInvalidField(result.field);
      setError(result.message);
      (form.elements.namedItem(result.field) as HTMLInputElement).focus();
      return;
    }
    setInvalidField(null);
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/access/sign-up", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.values), cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.status === 503 && data?.code === "registration_not_open") {
        setError("El registro de pruebas todavía no está abierto.");
        return;
      }
      if (response.ok && data?.ok === true) {
        clearAppBrowserState();
        // A full navigation discards the previous account's in-memory client state.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/onboarding");
        return;
      }
      setError(typeof data?.error === "string" ? data.error : "No pudimos crear la cuenta. Inténtalo de nuevo más tarde.");
    } catch {
      setError("No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
    } finally { setBusy(false); }
  }
  return <main className="access-page"><article className="access-screen register-screen" aria-labelledby="register-title">
    <AuthBrandbar register />
    <div className="access-paper register-paper">
      <div className="register-hero">
        <div className="register-art"><Image src="/assets/auth/register-reference.png" alt="Taquero preparando tacos al pastor bajo un toldo rojo en el tianguis" width={1024} height={1535} sizes="(max-width: 480px) 110vw, 530px" quality={90} preload /></div>
        <p className="register-eyebrow">Bienvenido al mostrador</p>
        <h1 id="register-title"><span>Crea tu</span> <span>cuenta.</span></h1>
        <svg className="register-underline" viewBox="0 0 170 22" aria-hidden="true"><path d="M5 16Q80 0 165 11" /></svg>
        <p className="register-description">Guarda tus ventas, fiados<br />y caja en un solo lugar.</p>
      </div>
      <form className="register-form access-form" action="/api/access/sign-up" method="post" onSubmit={register} noValidate aria-busy={busy}>
        <div className="access-field"><label htmlFor="register-name">Tu nombre</label><div className="register-input"><UserRound aria-hidden="true" /><input id="register-name" name="name" autoComplete="name" placeholder="¿Cómo te llamas?" maxLength={80} required aria-invalid={invalidField === "name"} aria-describedby={error ? "register-error" : undefined} /></div></div>
        <div className="access-field"><label htmlFor="register-email">Correo electrónico</label><div className="register-input"><Mail aria-hidden="true" /><input id="register-email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="tucorreo@ejemplo.com" maxLength={254} required aria-invalid={invalidField === "email"} aria-describedby={error ? "register-error" : undefined} /></div></div>
        <div className="access-field"><label htmlFor="register-password">Crea una contraseña</label><div className="register-input access-password-wrap"><LockKeyhole aria-hidden="true" /><input id="register-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Al menos 12 caracteres" minLength={12} maxLength={128} required aria-invalid={invalidField === "password"} aria-describedby={`register-hint${error ? " register-error" : ""}`} /><button className="access-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div></div>
        <p className="register-hint" id="register-hint"><Info aria-hidden="true" /><span>Guárdala: por ahora no podemos recuperar contraseñas por correo.</span></p>
        {error ? <p className="access-message access-message--error" id="register-error" role="alert">{error}</p> : null}
        <button className="access-submit register-submit" type="submit" disabled={busy}><span>{busy ? "Conectando…" : "Crear mi cuenta"}</span><ArrowRight aria-hidden="true" /></button>
      </form>
      <Link className="register-back" href="/acceso">Ya tengo cuenta · Iniciar sesión</Link>
    </div>
  </article></main>;
}
