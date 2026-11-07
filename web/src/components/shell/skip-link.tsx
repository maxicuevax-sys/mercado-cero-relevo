"use client";

import type { MouseEvent } from "react";

export function SkipLink({ href }: { href: string }) {
  function focusTarget(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  return (
    <a className="inicio-skip" href={href} onClick={focusTarget}>
      Saltar al contenido
    </a>
  );
}
