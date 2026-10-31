import { z } from "zod";
import { createGoal, listGoals } from "@/lib/goals";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  targetCents: z.number().int().positive(),
  deadline: z.string().datetime().nullable().optional(),
});

export async function GET() {
  return Response.json({ goals: listGoals() });
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    return Response.json({ goal: createGoal(body) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Datos de meta inválidos.", issues: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "No se pudo crear la meta.";
    return Response.json({ error: message }, { status: 400 });
  }
}
