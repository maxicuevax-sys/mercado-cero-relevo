import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

/** Guests are ephemeral: they never consume the pilot registration cap. */
const GUEST_EMAIL_SUFFIX = "@demo.trangui.local";

function pilotAccountLimit(): number {
  const raw = Number(process.env.JUDGE_MAX_ACCOUNTS ?? 100);
  return Number.isInteger(raw) && raw > 0 && raw <= 100_000 ? raw : 100;
}

export interface PilotIdentityOptions {
  directory: string;
  baseURL: string;
  secret: string;
  /** Closed until business isolation and public registration pass their gates. */
  allowSignUp?: boolean;
}

/**
 * Technical foundation only: no global instance, public route or business access.
 * Its caller owns the connection and must close it after draining requests.
 */
export async function createPilotIdentity(options: PilotIdentityOptions) {
  if (typeof window !== "undefined") throw new Error("Identity is server-only");
  if (!options.secret || options.secret.length < 32) {
    throw new Error("Identity requires an explicit secret of at least 32 characters");
  }
  const origin = new URL(options.baseURL);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && loopback)) ||
    origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash
  ) {
    throw new Error("Identity requires an HTTPS origin (HTTP only on exact loopback)");
  }
  if (!options.directory || !path.isAbsolute(options.directory)) {
    throw new Error("Identity requires an explicit absolute directory");
  }
  const directory = path.resolve(options.directory);
  const identityPath = path.join(directory, "identity.sqlite");
  if (
    path.dirname(directory) === directory ||
    existsSync(path.join(directory, "mercado-cero.db")) ||
    (process.env.DATABASE_PATH && path.resolve(process.env.DATABASE_PATH) === identityPath)
  ) {
    throw new Error("Identity needs a separate directory from the business database");
  }

  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(identityPath);
  try {
    database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    const pageSize = Number((database.prepare("PRAGMA page_size").get() as { page_size: number }).page_size);
    const pageCount = Number((database.prepare("PRAGMA page_count").get() as { page_count: number }).page_count);
    const maximumPages = Math.floor(32 * 1024 * 1024 / pageSize);
    if (pageCount > maximumPages) throw new Error("Identity storage limit reached");
    database.exec(`PRAGMA max_page_count = ${maximumPages}; PRAGMA journal_size_limit = 1048576;`);
    const authOptions = {
      appName: "Trangui",
      baseURL: origin.origin,
      secret: options.secret,
      database,
      trustedOrigins: [origin.origin],
      emailAndPassword: {
        enabled: true,
        disableSignUp: options.allowSignUp !== true,
        minPasswordLength: 1,
        maxPasswordLength: 4096,
        requireEmailVerification: false,
      },
      session: {
        expiresIn: 24 * 60 * 60,
        disableSessionRefresh: true,
        cookieCache: { enabled: false },
      },
      advanced: {
        useSecureCookies: origin.protocol === "https:",
        defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
        // No public route exists yet. Until a trusted proxy boundary is wired,
        // use the conservative shared bucket rather than spoofable forwarded IPs.
        ipAddress: { ipAddressHeaders: [] },
      },
      // Demo pública: un bloqueo de 3 intentos deja fuera a jueces/usuarios.
      // El acceso invitado y este piloto no manejan dinero real.
      rateLimit: { enabled: false, storage: "database" },
      telemetry: { enabled: false },
    } satisfies BetterAuthOptions;
    const migrations = await getMigrations(authOptions);
    await migrations.runMigrations();
    // Enforced at the write boundary, not a count-before-signup check:
    // simultaneous registrations cannot both claim the final pilot slot.
    // Guests are excluded: they are ephemeral and must keep working when the
    // pilot's own registration cap is full.
    database.exec(`
      DROP TRIGGER IF EXISTS pilot_max_100_accounts;
      CREATE TRIGGER pilot_max_100_accounts
      BEFORE INSERT ON user
      WHEN lower(NEW.email) NOT LIKE '%${GUEST_EMAIL_SUFFIX}'
        AND (SELECT COUNT(*) FROM user
             WHERE lower(email) NOT LIKE '%${GUEST_EMAIL_SUFFIX}') >= ${pilotAccountLimit()}
      BEGIN
        SELECT RAISE(ABORT, 'pilot_account_limit');
      END;
    `);
    const auth = betterAuth(authOptions);
    let closed = false;
    return {
      auth,
      database,
      close() {
        if (!closed) {
          database.close();
          closed = true;
        }
      },
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
