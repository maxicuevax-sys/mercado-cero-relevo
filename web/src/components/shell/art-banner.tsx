import type { ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import picadoArt from "@/assets/inicio/papel-picado.png";

export type ArtBannerProps = {
  /** Ilustración de marca que da el momento ilustrado (PNG original). */
  art: StaticImageData;
  /** Texto alternativo; por defecto "" porque la ilustración es decorativa. */
  alt?: string;
  /** Título de la banda (H2: el H1 vive en el PageHeader). */
  title?: string;
  /** Antetítulo corto en mayúsculas. */
  kicker?: string;
  /** Contenido de apoyo: párrafo, acciones o chips de la pantalla. */
  children?: ReactNode;
  /** Fondo verde profundo (como el hero de Inicio) en vez de papel. */
  invert?: boolean;
  /** Clases de composición de la pantalla que lo usa. */
  className?: string;
};

/**
 * Momento ilustrado reutilizable de las pantallas nuevas: ilustración de marca
 * grande + papel picado + texto corto. No es cliente ni tiene estado; sirve
 * igual en Server Components y puede llevar children server.
 */
export function ArtBanner({
  art,
  alt = "",
  title,
  kicker,
  children,
  invert = false,
  className = "",
}: ArtBannerProps) {
  return (
    <section
      className={`mc-art-banner${invert ? " mc-art-banner--invert" : ""} ${className}`.trim()}
    >
      <Image
        src={picadoArt}
        alt=""
        aria-hidden="true"
        className="mc-art-banner__picado"
        sizes="(max-width: 767px) 200px, 300px"
      />
      <div className="mc-art-banner__copy">
        {kicker ? <p className="mc-art-banner__kicker">{kicker}</p> : null}
        {title ? <h2 className="mc-art-banner__title">{title}</h2> : null}
        {children ? <div className="mc-art-banner__body">{children}</div> : null}
      </div>
      <div className="mc-art-banner__art">
        <Image
          src={art}
          alt={alt}
          aria-hidden={alt ? undefined : "true"}
          className="mc-art-banner__image"
          sizes="(max-width: 767px) 200px, 270px"
        />
      </div>
    </section>
  );
}
