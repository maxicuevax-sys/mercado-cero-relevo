import { formatMxn } from "../../lib/format";

// Break only between thousands groups; the final group keeps its two cents.
export function currencyGroups(cents: number): string[] {
  const groups = formatMxn(cents).split(",");
  return groups.map((group, index) => index < groups.length - 1 ? `${group},` : group);
}
