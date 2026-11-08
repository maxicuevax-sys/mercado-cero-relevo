import { getDb, nowIso } from "./db";
import { ValidationError } from "./errors";

export const BUSINESS_TYPES = ["produce", "food", "goods", "general"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export interface BusinessProfile {
  businessType: BusinessType;
  completedAt: string;
}

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && BUSINESS_TYPES.some(type => type === value);
}

/** Call inside the verified business database scope. Reads never create a profile. */
export function getBusinessProfile(): BusinessProfile | null {
  const database = getDb();
  if (!database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'business_profile'").get()) return null;
  const row = database.prepare("SELECT business_type, completed_at FROM business_profile WHERE id = 1").get();
  if (!row) return null;
  if (!isBusinessType(row.business_type) || typeof row.completed_at !== "string" || !Number.isFinite(Date.parse(row.completed_at))) {
    throw new Error("Invalid stored business profile");
  }
  return { businessType: row.business_type, completedAt: row.completed_at };
}

/** Singleton per business DB; no account identifier, sales or sample-data writes. */
export function setBusinessProfile(businessType: BusinessType): BusinessProfile {
  if (!isBusinessType(businessType)) throw new ValidationError("Elige un giro válido.", "invalid_business_type");
  const database = getDb();
  database.exec(`CREATE TABLE IF NOT EXISTS business_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_type TEXT NOT NULL CHECK (business_type IN ('produce', 'food', 'goods', 'general')),
    completed_at TEXT NOT NULL
  )`);
  database.prepare(`INSERT INTO business_profile (id, business_type, completed_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET business_type = excluded.business_type`).run(businessType, nowIso());
  // Preserve the first completion timestamp if the choice is updated or retried.
  return getBusinessProfile()!;
}
