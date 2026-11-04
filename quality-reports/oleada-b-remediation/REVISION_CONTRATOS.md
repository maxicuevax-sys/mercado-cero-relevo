# Revisión de contratos — corrección demo-only de `POST /api/demo/pay`

> **Rol:** `mc-auditoria-repo` · **Modo:** solo lectura, sin edición de producto y sin commits.
> **Fecha:** 2026-11-04 · **HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`.
> **Objeto:** validar los contratos de la corrección del P1 de doble pago/idempotencia en el cobro demo.
> **Artefacto escrito:** este documento. La sonda de validación fue temporal, fuera del repo.

---

## 0. Veredicto

- **Producto:** **APROBADO**. No encontré P0 ni P1 de dinero, seguridad o integridad en el código revisado. El guard `orders.demo=1`, el lock de escritura, la relectura de `SUM(payments)`, las llaves deterministas, el replay y el rollback están bien resueltos.
- **Cierre formal / merge:** **NO-GO temporal** por dos P1 de evidencia/proceso:
  1. `npm run verify:fast` **no puede pasar**: su gate `guard` falla. `web/scripts/harness-guard.mjs:61-65` sigue exigiendo el literal `provider: "demo"` dentro de la ruta, y la ruta ahora delega en `demo-payments.ts`.
  2. El test A-J es real (no simula el resultado), pero **no cumple la matriz acordada**: 1 ronda en vez de 6/6, sin lock externo que fuerce la carrera, sin varios casos exigidos por el análisis y sin atar la evidencia a un commit limpio / `buildSha`.
- **Conclusión:** la corrección de producto es apta; el P1 **no puede declararse cerrado** hasta actualizar el guard, completar el test (o documentar un waiver explícito) y repetir build + A-J + gates sobre un árbol limpio.

---

## 1. Alcance verificado

Archivos del cambio:

| Archivo | Estado | Rol |
|---|---|---|
| `web/src/lib/demo-payments.ts` | nuevo | Núcleo demo-only: transacción, guard `demo=1`, llaves, replay, errores |
| `web/src/app/api/demo/pay/route.ts` | modificado | Validación Zod + delegación; sin SQL de dinero |
| `web/scripts/p0-demo-pay-contract.mjs` | nuevo | Contrato A-J/K con dos procesos y SQLite temporal |

No modificados (confirmado con `git diff --name-only` y `git status`):

- `web/src/lib/orders.ts`, `web/src/lib/db.ts`, `web/src/lib/payment-rules.ts`
- `web/src/app/api/webhooks/pey/route.ts`, `web/src/lib/pey*.ts`
- `web/src/app/api/verify/route.ts`
- `web/src/lib/checkout.ts`, `web/src/app/pay/**`, `web/src/components/**`
- `web/package.json` y `web/scripts/harness-guard.mjs`

`git diff --name-only` devuelve únicamente `web/src/app/api/demo/pay/route.ts`. Los otros dos archivos del cambio son untracked. No hay archivos financieros modificados fuera del alcance.

---

## 2. Checklist contractual

### 2.1 `orders.demo=1` validado desde DB — **CUMPLE**

`demo-payments.ts:342-359` hace un `SELECT` crudo dentro de la transacción:

```sql
SELECT id, demo, status, total_cents, credit_cents, payment_link_id
FROM orders
WHERE id = ? AND merchant_id = ?
```

y corta con `409 demo_order_required` si `Number(row.demo) !== 1`. No usa `getOrder` para el guard (que en modo demo devolvería también pedidos `demo=0`). El filtro `merchant_id` también está presente. Además, `isDemoMode()` se comprueba en la ruta (`route.ts:26-31`) y otra vez en el helper (`demo-payments.ts:322-328`).

Verificación en vivo: el pedido real creado en modo real (`demo=0`) responde `409 demo_order_required` desde el servidor demo y no recibe pagos ni eventos (test A, y `p0-demo-pay-contract.txt`).

### 2.2 `BEGIN IMMEDIATE`, `SUM(payments)`, `recordPayment`, sin `await` — **CUMPLE (producto); PARCIAL (evidencia)**

- `BEGIN IMMEDIATE` se toma **antes** de leer el pedido (`demo-payments.ts:334`).
- El saldo se calcula dentro del lock con `SUM(amount_cents)` de `payments` con `status='paid'`, no con `orders.paid_cents` (`demo-payments.ts:369-382`). Es la fuente de verdad del dinero.
- La función es **síncrona**: no hay `async` ni `await` en `demo-payments.ts` (grep confirmado). El `await` de la ruta ocurre antes, en `readJsonLimited` (`route.ts:38`).
- `recordPayment` se llama dentro de la transacción externa (`demo-payments.ts:482-494`); su `SAVEPOINT` interno (`orders.ts:560`) anida correctamente. Si falla, su `finally` revierte al savepoint y el `finally` externo hace `ROLLBACK` total (`demo-payments.ts:511-523`).
- La auditoría de `recordPayment` (`orders.ts:605-611`) también queda dentro de la transacción.

La carrera de **dos `requestId` distintos** no está en el test A-J, pero la validé con una sonda temporal de dos procesos contra el mismo SQLite: dos POST simultáneos con llaves distintas dejaron **1 pago, `SUM=10000`** y una respuesta `alreadySettled`. También pasó la carrera con **llave automática** (sin `requestId`): 1 pago. El código es correcto; el test versionado no cubre ese caso (ver P1-2).

### 2.3 Unicidades, misma `requestId`, replay — **CUMPLE**

- `payment_events.idempotency_key` es `UNIQUE NOT NULL` (`db.ts:156-165`; índice `sqlite_autoindex_payment_events_2` verificado en la DB real).
- `payments.transaction_id` es `UNIQUE` (`db.ts:141-154`; índice `sqlite_autoindex_payments_2` verificado).
- Llaves (`demo-payments.ts:75-85`):
  - `demo:pay:v1:req:<merchant>:<requestId>`
  - `demo:pay:v1:auto:<merchant>:<orderId>:<dueCents>`
  - `transactionId = demo_txn_<sha256({key}).slice(0,40)>`
- Misma `requestId` con **otro pedido**: `payload.orderId !== row.id` → `409 idempotency_conflict` (`demo-payments.ts:213-218`).
- Misma `requestId` con **otro método**: solo para llaves `req:` → `409 idempotency_conflict` (`demo-payments.ts:220-230`). La llave automática no tiene identidad de método por diseño (ver P2-3).
- Replay coherente (`demo-payments.ts:240-306`):
  - Pago existente y consistente → `recordPayment` con el mismo `transactionId` no inserta, cura la orden vía `healOrderFromPayments`, devuelve `duplicate: true` y el mismo `transactionId`.
  - Evento `processed` sin pago → `409 idempotency_incomplete` (falla cerrado).
  - Evento sin pago y saldo distinto → `409 idempotency_state_changed`.
  - Evento sin pago y mismo saldo → `409 idempotency_incomplete`.
  - `rejected`/`ignored` → `409 idempotency_conflict`.
- El replay ocurre **antes** del no-op por saldo 0 para llaves `req:` (`demo-payments.ts:384-399`), de modo que un reintento después de una respuesta perdida devuelve `duplicate` y no un 409 por “importe distinto”. Correcto.
- La llave automática se busca **después** del no-op por saldo 0 (`demo-payments.ts:401-431`); un reintento sin `requestId` sobre un pedido ya cubierto devuelve `alreadySettled` (test F), coherente.
- `transactionIdFor` es determinista entre procesos y reinicios: SHA-256 de la llave, sin aleatoriedad. El test H lo prueba indirectamente (tras reiniciar, el replay encuentra el pago y no inserta otro).

### 2.4 Verdad real/pey/webhook, `paid`, `demo_paid` — **CUMPLE**

- No se tocó el webhook de pey, `pey.ts`, `pey-events.ts`, `verify` ni `checkout`.
- El nuevo pago se inserta con `provider: "demo"` (`demo-payments.ts:483`), y `recordPayment` marca `demo=1` por `provider === "demo"` (`orders.ts:591`).
- `recalculateOrderTotals` elige el estado con `coveredStatus(isDemoPayment ? "demo" : "pey")` (`orders.ts:681-687`); con el pago demo más reciente, el estado es `demo_paid`, nunca `paid`.
- El nuevo archivo **no escribe** el estado `paid` en ningún punto. El test B comprueba `demo_paid`; el test K comprueba que un fallo no cambia el estado.
- `/api/verify` solo busca `provider = 'pey'` (`verify/route.ts:74-80`). Un `transactionId` de `/api/demo/pay` responde `verified: false` (sonda P3; el `reason` es `not_found`, ver P2-9). No se presenta como dinero real.
- Evidencia aportada por el carril (no re-ejecutada por mí): `p0-other-after.txt` muestra webhook 40/40, checkout 19/19, p0-fiado 51, p0-corte 69 y p0-integracion 51, todos PASS; `p0-dinero-after.txt` muestra p0-dinero 45 PASS / 0 FAIL / 3 KNOWN. Todos quedaron en modo `partial` por árbol sucio, pero no muestran regresión funcional.

Matiz preexistente: un pedido **demo pagado totalmente en efectivo** al crearse queda en `paid` (`orders.ts:328-335`), no `demo_paid`. El nuevo endpoint no cambia eso; si se llama sobre él, devuelve `alreadySettled` sin escribir. Es una etiqueta preexistente, fuera del alcance de este parche (P2-8).

### 2.5 Errores seguros — **CUMPLE**

- Los errores de dominio son `AppError`/`ConflictError`/`NotFoundError` con mensajes propios (`demo-payments.ts:98-104, 144-177, 198-305, 351-359, 436-452`).
- La ruta los traduce con `appErrorResponse` (`route.ts:82-88`); lo inesperado va a `internalErrorResponse("demo pay", error)` (`route.ts:88`), que loguea en servidor y devuelve un mensaje genérico (`http-security.ts:364-371`, `errors.ts:72-82`).
- El test K fuerza un fallo de SQLite con un trigger: responde **500** y no deja evento ni pago. La respuesta no se asserta por contenido, pero el camino usa `internalErrorResponse`; no hay `error.message` de SQLite en el cliente.
- No se devuelven detalles de SQL, constraints ni stack traces. Los códigos nuevos (`demo_order_required`, `order_cancelled`, `order_state_inconsistent`, `idempotency_*`, `demo_pay_busy`) son estables y accionables.

### 2.6 `requestId` opcional y llave automática estable — **CUMPLE con matices**

- El body actual `{ orderId, method }` sigue siendo válido; `method` conserva default `"card"` y `cash` sigue dando 400 (`route.ts:15-23`).
- `requestId` es `.nullish()`: acepta ausente, `null`, `""` y espacios; el helper los normaliza a `null` y usa la llave automática (`demo-payments.ts:63-73`).
- La llave automática es una función pura de `MERCHANT.id + orderId + dueCents`; estable entre procesos y reinicios. La sonda de dos procesos la ejercitó con éxito. El test versionado solo la prueba en un proceso (I).
- La llave `req:` incluye el `requestId` recortado y es case-sensitive; `" R "` y `"R"` comparten llave, `"R"` y `"r"` no. Es consistente con `orders.ts`.
- Matiz de compatibilidad: un cliente que antes enviaba un `requestId` inválido (p. ej. numérico o de >128 chars) era **ignorado** por el esquema Zod viejo (strip de claves desconocidas); ahora recibe **400**. Es el comportamiento deseado del nuevo contrato, pero conviene documentarlo. El mensaje para un `requestId` no-string dice “no puede pasar de 128 caracteres”, aunque el problema sea el tipo (P2-6).
- La respuesta ahora incluye siempre `transactionId`, `duplicate` y `alreadySettled` (con `null`/`false`), mientras que la ruta vieja omitía algunos. Los clientes actuales ignoran campos extra; las UIs revisadas solo leen `order`/`error` (`caja-app.tsx:2038-2044`, `payment-panel.tsx:111-118`, `checkout-client.tsx:181-191`). Compatible.

### 2.7 Test A-J — **REAL, PERO INCOMPLETO**

El test **no simula** el resultado: crea pedidos reales por HTTP, arranca dos procesos `next start` sobre el mismo SQLite temporal, consulta la DB con `node:sqlite`, reinicia servidores y usa un trigger real para forzar el fallo. Eso es valioso y es la parte correcta.

Pero no cubre la matriz que el propio análisis fijó para cerrar el P1 (`ANALISIS_VENTAS_PAGOS.md` §5.1, §5.2, §8.4, §8.5):

- **D/H: una sola ronda, no 6/6.** `p0-demo-pay-contract.mjs:227-250` ejecuta una carrera y un reinicio. El análisis exige 6 rondas para imitar la reproducción 3/6 de la auditoría.
- **No fuerza la carrera.** El análisis pide abrir `BEGIN IMMEDIATE` en una tercera conexión, disparar los dos POST, esperar y liberar; el test solo usa `Promise.all`. Si el primer POST termina antes de que arranque el segundo, el test pasa sin ejercer contención.
- **No prueba la carrera con llave automática** (el caso de las UIs actuales, que no envían `requestId`). I solo la prueba secuencial en un proceso (`:252-260`).
- **Faltan casos del análisis:** G2 (mismo `requestId`, otro importe sin pago), I(b) pedido cancelado, I(c) `paid`/`demo_paid` con `due>0`, I(d) `fulfilled` con `due>0`, J2 (evento sin pago), J3 (pago sin evento), J5 (`/api/verify` con demo) y J6 (invariantes globales). El código los maneja por inspección, pero el test no los prueba.
- **No ata la evidencia al build/commit.** Solo comprueba que exista `.next/BUILD_ID` (`:161-163`); no lee `health.buildSha`, no compara con `git rev-parse HEAD` y no exige árbol limpio. El build actual tiene `BUILD_SHA` = HEAD `4130e71`, pero fue construido sobre un árbol sucio. Los `latest*.json` existentes no cubren el cambio: `latest-static.json` es de HEAD `4130e71` con `gitAtStart.dirty:false` a las 16:59Z (antes de las fuentes, 18:15/18:18) y `latest.json` es de otro SHA (`9206ea`).
- **No hay invariantes finales** (ningún `demo=0` con pagos demo, ningún `paid_cents>total`, todo pago demo con evento, todo evento procesado con pago). El test B/H comprueba conteos locales, no el estado global.

Sonda temporal (misma build, no versionada) para los huecos de dinero más importantes:

```text
PASS  dos requestId distintos no duplican dinero — codes=200/200 payments=1 sum=10000
PASS  al menos una respuesta fue no-op/replay
PASS  llave automática en carrera no duplica — codes=200/200 payments=1 sum=10000
PASS  pago demo válido — 200
PASS  verify no confirma un pago demo — 200 "not_found"
PASS  pedido demo queda demo_paid, no paid — demo_paid paid=5000
PASS  sin sobrepago demo — n=0
PASS  sin pedidos reales contaminados — n=0
PROBE — OK
```

Esto demuestra que el producto aguanta los dos casos que el test versionado no cubre, pero **no sustituye** el test comprometido ni la evidencia formal.

### 2.8 Riesgos de bloqueo, rollback, huérfanos, reset y datos corruptos — **ACEPTABLE CON FOLLOW-UPS**

- **`SQLITE_BUSY`:** `busy_timeout=5000` (`db.ts:86`), `BEGIN IMMEDIATE` mapea busy a `503 demo_pay_busy` (`demo-payments.ts:91-104`). El test G acepta 503 pero no lo fuerza. `node:sqlite` es síncrono: el proceso puede bloquear su event loop hasta 5 s; es el trade-off documentado en el análisis (R9). No hay `Retry-After` en el 503 (P2-5).
- **Rollback:** `finally` externo (`demo-payments.ts:511-523`) y savepoint interno de `recordPayment`. El test K prueba un fallo en el `INSERT` del pago: no queda evento, ni pago, ni cambio de orden. No se probó un fallo en el `UPDATE` de la orden (el análisis lo pedía); por inspección, el savepoint y el rollback externo lo cubren, pero falta evidencia.
- **Evento/pago huérfano:** en operación normal, evento + pago + orden + auditoría son una sola transacción; no hay ventana de autocommit como en la ruta vieja. Un evento preexistente `processed` sin pago se detecta y da 409; un pago sin evento con `due>0` da 409. No se crea dinero. El test K prueba el rollback; J2/J3 no están.
- **Reset demo:** `resetDemoData` borra pedidos/pagos demo pero **no** `payment_events` (`db.ts:2043-2064`). Después de un reset quedan eventos demo `processed` sin pago. Si se reutiliza el mismo `requestId`, el replay da 409; si un pedido preservado por un pago pey queda con el mismo `due` que la llave automática vieja, también puede dar 409. No crea dinero, pero puede bloquear un cobro demo legítimo tras un reset. Es el R12/R14 conocido; follow-up (P2-1).
- **Datos ya corruptos:** el parche es forward-looking. Un pedido `demo_paid`/`paid` con `due>0` da 409 `order_state_inconsistent`; un `paid_cents` viejo no se usa para el saldo (se usa `SUM(payments)`); un `paid_cents>total` no recibe otro pago. Lo que **no** hace es reparar filas viejas ni curar `paid_cents`/estado en la rama `alreadySettled` (P2-2). No se debe “arreglar” marcando `paid` sin evidencia pey (regla de oro).
- **Reset concurrente:** `resetDemoData` también usa `BEGIN IMMEDIATE` (`db.ts:2037`); el pago demo y el reset se serializan. La respuesta usa el `Order` leído dentro de la transacción. Si el reset gana después del commit, el cliente puede ver éxito de un pedido ya borrado; es destructivo por diseño (R11).

### 2.9 `git diff --check`, typecheck/lint y archivos financieros — **CUMPLE**

- `git diff --check` → exit **0**; solo el aviso de CRLF en `route.ts` (no es error de whitespace).
- `npx tsc --noEmit` → exit **0**, sin salida.
- `npx eslint src/lib/demo-payments.ts src/app/api/demo/pay/route.ts scripts/p0-demo-pay-contract.mjs` → exit **0**, sin salida.
- `git diff --name-only` → solo `web/src/app/api/demo/pay/route.ts`. `git status` → nuevos `demo-payments.ts` y `p0-demo-pay-contract.mjs`; nada de `orders.ts`, `db.ts`, webhook, pey, verify, checkout ni UI.
- **No** ejecuté `npm run verify:fast` completo; ejecuté su gate `guard` directamente y **falla** (P1-1), además de lint/typecheck por separado. Tampoco ejecuté un build nuevo; el build existente es de las 12:22 local y las fuentes son de las 12:15/12:18 local, pero el árbol está sucio.
- Los `harness/evidence/latest*.json` existentes **no corresponden a este cambio**: `latest-static.json` es de HEAD `4130e71`, limpio, 16:59Z (anterior a las fuentes del cambio) y `latest.json` es de `9206ea`. Los `p0-*-after.txt` del carril son `partial` y `gitAtStart.dirty=true`.

---

## 3. Hallazgos

### P0 — ninguno

No encontré forma de:

- pagar un pedido `demo=0` desde el endpoint demo (409 antes de escribir);
- cobrar en modo real (403 antes de leer el body);
- duplicar dinero con dos `requestId` distintos, misma `requestId` o llave automática (lock + `SUM` + unicidades; probado en vivo en los dos casos que el test no cubre);
- dejar evento/pago huérfano por un fallo del `INSERT` del pago (transacción + trigger K);
- marcar `paid` desde `/api/demo/pay` (el pago es provider demo y `recordPayment` resuelve `demo_paid`);
- filtrar SQL/constraints al cliente (500 genérico en K; `AppError` para dominio).

### P1 — bloquean el cierre formal (no el runtime)

#### P1-1. `verify:fast` rojo por el guard de `demo/pay`

`web/scripts/harness-guard.mjs:61-65` lee **solo** `web/src/app/api/demo/pay/route.ts` y exige el literal `provider: "demo"`. La ruta ya no lo contiene: delega en `recordDemoPayment`; el provider vive en `web/src/lib/demo-payments.ts:60` (`EVENT_PROVIDER = "demo"`) y se pasa en `:483` (`provider: EVENT_PROVIDER`).

Reproducción:

```text
$ node scripts/harness-guard.mjs
PASS  ...
FAIL  demo/pay declara provider demo
1 guardrail(s) fallaron.   (exit 1)
```

`harness-gate.mjs:379` incluye `guard` en `--fast`, y `AGENTS.md` exige `npm run verify:fast` como mínimo antes del reporte. Por tanto, el cambio **no puede pasar el gate mínimo** tal como está.

**Fix (fuera de producto):** actualizar el guard para leer `web/src/lib/demo-payments.ts` y verificar `EVENT_PROVIDER = "demo"` y `provider: EVENT_PROVIDER` (o ambas rutas), y volver a correr `npm run verify:fast`. No se debe “arreglar” agregando un literal artificial a la ruta.

#### P1-2. Evidencia A-J incompleta y no atada a un commit limpio / build

El test es real, pero no cumple la matriz acordada para cerrar el P1:

1. **6/6 y carrera forzada:** `:227-250` hace una sola ronda y no usa el lock externo de tercera conexión que pide `ANALISIS_VENTAS_PAGOS.md` §5.1. Sin ese lock, la carrera puede serializarse y el test pasar sin contention.
2. **Llave automática:** no hay carrera multiproceso sin `requestId`; I (`:252-260`) es secuencial en un proceso. Es el camino que usan las tres UIs actuales.
3. **Casos faltantes:** G2, I(b) cancelado, I(c) `paid`/`demo_paid` con `due>0`, I(d) `fulfilled` con `due>0`, J2 evento sin pago, J3 pago sin evento, J5 verify demo, J6 invariantes globales. El código los cubre por inspección; el test no.
4. **Build/commit:** solo verifica `.next/BUILD_ID` (`:161-163`). No lee `health.buildSha`, no lo compara con HEAD y no exige árbol limpio. `.next/BUILD_SHA` es `4130e71...` (HEAD), pero el build se hizo con el árbol sucio; los `latest*.json` existentes son previos al cambio (`latest-static` de las 16:59Z; `latest` de otro SHA), así que no son evidencia de este árbol. `p0-dinero-after.txt` y `p0-other-after.txt` muestran gates PASS pero `HARNESS FALLÓ` por `partial` + `dirty`.

**Fix:** extender el test (6 rondas con lock externo, carrera auto-key, G2/I(b-d)/J2/J3/J5/J6, invariantes finales, assert de `buildSha`/clean tree) **o** documentar un waiver explícito del dueño del P1. Después, commit limpio + `npm run build` + A-J + `verify:fast`/`verify:static`/`verify:evidence`.

### P2 — follow-ups y observaciones

| ID | Hallazgo | Evidencia | Impacto | Sugerencia |
|---|---|---|---|---|
| P2-1 | **Reset demo deja `payment_events`**; eventos `processed` sin pago sobreviven. Un `requestId` reutilizado o una llave automática que coincide tras un reset puede dar 409. | `db.ts:2043-2064` (no borra `payment_events`); `demo-payments.ts:286-305` | No crea dinero; puede bloquear un cobro demo tras reset. R12/R14. | Limpiar eventos demo en `resetDemoData` o documentar “no reutilizar requestId tras reset”; retención/limpieza. |
| P2-2 | **`alreadySettled` no cura la orden.** Si `SUM(payments)` ya cubre el total pero `paid_cents`/`status` quedaron viejos, devuelve 200 con la orden stale; el branch de replay sí cura. | `demo-payments.ts:401-414`; `orders.ts:709-742` | No crea dinero; la UI puede mostrar un estado inconsistente. | Recalcular/curar dentro del lock también en el no-op, o exponer un `heal` seguro. |
| P2-3 | **La llave automática no incluye el método.** Un reintento con otro método devuelve `duplicate: true` y conserva el método original; no da 409. | `demo-payments.ts:79-81, 220-230` | Por diseño (§3.7/§3.8), pero puede sorprender a la UI. | Documentarlo; si se quiere identidad de método, la UI debe enviar `requestId`. |
| P2-4 | **`recordPayment` se traga cualquier error `UNIQUE`** y devuelve `healOrderFromPayments`; el nuevo flujo luego marca el evento `processed`. Con el pre-chequeo + `BEGIN IMMEDIATE` es inalcanzable, pero es una defensa frágil. | `orders.ts:594-601`; `demo-payments.ts:447-452, 482-500` | Teórico evento `processed` sin pago si cambia el pre-chequeo o aparece otro UNIQUE. | Estrechar el catch al `transaction_id` o verificar `findPayment` después de `recordPayment` antes de marcar `processed`. |
| P2-5 | **`isBusyError` usa `/busy/i`** y no hay `Retry-After` en el 503. Un mensaje de dominio futuro con “busy” se mapearía a 503. | `demo-payments.ts:91-104` | Bajo; error mal clasificado. | Usar `/SQLITE_BUSY|database (table )?is locked/i`; agregar `Retry-After`. |
| P2-6 | **Mensaje Zod inexacto:** un `requestId` numérico/objeto recibe “no puede pasar de 128 caracteres”. | `route.ts:65-84` | Seguro, pero confuso. | Distinguir `invalid_type` de `too_big` con un mensaje “requestId inválido”. |
| P2-7 | **Test no integrado al harness/`package.json`**; `result.json` se escribe en el temp y se borra; usa `lupita`/10000/ports fijos y `taskkill` (Windows). | `p0-demo-pay-contract.mjs:16-24, 137-141, 288-292` | El test no corre en CI/`verify:full`; poca portabilidad. | Agregar `test:demo-pay` y un gate, o documentar que es manual; escribir evidencia fuera del temp. |
| P2-8 | **Verdad preexistente:** un pedido demo pagado 100% en efectivo al crearse queda `paid`, no `demo_paid`; el endpoint devuelve `alreadySettled` sin escribir. | `orders.ts:328-335`; `demo-payments.ts:401-414` | No lo introduce el parche; el invariante “demo nunca paid” no es absoluto. | Tratar en el carril de verdad demo/real; no cambiar en este P1. |
| P2-9 | **`/api/verify` de un pago `provider=demo`** devuelve `verified:false`, pero `reason:"not_found"` (la rama `demo_payment` es para `provider=pey` + `demo=1`). | `verify/route.ts:74-80, 102-117, 159-164`; sonda P3 | Correcto en lo esencial; mensaje menos explícito. | Si la UI lo muestra, mapear `provider=demo` a un `reason:"demo_payment"`. |
| P2-10 | **Colisión de llave automática si cambia el total** y el nuevo `due` coincide con el importe viejo: el evento viejo hace replay y no se registra el nuevo saldo. | `demo-payments.ts:79-81, 293-305` | Solo con edición manual/migración del total; no hay endpoint que lo haga. | Documentar que la identidad auto es “pedido + importe”; no editar totales sin nueva llave. |

Otras notas menores:

- `payment_events` demo se inserta con `signature_valid=0` (`demo-payments.ts:467-480`); es correcto (no hay firma), pero un monitoreo que cuente `signature_valid=0` como webhook inválido debe filtrar `provider/result`. P2 de observabilidad.
- `findEvent` busca por llave sin `provider` en el SQL y valida después (`demo-payments.ts:106-115, 197-202`). El prefijo `demo:pay:v1:` evita colisiones reales; es solo estilo/defensa.
- `parsePayload` no compara `payload.requestId` con el `requestId` embebido en la llave (`demo-payments.ts:139-188`); no afecta dinero porque la identidad es la llave, pero es una validación de integridad que se podría agregar.
- La rama `alreadySettled` devuelve `transactionId: null`; la UI no lo usa. La rama de replay devuelve el `transactionId` determinista. Correcto.
- El test no verifica el cuerpo del 500 de K (no filtra SQL); el código usa `internalErrorResponse`, pero faltaría el assert.

---

## 4. Evidencia ejecutada

| Comando | Resultado |
|---|---|
| `git diff --check` | exit 0; solo warning CRLF de `route.ts` |
| `git diff --name-only` | solo `web/src/app/api/demo/pay/route.ts` |
| `npx tsc --noEmit` (en `web/`) | exit 0, sin errores |
| `npx eslint src/lib/demo-payments.ts src/app/api/demo/pay/route.ts scripts/p0-demo-pay-contract.mjs` | exit 0, sin errores |
| `node scripts/p0-demo-pay-contract.mjs` | **29 PASS · 0 FAIL** |
| `node scripts/harness-guard.mjs` | **FAIL** `demo/pay declara provider demo`; exit 1 |
| Sonda temporal de dos procesos | **8 PASS**: dos `requestId` distintos, auto-key en carrera, verify demo, invariantes |
| `git status` | `M route.ts`; `?? demo-payments.ts`; `?? p0-demo-pay-contract.mjs`; `?? quality-reports/...` |
| Build | `.next/BUILD_SHA` = `4130e71d668e5e4693a8f5b634d2d2f953d21b02`, `builtAt` 2026-11-04T18:22:13.668Z; HEAD igual; árbol sucio |
| Harness evidence | `latest-static.json` es de HEAD `4130e71`, limpio, 16:59Z (previo al cambio); `latest.json` es de `9206ea`. Ninguno cubre el árbol sucio actual. |

Evidencia aportada por el carril (no re-ejecutada por mí, y marcada `partial`/`dirty` por el harness):

- `quality-reports/oleada-b-remediation/demo-pay-contract.txt` → 29 PASS / 0 FAIL.
- `p0-dinero-after.txt` → p0-dinero 45 PASS / 0 FAIL / 3 KNOWN; `HARNESS FALLÓ` por partial+dirty.
- `p0-other-after.txt` → webhook 40/40, checkout 19/19, p0-fiado 51, p0-corte 69, p0-integracion 51; todos PASS; `HARNESS FALLÓ` por partial+dirty.
- `two-tabs-after.txt` → dos pestañas, 1 pago, orden `demo_paid`.

---

## 5. Recomendaciones priorizadas

1. **P1-1 (bloqueante):** actualizar `web/scripts/harness-guard.mjs:61-65` para validar `demo-payments.ts`/`EVENT_PROVIDER`; correr `npm run verify:fast` y confirmar verde. No tocar producto para satisfacer el guard.
2. **P1-2 (bloqueante de cierre):** extender `p0-demo-pay-contract.mjs`:
   - 6 rondas de D/H con `BEGIN IMMEDIATE` externo en una tercera conexión;
   - carrera de llave automática (sin `requestId`) en dos procesos;
   - G2, I(b), I(c), I(d), J2, J3, J5, J6 e invariantes finales;
   - assert de `health.buildSha` contra HEAD y árbol limpio.
   Si el dueño decide no extenderlo, dejar un waiver escrito que explique por qué la matriz reducida es suficiente.
3. **Cierre formal:** commit limpio (sin artefactos temporales; los reports pueden ir en su propio commit), `npm run build`, `node scripts/p0-demo-pay-contract.mjs`, `npm run verify:fast`, `npm run verify:static` (o `verify:full` si el entorno lo permite) y `npm run verify:evidence`.
4. **P2:** limpiar eventos demo en `resetDemoData` o documentar la restricción; curar en `alreadySettled`; estrechar el catch `UNIQUE`; agregar `Retry-After`; mejorar el mensaje de `requestId`; integrar el test a `package.json`/harness; mapear `provider=demo` a `reason:"demo_payment"` en verify si la UI lo necesita.
5. **No tocar** `webhook/pey/verify/reconcile/checkout/UI` en este parche. La evidencia del carril no muestra regresión en esos contratos, pero debe repetirse en el commit limpio.

---

## 6. Veredicto final

| Dimensión | Estado |
|---|---|
| Contrato de dinero demo (guard `demo=1`, lock, `SUM`, unicidades, replay) | **CUMPLE** |
| Verdad real/pey/webhook/`paid`/`demo_paid` | **CUMPLE** (sin cambios fuera de alcance) |
| Errores seguros | **CUMPLE** |
| Compatibilidad `requestId` opcional / llave automática | **CUMPLE con matices** (P2-3, P2-6) |
| Test A-J realista | **PARCIAL**: real, pero no cubre la matriz acordada (P1-2) |
| Gate mínimo `verify:fast` | **ROJO** por `harness-guard.mjs` (P1-1) |
| Evidencia formal atada a commit/build limpio | **NO**: el árbol está sucio y los `latest*.json` son previos/al otro SHA; no cubren este cambio. |

**Producto: APROBADO. Cierre: NO-GO temporal.** Con P1-1 y P1-2 resueltos (guard actualizado + test ampliado/waiver + build y gates sobre commit limpio), el P1 de `POST /api/demo/pay` puede cerrarse. Sin eso, el código es correcto pero el cierre no está probado según las reglas del repo.
