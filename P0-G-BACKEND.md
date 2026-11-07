# P0-G · Backend y componente de “Pendientes” de negocio

> Rama `p0/pendientes-negocio` · base `be26105` · 1 de noviembre de 2026.
> Alcance de este corte: **datos + API + componente autocontenido**. El quinto tab
> **no** está integrado en `caja-app.tsx`; ese es el paso siguiente.
> No se tocaron pagos, webhook, pey, `/api/verify`, `paymentTruth` ni `caja-app.tsx`.

## 1 · Archivos

| Archivo | Cambio |
|---|---|
| `web/src/lib/db.ts` | Tabla `tasks`, índices y limpieza en `resetDemoData()` |
| `web/src/lib/types.ts` | `Task` y `TaskStatus` |
| `web/src/lib/tasks.ts` | Dominio, validación, orden y auditoría |
| `web/src/app/api/tasks/route.ts` | `GET` y `POST` |
| `web/src/app/api/tasks/[id]/route.ts` | `PATCH` y `DELETE` |
| `web/src/components/pending-tasks.tsx` | `PendingTasksPanel`, autocontenido |
| `web/scripts/tasks-contract.mjs` | Contrato de API en `:3101` con SQLite temporal |

## 2 · Datos

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | done | deleted
  due_at TEXT,
  postponed_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);
```

- La migración es compatible con una DB existente: `CREATE TABLE IF NOT EXISTS`
  agrega la tabla sin tocar pedidos, pagos, fiado, corte ni metas.
- `deleted` es **soft delete**. La fila se conserva para trazabilidad y no vuelve
  a aparecer en `GET /api/tasks`.
- No hay `merchant_id` porque el prototipo sigue siendo de una sola comerciante.
  Si se agrega multi-negocio, habrá que migrar la tabla y el filtro de la API.
- `resetDemoData()` ahora también vacía `tasks`; un reset de demo deja la
  bandeja limpia.
- Fecha efectiva para ordenar y mostrar: `postponed_until ?? due_at`.
  Posponer **no borra** `due_at`; la UI muestra la fecha pospuesta.

## 3 · API

Todas las respuestas son JSON. Los errores usan `{ "error": "texto para la
persona", "code"?: "..." }`.

### `GET /api/tasks`

- Dinámico con `await connection()`: no se sirve desde un snapshot de build.
- Devuelve `{ tasks: Task[] }` con `open` y `done` (máx. 50, nunca `deleted`).
- Orden: abiertas primero; dentro de abiertas, por fecha efectiva ascendente
  (vencidas primero) y después las que no tienen fecha, por creación. Las hechas
  van después, por `completed_at` descendente.

### `POST /api/tasks`

```json
{ "title": "Pagar al proveedor", "note": "Tomás pasa a las 11", "dueAt": "2030-01-15" }
```

- `title`: obligatorio, 1–120 caracteres después de recortar espacios.
- `note`: opcional, ≤ 500 caracteres; una nota vacía se guarda como `null`.
- `dueAt`: opcional, `AAAA-MM-DD` o ISO 8601. Una fecha sin hora se ancla a
  mediodía de México (`-06:00`) y se guarda como ISO UTC.
- Responde `201 { task }`.

### `PATCH /api/tasks/[id]`

```json
{ "action": "complete" | "reopen" | "postpone" | "delete", "postponeUntil": "..." }
```

| Acción | Efecto |
|---|---|
| `complete` | `status=done`, `completed_at=now`; repetirla es idempotente |
| `reopen` | `status=open`, `completed_at=null`; repetirla no duplica |
| `postpone` | `postponed_until=ISO`, `updated_at=now`; exige fecha futura y no completa |
| `delete` | `status=deleted`, `deleted_at=now`; repetirla devuelve la misma fila |

- Posponer una tarea `done` responde **409** con un mensaje que pide reabrirla.
- Posponer sin `postponeUntil` o con fecha pasada/inválida responde **400**.
- Un id inexistente responde **404**. Una tarea eliminada responde **404** para
  cualquier acción distinta de `delete`.
- Responde `200 { task }`.

### `DELETE /api/tasks/[id]`

- Soft delete idempotente.
- `200 { task }` si existe (incluida una ya eliminada); `404` si el id no existe.

### Validación y códigos

| Código | Cuándo |
|---|---|
| `title_required` | título vacío o solo espacios |
| `title_too_long` | título > 120 |
| `note_too_long` | nota > 500 |
| `invalid_date` | fecha no ISO, imposible (`2026-02-31`) u hora inválida |
| `date_not_future` | `postponeUntil` en el pasado o ahora |
| `task_done` | posponer una tarea ya completada |
| `not_found` | id inexistente o eliminado |

Las fechas con hora pero sin offset se interpretan como hora de México; las que
traen `Z` u offset se respetan. El servidor siempre responde ISO UTC.

### Auditoría

Cada transición real escribe en `audit_log` con `entity='task'`:

- `task.create`, `task.complete`, `task.reopen`, `task.postpone`, `task.delete`.
- Repetir una acción idempotente no duplica la auditoría.

## 4 · Componente

`web/src/components/pending-tasks.tsx` exporta `PendingTasksPanel` (named y
default). No importa nada de `caja-app.tsx`; maneja su propio fetch y estado.

### Props

| Prop | Tipo | Default | Uso |
|---|---|---|---|
| `apiBase` | `string` | `/api/tasks` | Base de la API; sirve para pruebas o un prefijo |
| `headingId` | `string` | generado | Id del `h1` para que el shell lo enfoque al cambiar de tab |
| `onTasksChange` | `(tasks: Task[]) => void` | — | Lista vigente tras cargar o mutar; opcional para un badge del tab |

### Estados

- **Loading:** skeleton breve con `role="status"` y texto solo para lectores.
- **Error inicial:** “No pude cargar tus pendientes” + detalle + **Reintentar**.
  Nunca se muestra el estado vacío cuando falló la red.
- **Error con datos previos:** banner “Esto es lo último que vi” + Reintentar,
  conservando la lista.
- **Vacío:** “No hay pendientes. Anota algo para después.” + botón.
  Si solo quedan hechas: “No hay pendientes abiertos.”
- **Acción fallida:** banner `role="alert"` con el mensaje del servidor y Cerrar.
- **Guardando:** acciones deshabilitadas y `aria-busy` por fila; el doble clic no
  dispara dos peticiones (guarda en vuelo por id).

### Interacciones

- **Anotar pendiente:** formulario inline con título, nota y fecha opcional.
  Valida en cliente y enfoca el primer campo inválido. Al guardar, cierra el
  formulario y enfoca la nueva tarea.
- **Completar:** botón `role="checkbox"` de 48 px con check visible. Al completar,
  la sección “Hechas” se abre y el foco pasa a la siguiente tarea abierta (o a
  “Anotar pendiente”).
- **Posponer:** menú inline con “Más tarde hoy” (+3 h), “Mañana” (9:00 de México),
  “En una semana” (9:00 de México) y “Elegir fecha” (mediodía de México). Escape
  cierra el menú.
- **Eliminar:** confirmación inline, sin `window.confirm`; el foco va a Cancelar,
  Escape cancela y la acción destructiva queda separada de Completar.
- **Hechas:** sección colapsable con contador y **Reabrir**.

### Accesibilidad y tamaño

- Objetivos táctiles de 48 px como mínimo; botones, inputs y check de completar.
- Foco visible global (`:focus-visible`, 3 px) y manejo de foco después de crear,
  completar, reabrir, posponer y eliminar.
- Teclado de punta a punta; `aria-expanded`, `aria-controls`, `aria-live` para
  anuncios y `role="alert"` para errores.
- Sin colores como única señal: los estados llevan texto (“Pospuesto”, “Venció”,
  “Hecho”).
- Probado con 360 px y con base tipográfica de 20 px (equivalente al 200 % del
  shell): sin scroll horizontal y sin palabras partidas en el H1.

## 5 · Punto de integración del quinto tab

Siguiente carril, **sin tocar este componente**:

1. En `web/src/components/caja-app.tsx`, ampliar
   `type Tab = "caja" | "fiado" | "corte" | "meta" | "pendientes"`.
2. Agregar el destino a `TABS`:
   ```tsx
   { id: "pendientes", label: "Pendientes", icon: ListTodo }
   ```
   Verificar a 360 px si cinco tabs con label caben. Si no, el plan ya contempla
   una fila superior o un tab “Más”; no reducir el objetivo táctil.
3. Importar `PendingTasksPanel` y montarlo en el `main` cuando `tab === "pendientes"`:
   ```tsx
   <PendingTasksPanel
     headingId="pendientes-heading"
     onTasksChange={(tasks) => setOpenTaskCount(tasks.filter((t) => t.status === "open").length)}
   />
   ```
   No duplicar tareas en el estado de `caja-app`; el componente ya hace fetch.
4. No envolverlo en `ScreenHeading`: el componente renderiza su propio `h1`
   “Pendientes” con el subtítulo “Lo que queda para después.”
5. Revisar que el sidebar y la tab bar inferior usen el mismo `TABS` para que
   `aria-current` y el estado activo funcionen sin lógica extra.
6. Probar: cambiar de tab no dispara venta ni cobro; recargar vuelve a Caja como
   hoy; el quinto tab no rompe 360 px, 200 % ni el orden de teclado.

## 6 · Pruebas ejecutadas

| Gate | Resultado |
|---|---|
| `npm ci` | **PASS** (385 paquetes; warnings de npm, sin errores) |
| `npm run lint` | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** (22 rutas; `/api/tasks` y `/api/tasks/[id]` dinámicas) |
| `npm run verify:fast` | **PASS 3/3** (guard, lint, types) |
| `node scripts/tasks-contract.mjs` | **PASS 37/37** |

`tasks-contract.mjs` levanta `next start` en `:3101` con `DATABASE_PATH` temporal,
prueba creación, validación, completar/reabrir/posponer/eliminar, orden, límite de
50, auditoría y persistencia tras reiniciar el servidor. Al terminar mata el
servidor y borra la DB. **No toca `:3000` ni la base de la demo.**

Además se verificó el componente en una página temporal de preview (eliminada
después, no está en el commit) con Playwright: **16/16** comprobaciones de estados,
foco, teclado, confirmación inline, error de red que no se disfraza de vacío,
objetivos de 48 px, 360 px y formulario con texto largo a 200 %. Es evidencia
manual de este corte, no un E2E versionado.

### Nota de verificación

`verify:fast` se corrió una vez después de borrar la página temporal y falló por
tipos generados obsoletos en `web/.next/types` que aún referenciaban esa página.
Tras `npm run build` limpio, `npx tsc --noEmit`, `npm run lint` y el segundo
`verify:fast` pasan. La evidencia autogenerada (`harness/evidence/latest.json`)
se revirtió para no firmar un snapshot de un commit que aún no existía.

## 7 · KNOWN / pendientes

- **El quinto tab no está integrado.** El componente existe y compila, pero
  `caja-app.tsx` no lo importa.
- No hay E2E de UI versionado para este módulo (`web/scripts/tasks-contract.mjs`
  solo cubre la API). El siguiente carril debe añadir el E2E de Playwright en
  `:3101` con DB temporal, incluidos 360 px y 200 % ya integrados al shell.
- No hay auth, multi-negocio ni separación por comerciante. La API asume una sola
  comerciante, igual que el resto del prototipo.
- La lista devuelve como máximo 50 tareas abiertas + hechas. Con muchas tareas
  abiertas, las hechas antiguas dejan de aparecer; no hay paginación ni archivo.
- No hay recordatorios, notificaciones, push, tareas recurrentes ni jobs en
  segundo plano. `due_at`/`postponed_until` solo ordenan y rotulan.
- Posponer no actualiza `due_at`; la fecha efectiva es `postponed_until ?? due_at`.
  Si se necesita historial de posposiciones, hoy solo queda en `audit_log`.
- La zona horaria de México se asume fija en UTC-6, como el resto del repo.
- `resetDemoData()` borra también las tareas manuales. Es intencional para una
  demo limpia, pero conviene avisarlo antes de un reset en producción.
- El módulo no debe mostrarse durante el cobro ni interrumpir la venta; esa
  restricción se implementa al montarlo en el shell, no aquí.
