import { cn } from "@/lib/format";
import { differenceName, differenceTone, signedMxn } from "./history-format";

/**
 * Pill de diferencia del corte. El signo y la palabra para lectores de
 * pantalla evitan depender solo del color.
 */
export function DifferencePill({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const tone = differenceTone(cents);
  return (
    <span
      className={cn("mc-corte-diff", `mc-corte-diff--${tone}`, className)}
    >
      {signedMxn(cents)}
      <span className="sr-only"> {differenceName(cents)}</span>
    </span>
  );
}
