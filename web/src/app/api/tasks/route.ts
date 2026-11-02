import { connection } from "next/server";
import { z } from "zod";
import { createTask, listTasks, TaskError, TASK_NOTE_MAX, TASK_TITLE_MAX } from "@/lib/tasks";

const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribe qué quieres recordar.")
    .max(TASK_TITLE_MAX, `El título no puede pasar de ${TASK_TITLE_MAX} caracteres.`),
  note: z
    .string()
    .trim()
    .max(TASK_NOTE_MAX, `La nota no puede pasar de ${TASK_NOTE_MAX} caracteres.`)
    .nullish(),
  dueAt: z.string().trim().min(1).nullish(),
});

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

export async function GET() {
  // La bandeja es dato vivo: no puede servirse desde un snapshot de build.
  await connection();
  return Response.json({ tasks: listTasks() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Envía los datos del pendiente en formato JSON.", 400);
  }

  try {
    const input = createSchema.parse(body);
    const task = createTask({
      title: input.title,
      note: input.note ?? null,
      dueAt: input.dueAt ?? null,
    });
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.issues[0]?.message ?? "Datos inválidos.", 400, {
        issues: error.issues,
      });
    }
    if (error instanceof TaskError) {
      return jsonError(error.message, error.httpStatus, { code: error.code });
    }
    return jsonError("No pude guardar el pendiente. Intenta de nuevo.", 500);
  }
}
