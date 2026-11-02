import { z } from "zod";
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

export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const existing = getTask(id);
  if (!existing) {
    return jsonError("Ese pendiente no existe.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Envía la acción del pendiente en formato JSON.", 400);
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

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
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
