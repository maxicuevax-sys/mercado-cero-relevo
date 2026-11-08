"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronRight, CircleHelp, CloudUpload, Coins, LogOut, MapPin, Mic, MonitorPlay, ShieldCheck, Store } from "lucide-react";
import { AccessibilityPanel } from "./accessibility-panel";
import { AssistantPreference } from "@/components/ayuda/optional-assistant";
import { CompanionPreferences } from "@/components/companion-preferences";
import { clearAppBrowserState } from "@/lib/auth/browser-state";

interface PeyStatusData {
  demoMode: boolean;
  peyApiKeyConfigured: boolean;
  peyWebhookSecretConfigured: boolean;
  peyBankAccountConfigured: boolean;
  httpsAppUrl: boolean;
  lastVerifiedWebhookAt: string | null;
  auditChain: {
    ok: boolean;
    checked: number;
    brokenAtId: string | null;
  };
}

const eventName = "mercado-cero:preferences-changed";
function subscribe(callback: () => void) { window.addEventListener(eventName, callback); window.addEventListener("storage", callback); return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback); }; }
function voiceSnapshot() { try { return localStorage.getItem("mercado-cero:muted") !== "1"; } catch { return true; } }

export function SettingsHome({ merchant, address, demo, accountMode = false }: { merchant: string; address: string; demo: boolean; accountMode?: boolean }) {
  const voice = useSyncExternalStore(subscribe, voiceSnapshot, () => true);
  const [notice, setNotice] = useState("");
  const [sessionVoice, setSessionVoice] = useState<boolean | null>(null);
  const [peyStatus, setPeyStatus] = useState<PeyStatusData | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (!accountMode) {
      setNotice("Este prototipo no tiene sesión local que cerrar. El acceso se administra fuera de la app; tus datos y preferencias se conservan.");
      return;
    }
    if (signingOut) return;
    setSigningOut(true);
    setNotice("");
    try {
      const response = await fetch("/api/access/sign-out", { method: "POST", credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        setNotice(typeof data?.error === "string" ? data.error : "No pudimos cerrar sesión. Inténtalo de nuevo.");
        return;
      }
      clearAppBrowserState();
      // A full navigation discards the signed-out account's in-memory client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/acceso");
    } catch {
      setNotice("No pudimos completar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pey/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PeyStatusData | null) => {
        if (!cancelled && data) {
          setPeyStatus(data);
        }
      })
      .catch(() => {
        // Fallback silencioso si el endpoint no está disponible
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleVoice() {
    const next = !(sessionVoice ?? voice);
    try { localStorage.setItem("mercado-cero:muted", next ? "0" : "1"); setSessionVoice(null); } catch { setSessionVoice(next); }
    window.dispatchEvent(new Event(eventName));
    setNotice(next ? "Lectura de voz activada. El micrófono pide permiso al dictar." : "Lectura de voz silenciada. El dictado sigue disponible con tu permiso.");
  }
  const rows = [
    {
      title: "Mi negocio",
      detail: "Datos, horario y productos",
      Icon: Store,
      content: <div className="mc-settings-subpanel"><p>{merchant} · {address}. La edición de datos y horarios aún no está disponible.</p><Link href="/onboarding">Cambiar giro</Link></div>,
    },
    {
      title: "Cobros",
      detail: "Métodos de pago y comisiones",
      Icon: Coins,
      content: (
        <div className="mc-settings-subpanel">
          <p>Efectivo, pago digital y fiado se eligen en Caja. Las comisiones y la configuración del proveedor no se editan desde este prototipo.</p>
          <div className="mc-settings-meta">
            <div>
              <strong>CoDi / Pey:</strong>{" "}
              {peyStatus
                ? peyStatus.demoMode
                  ? "Modo Demo (simulación)"
                  : peyStatus.peyApiKeyConfigured
                  ? "Conectado a Pey (CoDi & Pagos)"
                  : "Sin API Key de Pey"
                : "Consultando estado..."}
            </div>
            <div>
              <strong>Webhook HMAC:</strong>{" "}
              {peyStatus
                ? peyStatus.peyWebhookSecretConfigured
                  ? "Configurado (whsec_ activo)"
                  : "No configurado"
                : "..."}
            </div>
            <div>
              <strong>Último webhook verificado:</strong>{" "}
              {peyStatus
                ? peyStatus.lastVerifiedWebhookAt
                  ? new Date(peyStatus.lastVerifiedWebhookAt).toLocaleString("es-MX")
                  : "Ninguno recibido"
                : "..."}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Notificaciones",
      detail: "Avisos de ventas, cobros y pendientes",
      Icon: Bell,
      content: <p>Los avisos de dinero permanecen visibles. Puedes ajustar las sugerencias opcionales más abajo.</p>,
    },
    {
      title: "Seguridad",
      detail: "Contraseña y acceso a tu cuenta",
      Icon: ShieldCheck,
      content: (
        <div className="mc-settings-subpanel">
          <p>{accountMode ? "Tu cuenta de demo usa correo electrónico y contraseña. Por ahora no hay recuperación de contraseña por correo." : "El acceso de producción se administra fuera de esta app. No hay contraseña local ni recuperación de cuenta en este prototipo."}</p>
          <div className="mc-settings-meta">
            <div>
              <strong>Bitácora contable:</strong>{" "}
              {peyStatus
                ? peyStatus.auditChain?.ok
                  ? `Integridad de bitácora SHA-256: OK (${peyStatus.auditChain.checked} entradas verificadas)`
                  : `Advertencia: Cadena rota en ${peyStatus.auditChain?.brokenAtId ?? "desconocido"}`
                : "Consultando bitácora..."}
            </div>
            <div>
              <strong>PEY_API_KEY:</strong>{" "}
              {peyStatus ? (peyStatus.peyApiKeyConfigured ? "Configurada" : "No configurada") : "..."}
            </div>
            <div>
              <strong>PEY_WEBHOOK_SECRET:</strong>{" "}
              {peyStatus ? (peyStatus.peyWebhookSecretConfigured ? "Configurada" : "No configurada") : "..."}
            </div>
            <div>
              <strong>PEY_BANK_ACCOUNT_ID:</strong>{" "}
              {peyStatus ? (peyStatus.peyBankAccountConfigured ? "Configurada" : "Opcional / No configurada") : "..."}
            </div>
          </div>
        </div>
      ),
    },
  ];
  return <div className="mc-settings-home">
    <section className="mc-settings-profile" aria-label="Perfil del negocio"><Image src="/assets/spec/b-profile.png" alt="" width={110} height={72} /><div><h2>{merchant}</h2><p><MapPin aria-hidden="true" />{address}</p></div></section>
    <section className="mc-settings-group" aria-label="Configuración del negocio">{rows.map(row => <details key={row.title}><summary><row.Icon aria-hidden="true" /><span><strong>{row.title}</strong><small>{row.detail}</small></span><ChevronRight aria-hidden="true" /></summary>{row.content}</details>)}</section>
    <section className="mc-settings-group" aria-label="Preferencias de uso">
      <div className="mc-settings-row"><Mic aria-hidden="true" /><span><strong>Asistente de voz</strong><small>Lectura en voz alta. Micrófono con tu permiso.</small></span><button type="button" role="switch" aria-label="Asistente de voz" aria-checked={sessionVoice ?? voice} className="mc-settings-switch" onClick={toggleVoice}><span /></button></div>
      <div className="mc-settings-row"><MonitorPlay aria-hidden="true" /><span><strong>Modo demo</strong><small>{demo ? "Datos de ejemplo · sin dinero real" : "Entorno real · se configura en el servidor"}</small></span><button type="button" role="switch" aria-label="Modo demo (configurado en servidor)" aria-checked={demo} aria-disabled="true" className="mc-settings-switch" onClick={() => setNotice("El modo demo se configura en el servidor. Este control no cambia el entorno ni tus datos.")}><span /></button></div>
      <details><summary><CloudUpload aria-hidden="true" /><span><strong>Respaldo de datos</strong><small>Guarda y recupera tu información</small></span><ChevronRight aria-hidden="true" /></summary><p>Los respaldos se administran en el servidor. No hay exportación ni restauración desde esta pantalla.</p></details>
    </section>
    <Link href="/ayuda" className="mc-settings-help"><CircleHelp aria-hidden="true" />Centro de ayuda<ChevronRight aria-hidden="true" /></Link>
    <button type="button" className="mc-settings-logout" disabled={signingOut} onClick={signOut}><LogOut aria-hidden="true" />Cerrar sesión</button>
    <p role="status">{notice}</p>
    <details className="mc-settings-extra"><summary>Texto, contraste y preferencias avanzadas</summary><AccessibilityPanel /><AssistantPreference /><CompanionPreferences /></details>
  </div>;
}
