// Consultas puras de fiado: sin OpenAI, sin red y seguras para el cliente.

export interface DebtCredit {
  customerId?: string | null;
  customerName?: string | null;
  balanceCents: number;
  status?: string | null;
}

export interface DebtCustomerSummary {
  customerName: string;
  totalCents: number;
  debtCount: number;
}

export type DebtQueryAnswer =
  | {
      kind: "customer";
      customerName: string;
      totalCents: number;
      debtCount: number;
      answer: string;
    }
  | { kind: "ambiguous"; candidates: DebtCustomerSummary[]; answer: string }
  | {
      kind: "general";
      totalCents: number;
      debtCount: number;
      customerCount: number;
      answer: string;
    }
  | { kind: "not_found"; customerName: string; answer: string }
  | { kind: "needs_name"; answer: string };

const DEBT_QUERY_RE =
  /(cu[aá]ntos?\s+(me\s+)?debe(n)?|qui[eé]n(?:es)?\s+me\s+debe(n)?|me\s+deben|deudas?\s+abiertas?|(hay|tengo)\s+(deudas?|fiado))/i;
const GENERAL_DEBT_QUERY_RE =
  /(qui[eé]n(?:es)?\s+me\s+debe(n)?|cu[aá]ntos?\s+me\s+deben|me\s+deben|deudas?\s+abiertas?|(hay|tengo)\s+(deudas?|fiado)|cu[aá]nto\s+(hay|tengo)\s+(de\s+)?fiado)/i;
const CANDIDATE_PATTERNS = [
  /cu[aá]ntos?\s+(?:me\s+)?(?:debe|deben)\s+(?:de\s+|a\s+)?(.+)$/i,
  /(?:me\s+debe|me\s+deben)\s+(?:de\s+|a\s+)?(.+)$/i,
  /deudas?\s+abiertas?\s+(?:de\s+|a\s+)?(.+)$/i,
  /(?:deudas?|fiados?)\s+(?:de|a)\s+(.+)$/i,
];
const HONORIFICS = new Set(["don", "dona", "senor", "senora", "sr", "sra", "cliente"]);
const TRAILING_FILLER = new Set([
  "hoy",
  "ahorita",
  "ahora",
  "en",
  "total",
  "pues",
  "por",
  "favor",
  "fiado",
  "fiados",
  "deuda",
  "deudas",
  "del",
  "de",
  "la",
  "el",
  "cliente",
  "clientes",
]);
const NON_NAME_STARTS = new Set([
  "todos",
  "todas",
  "todo",
  "general",
  "nadie",
  "alguien",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "mi",
  "mis",
  "su",
  "sus",
]);
const NAME_PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e"]);

function normalizeDebtName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsDebtName(text: string, name: string): boolean {
  const target = normalizeDebtName(name);
  if (!target) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(target)}([^a-z0-9]|$)`).test(
    normalizeDebtName(text),
  );
}

function formatDebtMxn(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(safe / 100);
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function toDisplayName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && NAME_PARTICLES.has(normalizeDebtName(word))) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function cleanCustomerCandidate(raw: string): string | null {
  const words = raw
    .replace(/[.,;:!?¿¡"'“”()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let start = 0;
  let end = words.length;
  while (start < end && HONORIFICS.has(normalizeDebtName(words[start]))) start += 1;
  while (end > start && TRAILING_FILLER.has(normalizeDebtName(words[end - 1]))) end -= 1;
  const candidateWords = words.slice(start, end);
  if (candidateWords.length === 0) return null;
  if (NON_NAME_STARTS.has(normalizeDebtName(candidateWords[0]))) return null;
  return candidateWords.join(" ");
}

function extractCustomerCandidate(text: string): string | null {
  const cleanText = text.replace(/\s+/g, " ").trim();
  for (const pattern of CANDIDATE_PATTERNS) {
    const match = cleanText.match(pattern);
    if (!match) continue;
    const candidate = cleanCustomerCandidate(match[1]);
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Agrupa los créditos abiertos por cliente. Un mismo `customerId` con dos
 * fiados es una sola persona; dos `customerId` distintos con el mismo nombre
 * quedan separados para no adivinar cuál se consulta.
 */
function summarizeOpenCredits(
  credits: ReadonlyArray<DebtCredit>,
): DebtCustomerSummary[] {
  const buckets = new Map<string, DebtCustomerSummary>();
  for (const credit of credits) {
    if (credit.status === "settled") continue;
    const balance = Number.isFinite(credit.balanceCents)
      ? Math.round(credit.balanceCents)
      : 0;
    if (balance <= 0) continue;
    const customerName = (credit.customerName ?? "").trim();
    const key = credit.customerId?.trim() || `name:${normalizeDebtName(customerName)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.totalCents += balance;
      bucket.debtCount += 1;
      if (!bucket.customerName && customerName) bucket.customerName = customerName;
    } else {
      buckets.set(key, { customerName, totalCents: balance, debtCount: 1 });
    }
  }
  return [...buckets.values()];
}

function matchCustomers(
  candidate: string,
  customers: DebtCustomerSummary[],
): DebtCustomerSummary[] {
  const target = normalizeDebtName(candidate);
  if (!target) return [];
  const exact = customers.filter(
    (customer) => normalizeDebtName(customer.customerName) === target,
  );
  if (exact.length > 0) return exact;
  return customers.filter((customer) => {
    const name = normalizeDebtName(customer.customerName);
    return Boolean(name) && (name.startsWith(`${target} `) || target.startsWith(`${name} `));
  });
}

function customerDebtAnswer(bucket: DebtCustomerSummary): DebtQueryAnswer {
  const customerName = toDisplayName(bucket.customerName) || "El cliente";
  return {
    kind: "customer",
    customerName,
    totalCents: bucket.totalCents,
    debtCount: bucket.debtCount,
    answer: `${customerName} te debe ${formatDebtMxn(bucket.totalCents)} en ${plural(
      bucket.debtCount,
      "fiado",
      "fiados",
    )}.`,
  };
}

function ambiguousDebtAnswer(matches: DebtCustomerSummary[]): DebtQueryAnswer {
  const listing = matches
    .map(
      (customer) =>
        `${toDisplayName(customer.customerName) || "Sin nombre"} (${formatDebtMxn(
          customer.totalCents,
        )})`,
    )
    .join(", ");
  return {
    kind: "ambiguous",
    candidates: matches.map((customer) => ({ ...customer })),
    answer: `Tengo ${matches.length} clientes con ese nombre; dime cuál: ${listing}.`,
  };
}

function generalDebtAnswer(customers: DebtCustomerSummary[]): DebtQueryAnswer {
  const totalCents = customers.reduce((sum, customer) => sum + customer.totalCents, 0);
  const debtCount = customers.reduce((sum, customer) => sum + customer.debtCount, 0);
  const customerCount = customers.length;
  const answer =
    debtCount === 0
      ? "No hay deudas abiertas."
      : `Te deben ${formatDebtMxn(totalCents)} en ${plural(
          debtCount,
          "fiado",
          "fiados",
        )} de ${plural(customerCount, "cliente", "clientes")}.`;
  return { kind: "general", totalCents, debtCount, customerCount, answer };
}

/**
 * Responde consultas de fiado sin tocar la red ni el ledger.
 * Devuelve `null` cuando la frase no es una consulta de deuda.
 */
export function answerDebtQuery(
  transcript: string,
  credits: ReadonlyArray<DebtCredit>,
): DebtQueryAnswer | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text || !DEBT_QUERY_RE.test(text)) return null;

  const customers = summarizeOpenCredits(credits);
  const candidate = extractCustomerCandidate(text);
  let matches = candidate ? matchCustomers(candidate, customers) : [];

  if (!candidate && !GENERAL_DEBT_QUERY_RE.test(text)) {
    // "Juan, ¿cuánto me debe?" invierte el orden: busca el nombre en la frase.
    matches = customers.filter(
      (customer) =>
        Boolean(customer.customerName) && mentionsDebtName(text, customer.customerName),
    );
  }

  if (candidate) {
    if (matches.length > 1) return ambiguousDebtAnswer(matches);
    if (matches.length === 1) return customerDebtAnswer(matches[0]);
    const customerName = toDisplayName(candidate) || "ese cliente";
    return {
      kind: "not_found",
      customerName,
      answer: `No encontré deudas abiertas de ${customerName}.`,
    };
  }

  if (GENERAL_DEBT_QUERY_RE.test(text)) return generalDebtAnswer(customers);

  if (matches.length > 1) return ambiguousDebtAnswer(matches);
  if (matches.length === 1) return customerDebtAnswer(matches[0]);

  return { kind: "needs_name", answer: "¿De qué cliente quieres saber?" };
}
