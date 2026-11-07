# Auditoría adversarial Oleada B — Ventas y pagos

> **Rol:** `mc-ventas-pagos` (revisión adversarial, solo lectura de producto).
> **Fecha:** 2026-11-04.
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`.
> **HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02` (`docs: cierre formal local de Oleada B`).
> **Base de Oleada A:** `26c7741433f18e4f4d0e78b1913df76ed09dae7e`.
> **Servidor:** `http://localhost:3100`, `buildSha=4130e71…`, `DEMO_MODE=true`, `APP_URL` local.
> **Base de datos:** `web/data/mercado-cero.db` (todas las filas creadas por esta auditoría quedaron `demo=1`; no hay pagos reales).

---

## 0. Veredicto

| Severidad | Cantidad | Estado |
|---|---:|---|
| **P0** | **0** | No se reprodujo un cobro incorrecto, pérdida de venta ni `paid` real por UI/QR en el camino normal. |
| **P1** | **2** | Demo-pay sin `order.demo`/idempotencia durable; abonos demo contados como “Cobrado confirmado”. |
| **P2** | **4** | 502 + edición duplica; “Actualizar estado” revive estado viejo; puntero pendiente resucita; titular mixto demo oculta el fiado. |
| **P3** | **2** | Agregado “Por cobrar digital” incluye demo sin decirlo; solo se reanuda el último pendiente. |

**Lectura corta:** el flujo principal de `/caja` funciona y usa el motor existente sin tocarlo. La Caja nueva es una base razonable para Oleada C, pero **no está lista para declarar Oleada B cerrada ni para handoff público**: quedan dos P1 (uno heredado del motor demo y otro heredado de `/api/demo/pay` que B expone en el recorrido principal), cuatro P2 de verdad/estado y evidencia solo en demo, sin pey ni QR reales.

---

## 1. Entorno y método

- **UI real con Playwright/Chromium headless**, viewport 1280×1000, locale `es-MX`, localStorage limpio entre escenarios.
- **API real** contra `3100` para crear ventas demo, generar link/QR, pagar demo, abonar fiado y leer detalle.
- **SQLite en solo lectura** para contrastar cada respuesta de la UI con `orders`, `payments`, `credits`, `credit_payments` y `order_items`.
- **Suite existente** `web/scripts/webhook-contract.mjs` contra `3100` (40/40).
- **Copia aislada** de la base con `VACUUM INTO` en `%TEMP%\opencode\mc-audit-pagos\pagos-copy.db`; servidores temporales `3210`/`3212` con el mismo build para pruebas destructivas (doble demo-pay y pedido `demo=0`). Ambos se apagaron al terminar.
- **No se editó producto, endpoints ni se hizo commit.** `git status` solo muestra `?? quality-reports/oleada-b-review/`.

Evidencia de entorno: `EVIDENCIAS/pagos-ambiente.json`.

---

## 2. Cobertura ejecutada

| Caso | Resultado | Evidencia |
|---|---|---|
| Venta simple, múltiple, cantidades, eliminación, decimales, efectivo exacto | **PASS** | `pagos-ui-flow.json` A1–A10; `pagos-caja-efectivo-exacto.png` |
| Efectivo con cambio; recibido/aplicado/cambio | **PASS** | `pagos-ui-flow.json` B1/B3; revalidación `pagos-result-assertions.json` B2; `pagos-caja-cambio.png` |
| Efectivo insuficiente bloquea y no crea pedido | **PASS** | `pagos-ui-flow.json` C1–C3 |
| Doble clic crea un solo POST y una sola orden | **PASS** | `pagos-ui-flow.json` D1–D2 |
| Respuesta perdida real (abort post-commit) + reintento con misma llave | **PASS** | `pagos-lost-response.json`; `pagos-lost-response-aviso.png`, `pagos-lost-response-resultado.png` |
| 502 post-commit + edición + reintento | **FAIL (P2-1)** | `pagos-502-edit.json`; `pagos-502-antes-de-editar.png`, `pagos-502-despues-de-editar.png` |
| Borrador sobrevive recarga | **PASS** | `pagos-ui-flow.json` F1–F2 |
| Digital: pedido, link, QR, pendiente, recarga, demo, resultado | **PASS** | `pagos-ui-flow.json` G1–G6, G8–G9; `pagos-caja-digital-pendiente.png`, `pagos-caja-digital-demo-resultado.png` |
| Checkout del link: demo válido, termina `demo_paid` | **PASS** | `pagos-ui-flow.json` H1–H2; `pagos-checkout-demo.png` |
| Fiado, saldo vivo, abono parcial y liquidación | **PASS** | `pagos-ui-flow.json` I1–I7; `pagos-ventas-fiado-parcial.png` |
| Mixto efectivo + fiado: DB correcta, titular engañoso | **FAIL (P2-4)** | `pagos-ui-flow.json` J1–J3; `pagos-caja-mixto-fiado-demo.png` |
| Puntero pendiente tras “Nueva venta” + recarga | **FAIL (P2-3)** | `pagos-ui-flow.json` K1–K3; `pagos-caja-puntero-resucitado.png` |
| `/ventas`: filas, importes, método, pendiente, demo, saldo vivo | **PASS** | `pagos-ui-flow.json` L5–L8; `pagos-ventas.png`, `pagos-ventas-pendiente.png` |
| `/ventas`: agregados contra servidor | **PASS en copia estable, salvo P1-2** | `pagos-ventas-stable.json` E1–E5 |
| `requestId`: mismo payload, payload distinto, doble POST concurrente | **PASS** | `pagos-ui-flow.json` M1–M4 |
| Polling automático viejo | **PASS por código** (`updatedAt`), no revierte | `payment-panel.tsx:33-59` |
| “Actualizar estado” con respuesta vieja | **FAIL (P2-2)** | `pagos-polling-viejo.json`; `pagos-polling-viejo.png` |
| Webhook: firma, replay, monto, orden, timestamp, JSON, QR, reintento | **PASS 40/40** | `pagos-webhook-suite.txt`, `pagos-webhook-suite.json` |
| `/api/verify` con transacción demo y pey-demo | **PASS: `verified:false`** | `pagos-verify-demo.json`, `pagos-verify-pey-demo.json` |
| Motor financiero intacto y mismas APIs | **PASS** | `pagos-engine-untouched.txt` |

### Nota de transparencia sobre la corrida principal

`pagos-ui-flow.json` registró **60/66 PASS**. De los 6 FAIL:

- **B2 e I2** fueron falsos negativos de la aserción: `inner_text` separa etiqueta y monto con `\n`; los valores sí estaban. Revalidados **2/2 PASS** en `pagos-result-assertions.json`.
- **L2** fue una carrera con otro escritor sobre la base compartida 3100 (el total cambió entre el render SSR y la llamada API). Revalidado en copia estable **3/3 PASS** en `pagos-ventas-stable.json`.
- **G7, J3 y L3b** son fallos reales y se detallan abajo.

Tras esas revalidaciones, quedan **3 fallos reales** de la matriz principal: P2-2 (G7), P2-4 (J3) y P1-2 (L3b).

---

## 3. Hallazgos

### P1-1 — `/api/demo/pay` no valida `order.demo` y no tiene idempotencia durable

**Severidad:** P1 · **Estado:** abierto (heredado; B lo expone).

**Esperado:** un pedido `demo=0` debe rechazar la simulación; dos solicitudes concurrentes del mismo pedido deben producir como máximo un pago y `paid_cents <= total`.

**Observado:**

1. **Pedido no demo pagado como demo.** En la copia se insertó un pedido `payment_pending` con `demo=0` (fixture controlado, no en la base 3100). `POST /api/demo/pay` respondió `200` y lo dejó `demo_paid`, con un pago `provider=demo`, `demo=1`, `amount_cents=5000`, conservando `orders.demo=0`. La consulta SQL de visibilidad real (`demo=0 AND id NOT LIKE 'demo_%' AND status != 'demo_paid'`) devuelve 0 para ese pedido, así que desaparecería del historial real. Evidencia: `pagos-demo-pay-adversarial.json` 2.1–3.1.
2. **Doble pago bajo dos procesos.** Con dos instancias del mismo build (`3210` y `3212`) sobre la misma copia SQLite y un lock de escritura externo que fuerza a ambas a leer el saldo antes de escribir, dos `POST /api/demo/pay` concurrentes insertaron **dos pagos de 10000** sobre un total de **10000**: `paid_cents=20000`. Evidencia: `pagos-demo-lock-race.json` (`duplicated: true`).
3. **No se reprodujo en un solo proceso.** 10 POST concurrentes contra `3100` y 12 contra dos procesos sin contención de escritura produjeron un solo pago; el segundo request ve `amountCents <= 0`. Evidencia: `pagos-demo-pay-adversarial.json` 1.2 y `pagos-demo-multiproceso.json` (`duplicated: false`).

**Reproducción (copia):**

1. Crear pedido digital de 10000 y generar link.
2. Abrir dos instancias del build contra la misma copia SQLite.
3. Tomar `BEGIN IMMEDIATE` externo; lanzar un `POST /api/demo/pay` en cada instancia; liberar el lock.
4. Leer `payments` y `orders`.
5. Para el caso `demo=0`: insertar un pedido `payment_pending, demo=0` en la copia y llamar `/api/demo/pay`.

**Archivos:** `web/src/app/api/demo/pay/route.ts:49-85` (no comprueba `order.demo`; genera `transactionId` nuevo por llamada), `web/src/lib/orders.ts:554-555` (`recordPayment` solo corta en `<=0`, no limita contra el saldo pendiente), `web/src/components/caja/payment-panel.tsx:220-233` (los botones demo dependen del modo global, no de `order.demo`).

**Impacto:** duplica un pago simulado y puede corromper un pedido no demo en una base reutilizada. No es dinero real, pero rompe la verdad demo/real y la afirmación de idempotencia.

---

### P1-2 — Abonos demo de fiado se suman a “Cobrado confirmado”, `cashCents` y `declaredDigitalCents`

**Severidad:** P1 (verdad demo; no hay dinero real) · **Estado:** abierto (bug preexistente de `db.ts`; B lo expone en `/ventas`).

**Esperado:** un `credit_payment` con `demo=1` debe ir a `demoCashCents`/`demoDigitalCents`; en `DEMO_MODE` los buckets reales deben quedar en 0.

**Observado (copia estable):**

- Abono demo de fiado por `$100` con `method=cash`: `/ventas` mostró **“Cobrado confirmado $100.00”** y el subtítulo **“Solo efectivo real y pagos verificados; demo no cuenta”**. El dashboard devolvió `cashCents=10000` y `demoCashCents=146736` (los `credit_payments` demo no entraron a `demoCashCents`).
- Un abono demo con `method=card` por `$50` incrementó `declaredDigitalCents` de 0 a 5000, sin pasar a `demoDigitalCents`.
- Los `credit_payments` de la copia son `provider=cash, demo=1`; la condición `payment.provider === "demo"` nunca se cumple para ellos y `!includeDemo && demo===1` es falsa justo en modo demo.

**Reproducción:**

1. Crear venta a fiado demo por 100.
2. `POST /api/credits/{id}/pay` con `method=cash`, 4000 y 6000.
3. Abrir `/ventas` y `/api/dashboard`.
4. Repetir con `method=card` 5000 y comparar `declaredDigitalCents`.

**Evidencia:** `pagos-ventas-stable.json` (E2–E5), `pagos-ventas-stable.png`, `pagos-demo-credit-digital.json`.

**Archivos:** `web/src/lib/db.ts:1832-1845` (asimétrico respecto al loop de `payments` de la línea 1820), `web/src/app/ventas/page.tsx:96-109`.

**Impacto:** la métrica principal de dinero cobrado presenta dinero simulado como real en el build demo. No afecta `DEMO_MODE=false`, pero invalida la etiqueta “demo no cuenta” y cualquier demo comercial que use ese número.

---

### P2-1 — Un 502 post-commit se trata como fallo normal; editar y confirmar duplica la venta

**Severidad:** P2 · **Estado:** abierto.

**Esperado:** un 502 de proxy/servidor después del commit debe tratarse como resultado desconocido, conservar la misma `requestId` y pedir revisar Ventas antes de editar.

**Observado:** la UI mostró `El banco tardó en responder. Reintenta.` con CTA **“Confirmar venta”** (no “Reintentar venta”). El reintento sin editar sí reutiliza la llave y no duplica (`pagos-ui-flow.json` E4–E5). Pero al cambiar cantidad 1→2 y efectivo 40→80, el nuevo payload generó otra `requestId` y una segunda orden pagada: **4000 y 8000**, dos `paid` en DB. Evidencia: `pagos-502-edit.json` (`duplicated: true`).

**Reproducción:** interceptar el primer `POST /api/orders`; `route.fetch()` para commitear y responder 502; editar cantidad/efectivo; confirmar; comparar `request_id` y `orders`.

**Archivos:** `web/src/components/caja/caja-screen.tsx:630-642` (solo reconoce errores de red, no 502), `web/src/components/caja/sale-summary.tsx:64-79` (`retry` solo si el mensaje empieza con “No sabemos”).

**Impacto:** dos ventas pagadas por una sola operación si hay 502 y la persona edita antes de reintentar. El aviso “Reintenta” mitiga el caso sin edición, no el caso con edición.

---

### P2-2 — “Actualizar estado” ignora el guard de `updatedAt` y revive un estado viejo

**Severidad:** P2 · **Estado:** abierto.

**Esperado:** toda respuesta GET de detalle debe ignorarse si su `updatedAt` es menor al estado actual, o abortar la petición vieja.

**Observado:** con un pedido ya en `payment_pending` y link/QR visibles, se sirvió la orden `confirmed` anterior en `GET /api/orders/{id}` y se pulsó **Actualizar estado**. El badge pasó de **PENDIENTE** a **REGISTRADO** y el link desapareció (`linkCount 1 → 0`), aunque la orden seguía pendiente. El polling automático sí compara `updatedAt`; el botón manual no. Evidencia: `pagos-polling-viejo.json` (`ok: true`), `pagos-polling-viejo.png`; también `pagos-ui-flow.json` G7.

**Reproducción:** crear pedido digital, guardar la orden `confirmed`, generar link, interceptar el GET y devolver la orden vieja, pulsar Actualizar estado.

**Archivos:** `web/src/components/caja/payment-panel.tsx:33-59` (guard del intervalo), `web/src/components/caja/payment-panel.tsx:83-96` (refresh sin guard).

**Impacto:** la UI puede mostrar un estado anterior y ocultar el link/QR de un cobro que sigue pendiente. No mueve dinero, pero rompe la verdad del estado.

---

### P2-3 — “Nueva venta” no borra el puntero pendiente; recargar resucita el resultado viejo

**Severidad:** P2 · **Estado:** abierto.

**Esperado:** al pulsar Nueva venta o al detectar una orden terminal, el puntero de la cola debe limpiarse; una recarga debe abrir una venta nueva.

**Observado:** tras pagar por API un pedido pendiente y pulsar **Nueva venta**, `localStorage` seguía con `{"orderIds":["ord_d754…"]}`. Al recargar, `/caja` volvió a **“Venta registrada”** del pedido viejo. Evidencia: `pagos-ui-flow.json` K1–K3; `pagos-caja-puntero-resucitado.png`.

**Reproducción:** crear pedido digital (queda en `PENDING_KEY`), pagarlo por API, recargar, pulsar Nueva venta y recargar otra vez.

**Archivos:** `web/src/components/caja/caja-screen.tsx:114-140` (solo limpia en 404), `164-185` (`clearDraft` no toca `PENDING_KEY`), `622-627`.

**Impacto:** la caja queda atrapada en el resultado de un cobro viejo en cada recarga; puede confundir la siguiente venta.

---

### P2-4 — Titular de venta mixta demo dice “Venta cobrada en efectivo” aunque haya fiado abierto

**Severidad:** P2 (solo demo) · **Estado:** abierto.

**Esperado:** si `creditCents > 0`, el titular debe decir “Venta registrada con saldo fiado” (como en modo real) o “Cobro mixto (demo)”.

**Observado:** venta de 90 con efectivo 60 + fiado 30 mostró **“Venta cobrada en efectivo (demo)”** y solo más abajo **“Saldo vivo fiado $30.00”**. Evidencia: `pagos-ui-flow.json` J2–J3; `pagos-caja-mixto-fiado-demo.png`.

**Reproducción:** crear venta 90, elegir Mixto, efectivo 100, fiado 30, cliente; confirmar y leer titular/facts.

**Archivo:** `web/src/components/caja/sale-result.tsx:17-38` (`isCashDemo` no considera `openCredit`; el título prioriza demo/efectivo).

**Impacto:** el titular afirma cobro total cuando solo una parte fue efectivo; el detalle lo corrige, pero la lectura rápida es falsa. Solo demo.

---

### P3-1 — “Por cobrar digital” incluye pendientes demo sin decirlo

**Severidad:** P3 · **Estado:** abierto (conocido, P2 en revisión previa).

**Esperado:** indicar que incluye demo o excluir los pendientes demo del agregado real.

**Observado (copia estable):** la tarjeta mostraba **$723.00** con “Links y QR de todos los días. No incluye fiado.”; el total incluye pedidos demo. A diferencia de “Ventas hoy” y “Cobrado confirmado”, no menciona demo. Evidencia: `pagos-ventas-stable.json`, `pagos-ventas-pendiente.png`.

**Archivos:** `web/src/app/ventas/page.tsx:107-109`, `web/src/lib/db.ts:1475-1487`.

**Impacto:** ambigüedad de alcance; no afirma pagado, pero mezcla demo con deuda digital.

---

### P3-2 — La cola de pendientes solo reanuda el último pedido

**Severidad:** P3 · **Estado:** conocido heredado (no re-ejecutado con dos pendientes en esta sesión).

**Esperado:** mostrar o reanudar todos los pendientes, o al menos avisar de los anteriores.

**Observado por código:** `PENDING_KEY` guarda un array, pero el arranque usa `pendingIds[pendingIds.length - 1]`; los anteriores no se muestran en `/caja`.

**Archivo:** `web/src/components/caja/caja-screen.tsx:114-116`.

**Impacto:** cobros pendientes anteriores quedan sin aviso en la pantalla nueva; siguen visibles en `/ventas`.

---

## 4. Lo que sí funciona (contratos principales)

- **Efectivo:** exacto, con cambio, decimales, miles y venta múltiple; el servidor cobra el total, no el efectivo recibido. `A`, `B`, `E3` y DB.
- **Bloqueos:** efectivo insuficiente deshabilita el CTA y no crea pedido; doble clic produce un solo POST.
- **Respuesta perdida real:** abort post-commit muestra “No sabemos si la venta quedó registrada… Reintentar venta”, conserva la misma `requestId` y no duplica (`pagos-lost-response.json`).
- **`requestId`:** mismo payload → misma orden (`201`); payload distinto → `409 request_id_conflict`; doble POST concurrente → una sola fila (`M1–M4`).
- **Digital:** pedido `confirmed` con `paidCents=0`; link/QR generan `payment_pending`; recarga reanuda el mismo cobro; demo termina `demo_paid`, nunca `paid`; el resultado dice “Pago demo (simulado)” (`G`, `H`).
- **QR/link no declaran pago:** el QR demo es un puntero a `/pay/{id}?demo=1`; no hay endpoint que marque pagado al escanear. El checkout demo llama `/api/demo/pay` y termina `demo_paid`.
- **`/api/verify`:** transacción demo y pey-demo responden `verified:false` (`pagos-verify-demo.json`, `pagos-verify-pey-demo.json`).
- **Fiado:** deuda real en DB; `/ventas` muestra `Saldo vivo $100.00 → $60.00 → Fiado saldado $100.00`; no inventa un pago (`I`).
- **Webhook:** 40/40 con firma válida, replay por `webhook-id`, firma falsa, monto distinto, orden inexistente, timestamp viejo, JSON inválido, QR y reintento corregido (`pagos-webhook-suite.json`).
- **`/ventas`:** filas de efectivo, demo, pendiente y fiado con importes/métodos correctos; `page=99` se acota a la última página; 25 por página (`L5–L11`, `pagos-ventas-pendiente.json`).

---

## 5. Motor financiero y contratos

**No se tocó el motor financiero.** `git diff --name-status 26c7741..4130e71` sobre `web/src/lib`, `web/src/app/api`, `web/src/app/pay` y `web/src/app/page.tsx` no muestra cambios. Los archivos protegidos (`orders.ts`, `cash.ts`, `db.ts`, `goals.ts`, `tasks.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `app/page.tsx`, `pay/[id]/page.tsx`, webhook, demo/pay, orders API) tienen diff vacío.

Los únicos cambios fuera del código nuevo son:

- `web/next.config.ts`: `Cache-Control: private` para `/caja` y `/ventas`.
- `web/src/components/caja-app.tsx`: `ClosingChecklist` pasa a `next/dynamic`; no cambia lógica de venta.

La UI nueva usa los mismos contratos:

- `POST /api/orders` con `{ items, cashCents aplicado, creditCents aplicado, customerName, requestId }`.
- `GET /api/orders/[id]` para detalle/polling.
- `POST /api/orders/[id]/pay` con `{ mode: "link" | "qr" }`.
- `POST /api/demo/pay` solo para demo.
- `/ventas` lee `listOrders`, `getCredit`, `getDailySummary` y `sumPendingOrderBalances` de `lib/db.ts`; no hay segunda base ni segundo webhook.

Evidencia: `pagos-engine-untouched.txt`, capturas de red en `pagos-ui-flow.json` (payloads con `requestId`), y `git status` limpio de producto.

---

## 6. Límites de esta revisión

- No se probó **pey real**, **QR real**, lector de pantalla, iOS/Safari ni una instancia de producción multi-worker. Tampoco se ejecutó un servidor con `DEMO_MODE=false`; P1-2 es específico de demo. La carrera de demo-pay se reprodujo en una **copia SQLite** con dos procesos; en el servidor 3100 de un solo proceso no se duplicó con 10 POST concurrentes.
- La base demo 3100 quedó con **120 pedidos de auditoría** (todos `demo=1`, sin pagos reales). `/api/demo/reset` respondió **409** al final de la suite webhook por datos reales preexistentes; no se forzó el borrado.
- La corrida principal tiene 2 falsos negativos de aserción (B2/I2) y 1 carrera de otro escritor (L2), ya revalidados; se documentan para no ocultar el resultado crudo.
- No se modificó producto, endpoints, base fuera de datos demo ni se hizo commit.

---

## 7. Recomendación

- **Para Oleada C:** sí, como base funcional. El flujo principal de venta/cobro y `/ventas` es utilizable en demo; el motor está intacto.
- **Para cerrar Oleada B:** **no** mientras P1-1/P1-2 y P2-1..P2-4 sigan abiertos. P1-1 y P1-2 son heredados, pero B los pone en el recorrido principal y la nueva `/ventas` los hace visibles.
- **Para handoff público:** **no**. Falta pey/QR reales, decisión sobre demo-pay, y corregir la verdad de los agregados demo.

---

## 8. Índice de evidencia

En `quality-reports/oleada-b-review/EVIDENCIAS/`:

- `pagos-ambiente.json` — HEAD, buildSha, estado, conteos demo.
- `pagos-engine-untouched.txt` — diff del motor y endpoints usados.
- `pagos-ui-flow.json` / `.log` — matriz principal de UI.
- `pagos-result-assertions.json` — revalidación de B2/I2.
- `pagos-lost-response.json` — abort post-commit + reintento.
- `pagos-502-edit.json` — 502 + edición + duplicado.
- `pagos-polling-viejo.json` — refresh manual con respuesta vieja.
- `pagos-demo-pay-adversarial.json` — demo=0 y concurrencia same-process.
- `pagos-demo-lock-race.json` — doble pago multi-proceso con lock (P1-1).
- `pagos-demo-multiproceso.json` — control sin lock (no duplicó).
- `pagos-demo-edge.json` — cash rechazado, 404, QR, demo, repetición.
- `pagos-ventas-stable.json` — agregados estables y P1-2.
- `pagos-ventas-pending.json` — fila pendiente correcta.
- `pagos-verify-demo.json`, `pagos-verify-pey-demo.json` — `verified:false`.
- `pagos-webhook-suite.json` / `.txt` — 40/40.
- `pagos-hallazgos.json` — resumen estructurado P0–P3.
- `pagos-SHA256.txt` — hashes de los 53 artefactos de evidencia.
- Capturas: `pagos-caja-*.png`, `pagos-ventas*.png`, `pagos-checkout-demo.png`, `pagos-502-*.png`, `pagos-lost-response-*.png`, `pagos-polling-viejo.png`.
