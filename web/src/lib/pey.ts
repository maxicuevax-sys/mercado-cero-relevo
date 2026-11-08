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
  expiresAt: string;
}

export interface PeyCodiPush {
  id: string;
  status: string;
  expiresAt: string;
  phoneMasked: string;
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
  creditId?: string;
  subAccountId?: string;
}): Promise<PeyPaymentLink> {
  if (isDemoMode()) {
    const query = input.creditId ? `?demo=1&creditId=${input.creditId}` : "?demo=1";
    return {
      id: input.creditId ? `demo_link_${input.creditId}` : `demo_link_${input.orderId}`,
      url: `${appUrl()}/pay/${input.orderId}${query}`,
    };
  }

  const base = appUrl();
  if (!base.startsWith("https://")) {
    throw new Error(
      "pey exige URLs HTTPS. Configura APP_URL con tu dominio HTTPS (o un túnel) antes de generar el link.",
    );
  }

  const clientReferenceId = input.creditId ? `cred_${input.creditId}` : input.orderId;
  const metadata: Record<string, unknown> = {
    orderId: input.orderId,
    merchant: "mercado-cero",
  };
  if (input.creditId) {
    metadata.creditId = input.creditId;
  }
  if (input.subAccountId) {
    metadata.subAccountId = input.subAccountId;
  }

  const body = {
    amount: Number((input.amountCents / 100).toFixed(2)),
    successUrl: `${base}/pay/${input.orderId}/success`,
    backUrl: `${base}/pay/${input.orderId}`,
    clientReferenceId,
    metadata,
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
  expirationSeconds?: number;
  creditId?: string;
  subAccountId?: string;
}): Promise<PeyQr> {
  const expiration = Math.min(3600, Math.max(60, input.expirationSeconds ?? 600));
  const expiresAt = new Date(Date.now() + expiration * 1000).toISOString();

  if (isDemoMode()) {
    return {
      id: input.creditId ? `demo_qr_${input.creditId}` : `demo_qr_${input.orderId}`,
      qrString: JSON.stringify({
        demo: true,
        orderId: input.orderId,
        numRef: input.numRef,
        creditId: input.creditId,
      }),
      qrImage: null,
      expiresAt,
    };
  }

  const metadata: Record<string, unknown> = { orderId: input.orderId };
  if (input.creditId) {
    metadata.creditId = input.creditId;
  }
  if (input.subAccountId) {
    metadata.subAccountId = input.subAccountId;
  }

  const body: Record<string, unknown> = {
    amount: Number((input.amountCents / 100).toFixed(2)),
    concept: input.concept,
    expiration,
    numRef: input.numRef,
    generateImage: false,
    metadata,
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
    expiresAt,
  };
}

export async function createCodiPush(input: {
  orderId: string;
  amountCents: number;
  concept: string;
  phone: string;
  numRef: string;
  subAccountId?: string;
}): Promise<PeyCodiPush> {
  const phone = input.phone.trim();
  if (!/^\d{10}$/.test(phone)) {
    throw new Error(
      "El teléfono para cobro CoDi Push debe contener exactamente 10 dígitos numéricos.",
    );
  }
  const expiresAt = new Date(Date.now() + 600 * 1000).toISOString();
  const phoneMasked = `******${phone.slice(-4)}`;

  if (isDemoMode()) {
    return {
      id: `demo_pn_${input.orderId}_${Date.now()}`,
      status: "PENDING",
      expiresAt,
      phoneMasked,
    };
  }

  const metadata: Record<string, unknown> = { orderId: input.orderId };
  if (input.subAccountId) {
    metadata.subAccountId = input.subAccountId;
  }

  const body: Record<string, unknown> = {
    amount: Number((input.amountCents / 100).toFixed(2)),
    concept: input.concept,
    phoneNumber: phone,
    expiration: 600,
    numRef: input.numRef,
    metadata,
  };

  if (process.env.PEY_BANK_ACCOUNT_ID) {
    body.bankAccountId = process.env.PEY_BANK_ACCOUNT_ID;
  }

  const result = await peyFetch<{ id: string; status?: string }>("/codi/pn", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: result.id,
    status: result.status ?? "PENDING",
    expiresAt,
    phoneMasked,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/**
 * Extrae de forma segura posibles `transactionId` desde payloads JSON
 * guardados en `payment_events` (tanto de eventos `codi.qr.payment_received` /
 * `codi.pn.payment_received` con `transactionId` en raíz, como
 * `payment_link.status_updated` con `transactions[].transactionId`).
 */
export function extractCandidateTransactionIds(payloads: string[]): string[] {
  if (!Array.isArray(payloads)) return [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const id = identifier(value);
    if (id) {
      seen.add(id);
    }
  };

  const inspectRecord = (record: Record<string, unknown>) => {
    add(record.transactionId);
    if (Array.isArray(record.transactions)) {
      for (const tx of record.transactions) {
        if (isRecord(tx)) {
          add(tx.transactionId);
        }
      }
    }
  };

  for (const raw of payloads) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;

    inspectRecord(parsed);
    if (isRecord(parsed.data)) {
      inspectRecord(parsed.data);
    }
  }

  return [...seen];
}

export interface PeyOrderReferenceTarget {
  id: string;
  paymentLinkId?: string | null;
  qrId?: string | null;
  codiPushId?: string | null;
  numRef?: string | null;
}

export type PeySyncFailureReason =
  | "not_paid"
  | "currency_mismatch"
  | "amount_mismatch"
  | "reference_mismatch";

export type PeyTransactionValidationResult =
  | { ok: true; amountCents: number }
  | { ok: false; reason: PeySyncFailureReason };

export function hasPeyReferenceMismatch(
  order: PeyOrderReferenceTarget,
  transaction: PeyTransaction,
): boolean {
  const metadata = isRecord(transaction.metadata) ? transaction.metadata : {};
  const externalMetadata = isRecord(metadata.externalMetadata) ? metadata.externalMetadata : {};
  const metadataOrderId = identifier(metadata.orderId) || identifier(externalMetadata.orderId);
  if (metadataOrderId && metadataOrderId !== order.id) return true;

  const clientReferenceId = identifier((transaction as Record<string, unknown>).clientReferenceId);
  if (clientReferenceId && clientReferenceId !== order.id) return true;

  const txNumRef =
    identifier((transaction as Record<string, unknown>).numRef) || identifier(metadata.numRef);
  if (txNumRef && order.numRef && txNumRef !== order.numRef) return true;

  const payableId = identifier(transaction.payableId);
  const matchedNumRef = Boolean(txNumRef && order.numRef && txNumRef === order.numRef);
  if (!metadataOrderId && !clientReferenceId && !payableId && !matchedNumRef) return true;

  if (transaction.payableType === "PAYMENT_LINK") {
    if (!order.paymentLinkId) return true;
    if (payableId && payableId !== order.paymentLinkId) return true;
  } else if (transaction.payableType === "API_CODI_QR") {
    if (!order.qrId) return true;
    if (payableId && payableId !== order.qrId) return true;
  } else if (transaction.payableType === "API_CODI_PN") {
    if (!order.codiPushId) return true;
    if (payableId && payableId !== order.codiPushId) return true;
  } else if (
    payableId &&
    payableId !== order.paymentLinkId &&
    payableId !== order.qrId &&
    payableId !== order.codiPushId
  ) {
    return true;
  }

  return false;
}

export function validatePeyTransactionForOrder(
  order: PeyOrderReferenceTarget,
  transaction: PeyTransaction,
  expectedCents: number,
): PeyTransactionValidationResult {
  const amountCents = transactionBaseCents(transaction);
  const isPaid = transaction.status === "PAID";
  const isMxn = typeof transaction.currency === "string" && transaction.currency.toUpperCase() === "MXN";
  const amountMatches = amountCents !== null && amountCents === expectedCents;
  const referenceMatches = !hasPeyReferenceMismatch(order, transaction);

  if (isPaid && isMxn && amountMatches && referenceMatches) {
    return { ok: true, amountCents };
  }

  return {
    ok: false,
    reason: !isPaid
      ? "not_paid"
      : !isMxn
        ? "currency_mismatch"
        : !amountMatches
          ? "amount_mismatch"
          : "reference_mismatch",
  };
}

export interface PeySubAccount {
  subAccountId: string;
  name: string;
  email: string;
  bankAccountId?: string | null;
  createdAt: string;
}

export async function createPeySubAccount(input: {
  userId: string;
  name: string;
  email: string;
  bankClabe?: string;
}): Promise<PeySubAccount> {
  const now = new Date().toISOString();
  if (isDemoMode()) {
    return {
      subAccountId: `demo_sub_${input.userId}`,
      name: input.name,
      email: input.email,
      bankAccountId: input.bankClabe ? `demo_bank_${Date.now()}` : null,
      createdAt: now,
    };
  }

  const body: Record<string, unknown> = {
    externalId: input.userId,
    name: input.name,
    email: input.email,
  };
  if (input.bankClabe) {
    body.clabe = input.bankClabe;
  }

  try {
    const result = await peyFetch<{ id: string; bankAccountId?: string }>("/sub-account/create", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      subAccountId: result.id,
      name: input.name,
      email: input.email,
      bankAccountId: result.bankAccountId ?? null,
      createdAt: now,
    };
  } catch {
    return {
      subAccountId: `sub_${input.userId}`,
      name: input.name,
      email: input.email,
      bankAccountId: null,
      createdAt: now,
    };
  }
}
