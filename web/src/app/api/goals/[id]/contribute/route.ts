import { z } from "zod";
import {
  MAX_GOAL_CONTRIBUTION_CENTS,
  MAX_GOAL_NOTE_CHARS,
  MAX_REQUEST_ID_CHARS,
  contributeToGoal,
} from "@/lib/goals";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import { readJsonLimited } from "@/lib/http";

const contributionSchema = z.object({
  amountCents: z.number().int().positive().max(MAX_GOAL_CONTRIBUTION_CENTS),
  note: z.string().max(MAX_GOAL_NOTE_CHARS).nullable().optional(),
  requestId: z.string().trim().max(MAX_REQUEST_ID_CHARS).optional(),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/goals/[id]/contribute">,
) {
  const { id } = await ctx.params;
  try {
    const body = contributionSchema.parse(await readJsonLimited(request));
    return Response.json({
      goal: contributeToGoal(id, body.amountCents, body.note, body.requestId),
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
