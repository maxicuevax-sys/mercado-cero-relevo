import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { appUrl } from "../config";
import { getDb, getOrder } from "../db";
import { getJudgeRuntime } from "./pilot-runtime";
import { judgeAccountsEnabled } from "./pilot-mode";
import { currentTenantDatabase, runInTenantDatabase } from "./tenant-scope";
import { InvalidDemoCheckout, openDemoCheckout, sealDemoCheckout } from "./demo-checkout-capability";
import type { DemoCheckoutData } from "../demo-checkout-data";

function config() { return { secret: process.env.PILOT_AUTH_SECRET ?? "", origin: appUrl() }; }

export function isActiveJudgeDemoCheckoutUrl(value: string | null, orderId: string): boolean {
  try {
    const url = new URL(value ?? "");
    if (url.origin !== appUrl() || url.pathname !== "/cobro/demo" || url.search) return false;
    const grant = openDemoCheckout(url.hash.slice(1), config());
    return grant.orderId === orderId && grant.accountId === currentTenantDatabase()?.accountId;
  } catch { return false; }
}

/** Called only inside a verified account's existing server scope. Never accepts an account from the browser. */
export function createJudgeDemoCheckoutUrl(orderId: string, expiresAt?: string): string {
  const accountId = currentTenantDatabase()?.accountId;
  if (!judgeAccountsEnabled() || process.env.DEMO_MODE !== "true" || !accountId
      || process.env.PEY_API_KEY || process.env.OPENAI_API_KEY || process.env.PEY_WEBHOOK_SECRET || process.env.OPERATOR_ACCESS_TOKEN) throw new InvalidDemoCheckout();
  const order = getDb().prepare("SELECT demo FROM orders WHERE id = ?").get(orderId) as { demo: number } | undefined;
  if (!order || order.demo !== 1) throw new InvalidDemoCheckout();
  const end = Math.min(expiresAt ? Date.parse(expiresAt) : Date.now() + 600000, Date.now() + 900000);
  const token = sealDemoCheckout({ accountId, orderId }, config(), new Date(end).toISOString());
  // URL fragments are never sent to access logs, proxies or HTTP referrers.
  return `${appUrl()}/cobro/demo#${token}`;
}

/** A decrypted capability is delegated access to exactly one DEMO order, never an account session. */
export async function runDemoCheckout<T>(token: string, work: (orderId: string) => T | Promise<T>): Promise<T> {
  if (!judgeAccountsEnabled()) throw new InvalidDemoCheckout();
  const { identity, root } = await getJudgeRuntime(); // Fail closed if real providers/credentials are enabled.
  const grant = openDemoCheckout(token, config());
  const account = identity.database.prepare("SELECT id FROM user WHERE id = ?").get(grant.accountId);
  if (!account) throw new InvalidDemoCheckout();
  const business = path.join(root, "business");
  const directory = path.join(business, createHash("sha256").update(grant.accountId).digest("hex"));
  const database = path.join(directory, "demo.sqlite");
  // An old link must never recreate an orphaned business or identity.
  for (const target of [business, directory, database]) {
    if (!fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()) throw new InvalidDemoCheckout();
  }
  if (!fs.statSync(database).isFile()) throw new InvalidDemoCheckout();
  return runInTenantDatabase({ root: business, accountId: grant.accountId }, async () => {
    readDemoCheckout(grant.orderId); // Validate mode/order/expiry before any callback (including POST).
    return work(grant.orderId);
  });
}

export function readDemoCheckout(orderId: string): DemoCheckoutData {
  const row = getDb().prepare("SELECT demo FROM orders WHERE id = ?").get(orderId) as { demo: number } | undefined;
  const order = getOrder(orderId);
  // QR capabilities were sealed with that QR's expiry. A separately renewed
  // payment link has its own expiry, even if an earlier QR has since expired.
  if (!row || row.demo !== 1 || !order || order.status === "cancelled") throw new InvalidDemoCheckout();
  return {
    demo: true, reference: order.id.slice(-4).toUpperCase(), totalCents: order.totalCents,
    dueCents: Math.max(0, order.totalCents - order.paidCents - order.creditCents), status: order.status,
    items: order.items.map(item => ({ description: item.description, quantity: item.quantity, totalCents: item.totalCents })),
  };
}
