"use client";

import { useEffect, useRef, useState } from "react";
import { formatMxn } from "@/lib/format";

/**
 * Rueda el monto cuando cambia. El movimiento tiene una causa: cambió el
 * total, el periodo o el pago. Respeta prefers-reduced-motion.
 */
export function AnimatedAmount({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(cents);
  const displayRef = useRef(cents);

  useEffect(() => {
    const from = displayRef.current;
    const to = cents;
    if (from === to) return;

    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 1
      : 220;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);
      displayRef.current = value;
      setDisplay(value);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [cents]);

  const formatted = formatMxn(display);
  const [whole, decimals] = formatted.split(".");

  return (
    <span className={className}>
      {whole}
      <wbr />.{decimals}
    </span>
  );
}
