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
