#!/usr/bin/env node
/**
 * Contrato de la API de pendientes de negocio.
 *
 * Levanta un `next start` aislado en el puerto 3101 con una SQLite temporal.
 * Nunca toca el puerto 3000 ni la base de la demo. Al terminar borra la DB.
 *
 * Uso (desde web/, después de `npm run build`):
 *   node scripts/tasks-contract.mjs
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(
  os.tmpdir(),
  `mercado-cero-tasks-${process.pid}-${Date.now()}.db`,
);
const DAY_MS = 24 * 60 * 60 * 1000;

let passed = 0;
let failed = 0;
const failures = [];
let child = null;
let serverLog = "";

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  failures.push({ name, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mexicoDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function api(method, route, body) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, body: json, text, headers: response.headers };
}

function summarize(result) {
  return `status=${result.status} body=${result.text.slice(0, 240)}`;
}

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(
        `El servidor aislado terminó antes de responder.\n${serverLog.slice(-2000)}`,
      );
    }
    try {
      const response = await fetch(`${BASE}/api/tasks`);
      if (response.ok) return;
    } catch {
      // Aún arranca.
    }
    await delay(500);
  }
  throw new Error(`El servidor no respondió en 90 s.\n${serverLog.slice(-2000)}`);
}

async function assertPortFree() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const response = await fetch(`${BASE}/api/tasks`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (response.ok || response.status > 0) {
      throw new Error(
        `El puerto ${PORT} ya está ocupado. No lo toqué; cierra ese servidor y reintenta.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("ya está ocupado")) {
      throw error;
    }
    // Sin respuesta: el puerto está libre.
  }
}

async function startServer() {
  if (!fs.existsSync(NEXT_BIN)) {
    throw new Error("Falta node_modules. Corre `npm ci` en web/.");
  }
  if (!fs.existsSync(path.join(WEB, ".next", "BUILD_ID"))) {
    throw new Error("Falta el build. Corre `npm run build` en web/.");
  }

  child = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(PORT)], {
    cwd: WEB,
    env: {
      ...process.env,
      DATABASE_PATH: DB_PATH,
      PORT: String(PORT),
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    serverLog += chunk.toString();
  });

  await waitForServer();
}

async function stopServer() {
  if (!child || child.exitCode !== null) {
    child = null;
    return;
  }
  const proc = child;
  child = null;
  proc.kill();
  const exited = await Promise.race([
    new Promise((resolve) => proc.once("exit", () => resolve(true))),
    delay(5000).then(() => false),
  ]);
  if (!exited) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      proc.kill("SIGKILL");
    }
  }
  await delay(300);
}

function cleanupDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
    } catch {
      // Windows puede tardar un instante en soltar el archivo.
    }
  }
}

async function main() {
  if (BASE.includes(":3000")) {
    throw new Error("Este contrato no puede apuntar al puerto 3000.");
  }
  await assertPortFree();
  await startServer();
  console.log(`Servidor aislado en ${BASE} · DB temporal ${DB_PATH}`);

  // 1 · Bandeja vacía y validación de creación.
  const empty = await api("GET", "/api/tasks");
  check(
    "GET /api/tasks inicia vacío",
    empty.status === 200 && Array.isArray(empty.body?.tasks) && empty.body.tasks.length === 0,
    summarize(empty),
  );

  const missingTitle = await api("POST", "/api/tasks", {});
  check("POST sin título → 400", missingTitle.status === 400, summarize(missingTitle));

  const blankTitle = await api("POST", "/api/tasks", { title: "   " });
  check("POST título en blanco → 400", blankTitle.status === 400, summarize(blankTitle));

  const longTitle = await api("POST", "/api/tasks", { title: "a".repeat(121) });
  check("POST título de 121 → 400", longTitle.status === 400, summarize(longTitle));

  const longNote = await api("POST", "/api/tasks", {
    title: "Nota larga",
    note: "b".repeat(501),
  });
  check("POST nota de 501 → 400", longNote.status === 400, summarize(longNote));

  const badDate = await api("POST", "/api/tasks", {
    title: "Fecha mala",
    dueAt: "mañana",
  });
  check("POST fecha no ISO → 400", badDate.status === 400, summarize(badDate));

  const impossibleDate = await api("POST", "/api/tasks", {
    title: "31 de febrero",
    dueAt: "2026-02-31",
  });
  check(
    "POST 31 de febrero → 400",
    impossibleDate.status === 400,
    summarize(impossibleDate),
  );

  const created = await api("POST", "/api/tasks", {
    title: "  Pagar al proveedor  ",
    note: "  Tomás pasa a las 11  ",
    dueAt: "2030-01-15",
  });
  const task = created.body?.task;
  check(
    "POST crea tarea y recorta espacios",
    created.status === 201 &&
      task?.title === "Pagar al proveedor" &&
      task?.note === "Tomás pasa a las 11" &&
      task?.status === "open" &&
      typeof task?.id === "string" &&
      task.id.startsWith("task_"),
    summarize(created),
  );
  check(
    "POST normaliza fecha sin hora a ISO",
    typeof task?.dueAt === "string" &&
      mexicoDateKey(new Date(task.dueAt)) === "2030-01-15",
    `dueAt=${task?.dueAt}`,
  );

  const listed = await api("GET", "/api/tasks");
  check(
    "GET incluye la tarea creada",
    listed.status === 200 &&
      Array.isArray(listed.body?.tasks) &&
      listed.body.tasks.some((item) => item.id === task.id),
    summarize(listed),
  );

  // 2 · Completar idempotente, hechas y reabrir.
  const complete1 = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "complete",
  });
  const completedAt = complete1.body?.task?.completedAt;
  check(
    "PATCH complete deja status done y completedAt",
    complete1.status === 200 &&
      complete1.body?.task?.status === "done" &&
      typeof completedAt === "string",
    summarize(complete1),
  );

  const complete2 = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "complete",
  });
  check(
    "PATCH complete repetido es idempotente",
    complete2.status === 200 &&
      complete2.body?.task?.status === "done" &&
      complete2.body?.task?.completedAt === completedAt,
    summarize(complete2),
  );

  const withDone = await api("GET", "/api/tasks");
  check(
    "GET conserva la tarea hecha",
    withDone.body?.tasks?.some(
      (item) => item.id === task.id && item.status === "done",
    ) === true,
    summarize(withDone),
  );

  const reopen = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "reopen",
  });
  check(
    "PATCH reopen vuelve a open y limpia completedAt",
    reopen.status === 200 &&
      reopen.body?.task?.status === "open" &&
      reopen.body?.task?.completedAt === null,
    summarize(reopen),
  );

  // 3 · Posponer: futuro, pasado e inválido.
  const futureIso = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
  const postpone = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "postpone",
    postponeUntil: futureIso,
  });
  check(
    "PATCH postpone guarda postponedUntil sin completar",
    postpone.status === 200 &&
      postpone.body?.task?.status === "open" &&
      postpone.body?.task?.postponedUntil === futureIso &&
      postpone.body?.task?.dueAt === task.dueAt,
    summarize(postpone),
  );

  const past = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "postpone",
    postponeUntil: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  check(
    "PATCH postpone al pasado → 400 claro",
    past.status === 400 &&
      typeof past.body?.error === "string" &&
      /futura/i.test(past.body.error),
    summarize(past),
  );

  const badPostpone = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "postpone",
    postponeUntil: "mañana",
  });
  check(
    "PATCH postpone inválido → 400 claro",
    badPostpone.status === 400 && typeof badPostpone.body?.error === "string",
    summarize(badPostpone),
  );

  const missingPostpone = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "postpone",
  });
  check(
    "PATCH postpone sin fecha → 400",
    missingPostpone.status === 400,
    summarize(missingPostpone),
  );

  const afterBad = await api("GET", "/api/tasks");
  const unchanged = afterBad.body?.tasks?.find((item) => item.id === task.id);
  check(
    "Un postpone rechazado no cambia la tarea",
    unchanged?.postponedUntil === futureIso && unchanged?.status === "open",
    `postponedUntil=${unchanged?.postponedUntil}`,
  );

  const invalidAction = await api("PATCH", `/api/tasks/${task.id}`, {
    action: "archive",
  });
  check(
    "PATCH acción desconocida → 400",
    invalidAction.status === 400,
    summarize(invalidAction),
  );

  // 4 · Orden: vencidas, luego fecha, luego sin fecha.
  const overdueTask = await api("POST", "/api/tasks", {
    title: "Revisar el gas (vencida)",
    dueAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
  });
  const tomorrowTask = await api("POST", "/api/tasks", {
    title: "Pedir tortillas (mañana)",
    dueAt: new Date(Date.now() + 1 * DAY_MS).toISOString(),
  });
  const laterTask = await api("POST", "/api/tasks", {
    title: "Hablar con el cliente (después)",
    dueAt: new Date(Date.now() + 5 * DAY_MS).toISOString(),
  });
  const noDateTask = await api("POST", "/api/tasks", {
    title: "Comprar bolsas (sin fecha)",
  });

  const ordered = await api("GET", "/api/tasks");
  const ids = (ordered.body?.tasks ?? []).map((item) => item.id);
  const indexOverdue = ids.indexOf(overdueTask.body?.task?.id);
  const indexTomorrow = ids.indexOf(tomorrowTask.body?.task?.id);
  const indexLater = ids.indexOf(laterTask.body?.task?.id);
  const indexNoDate = ids.indexOf(noDateTask.body?.task?.id);
  check(
    "GET ordena vencida → próxima → futura → sin fecha",
    indexOverdue !== -1 &&
      indexTomorrow !== -1 &&
      indexLater !== -1 &&
      indexNoDate !== -1 &&
      indexOverdue < indexTomorrow &&
      indexTomorrow < indexLater &&
      indexLater < indexNoDate,
    `indices=${indexOverdue},${indexTomorrow},${indexLater},${indexNoDate}`,
  );

  // 5 · Posponer una tarea hecha exige reabrir.
  await api("PATCH", `/api/tasks/${overdueTask.body.task.id}`, {
    action: "complete",
  });
  const postponeDone = await api("PATCH", `/api/tasks/${overdueTask.body.task.id}`, {
    action: "postpone",
    postponeUntil: new Date(Date.now() + DAY_MS).toISOString(),
  });
  check(
    "PATCH postpone sobre hecha → 409",
    postponeDone.status === 409,
    summarize(postponeDone),
  );

  // 6 · Eliminar es soft delete, idempotente y no resucita.
  const deleteMe = await api("POST", "/api/tasks", {
    title: "Eliminar esta tarea",
  });
  const deleteId = deleteMe.body?.task?.id;
  const deleted = await api("PATCH", `/api/tasks/${deleteId}`, {
    action: "delete",
  });
  const deletedAt = deleted.body?.task?.deletedAt;
  check(
    "PATCH delete marca deleted y deletedAt",
    deleted.status === 200 &&
      deleted.body?.task?.status === "deleted" &&
      typeof deletedAt === "string",
    summarize(deleted),
  );

  const afterDelete = await api("GET", "/api/tasks");
  check(
    "GET no muestra la tarea eliminada",
    afterDelete.body?.tasks?.every((item) => item.id !== deleteId) === true,
    summarize(afterDelete),
  );

  const deleteAgain = await api("DELETE", `/api/tasks/${deleteId}`);
  check(
    "DELETE repetido es idempotente",
    deleteAgain.status === 200 &&
      deleteAgain.body?.task?.status === "deleted" &&
      deleteAgain.body?.task?.deletedAt === deletedAt,
    summarize(deleteAgain),
  );

  const completeDeleted = await api("PATCH", `/api/tasks/${deleteId}`, {
    action: "complete",
  });
  check(
    "PATCH sobre eliminada → 404",
    completeDeleted.status === 404,
    summarize(completeDeleted),
  );

  const deletePatch = await api("PATCH", `/api/tasks/${deleteId}`, {
    action: "delete",
  });
  check(
    "PATCH delete repetido es idempotente",
    deletePatch.status === 200 && deletePatch.body?.task?.status === "deleted",
    summarize(deletePatch),
  );

  const unknownPatch = await api("PATCH", "/api/tasks/task_no_existe", {
    action: "complete",
  });
  check("PATCH id desconocido → 404", unknownPatch.status === 404, summarize(unknownPatch));

  const unknownDelete = await api("DELETE", "/api/tasks/task_no_existe");
  check("DELETE id desconocido → 404", unknownDelete.status === 404, summarize(unknownDelete));

  const deleteEndpoint = await api("DELETE", `/api/tasks/${noDateTask.body.task.id}`);
  check(
    "DELETE /api/tasks/[id] hace soft delete",
    deleteEndpoint.status === 200 &&
      deleteEndpoint.body?.task?.status === "deleted" &&
      typeof deleteEndpoint.body?.task?.deletedAt === "string",
    summarize(deleteEndpoint),
  );

  // 7 · JSON roto.
  const brokenJson = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{no es json",
  });
  check("POST con JSON roto → 400", brokenJson.status === 400);

  // 8 · Límite de 50 y auditoría.
  for (let index = 0; index < 52; index += 1) {
    await api("POST", "/api/tasks", { title: `Relleno ${index + 1}` });
  }
  const capped = await api("GET", "/api/tasks");
  check(
    "GET devuelve como máximo 50 tareas",
    capped.status === 200 &&
      Array.isArray(capped.body?.tasks) &&
      capped.body.tasks.length === 50,
    `status=${capped.status} length=${capped.body?.tasks?.length}`,
  );
  check(
    "La lista capada no incluye eliminadas",
    capped.body?.tasks?.every((item) => item.status !== "deleted") === true,
    summarize(capped),
  );

  const auditDb = new DatabaseSync(DB_PATH);
  const auditRows = auditDb
    .prepare(
      "SELECT action, COUNT(*) AS n FROM audit_log WHERE entity = 'task' GROUP BY action",
    )
    .all();
  const auditCounts = Object.fromEntries(
    auditRows.map((row) => [row.action, Number(row.n)]),
  );
  auditDb.close();
  check(
    "audit registra crear/completar/reabrir/posponer/eliminar",
    auditCounts["task.create"] >= 1 &&
      auditCounts["task.complete"] >= 1 &&
      auditCounts["task.reopen"] >= 1 &&
      auditCounts["task.postpone"] >= 1 &&
      auditCounts["task.delete"] >= 1,
    JSON.stringify(auditCounts),
  );

  // 9 · Persistencia tras reiniciar el servidor con la misma SQLite.
  const beforeRestart = await api("GET", "/api/tasks");
  const survivor = beforeRestart.body?.tasks?.find((item) => item.id === task.id);
  await stopServer();
  await startServer();
  const afterRestart = await api("GET", "/api/tasks");
  const survivorAfter = afterRestart.body?.tasks?.find((item) => item.id === task.id);
  check(
    "Las tareas sobreviven el reinicio del servidor",
    survivorAfter?.id === task.id &&
      survivorAfter?.status === survivor?.status &&
      survivorAfter?.postponedUntil === survivor?.postponedUntil,
    `antes=${JSON.stringify(survivor)} después=${JSON.stringify(survivorAfter)}`,
  );
  check(
    "La tarea eliminada sigue fuera después del reinicio",
    afterRestart.body?.tasks?.every((item) => item.id !== deleteId) === true,
  );

  const finalList = await api("GET", "/api/tasks");
  check(
    "GET final responde 200 y no expone status deleted",
    finalList.status === 200 &&
      finalList.body?.tasks?.every((item) => item.status === "open" || item.status === "done") ===
        true,
    summarize(finalList),
  );

  console.log("");
  console.log(
    `${passed} PASS · ${failed} FAIL · ${passed + failed} checks · puerto ${PORT} · DB temporal`,
  );
  if (failed > 0) {
    console.log("Fallos:");
    for (const failure of failures) {
      console.log(`- ${failure.name}${failure.detail ? ` — ${failure.detail}` : ""}`);
    }
    process.exitCode = 1;
  }
}

process.on("SIGINT", async () => {
  await stopServer();
  cleanupDb();
  process.exit(130);
});

try {
  await main();
} catch (error) {
  console.error(
    `\nNo se pudo correr el contrato: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
} finally {
  await stopServer();
  cleanupDb();
}
