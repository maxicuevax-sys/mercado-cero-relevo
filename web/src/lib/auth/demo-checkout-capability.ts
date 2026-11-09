import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const PURPOSE = "trangui:demo-checkout:v1";
const MAX_TTL_SECONDS = 900;
export type DemoCheckoutGrant = { accountId: string; orderId: string; iat: number; exp: number };
type Configuration = { secret: string; origin: string; nowMs?: number };
export class InvalidDemoCheckout extends Error {
  constructor() { super("Cobro demo no disponible."); }
}
function configuration(input: Configuration) {
  const url = new URL(input.origin);
  if (input.secret.length < 32 || url.origin !== input.origin || url.username || url.password
      || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) throw new InvalidDemoCheckout();
  return { key: Buffer.from(hkdfSync("sha256", input.secret, PURPOSE, input.origin, 32)), aad: Buffer.from(`${PURPOSE}:${input.origin}`), now: Math.floor((input.nowMs ?? Date.now()) / 1000) };
}
function validGrant(input: unknown, now: number): input is DemoCheckoutGrant {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const grant = input as DemoCheckoutGrant;
  return Object.keys(input).sort().join(",") === "accountId,exp,iat,orderId"
    && typeof grant.accountId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(grant.accountId)
    && typeof grant.orderId === "string" && /^ord_[A-Za-z0-9_-]{1,128}$/.test(grant.orderId)
    && Number.isSafeInteger(grant.iat) && Number.isSafeInteger(grant.exp)
    && grant.iat <= now && grant.exp > now && grant.exp > grant.iat
    && grant.exp - grant.iat <= MAX_TTL_SECONDS;
}
export function sealDemoCheckout(subject: { accountId: string; orderId: string }, input: Configuration, expiresAt?: string): string {
  const config = configuration(input);
  const grant = { ...subject, iat: config.now, exp: expiresAt ? Math.floor(Date.parse(expiresAt) / 1000) : config.now + 600 };
  if (!validGrant(grant, config.now)) throw new InvalidDemoCheckout();
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", config.key, iv);
  cipher.setAAD(config.aad);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(grant), "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64url")}`;
}
export function openDemoCheckout(token: string, input: Configuration): DemoCheckoutGrant {
  try {
    if (typeof token !== "string" || token.length > 1024 || !/^v1\.[A-Za-z0-9_-]+$/.test(token)) throw new InvalidDemoCheckout();
    const encoded = token.slice(3), value = Buffer.from(encoded, "base64url");
    if (value.length < 29 || value.toString("base64url") !== encoded) throw new InvalidDemoCheckout();
    const config = configuration(input), decipher = createDecipheriv("aes-256-gcm", config.key, value.subarray(0, 12));
    decipher.setAAD(config.aad); decipher.setAuthTag(value.subarray(-16));
    const plaintext = Buffer.concat([decipher.update(value.subarray(12, -16)), decipher.final()]);
    const grant: unknown = JSON.parse(plaintext.toString("utf8"));
    if (!validGrant(grant, config.now)) throw new InvalidDemoCheckout();
    return grant;
  } catch { throw new InvalidDemoCheckout(); }
}
