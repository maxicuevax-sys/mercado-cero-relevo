"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Mueve el foco al contenido de la ruta, tanto al entrar por navegación como
 * en la carga inicial. El AppShell se remonta en cada navegación, así que no
 * se puede confiar en un ref local para distinguir la primera carga.
 * El anuncio se toma del texto marcado con `data-route-announcement` para que
 * la paginación diga en qué página quedó.
 */
export function RouteFocus({
  mainId,
  targetId,
}: {
  mainId: string;
  targetId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const main = document.getElementById(mainId);
    const preferred = targetId ? document.getElementById(targetId) : null;
    const heading = main?.querySelector<HTMLElement>("h1") ?? null;
    const target = preferred ?? heading ?? main;
    if (!target) return;

    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });

    const detail = document
      .querySelector<HTMLElement>("[data-route-announcement]")
      ?.textContent?.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnnouncement(detail ? `${document.title}. ${detail}` : document.title);
  }, [key, mainId, targetId]);

  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );
}
