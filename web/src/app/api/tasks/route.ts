import { connection } from "next/server";
import { z } from "zod";
import { cachedJson } from "@/lib/http-cache";
import {
  bodyErrorResponse,
  enforceRateLimit,
  readJsonLimited,
} from "@/lib/http-security";
import {
  DEFAULT_TASKS_LIMIT,
  MAX_TASKS_LIMIT,
  pageMeta,
  parseLimit,
  parseOffset,
} from "@/lib/pagination";
import {
  countTasks,
  createTask,
  listTasks,
  TaskError,
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
} from "@/lib/tasks";

const MAX_TASK_BODY_BYTES = 16 * 1024;

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

export async function GET(request: Request) {
  // La bandeja es dato vivo: no puede servirse desde un snapshot de build.
  await connection();
  const params = new URL(request.url).searchParams;
  const limit = parseLimit(params, DEFAULT_TASKS_LIMIT, MAX_TASKS_LIMIT);
  const offset = parseOffset(params);
  const tasks = listTasks(limit, offset);
  const total = countTasks();
  const meta = pageMeta(limit, offset, tasks.length, total);
  return await cachedJson(
    request,
    {
      tasks,
      limit,
      offset,
      total,
      hasMore: meta.hasMore,
      pagination: meta,
    },
    "tasks",
  );
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "tasks-create", 60, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_TASK_BODY_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
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
