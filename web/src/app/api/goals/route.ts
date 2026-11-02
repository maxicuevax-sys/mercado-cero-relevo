import { z } from "zod";
import {
  MAX_GOAL_TITLE_CHARS,
  createGoal,
  listGoals,
} from "@/lib/goals";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import { readJsonLimited } from "@/lib/http";

const createSchema = z.object({
  title: z.string().trim().min(1).max(MAX_GOAL_TITLE_CHARS),
  targetCents: z.number().int().positive(),
  deadline: z.string().datetime().nullable().optional(),
});

export async function GET() {
  return Response.json({ goals: listGoals() });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonLimited(request);
    const input = createSchema.parse(body);
    return Response.json({ goal: createGoal(input) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Datos de meta inválidos.", issues: error.issues },
        { status: 400 },
      );
    }
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo crear la meta.");
  }
}
