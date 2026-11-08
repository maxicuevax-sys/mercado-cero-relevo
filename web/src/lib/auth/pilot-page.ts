import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { ReactNode } from "react";
import { judgeAccountsEnabled } from "./pilot-mode";

export function withPilotPage<Args extends unknown[]>(page: (...args: Args) => ReactNode | Promise<ReactNode>, options: { buyer?: boolean } = {}) {
  return async (...args: Args) => {
    // Always dynamic, including flag-off builds: a cached owner's HTML must
    // never be served after account mode is activated at runtime.
    await connection();
    if (!judgeAccountsEnabled()) return page(...args);
    if (options.buyer) notFound();
    const { verifiedJudgeAccount, runJudgeRequest } = await import("./pilot-runtime");
    const requestHeaders = new Headers(await headers());
    const account = await verifiedJudgeAccount(requestHeaders);
    if (!account) redirect("/acceso");
    return runJudgeRequest(account, () => page(...args));
  };
}
