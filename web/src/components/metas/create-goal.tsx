"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * CTA "Nueva meta". La creación vive en la ruta `/metas/nueva` para que el
 * formulario tenga su propia pantalla, foco y URL.
 */
export function CreateGoalButton({
  label = "Nueva meta",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href="/metas/nueva"
      className={`mc-metas-cta${variant === "secondary" ? " mc-metas-cta--secondary" : ""}`}
    >
      <Plus className="mc-metas-cta__icon" aria-hidden="true" />
      {label}
    </Link>
  );
}
