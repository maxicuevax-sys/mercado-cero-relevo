import crypto from "node:crypto";
import { appUrl, isDemoMode } from "./config";

const PEY_BASE = process.env.PEY_BASE_URL ?? "https://api.pey.mx";

export interface PeyPaymentLink {
  id: string;
  url: string;
}

export interface PeyQr {
  id: string;
  qrString: string;
  qrImage: string | null;
}

export interface PeyTransaction {
  id: string;
  status: "PENDING" | "PAID";
  amount: number;
  amountBreakdown?: {
    base?: number;
    tip?: number;
    fee?: number;
  };
  currency?: string;
  paymentMethod?: string;
  payableType?: "PAYMENT_LINK" | "API_CODI_QR" | "API_CODI_PN" | string;
  payableId?: string;
  description?: string;
  datePaid?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.PEY_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

const PEY_TIMEOUT_MS = Math.max(
  1_000,
  Number(process.env.PEY_TIMEOUT_MS ?? 10_000) || 10_000,
);

async function peyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Un cuelgue de pey no puede colgar la caja, la conciliación ni el webhook.
  // La conciliación puede imponer un timeout global pasando su propio signal.
  const signal = init?.signal ?? AbortSignal.timeout(PEY_TIMEOUT_MS);
  const response = await fetch(`${PEY_BASE}${path}`, {
    ...init,
    signal,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : text || response.statusText;
    throw new Error(`pey ${response.status}: ${message}`);
  }

  return body as T;
}

export async function createPaymentLink(input: {
  orderId: string;
  amountCents: number;
  concept: string;
}): Promise<PeyPaymentLink> {
  if (isDemoMode()) {
    return {
      id: `demo_link_${input.orderId}`,
      url: `${appUrl()}/pay/${input.orderId}?demo=1`,
    };
  }

  const base = appUrl();
  if (!base.startsWith("https://")) {
    throw new Error(
      "pey exige URLs HTTPS. Configura APP_URL con tu dominio HTTPS (o un túnel) antes de generar el link.",
    );
  }

  const body = {
    amount: Number((input.amountCents / 100).toFixed(2)),
    successUrl: `${base}/pay/${input.orderId}/success`,
    backUrl: `${base}/pay/${input.orderId}`,
    clientReferenceId: input.orderId,
    metadata: {
      orderId: input.orderId,
      merchant: "mercado-cero",
    },
  };

  const result = await peyFetch<{ id: string; url: string }>("/payment-link/create", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { id: result.id, url: result.url };
}

export async function createCodiQr(input: {
  orderId: string;
  amountCents: number;
  concept: string;
  numRef: string;
}): Promise<PeyQr> {
  if (isDemoMode()) {
    return {
      id: `demo_qr_${input.orderId}`,
      qrString: JSON.stringify({ demo: true, orderId: input.orderId, numRef: input.numRef }),
      qrImage: null,
    };
  }

  const body: Record<string, unknown> = {
    amount: Number((input.amountCents / 100).toFixed(2)),
    concept: input.concept,
    expiration: 600,
    numRef: input.numRef,
    generateImage: false,
    metadata: { orderId: input.orderId },
  };

  if (process.env.PEY_BANK_ACCOUNT_ID) {
    body.bankAccountId = process.env.PEY_BANK_ACCOUNT_ID;
  }

  const result = await peyFetch<{ id: string; qrString: string; qrImage?: string | null }>(
    "/codi/qr",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return {
    id: result.id,
    qrString: result.qrString,
    qrImage: result.qrImage ?? null,
  };
}

export async function getPeyTransaction(
  id: string,
  signal?: AbortSignal,
): Promise<PeyTransaction | null> {
  if (isDemoMode()) return null;
  try {
    return await peyFetch<PeyTransaction>(
      `/transaction/${encodeURIComponent(id)}`,
      { signal },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) return null;
    throw error;
  }
}

/**
 * El `amount` del checkout puede incluir propina y fee de pey. Para validar
 * contra la venta usamos `amountBreakdown.base`, que es el monto del link.
 */
export function transactionBaseCents(transaction: {
  amount?: unknown;
  amountBreakdown?: unknown;
}): number | null {
  const breakdown =
    typeof transaction.amountBreakdown === "object" &&
    transaction.amountBreakdown !== null &&
    !Array.isArray(transaction.amountBreakdown)
      ? (transaction.amountBreakdown as Record<string, unknown>)
      : null;
  const base = breakdown?.base;
  const value = base !== undefined && base !== null ? base : transaction.amount;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function verifyWebhookSignature(
  rawBody: string,
  headerValues: { id: string | null; timestamp: string | null; signature: string | null },
): boolean {
  const secret = process.env.PEY_WEBHOOK_SECRET;
  if (!secret || !headerValues.id || !headerValues.timestamp || !headerValues.signature) {
    return false;
  }

  const timestamp = Number(headerValues.timestamp);
  if (!Number.isFinite(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 60 * 5) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${headerValues.id}.${headerValues.timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest();

  const signatures = headerValues.signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : part));

  return signatures.some((signature) => {
    try {
      const received = Buffer.from(signature, "base64");
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    } catch {
      return false;
    }
  });
}

export function mapPeyMethod(
  method: string | undefined,
): "codi" | "card" | "wallet" | "unknown" {
  const normalized = (method ?? "").trim().toUpperCase();
  if (!normalized) return "unknown";
  if (normalized.includes("CODI")) return "codi";
  if (
    normalized.includes("APPLE") ||
    normalized.includes("GOOGLE") ||
    normalized.includes("WALLET")
  ) {
    return "wallet";
  }
  if (
    normalized.includes("CARD") ||
    normalized.includes("CREDIT") ||
    normalized.includes("DEBIT") ||
    normalized.includes("TARJETA")
  ) {
    return "card";
  }
  return "unknown";
}
