import { withPilotRoute } from "../../../../lib/auth/pilot-route";
import { z } from "zod";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";
import {
  completeTask,
  deleteTask,
  getTask,
  postponeTask,
  reopenTask,
  TaskError,
} from "@/lib/tasks";

const actionSchema = z.object({
  action: z.enum(["complete", "reopen", "postpone", "delete"], {
    message: "Acción no válida.",
  }),
  postponeUntil: z.string().trim().min(1).optional(),
});

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

async function PATCHImpl(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const limited = enforceRateLimit(request, "tasks-patch", 60, 60_000);
  if (limited) return limited;

  const { id } = await ctx.params;
  const existing = getTask(id);
  if (!existing) {
    return jsonError("Ese pendiente no existe.", 404);
  }

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_SMALL_JSON_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const input = actionSchema.parse(body);

    if (existing.status === "deleted" && input.action !== "delete") {
      return jsonError("Ese pendiente no existe.", 404);
    }

    let task;
    switch (input.action) {
      case "complete":
        task = completeTask(id);
        break;
      case "reopen":
        task = reopenTask(id);
        break;
      case "postpone":
        if (!input.postponeUntil) {
          return jsonError("Elige cuándo mover el pendiente.", 400);
        }
        task = postponeTask(id, input.postponeUntil);
        break;
      case "delete":
        task = deleteTask(id);
        break;
    }

    return Response.json({ task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Datos inválidos.", 400, {
        issues: error.issues,
      });
    }
    if (error instanceof TaskError) {
      return jsonError(error.message, error.httpStatus, { code: error.code });
    }
    return jsonError("No pude actualizar el pendiente. Intenta de nuevo.", 500);
  }
}

async function DELETEImpl(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const limited = enforceRateLimit(request, "tasks-delete", 60, 60_000);
  if (limited) return limited;

  const { id } = await ctx.params;
  try {
    return Response.json({ task: deleteTask(id) });
  } catch (error) {
    if (error instanceof TaskError) {
      return jsonError(error.message, error.httpStatus, { code: error.code });
    }
    return jsonError("No pude eliminar el pendiente. Intenta de nuevo.", 500);
  }
}

export const PATCH = withPilotRoute(PATCHImpl);
export const DELETE = withPilotRoute(DELETEImpl);
