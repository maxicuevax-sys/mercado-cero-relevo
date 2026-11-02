import { z } from "zod";
import { GoalError, createGoal, listGoals } from "@/lib/goals";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  targetCents: z.number().int().positive(),
  deadline: z.string().datetime().nullable().optional(),
});

export async function GET() {
  return Response.json({ goals: listGoals() });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "goals-create", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_SMALL_JSON_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const input = createSchema.parse(body);
    return Response.json({ goal: createGoal(input) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Datos de meta inválidos.", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof GoalError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[goals create] error inesperado", error);
    return Response.json(
      { error: "No se pudo crear la meta.", code: "goal_create_failed" },
      { status: 500 },
    );
  }
}
