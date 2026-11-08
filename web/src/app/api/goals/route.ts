import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { z } from "zod";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import { MAX_GOAL_TITLE_CHARS, createGoal, listGoals } from "@/lib/goals";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";

const createSchema = z.object({
  title: z.string().trim().min(1).max(MAX_GOAL_TITLE_CHARS),
  targetCents: z.number().int().positive(),
  deadline: z.string().datetime().nullable().optional(),
});

async function GETImpl() {
  return Response.json({ goals: listGoals() });
}

async function POSTImpl(request: Request) {
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
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo crear la meta.");
  }
}

export const GET = withPilotRoute(GETImpl);
export const POST = withPilotRoute(POSTImpl);
