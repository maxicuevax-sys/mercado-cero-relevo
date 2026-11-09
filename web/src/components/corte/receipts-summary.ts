import type { DailySummary } from "../../lib/types";

/** Sales include unpaid orders and fiado. Receipts come only from payment buckets. */
export function corteReceipts(summary: Pick<DailySummary, "cashCents" | "verifiedDigitalCents" | "demoCashCents" | "demoDigitalCents">) {
  return {
    confirmedCents: summary.cashCents + summary.verifiedDigitalCents,
    demoCents: summary.demoCashCents + summary.demoDigitalCents,
  };
}
