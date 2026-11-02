import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * Encabezado único de los cinco destinos: mismo H1, misma raya terracota y
 * misma zona de acción. Fiado y Meta lo usan con una columna de lectura
 * dentro del shell, no con un contenedor propio.
 */
export function ScreenHeading({
  title,
  subtitle,
  action,
  headingId,
  compactSubtitle = false,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  headingId?: string;
  compactSubtitle?: boolean;
}) {
  return (
    <div className="screen-heading-block mb-5 min-w-0">
      <div className="screen-heading">
        <h1
          id={headingId}
          data-sheet-fallback
          tabIndex={-1}
          className="screen-heading__title heading-in text-[1.75rem] font-semibold leading-tight tracking-tight text-ink"
        >
          {title}
        </h1>
        {action ? <div className="screen-heading__action">{action}</div> : null}
      </div>
      <p
        className={cn(
          "screen-heading__subtitle text-[0.9375rem] leading-relaxed text-ink-2",
          compactSubtitle && "screen-heading__subtitle--optional",
        )}
      >
        {subtitle}
      </p>
    </div>
  );
}
