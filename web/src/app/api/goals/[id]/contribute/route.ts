import { z } from "zod";
import { GoalError, contributeToGoal } from "@/lib/goals";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";

const contributionSchema = z.object({
  amountCents: z.number().int().positive(),
  note: z.string().max(200).nullable().optional(),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/goals/[id]/contribute">,
) {
  const limited = enforceRateLimit(request, "goal-contribute", 60, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_SMALL_JSON_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const { id } = await ctx.params;
    const input = contributionSchema.parse(body);
    return Response.json({
      goal: contributeToGoal(id, input.amountCents, input.note),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Aportación inválida.", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof GoalError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[goal contribute] error inesperado", error);
    return Response.json(
      { error: "No se pudo registrar la aportación.", code: "goal_contribute_failed" },
      { status: 500 },
    );
  }
}
