import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

interface TenantDatabaseScope {
  readonly accountId: string;
  readonly databasePath: string;
  readonly backupDirectory: string;
  database?: DatabaseSync;
  closed: boolean;
}
const storage = new AsyncLocalStorage<TenantDatabaseScope>();

export function currentTenantDatabase(): TenantDatabaseScope | undefined {
  return storage.getStore();
}

function rejectSymlink(target: string) {
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error("Tenant storage cannot use symbolic links");
  }
}

/** Internal boundary: accountId must come from a verified server-side session,
 * or a server-verified, live-account DEMO checkout capability, never a raw
 * query parameter, cookie value or client-supplied account header.
 * Not an authentication API. Public handlers remain closed until wired safely.
 * Each operation owns its connection; concurrent requests never share a mutable
 * current-account variable or the legacy owner's business connection.
 */
export async function runInTenantDatabase<T>(
  options: { root: string; accountId: string },
  work: () => T | Promise<T>,
): Promise<T> {
  if (storage.getStore()) throw new Error("Nested tenant database scopes are forbidden");
  if (process.env.DEMO_MODE !== "true" || process.env.PEY_API_KEY || process.env.OPENAI_API_KEY) {
    throw new Error("Judge accounts require explicit demo mode with paid providers disabled");
  }
  if (typeof options.root !== "string" || !options.root || !path.isAbsolute(options.root) || path.dirname(path.resolve(options.root)) === path.resolve(options.root)) {
    throw new Error("Tenant storage requires a dedicated absolute directory");
  }
  if (typeof options.accountId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(options.accountId)) throw new Error("Invalid account identifier");
  const root = path.resolve(options.root);
  rejectSymlink(root);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const key = createHash("sha256").update(options.accountId).digest("hex");
  const directory = path.join(root, key);
  rejectSymlink(directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const scope: TenantDatabaseScope = {
    accountId: options.accountId,
    databasePath: path.join(directory, "demo.sqlite"),
    backupDirectory: path.join(directory, "backups"),
    closed: false,
  };
  rejectSymlink(scope.databasePath);
  rejectSymlink(scope.backupDirectory);
  return storage.run(scope, async () => {
    try { return await work(); }
    finally {
      scope.closed = true;
      scope.database?.close();
      scope.database = undefined;
    }
  });
}
