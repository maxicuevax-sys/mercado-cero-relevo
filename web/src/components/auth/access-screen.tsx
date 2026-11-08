"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, MonitorPlay, Store, UserRound } from "lucide-react";
import shop from "@/assets/inicio/brand-shop-cream.svg";

function BrandRays() {
  return <svg viewBox="0 0 28 30" aria-hidden="true" className="access-rays"><path d="m6 6 9-4M7 14h14M6 22l9 5" /></svg>;
}

export function AccessScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invalidField, setInvalidField] = useState<"email" | "password" | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    setNotice("");
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    if (!email || !emailInput.validity.valid) {
      setInvalidField("email");
      setError("Escribe un correo electrónico válido.");
      emailInput.focus();
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setInvalidField("password");
      setError("Escribe tu contraseña de 12 a 128 caracteres.");
      (form.elements.namedItem("password") as HTMLInputElement).focus();
      return;
    }
    setInvalidField(null);
    setError("");
    setBusy(true);
    try {
      // Fail closed until tenant isolation is ready; no fake session or redirect.
      const response = await fetch("/api/access/sign-in", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      setError(response.status === 503
        ? "El acceso de prueba todavía no está abierto."
        : "No pudimos iniciar sesión. Inténtalo de nuevo más tarde.");
    } catch {
      setError("No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="access-page">
      <article className="access-screen" aria-labelledby="access-title">
        <header className="access-brandbar">
          <div className="access-brand" aria-label="Trangui">
            <Image src={shop} alt="" aria-hidden="true" className="access-shop" width={50} height={50} />
            <span>Trangui</span><BrandRays />
          </div>
          <span className="access-demo" aria-label="Modo demo"><MonitorPlay aria-hidden="true" /><span>DEMO</span></span>
        </header>
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
                <input id="access-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contraseña" minLength={12} maxLength={128} required aria-invalid={invalidField === "password"} aria-describedby={error ? "access-error" : undefined} />
                <button className="access-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>
            {error ? <p className="access-message access-message--error" id="access-error" role="alert">{error}</p> : null}
            <button className="access-submit" type="submit" disabled={busy}><ArrowRight aria-hidden="true" /><span>{busy ? "Conectando…" : "Entrar a mi demo"}</span></button>
          </form>
          <div className="access-divider"><span>¿Es tu primera visita?</span></div>
          <button className="access-register" type="button" onClick={() => { setError(""); setInvalidField(null); setNotice("El registro de pruebas estará disponible próximamente."); }}><UserRound aria-hidden="true" /><span>Crear cuenta de prueba</span></button>
          {notice ? <p className="access-message" role="status">{notice}</p> : null}
          <aside className="access-promise" aria-label="Sobre la demo"><div className="access-promise-mark"><Store aria-hidden="true" /><BrandRays /></div><p>Cada persona prueba con sus propios datos. Siempre en modo demo.</p></aside>
        </div>
      </article>
    </main>
  );
}
