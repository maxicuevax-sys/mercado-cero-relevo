import path from "node:path";
import { createHash } from "node:crypto";
import { createPilotIdentity } from "./pilot-identity";
import { runInTenantDatabase } from "./tenant-scope";
import { judgeAccountsEnabled } from "./pilot-mode";

let runtime: Promise<{ identity: Awaited<ReturnType<typeof createPilotIdentity>>; root: string }> | undefined;
let configuration: string | undefined;

export function getJudgeRuntime() {
  if (!judgeAccountsEnabled()) throw new Error("Judge accounts are disabled");
  if (process.env.DEMO_MODE !== "true" || process.env.PEY_API_KEY || process.env.OPENAI_API_KEY || process.env.PEY_WEBHOOK_SECRET || process.env.OPERATOR_ACCESS_TOKEN) {
    throw new Error("Judge accounts require explicit demo mode without provider credentials");
  }
  const root = process.env.JUDGE_DATA_ROOT;
  const secret = process.env.PILOT_AUTH_SECRET;
  const baseURL = process.env.APP_URL;
  if (!root || !path.isAbsolute(root) || path.dirname(path.resolve(root)) === path.resolve(root)) throw new Error("Judge accounts require an absolute data directory");
  if (!secret || secret.length < 32 || !baseURL) throw new Error("Judge account identity configuration is incomplete");
  const key = createHash("sha256").update(JSON.stringify([path.resolve(root), baseURL, secret])).digest("hex");
  if (configuration && configuration !== key) throw new Error("Restart required after identity configuration changes");
  if (!runtime) {
    configuration = key;
    runtime = createPilotIdentity({ directory: path.join(root, "identity"), baseURL, secret, allowSignUp: true })
      .then(identity => ({ identity, root }))
      .catch(error => { runtime = undefined; configuration = undefined; throw error; });
  }
  return runtime;
}

export async function verifiedJudgeAccount(headers: Headers) {
  const { identity } = await getJudgeRuntime();
  const session = await identity.auth.api.getSession({ headers });
  return session?.user ?? null;
}

export async function runJudgeRequest<T>(account: { id: string }, work: () => T | Promise<T>) {
  // The caller obtains account only from verifiedJudgeAccount, never headers or URL IDs.
  const { root } = await getJudgeRuntime();
  return runInTenantDatabase({ root: path.join(root, "business"), accountId: account.id }, work);
}
