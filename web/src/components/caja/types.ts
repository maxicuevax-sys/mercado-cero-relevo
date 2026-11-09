export type DraftLine = {
  id: string;
  description: string;
  quantity: string;
  price: string;
};

export type PaymentChoice = "cash" | "digital" | "credit" | "mixed";

export function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `line_${crypto.randomUUID()}`;
  }
  return `line_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseMoneyCents(value: string): number {
  const entered = value.trim();
  // Currency prefix and initial minus are valid; never erase letters or internal signs.
  if (!/^(?:-\s*\$?\s*|\$\s*-\s*|\$\s*)?[\d.,]+$/.test(entered)) return 0;
  let raw = entered.replace(/[^\d.,-]/g, "");
  if (!raw || raw === "-" || raw === ".") return 0;
  const negative = raw.startsWith("-");
  raw = raw.replace(/-/g, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(/,/g, ".") : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    const parts = raw.split(",");
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      raw = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (dot >= 0) {
    const parts = raw.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      // "1.000" y "35.500" se leen como separador de miles, no como centavos.
      raw = parts.join("");
    } else if (parts.length > 2) {
      const last = parts.pop() as string;
      raw = parts.join("") + (last.length <= 2 ? `.${last}` : last);
    }
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((negative ? -amount : amount) * 100);
}

export const QUANTITY_ERROR = "La cantidad debe ser mayor que cero, máximo 999 y con hasta 3 decimales.";

export function parseQuantity(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return 0;
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) return 0;
  // Preserve supported fractions exactly; never silently round an entered quantity.
  const decimals = (normalized.split(".")[1] ?? "").replace(/0+$/, "");
  if (decimals.length > 3) return 0;
  return quantity;
}

export function lineTotalCents(line: DraftLine): number {
  const quantity = parseQuantity(line.quantity);
  const price = parseMoneyCents(line.price);
  if (!quantity || !price) return 0;
  return Math.round(quantity * price);
}

export function draftTotalCents(lines: DraftLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}
