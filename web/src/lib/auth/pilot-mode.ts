export function judgeAccountsEnabled(): boolean {
  const flag = process.env.JUDGE_DEMO_ACCOUNTS;
  if (flag && flag !== "true" && flag !== "false") throw new Error("Invalid judge account mode");
  return flag === "true";
}
