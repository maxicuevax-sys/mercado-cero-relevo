import { z } from "zod";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import {
  MAX_GOAL_CONTRIBUTION_CENTS,
  MAX_GOAL_NOTE_CHARS,
  MAX_REQUEST_ID_CHARS,
  contributeToGoal,
} from "@/lib/goals";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";

const contributionSchema = z.object({
  amountCents: z.number().int().positive().max(MAX_GOAL_CONTRIBUTION_CENTS),
  note: z.string().max(MAX_GOAL_NOTE_CHARS).nullable().optional(),
  requestId: z.string().trim().max(MAX_REQUEST_ID_CHARS).optional(),
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
      goal: contributeToGoal(id, input.amountCents, input.note, input.requestId),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Aportación inválida.", issues: error.issues },
        { status: 400 },
      );
    }
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo registrar la aportación.");
  }
}
