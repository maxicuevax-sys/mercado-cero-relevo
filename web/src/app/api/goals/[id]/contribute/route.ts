import { z } from "zod";
import { contributeToGoal } from "@/lib/goals";

const contributionSchema = z.object({
  amountCents: z.number().int().positive(),
  note: z.string().max(200).nullable().optional(),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/goals/[id]/contribute">,
) {
  const { id } = await ctx.params;
  try {
    const body = contributionSchema.parse(await request.json());
    return Response.json({
      goal: contributeToGoal(id, body.amountCents, body.note),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Aportación inválida.", issues: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "No se pudo registrar la aportación.";
    return Response.json({ error: message }, { status: 400 });
  }
}
