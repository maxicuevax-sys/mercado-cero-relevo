import { createElement } from "react";
import { formatMxn } from "@/lib/format";

type AmountTag = "span" | "p" | "div";

export function CurrencyAmount({
  cents,
  className = "",
  as = "span",
}: {
  cents: number;
  className?: string;
  as?: AmountTag;
}) {
  return createElement(
    as,
    { className: `tabular-nums ${className}`.trim() },
    formatMxn(cents),
  );
}
