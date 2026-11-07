# Lane report — P0 fix datos

## Objetivo

- Qué se pidió: cerrar carreras, transacciones e idempotencia en pedidos, links/QR, metas, migración de `credit_payments` y `copyLegacyIntoVersioned`, con mapeo de errores HTTP y tests de contrato en un servidor aislado.
- Qué quedó fuera: no se tocó `recordPayment`, seed, webhook ni `/api/verify` (carril de dinero). No se hizo merge.

## Cambios

- Archivos:
  - `web/src/lib/orders.ts`: `createOrder` con `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`, `requestId` único, límites de ítems/descripción/cantidad/precio/total, auditoría dentro de la transacción; `attachPaymentLink`/`attachQr` transaccionales e idempotentes; conflicto de `num_ref`; errores de dominio.
  - `web/src/lib/db.ts`: migraciones de `orders.request_id`, `goal_contributions.request_id`, deduplicación de `request_id` antes de cada índice único, y `copyLegacyIntoVersioned` con `ON CONFLICT DO UPDATE` + subida de versión + `audit_log` (sin `INSERT OR IGNORE`).
  - `web/src/lib/goals.ts`: aportación transaccional con `requestId` idempotente y validación de topes.
  - `web/src/app/api/orders/route.ts`, `api/orders/[id]/route.ts`, `api/orders/[id]/pay/route.ts`, `api/goals/route.ts`, `api/goals/[id]/contribute/route.ts`, `api/credits/[id]/pay/route.ts`: Zod, límite de body, 400/404/409/413/500 sin filtrar mensajes internos.
  - `web/src/lib/errors.ts`, `web/src/lib/http.ts`: errores de dominio y lectura JSON con techo real de 32 KB.
  - `web/scripts/p0-fix-datos-contract.mjs` + `test:fix-datos`: contrato reproducible en `:3123` con DB temporal.
- Decisión técnica: la serialización de link/QR es por pedido en el proceso de Next y el attach se decide dentro de `BEGIN IMMEDIATE`; una segunda petición relee y devuelve el recurso existente. La migración deduplica conservando el primer abono y anulando la llave del resto, sin tocar montos ni saldos.
- Riesgo introducido: si se despliegan varias instancias de Next, la serialización en memoria no impide que dos procesos llamen a pey a la vez; el attach transaccional evita el doble adjunto, pero no el recurso externo huérfano. El prototipo corre una sola instancia.

## Evidencia

- `npm run lint`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- `npm run test:fix-datos`: PASS · 40/40 checks (server aislado `:3123`, DB temporal).
- `p0-venta` (`P0_BASE_URL=http://localhost:3123`): PASS · 43/43.
- `p0-corte` (`P0_BASE_URL=http://localhost:3123`): PASS · 69/69 (incluye migración vieja, legacy interrumpida y esquema ya versionado).
- `p0-fiado` (`P0_BASE_URL=http://localhost:3123`): 49 PASS · 1 FAIL esperado; el único FAIL es el check del propio script que exige `:3101`, puerto prohibido por esta tarea. Toda la funcionalidad del carril pasó.
- Gates no ejecutados: `verify:full` (requiere túnel y runtime compartido; no aplica a este worktree).
- `harness/evidence/latest.json`: no se regeneró; el carril usó tests de contrato y E2E aislados. Los JSON/PNG de evidencia que los E2E reescribieron se restauraron a la base para no ensuciar el diff.

## Verificación manual

- [x] Lo probé en la app real, no solo en tests (E2E Playwright en `:3123`).
- [ ] Revisé estados vacío/carga/error: cubierto por `p0-venta`/`p0-fiado`/`p0-corte`; no hubo cambio de UI.
- [x] Revisé 360 px y texto 200% mediante `p0-venta`/`p0-fiado`/`p0-corte`.
- [x] No hay secretos en el diff.
- [x] No marqué `paid` fuera del webhook pey; no se tocó esa ruta.

## Pendientes / KNOWN

- La UI no genera `requestId` al confirmar venta o aportar; la idempotencia durable está disponible para el cliente, pero el doble clic de la UI depende de su estado `saving`/`disabled`. Cablear llaves persistentes en `caja-app.tsx` quedó fuera de este carril para no pisar UI compartida.
- El test `p0-fiado` conserva su assert de puerto `:3101`; por la restricción de la tarea se corrió en `:3123` y ese check es el único FAIL.
- Serialización link/QR es por proceso (ver riesgo arriba).

## Ronda 2 — revisión adversarial de datos

### Cambios

- `web/src/lib/db.ts`
  - `getDb()` solo publica la conexión después de `migrate` + `seed`; si falla, cierra la conexión y deja `db = null` para reintentar en la siguiente petición.
  - `copyLegacyIntoVersioned` compara también `created_at`: una legacy más nueva actualiza la misma fila; si el `id` existe en otra `(date, version)` o la legacy es más vieja/igual, entra como versión nueva con id nuevo o siguiente versión libre. Nunca borra ni pisa una versión existente. Cada fila del merge queda auditada.
  - `cash_closes.request_id` se deduplica después del merge y antes del índice único; `dedupeRequestIds` ahora usa `SAVEPOINT` para convivir con la transacción de `migrateCashCloses`.
  - Índice de pedidos scopeado por comercio: `(merchant_id, request_id) WHERE request_id IS NOT NULL`; se elimina el índice global viejo.
  - Filtro demo en listas, totales, resumen, analytics y corte. `demo=1` se escribe al crear en modo demo en `orders`, `payments`, `credits`, `credit_payments` y `cash_closes`. Los créditos demo no se leen ni se pueden abonar en real.
  - Un corte real salta las versiones demo ocultas de la misma fecha para no chocar con `UNIQUE(date, version)`.
- `web/src/lib/orders.ts`
  - Hash canónico del payload (`items`, cash, credit, customer) en `orders.request_hash`; un `requestId` repetido con otro payload responde `409 request_id_conflict`.
  - `attachPaymentLink`/`attachQr` no degradan un pedido `paid`/`demo_paid`/`fulfilled` a `payment_pending`; además no marcan pendiente si no queda saldo.
  - `recordPayment` es atómico con `SAVEPOINT` (pago + `paid_cents` + estado + auditoría) y, en un reintento con la misma `transactionId`, recalcula la orden desde `payments` para curar un fallo anterior.
  - `fulfillOrder` bloquea `demo_paid` con `409 demo_not_deliverable`.
- `web/src/lib/goals.ts` y `web/src/lib/orders.ts` (fiado): hash canónico en `goal_contributions.request_hash` y `credit_payments.request_hash`; mismo `requestId` con otro monto/método/nota responde `409 request_id_conflict`.
- `web/src/app/api/goals/[id]/contribute/route.ts`: `requestId` obligatorio (400 si falta) para que dos POST concurrentes no sumen dos veces.
- `web/src/lib/request-hash.ts`: canonicalización estable + SHA-256.
- Tests: `p0-fix-datos-contract.mjs` ampliado; nuevos `p0-db-guards-contract.mjs` (arranque fallido, demo→real, corte demo del mismo día) y `p0-orders-atomic-contract.mjs` (attach tardío, atomicidad de `recordPayment`, curación, fulfill demo). `p0-fiado-e2e.py` actualizado al contrato 409 por monto distinto.

### Evidencia (ronda 2)

- `npm run lint`: PASS (1 warning preexistente en `harness-gate.mjs`).
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- `npm run test:fix-datos`: PASS · 58 + 20 + 7 = 85 checks.
- `npm run test:security`: PASS · 29/29.
- `npm run test:perf-data`: PASS · `ok:true`.
- `npm run test:harness`: PASS · 44/44.
- Webhook: PASS · 34/34. `verify-truth`: PASS.
- `p0-venta` (`:3180`, DB temporal): PASS · 51/51.
- `p0-fiado` (`:3180`, DB temporal): PASS · 51/51.
- `p0-corte` (`:3180` + migración `:3181`, DB temporal y migraciones viejas): PASS · 69/69.
- `p0-integracion` (`:3180`, DB temporal): PASS · 51/51.
- `p0-dinero` (`:3185`, DB temporal): PASS · 45/45 · 3 KNOWN.

### KNOWN de esta ronda

- `caja-app.tsx` (GoalCard) todavía no envía `requestId` al aportar; la ruta ahora responde 400. La UI de mobile QA ya lo enviará. No se tocó UI por alcance.
- Las filas manuales de demo creadas **antes** de esta migración no tienen `demo=1`; se siguen filtrando las fixtures por `demo_seed_*`/`demo_*` y por `provider='demo'`, pero una fila manual vieja sin marcador no se puede distinguir de una real.
- Precedencia del corte: se conserva `400 reason_required` antes de `409 version_conflict`. Es validación de formulario primero; una pestaña vieja con motivo ausente recibe primero el error de motivo. Decisión documentada, no P0.
- Un `demo_paid` ya no se puede marcar `fulfilled`; la UI no recibió la etiqueta “Demo entregado” porque no se tocó UI.
- `p0-integracion` mostró dos fallos intermitentes bajo carga compartida (audio Kokoro y crear pendiente) y pasó limpio 51/51 en la corrida final. No se cambió ningún umbral.
- Serialización link/QR sigue siendo por proceso (riesgo original).

## Ronda 3 — P0 demo→real (rama `p0/fix-demo-real`)

### Cambios

- `web/src/lib/db.ts`
  - `customers` gana `demo` y unicidad `(name, demo)`; migración reconstruye la tabla vieja (`name UNIQUE`) con `foreign_keys=OFF` y `PRAGMA foreign_key_check` antes de confirmar. Un cliente real “Juan” ya no reutiliza `demo_seed_cus_*`.
  - `findOrCreateCustomer` busca/crea por modo (`demo=0/1`) y tolera la carrera con `INSERT OR IGNORE`.
  - `listCredits`/`countCredits`/`getCredit` filtran por `credit.demo=0` en real, no por `customer_id` ni `order_id`. Un crédito real con cliente demo queda visible y pagable.
  - `getOrderRequestMatch`/`getOrderByRequestId`/`getOrderByPaymentLink`/`getOrderByNumRef` filtran el modo actual; un requestId/link/QR demo no resuelve un pedido real.
  - `goals`, `goal_contributions` y `tasks` ganan `demo`; `seedGoal`/`createGoal`/aportaciones y `createTask` lo escriben. En real se filtran `listGoals/getGoal/contribute/listTasks/countTasks/getTask`.
  - `resetDemoData` detecta datos reales en orders/payments/credits/cash_closes/goals/tasks. Sin `FORCE` responde `409 real_data_present` con desglose. Con `FORCE` borra solo filas demo y conserva pedidos, pagos, créditos, cortes, metas, pendientes y auditoría reales. Backup timestamped siempre.
- `web/src/lib/orders.ts`
  - `findOrderForRequest` responde `409 request_id_conflict` si la llave pertenece al otro modo; el INSERT traduce la colisión única a 409.
  - `fulfillOrder` consulta el crédito abierto por `order_id` (y `credit_id`), sin el filtro de visibilidad, así que un crédito real con cliente demo bloquea la entrega.
  - `attachPaymentLink`/`attachQr` no degradan `partially_paid`.
- `web/src/lib/pey-events.ts`
  - El evento exige `currency` (MXN) y `clientReferenceId`; la moneda de transacción se valida si viene.
  - Un replay con otra llave de webhook cura `paid_cents`/estado con `recordPayment` en vez de responder `ignored`; no toca transacciones de otro pedido.
- Tests: nuevo `web/scripts/p0-demo-real-contract.mjs` (32 checks) integrado en `test:fix-datos`; `p0-fix-datos-contract.mjs` cubre la migración real de `customers`; `p0-orders-atomic-contract.mjs` cubre `partially_paid`; `webhook-contract.mjs` cubre replay curador, moneda y `clientReferenceId`.

### Evidencia (ronda 3)

- `npm ci`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS (buildSha `f397419…`, árbol de trabajo previo al commit).
- `npm run test:fix-datos`: PASS · 63 + 20 + 8 + 32 = 123 checks (DB temporales, puertos aislados).
- `npm run test:security`: PASS · 48/48.
- `npm run test:perf-data`: PASS · `ok:true`.
- `npm run test:harness`: PASS · 48/48.
- Webhook aislado (`webhook-gate.mjs`): PASS · 40/40 (34 originales + 6 de replay/moneda/`clientReferenceId`).
- `p0-venta` (`:3280`, DB temporal): PASS · 65/65.
- `p0-fiado` (`:3281`, DB temporal): PASS · 51/51.
- `p0-corte` (`:3282` + migración `:3296`, DB temporal): PASS · 69/69.
- `p0-integracion` (`:3283`, DB temporal): PASS · 51/51.
- `p0-dinero` (`:3284`, DB temporal): PASS · 45/45 · 3 KNOWN.
- `npm run verify:fast`: 3/3 gates PASS; `ok:false` únicamente por árbol sucio antes del commit (comportamiento esperado del harness).

### KNOWN de esta ronda

- P2 `demo_paid` vs `paid` con webhook firmado en demo: no se cambió. El `webhook-gate` usa `DEMO_MODE=true` a propósito para ejercitar la transición del webhook firmado; convertirlo a `demo_paid` exigiría separar el modo “webhook real de prueba” del modo demo y habría dejado el gate sin cubrir `paid`. Los pagos con `provider=demo` ya nacen `demo_paid` y nunca `paid`.
- Las filas demo manuales creadas antes de esta migración y sin prefijo reservado (`demo_seed_*`, `demo_*`, `cash_demo_*`) se tratan como reales. El backfill solo marca prefijos inequívocos; es conservador para no borrar datos reales en `FORCE`.
- Un requestId cruzado responde 409 (no 404): es una llave existente en el otro modo, no un recurso ausente.
- La serialización link/QR sigue siendo por proceso (riesgo original, sin cambios).
- `p0-dinero` mantiene sus 3 KNOWN preexistentes (payload real de pey, reconciliación de red y conteo posterior al cierre).
