import { connection } from "next/server";
import { listCredits } from "@/lib/db";

export async function GET() {
  // El saldo vivo no puede servirse desde un snapshot de build.
  await connection();
  return Response.json({ credits: listCredits() });
}
