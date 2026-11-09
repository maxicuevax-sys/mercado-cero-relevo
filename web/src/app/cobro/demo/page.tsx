import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { judgeAccountsEnabled } from "@/lib/auth/pilot-mode";
import { getJudgeRuntime } from "@/lib/auth/pilot-runtime";
import DemoCheckout from "./demo-checkout";
import "@/app/checkout.css";
import "./demo-checkout.css";

export const metadata: Metadata = { title: "Cobro DEMO · Trangui", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const instant = false;

export default async function DemoCheckoutPage() {
  await connection();
  if (!judgeAccountsEnabled()) notFound();
  try { await getJudgeRuntime(); } catch { notFound(); }
  // This shell contains no order data. The fragment stays in the browser;
  // the capability is verified by the fixed endpoint before every read/write.
  return <DemoCheckout />;
}
