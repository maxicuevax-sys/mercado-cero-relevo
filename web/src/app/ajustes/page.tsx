import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OperationalPage } from "@/components/shell/operational-page";
import { AccessibilityPanel } from "@/components/ajustes/accessibility-panel";
import { CompanionPreferences } from "@/components/companion-preferences";
import { MERCHANT, isDemoMode } from "@/lib/config";
import "./ajustes.css";

export const metadata: Metadata = {
  title: "Ajustes · Mercado Cero",
  description:
    "Tamaño del texto, contraste, velocidad de la voz y preferencias de acompañamiento, guardados en este dispositivo.",
};

export const instant = false;

const STORED_ITEMS = [
  "Tus preferencias se guardan solo en este dispositivo; no viajan con tu cuenta.",
  "Se aplican en cuanto cambias una opción, sin recargar la página.",
  "Si borras los datos del navegador, la app vuelve a los valores iniciales.",
];

export default async function AjustesPage() {
  await connection();

  return (
    <OperationalPage
      activeHref="/ajustes"
      title="Ajustes"
      titleId="ajustes-title"
      eyebrow="Accesibilidad"
      subtitle="El tamaño del texto, el contraste y la voz. Se aplican a toda la app y se guardan en este dispositivo."
      actions={
        <Link href="/ayuda" className="mc-ajustes-action">
          Volver a la ayuda
        </Link>
      }
      merchant={MERCHANT.name}
      address={MERCHANT.address}
      demo={isDemoMode()}
    >
      <div className="mc-ajustes-layout">
        <div className="mc-ajustes-col">
          <AccessibilityPanel />
        </div>

        <div className="mc-ajustes-col">
          <section
            className="mc-op-panel mc-ajustes-companion"
            aria-labelledby="mc-ajustes-companion-title"
          >
            <div className="mc-op-panel__head">
              <h2
                id="mc-ajustes-companion-title"
                className="mc-op-panel__title"
              >
                Preferencias de acompañamiento
              </h2>
              <p className="mc-op-panel__meta">
                Sugerencias, recordatorios y explicaciones
              </p>
            </div>
            <div className="mc-op-panel__body">
              <CompanionPreferences />
            </div>
          </section>

          <section
            className="mc-op-panel"
            aria-labelledby="mc-ajustes-stored-title"
          >
            <div className="mc-op-panel__head">
              <h2
                id="mc-ajustes-stored-title"
                className="mc-op-panel__title"
              >
                Qué se guarda
              </h2>
            </div>
            <div className="mc-op-panel__body">
              <ul className="mc-ajustes-stored">
                {STORED_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                <li>
                  Silenciar la voz solo apaga la lectura en voz alta; los avisos
                  de dinero, pagos y cobros pendientes siguen visibles.
                </li>
              </ul>
            </div>
            <div className="mc-op-panel__foot">
              <Link href="/ayuda" className="mc-ajustes-action">
                Ver la ayuda
              </Link>
            </div>
          </section>
        </div>
      </div>
    </OperationalPage>
  );
}
