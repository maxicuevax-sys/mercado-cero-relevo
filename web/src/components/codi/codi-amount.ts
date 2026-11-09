/** Accept decimals or explicit mixed grouping; reject ambiguous single separators with 3+ decimals. */
export function parseCodiAmountCents(value: string): number | null {
  const raw = value.trim();
  if (!raw) return 0;
  let canonical: string;
  if (/^\d+(?:[.,]\d{1,2})?$/.test(raw)) {
    canonical = raw.replace(",", ".");
  } else if (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d{1,2})$/.test(raw)) {
    canonical = raw.replace(/,/g, "");
  } else if (/^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})$/.test(raw)) {
    canonical = raw.replace(/\./g, "").replace(",", ".");
  } else {
    return null;
  }
  const [integer, fraction = ""] = canonical.split(".");
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
