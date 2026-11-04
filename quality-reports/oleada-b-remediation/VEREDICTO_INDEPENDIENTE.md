# VEREDICTO INDEPENDIENTE — P1 `POST /api/demo/pay`

> **Rol:** `mc-verificador-final`. Verificación adversarial, solo lectura y ejecución de pruebas.
> **No implementé, no corregí producto y no hice commits.**
> **Fecha:** 2026-11-04 · **Repo:** `mercado-cero` · **Rama:** `design/oleada-b-caja-ventas`
> **HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02` · **Build:** `BUILD_SHA = 4130e71...`, `builtAt = 2026-11-04T18:48:39.119Z`
> **Árbol:** sucio. Dos modificados (`route.ts`, `harness-guard.mjs`) y dos nuevos (`demo-payments.ts`, `p0-demo-pay-contract.mjs`), más los documentos de `quality-reports/`.

---

## 0. Veredicto en una línea

- **Producto / demo local:** **P1 CERRADO LOCALMENTE**. No encontré P0 ni P1 de dinero, integridad o seguridad en el código de la remediación. El guard `orders.demo=1`, el lock, la relectura de `SUM(payments)`, las llaves persistentes, la transacción única y los códigos 404/409/503 se comportan como se espera en las pruebas ejecutadas.
- **Cierre formal / handoff público:** **NO-GO**. El árbol está sucio, `verify:fast` y `verify:static` salen con exit 1 por `gitAtStart.dirty`, `verify:evidence` es inválido para este HEAD y el contrato A-J no está atado al build/commit ni integrado a los gates. Eso es un bloqueo de **evidencia/proceso**, no un defecto de runtime.
- **P0:** ninguno.
- **P1 de producto:** ninguno.
- **P1 de cierre:** quedan dos, ambos de evidencia/proceso (P1-E1 y P1-E2 abajo).

---

## 1. Diagnóstico previo: confirmado

El diagnóstico que originó la remediación es correcto. El diff de la ruta vieja muestra:

1. `getOrder(orderId)` no comprobaba `orders.demo`; en modo demo podía devolver también un pedido real. Un `POST /api/demo/pay` con un `orderId` real podía entrar al flujo demo.
2. El saldo se calculaba con `order.totalCents - order.paidCents - order.creditCents`, leyendo `orders.paid_cents` fuera de un lock. Dos procesos podían leer la misma foto y ambos decidir que había saldo.
3. El `transactionId` era aleatorio (`demo_txn_${newId("tx")}`) y la `idempotency_key` del evento era ese mismo valor aleatorio. Por tanto, `payments.transaction_id UNIQUE` y `payment_events.idempotency_key UNIQUE` no deduplicaban **la misma operación**; cada reintento generaba otra llave.
4. El evento se insertaba en autocommit y `recordPayment` abría su propio `SAVEPOINT` después. Un fallo intermedio podía dejar un evento sin pago.
5. La protección real era del cliente (no mandar dos veces) y de la aleatoriedad, no del servidor.

Esto coincide con `ANALISIS_VENTAS_PAGOS.md` y con la reproducción previa de `REVISION_CONTRATOS.md`; mi verificación se centró en el estado **posterior** a la remediación.

---

## 2. Corrección verificada (código)

| Requisito | Evidencia | Estado |
|---|---|---|
| `orders.demo=1` leído desde DB, no desde el cliente | `demo-payments.ts:342-359`: `SELECT ... FROM orders WHERE id = ? AND merchant_id = ?`, `if (Number(row.demo) !== 1) → 409 demo_order_required` | **CUMPLE** |
| Lock de escritura antes de leer el saldo | `demo-payments.ts:334`: `BEGIN IMMEDIATE` antes del `SELECT` | **CUMPLE** |
| Saldo desde `SUM(payments)` | `demo-payments.ts:369-382`: `SUM(amount_cents) WHERE status='paid'`; no usa `orders.paid_cents` | **CUMPLE** |
| Llaves persistentes y deterministas | `demo-payments.ts:75-85`: `demo:pay:v1:req:<merchant>:<requestId>` y `demo:pay:v1:auto:<merchant>:<orderId>:<dueCents>`; `transactionIdFor` = SHA-256 de la llave | **CUMPLE** |
| `payment_events.idempotency_key` único | `db.ts:160` (preexistente, no modificado) | **CUMPLE** |
| `payments.transaction_id` único | `db.ts:148` (preexistente, no modificado) | **CUMPLE** |
| Evento + pago + orden + auditoría en una transacción | `demo-payments.ts:334-503`; `recordPayment` anida `SAVEPOINT payment_record` (`orders.ts:560`); el `finally` exterior hace `ROLLBACK` (`:511-523`) | **CUMPLE** |
| `requestId` opcional | `route.ts:15-23` (`.nullish()`), `demo-payments.ts:63-73` (vacío → `null`), `:384-431` (auto key) | **CUMPLE** |
| 409 de conflicto | `demo-payments.ts:144-177, 197-305, 351-359, 436-452`; ruta los traduce con `appErrorResponse` | **CUMPLE** |
| 404 / 409 / 503 seguros | `NotFoundError` 404, `ConflictError` 409, `busyError()` 503; lo inesperado usa `internalErrorResponse` 500 sin SQL | **CUMPLE** |
| Función síncrona, sin `await` dentro del lock | `recordDemoPayment` no es `async`; el `await` de la ruta es anterior (`readJsonLimited`, `route.ts:38`) | **CUMPLE** |
| No escribe `paid` desde demo | El pago usa `provider: "demo"`; `recordPayment`/`recalculateOrderTotals` resuelven `demo_paid` (`orders.ts:604, 679-687`); no hay literal `paid` en `demo-payments.ts` | **CUMPLE** |

**Nota:** `payment_events.idempotency_key UNIQUE` y `payments.transaction_id UNIQUE` ya existían en `db.ts`; esta remediación **no modificó el esquema**. Eso es correcto: el P1 se podía cerrar con las columnas existentes.

---

## 3. Verificación ejecutada de forma independiente

Todo se ejecutó en la sesión de verificación, no se tomó ningún PASS de los reportes del carril.

| Comando | Resultado real | Exit |
|---|---|---|
| `node scripts/p0-demo-pay-contract.mjs` | **49 PASS · 0 FAIL** (incluye J, A0, A, B, C, D, D2, E, E2, F, G1-G6 rondas, G7 auto, G8 llaves distintas, H, I, K) | 0 |
| `npm run verify:fast` | **3/3 gates verdes**: guard, lint, types | **1** por `gitAtStart.dirty` / `gitAtEnd.dirty` |
| `npm run verify:static` | **5/5 gates verdes**: guard, lint, types, deps, build | **1** por `gitAtStart.dirty` / `gitAtEnd.dirty` |
| `npm run verify:evidence` | **INVÁLIDA**: 4 fallos (SHA `9206ea` vs HEAD `4130e71`, árbol sucio, artefactos móviles con hash distinto, `gatesOk` recalculado) | 1 |
| `npm run test:fix-datos` | **123 checks, 0 FAIL**: P0 FIX DATOS 63, P0 DB GUARDS 20, P0 ORDERS ATOMIC 8, P0 DEMO→REAL 32 | 0 |
| `npm run test:harness` | **58/58 tests** | 0 |
| `node scripts/p0-venta-gate.mjs` | **66 PASS · 0 FAIL · 0 KNOWN**, buildSha `4130e71` | 0 |
| `python scripts/p0-fiado-e2e.py` | **51 PASS · 0 FAIL · 0 KNOWN** | 0 |
| `python scripts/p0-corte-e2e.py` | **69 PASS · 0 FAIL · 0 KNOWN** | 0 |
| `python scripts/p0-integracion-e2e.py` | **51 PASS · 0 FAIL · 0 KNOWN** | 0 |
| `python scripts/p0-dinero-e2e.py` | **45 PASS · 0 FAIL · 3 KNOWN** (pey real no verificable, reconciliación de red no ejecutada, contrato de conteo post-cierre) | 0 |
| `node scripts/webhook-contract.mjs` (servidor aislado temporal) | **40/40** | 0 |
| `node scripts/checkout-gate.mjs` | **19/19**, buildSha `4130e71` | 0 |
| `python scripts/oleada-b-smoke.py` (aislado, `localhost:3492`, DB temporal) | **44 PASS · 0 FAIL** | 0 |
| `npm run test:security` | **58/58** | 0 |
| `git diff --check` | Sin errores de whitespace; solo aviso CRLF de `route.ts` | 0 |

**Sobre `verify:fast` / `verify:static`:** los gates están verdes, pero el harness los marca como corrida inválida porque el árbol está sucio. No los reporto como PASS formal; el exit 1 es correcto según las reglas del repo.

**Sobre `verify:evidence`:** el `latest.json` existente es de `9206ea`, no de este HEAD. Además, los artefactos de `mobile` ya no coinciden con sus hashes. Es evidencia vieja y no cubre esta remediación. No es un fallo de `demo/pay`; es exactamente la razón por la que el handoff formal no se puede declarar.

**Sobre la B smoke:** dos intentos iniciales con `BASE_URL=http://127.0.0.1:...` fallaron en `page.goto(..., wait_until="networkidle")` porque la app genera enlaces `http://localhost:...` y el CSP `connect-src 'self'` los bloquea al cambiar de host. No cuento esos intentos como PASS; uno de ellos usó `:3340` y pudo reutilizar un servidor ya existente. El run válido se hizo contra un servidor aislado en `localhost:3492` con DB temporal: **44/44**. Es un detalle de host del harness, no una regresión de producto.

**Sobre el webhook:** el contrato terminó con `No se pudo reiniciar la base: 409` después de 40/40. El reset se bloquea por el pago `pey` demo firmado de la propia prueba; es consistente con la política de reset y no afecta los 40 checks. La DB era temporal.

---

## 4. Reproducción adversarial propia

Además del contrato de 49 checks, ejecuté dos sondas temporales fuera del repo, contra el build `4130e71`, con SQLite temporal y servidores `next start` reales.

### 4.1 Dos procesos + pedido real (`verificador-probe.mjs`)

Resultado: **7/7 PASS**.

| Caso | Resultado |
|---|---|
| Pedido real (`demo=0`) con `requestId` desde servidor demo | `409 demo_order_required`, 0 pagos, estado `confirmed` |
| Dos procesos, mismo pedido, **sin** `requestId` | `200/200`, 1 pago, `SUM=10000`, 1 evento automático |
| Dos procesos, misma `requestId` | `200/200`, 1 pago, 1 evento; una respuesta `duplicate=false`, la otra `duplicate=true` |
| Dos procesos, **requestId distintos** | `200/200`, 1 pago, `SUM=9000`; la segunda no duplica |
| Pedido ya cubierto + `requestId` nuevo | `200 alreadySettled=true`, sin pago ni evento nuevos |
| Invariante global | Ningún pedido con `paid_cents > total_cents` |

### 4.2 Estados terminales y fallo atómico del UPDATE (`verificador-probe2.mjs`)

Resultado: **9/9 PASS**.

| Caso | Resultado |
|---|---|
| Pedido cancelado | `409 order_cancelled`, 0 pagos |
| `paid` con saldo pendiente (`due>0`) | `409 order_state_inconsistent`, 0 pagos |
| `fulfilled` con saldo | `200`, 1 pago, estado sigue `fulfilled` |
| `requestId` de 129 caracteres | `400 request_id_invalid` |
| `requestId` numérico | `400 request_id_invalid` (mensaje inexacto, P2) |
| Trigger que aborta el `UPDATE` de la orden | `500` seguro, 0 eventos, 0 pagos, orden intacta |
| Reintento con la misma `requestId` tras el fallo | `200`, 1 evento, 1 pago, `paid_cents=7000` |

Este último caso es importante: el test versionado solo fuerza el fallo del `INSERT` del pago; yo forcé el fallo del `UPDATE` de la orden. El rollback exterior + savepoint funcionan y el reintento es idempotente.

---

## 5. Revisión del test A-J

El test nuevo es real y ya no es el de 29 checks. Cubre:

- **6 rondas** de carrera multiproceso con la misma `requestId` (`p0-demo-pay-contract.mjs:230-256`).
- **Carrera con llave automática** sin `requestId` (`:258-276`).
- **Dos `requestId` distintos** en el mismo pedido (`:278-296`).
- **Reinicio** de ambos servidores y replay (`:298-307`).
- **Fallo atómico** del `INSERT` del pago con trigger (`:319-342`).
- Conflictos: mismo `requestId` con otro método, otro pedido, otro estado; 404; método inválido; no-op ya cubierto.

**Lo que el test sigue sin hacer (P2, no defecto de producto):**

1. **No fuerza la carrera con un lock externo de tercera conexión.** Usa `Promise.all`; las seis rondas son reales y los dos procesos son reales, pero no garantizan contención máxima. El `ANALISIS` §5.1 pedía `BEGIN IMMEDIATE` externo, esperar y liberar. Esta es la principal diferencia entre “6/6” y “6/6 forzado”.
2. **No cubre G2** (mismo `requestId`, otro importe sin pago), **I(b-d)** (cancelado, `paid`/`demo_paid` con saldo, `fulfilled` con saldo), **J2/J3** (evento sin pago / pago sin evento), **J5** (`verify` demo) ni **J6** (invariantes globales). Mi sonda cubrió I(b-d) y el fallo del UPDATE; el resto queda por inspección o por otros gates.
3. **No está atado al build/commit.** Solo comprueba que exista `.next/BUILD_ID` (`:161-163`); no lee `/api/health`, no compara `buildSha` con HEAD y no exige árbol limpio. El build que usé sí contiene el módulo nuevo (`demo_order_required` en `_1x115tc6mv3ku._.js`), pero el test no lo verifica por sí mismo.
4. **No está integrado a `package.json` ni a `verify:full`/CI.** No hay `test:demo-pay`; el test es manual y su `result.json` se escribe en el temporal y se borra (`:344-363`).
5. **No asserta el cuerpo del 500** de K; el código usa `internalErrorResponse`, pero faltaría comprobar que no filtra SQL.

---

## 6. Guard: adaptado, no debilitado materialmente

`git diff` de `web/scripts/harness-guard.mjs` es un solo hunk:

```diff
-const demoPay = read("web/src/app/api/demo/pay/route.ts");
+const demoPayRoute = read("web/src/app/api/demo/pay/route.ts");
+const demoPayCore = read("web/src/lib/demo-payments.ts");
 check(
   "demo/pay declara provider demo",
-  demoPay.includes('provider: "demo"') || demoPay.includes("provider: 'demo'"),
+  demoPayRoute.includes("recordDemoPayment") &&
+    (demoPayCore.includes('provider: "demo"') || ... ||
+     demoPayCore.includes('EVENT_PROVIDER = "demo"') || ...),
 );
```

- El guard sigue fallando si la ruta no delega en `recordDemoPayment` y si el núcleo no declara el proveedor demo.
- No se eliminó ni se relajó ningún otro check del guard; `npm run verify:fast` lo ejecutó y pasó.
- **Matiz P2:** la aserción es textual; no comprueba que el `recordPayment` del núcleo use `provider: EVENT_PROVIDER`. En el código revisado sí lo usa (`demo-payments.ts:482-494`), pero una constante declarada y no usada también satisfaría el guard. No es un debilitamiento material hoy; sí una mejora de robustez.

---

## 7. Alcance: qué NO se tocó

`git diff --name-only` devuelve solo:

- `web/scripts/harness-guard.mjs`
- `web/src/app/api/demo/pay/route.ts`

Los nuevos son:

- `web/src/lib/demo-payments.ts`
- `web/scripts/p0-demo-pay-contract.mjs`
- `quality-reports/oleada-b-remediation/`

No hay cambios en:

- `web/src/lib/orders.ts`
- `web/src/lib/db.ts`
- `web/src/lib/cash.ts`
- `web/src/lib/payment-rules.ts`
- `web/src/app/api/webhooks/pey/**`
- `web/src/lib/pey.ts` / `pey-events.ts`
- `web/src/app/api/verify/**`
- `web/src/lib/checkout.ts` / `web/src/app/pay/**`
- UI (`web/src/components/**`)
- rutas reales

`db.ts` ya tenía las unicidades que el flujo necesita; no se alteró el esquema. Esto cumple la condición “sin cambios en real/webhook/pey/verify”.

---

## 8. Hallazgos

### P0 — ninguno

No encontré, en el código y las pruebas revisadas, una forma de:

- pagar un pedido `demo=0` desde `/api/demo/pay`;
- cobrar en modo real (la ruta responde 403 antes de leer el body);
- duplicar `paid_cents` con dos procesos, misma llave, llaves distintas o llave automática;
- dejar evento/pago huérfano por un fallo del `INSERT` del pago o del `UPDATE` de la orden;
- marcar `paid` desde el endpoint demo;
- devolver SQL, constraints o stack traces al cliente.

### P1 — bloqueos de cierre, no de producto

#### P1-E1. El árbol no es limpio y no hay evidencia formal de este cambio

- `git status`: `route.ts` y `harness-guard.mjs` modificados; `demo-payments.ts` y `p0-demo-pay-contract.mjs` sin commit.
- `verify:fast`: 3/3 gates verdes, exit 1 por `dirty=true`.
- `verify:static`: 5/5 gates verdes, exit 1 por `dirty=true`.
- `verify:evidence`: inválido; el `latest.json` es de `9206ea`, no de `4130e71`, y varios artefactos móviles tienen hash distinto.
- No hay `latest.json`/`latest-static.json` de este árbol con `ok:true`, `gitAtStart.sha = HEAD`, `gitAtStart.dirty:false` y `buildSha` coincidente.

**Impacto:** no se puede declarar merge/handoff público aunque el producto esté correcto. Es un P1 de proceso/evidencia según `AGENTS.md` y `harness/EVALS.md`.

#### P1-E2. El contrato A-J no está atado al build/commit ni a los gates

- El test pasó 49/49, pero solo verifica que exista `.next/BUILD_ID`; no lee `health.buildSha` ni exige árbol limpio/HEAD.
- No está en `package.json` ni en `verify:full`/CI; no hay `test:demo-pay`.
- No usa el lock externo de tercera conexión que exige `ANALISIS` §5.1.
- No cubre varios casos de la matriz acordada (G2, I b-d, J2/J3/J5/J6, invariantes globales).
- No hay waiver escrito del dueño del P1 que sustituya esos casos.

**Impacto:** su 49/49 es evidencia local valiosa, pero no es todavía la evidencia formal que el propio análisis exige para cerrar el P1. Esto no invalida el código; invalida el cierre.

### P2 — follow-ups verificados o relevantes

| ID | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| P2-1 | `resetDemoData` borra pagos/pedidos demo pero **no** `payment_events`. Un `requestId` reutilizado tras reset puede dar 409. | `db.ts:2048-2060`; no se ejecutó con el endpoint nuevo | No crea dinero; puede bloquear un cobro demo. |
| P2-2 | La rama `alreadySettled` no cura `paid_cents`/`status` si `SUM(payments)` ya cubre pero la orden quedó vieja. | `demo-payments.ts:401-414`; la rama de replay sí cura | No crea dinero; la UI puede mostrar estado inconsistente. |
| P2-3 | La llave automática no incluye el método. Un reintento sin `requestId` con otro método devuelve `duplicate` y conserva el método original. | `demo-payments.ts:79-81, 220-230` | Por diseño; documentar. |
| P2-4 | `recordPayment` captura **cualquier** error `UNIQUE` y llama a `healOrderFromPayments`; el flujo demo luego marca el evento `processed`. Con el prechequeo + lock es inalcanzable, pero la defensa es frágil. | `orders.ts:594-601`; `demo-payments.ts:446-452` | Teórico evento procesado sin pago si cambia el prechequeo. |
| P2-5 | `isBusyError` usa `/busy/i` y el 503 no lleva `Retry-After`. | `demo-payments.ts:91-104` | Error mal clasificado en el futuro; UX de reintento. |
| P2-6 | Un `requestId` no-string recibe el mensaje “no puede pasar de 128 caracteres”, aunque el problema sea el tipo. | `route.ts:65-84`; sonda propia confirmó 400 | Seguro pero confuso. |
| P2-7 | El test no es portable/CI: puertos fijos, `taskkill` en Windows, `result.json` en temporal, sin buildSha/clean check. | `p0-demo-pay-contract.mjs:16-24, 161-163, 344-363` | No protege contra regresiones en CI. |
| P2-8 | Pedidos demo antiguos con `demo=0` e id que no empieza por `demo_` no se marcan en la migración; el nuevo guard los rechaza. | `db.ts:466-481` | Compatibilidad con datos viejos; no crea dinero. |
| P2-9 | `payment_events` de demo se insertan con `signature_valid=0`; un monitoreo que cuente “firma inválida” debe filtrar `provider='demo'`/`result='processed'`. | `demo-payments.ts:467-480` | Observabilidad, no dinero. |
| P2-10 | `/api/verify` de un pago `provider=demo` devuelve `verified:false` pero `reason:"not_found"`; la rama `demo_payment` es para `pey` + `demo=1`. | `verify/route.ts:74-80, 102-117`; p0-dinero | Correcto en lo esencial; mensaje menos explícito. |
| P2-11 | Un pedido demo pagado 100% en efectivo al crearse queda `paid`, no `demo_paid`; el endpoint devuelve `alreadySettled` sin escribir. | `orders.ts:328-335` | Preexistente; no lo introduce este parche. |
| P2-12 | El 500 de K no se asserta por contenido; el código usa `internalErrorResponse`, pero faltaría probar que no filtra SQL. | `p0-demo-pay-contract.mjs:321-342` | Cobertura, no producto. |

---

## 9. Lo que NO se probó (límites del veredicto)

1. **Multiproceso natural / carga real.** Se probaron dos procesos `next start` y `Promise.all`; no hay docenas de clientes, latencia real, reintentos de red ni un lock externo de tercera conexión. El riesgo residual es de contención/latencia, no de doble dinero (el lock y las unicidades son la defensa).
2. **Reset demo con el endpoint nuevo.** No se ejecutó “pagar demo → `/api/demo/reset` → reutilizar `requestId`”. Por inspección, los `payment_events` sobreviven y un `requestId` viejo daría 409; no crea dinero. Queda P2-1.
3. **Datos ya corruptos.** El parche es forward-looking. Probé un estado sintético `paid` con saldo (`409 order_state_inconsistent`), pero no inventarié ni reparé filas reales/demo ya inconsistentes. No hay una decisión escrita del dueño sobre reparar, waiver o reset; el análisis §8.5 lo pedía.
4. **pey real.** No hay pago real ni portal. El webhook se probó con payloads sintéticos y `p0-dinero` mantiene 3 KNOWN: payload real de pey no verificable, reconciliación de red no ejecutada y contrato de conteo post-cierre.
5. **`verify:full` (23 gates).** No se ejecutó completo; no hay túnel/preflight, HIG/mobile/motion/contrast/rehearsal/perf/film. Sí se ejecutaron static, security, fix-datos, webhook, checkout, p0 y B smoke.
6. **Commit, merge, deploy y Oleada C.** No se hicieron; el veredicto es solo sobre el estado local del árbol.

---

## 10. Decisión GO / NO-GO

| Dimensión | Decisión |
|---|---|
| **Producto demo (`/api/demo/pay`)** | **GO local.** No hay P0/P1 de dinero; los casos críticos están cubiertos y reproducidos. |
| **Merge / handoff público / demo anunciada** | **NO-GO** hasta cumplir las condiciones de abajo. |
| **Oleada C** | **No iniciar**; fuera de este veredicto. |

### Condiciones para convertir el NO-GO formal en GO

1. **Commit limpio** de la remediación (helper, ruta, guard, test y documentos) en la rama. No dejar el test y el helper untracked.
2. **Build desde ese commit** y ejecutar `p0-demo-pay-contract.mjs` contra ese build, comprobando `/api/health.buildSha === git rev-parse HEAD`.
3. **`npm run verify:fast` y `npm run verify:static`** (o `verify:full` si el entorno lo permite) sobre árbol limpio; `npm run verify:evidence` debe pasar y dejar `latest*.json` con `ok:true`, `gitAtStart.sha = HEAD`, `dirty:false` y `buildSha` coincidente.
4. **Integrar el contrato A-J** a `package.json`/`verify:full`/CI (o dejar un waiver explícito del dueño) y, idealmente, agregar el lock externo de tercera conexión y los casos G2/I(b-d)/J2/J3/J5/J6.
5. **Decisión escrita sobre datos ya corruptos y reset demo:** inventariar o declarar waiver; no “arreglar” marcando `paid` sin evidencia pey.
6. Repetir la verificación de webhook/checkout/p0/seguridad sobre el commit limpio; mis PASS son del árbol actual, no de un commit entregado.

---

## 11. Conclusión

La remediación **resuelve el P1 de producto**: el endpoint ya no acepta pedidos reales, el saldo se decide dentro de un lock con `SUM(payments)`, las llaves son persistentes, el evento/pago/orden/auditoría son atómicos, y los conflictos/errores son seguros. Las pruebas independientes —49/49 del contrato, 7/7 de dos procesos, 9/9 de estados/atomicidad, y los gates p0/webhook/checkout/seguridad— no muestran P0/P1 de runtime.

Lo que **no** está cerrado es el **cierre formal**: árbol sucio, sin commit, `verify:evidence` inválido, contrato A-J no atado al build ni integrado a gates, y sin lock externo/varios casos de la matriz. Por eso:

**Producto: GO local. Handoff: NO-GO condicionado a evidencia limpia.**
