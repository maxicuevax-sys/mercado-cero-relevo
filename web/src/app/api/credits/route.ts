import { listCredits } from "@/lib/db";

export async function GET() {
  return Response.json({ credits: listCredits() });
}
