import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArtBanner } from "@/components/shell/art-banner";
import { OperationalPage } from "@/components/shell/operational-page";
import { AccessibilityPanel } from "@/components/ajustes/accessibility-panel";
import { CompanionPreferences } from "@/components/companion-preferences";
import { MERCHANT, isDemoMode } from "@/lib/config";
import lupitaArt from "@/assets/brand/ilustraciones/transparent/lupita.png";
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
  "La app respeta la reducción de movimiento de tu sistema: ninguna animación tapa un importe.",
];

export default async function AjustesPage() {
  await connection();

  return (
    <OperationalPage
      activeHref="/ajustes"
      title="Ajustes"
      titleId="ajustes-title"
      eyebrow="Accesibilidad"
      subtitle="Texto, contraste y voz, a tu manera."
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


        <div className="mc-ajustes-main">
          <AccessibilityPanel />
        </div>

        <ArtBanner
          art={lupitaArt}
          kicker="A tu manera"
          title="La app se ajusta a tu vista."
          className="mc-ajustes-band"
        >
          <p className="mc-ajustes-band__lead">
            Texto más grande, más contraste y la voz a tu ritmo. Se guarda solo en
            este dispositivo y se aplica en todas las pantallas.
          </p>
        </ArtBanner>

        <div className="mc-ajustes-side">
          <section
            className="mc-art-paper mc-ajustes-companion"
            aria-labelledby="mc-ajustes-companion-title"
          >
            <div className="mc-art-paper__head">
              <h2
                id="mc-ajustes-companion-title"
                className="mc-art-paper__title"
              >
                Preferencias de acompañamiento
              </h2>
              <span className="mc-art-stamp mc-art-stamp--clay">Opcional</span>
            </div>
            <p className="mc-art-paper__note">
              Sugerencias, recordatorios y explicaciones de Lupita.
            </p>
            <div className="mc-ajustes-companion__body">
              <CompanionPreferences />
            </div>
          </section>

          <section
            className="mc-art-paper mc-ajustes-stored"
            aria-labelledby="mc-ajustes-stored-title"
          >
            <div className="mc-art-paper__head">
              <h2 id="mc-ajustes-stored-title" className="mc-art-paper__title">
                Qué se guarda
              </h2>
              <span className="mc-art-stamp mc-art-stamp--green">
                Solo este dispositivo
              </span>
            </div>
            <ul className="mc-ajustes-stored__list">
              {STORED_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
              <li>
                Silenciar la voz solo apaga la lectura en voz alta; los avisos de
                dinero, pagos y cobros pendientes siguen visibles.
              </li>
            </ul>
            <div className="mc-ajustes-stored__foot">
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
