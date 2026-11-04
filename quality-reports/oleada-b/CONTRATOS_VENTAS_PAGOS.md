# Contratos de venta y pagos — Oleada B (`/caja`)

> **Carril:** `mc-ventas-pagos` · **Modo:** solo lectura (no se editó código, no se hizo commit).
> **Rama:** `design/oleada-b-caja-ventas` · **Base declarada:** `26c7741` (`docs: cierre local de Oleada A`).
> **Fecha:** 4 de noviembre de 2026.
>
> **Veredicto de esta auditoría:** contratos y reglas documentados. **No se ejecutó ningún gate ni prueba de esta matriz**, así que aquí **no se declara PASS**. La evidencia runtime vigente no corresponde al árbol actual (ver §0 y §12).

---

## 0 · Estado del árbol y de la evidencia

El árbol de trabajo **no está limpio**:

```text
 M web/src/app/inicio/page.tsx
 D web/src/app/ventas/route.ts
 M web/src/components/shell/nav.ts
?? web/src/app/caja/page.tsx
?? web/src/app/ventas/page.tsx
?? web/src/app/ventas/ventas.css
?? web/src/components/caja/caja-screen.tsx
?? web/src/components/caja/caja.css
?? web/src/components/caja/payment-panel.tsx
?? web/src/components/caja/sale-line-items.tsx
?? web/src/components/caja/sale-result.tsx
?? web/src/components/caja/sale-summary.tsx
?? web/src/components/caja/types.ts
```

Consecuencia: cualquier `verify:full` que se corra ahora tendrá `gitAtStart.dirty:true` y **no podrá ser evidencia válida** hasta que el dueño del carril commitee o revierta esos archivos. Este documento no certifica la implementación nueva de `/caja`; solo fija el contrato que debe respetar.

Evidencia disponible hoy:

| Artefacto | SHA declarado | Estado | Uso permitido |
|---|---:|---|---|
| `harness/evidence/latest-static.json` | `26c7741` | `ok:true`, 5 gates static | Sirve como base estática de la rama, **no** prueba runtime ni UI nueva. |
| `harness/evidence/latest.json` | `9206ea1` (`p0/final-closure`) | `ok:true`, 23 gates | **Obsoleto** para `26c7741`; no usarlo como evidencia del carril. |
| `harness/evidence/p0-venta-e2e.json` | `26c7741`, `dirty:false` | 66 PASS / 0 FAIL / 0 KNOWN | Baseline de la UI legacy; no prueba la `/caja` nueva. |
| `harness/evidence/p0-dinero-e2e.json` | `26c7741` | 45 PASS / 0 FAIL / 3 KNOWN | Baseline de verdad de dinero/demo. |
| `harness/evidence/p0-fiado-e2e.json` | `26c7741` | 51 PASS / 0 FAIL | Baseline de fiado. |
| `harness/evidence/p0-corte-e2e.json` | `26c7741` | 69 PASS / 0 FAIL | Baseline de corte. |

Regla del repo: la evidencia full solo vale para el `gitAtStart.sha` que declara, con árbol limpio y `serverBuildSha === sha` (`AGENTS.md`, `harness/evidence/README.md:20-27`). Un servidor de otro commit no cuenta.

> Los números de la tabla anterior son los que **declaran los artefactos existentes**; no se reejecutaron en esta auditoría.

---

## 1 · Resumen ejecutivo (lo que la UI nueva debe saber)

1. `createOrder` **no crea un pago digital**. Crea la venta en `confirmed`; dentro de esa función solo el efectivo exacto la deja `paid`, y el único que confirma dinero digital real es el webhook firmado de pey.
2. El estado inicial de **toda** venta creada es `confirmed` (`web/src/lib/orders.ts:244`). Un pedido con saldo digital pendiente sigue `confirmed` hasta que se adjunta link/QR; ahí pasa a `payment_pending` (`orders.ts:409-421`).
3. `paid` significa “cubierto”, **no** “entregable”. Un pedido con `creditCents > 0` puede quedar `paid` y aun así tener fiado abierto; `fulfillOrder` lo bloquea con `credit_open` (`orders.ts:979-1009`).
4. El campo `paymentMethod` del `POST /api/orders` **se acepta pero se ignora**. El método real se deriva de las filas de `payments` (`orders.ts:284-301`, `634-707`). La UI no debe mostrar la pestaña elegida como si fuera un dato persistido.
5. El servidor **recorta el efectivo primero y el fiado después** (`orders.ts:172-185`). La UI debe enviar montos **ya aplicados**, no el efectivo crudo recibido; si manda crudo con fiado, el servidor puede convertir el fiado en cero y cambiar el reparto.
6. El **cambio no existe en la base**. Es un cálculo de presentación: `cambio = efectivo_recibido − efectivo_aplicado`. No se envía, no se guarda, no es un pago, no es un gasto (`orders.ts:172-176`; esquema `db.ts:108-129`).
7. `requestId` es idempotente **solo con el mismo payload canónico**. Mismo payload devuelve el mismo pedido con `201`; payload distinto responde `409 request_id_conflict` (`orders.ts:56-91`, `196-216`).
8. No existen transiciones operativas para `expired`, `cancelled` ni `failed`. `draft` existe en el tipo/esquema pero no se usa. `partially_paid` está implementado en el recálculo, pero **no hay ruta pública que lo produzca**.
9. `/api/verify` es una consulta de comprobante: puede decir `verified:true` con `source:"pey"` **sin escribir nada**. No reemplaza al webhook (`api/verify/route.ts:119-217`).
10. Los riesgos más altos del carril son: doble `/api/demo/pay` concurrente, reenvío de `createOrder` con efectivo crudo + fiado, pérdida de `requestId` tras una respuesta perdida, y polling que revive un estado viejo.

---

## 2 · Fuentes auditadas

| Contrato | Archivo principal |
|---|---|
| Creación de venta | `web/src/lib/orders.ts:99-362`; `web/src/app/api/orders/route.ts:30-102` |
| Link/QR | `web/src/app/api/orders/[id]/pay/route.ts:25-161`; `orders.ts:364-526` |
| Demo | `web/src/app/api/demo/pay/route.ts:15-99` |
| Webhook | `web/src/app/api/webhooks/pey/route.ts:120-284`; `web/src/lib/pey-events.ts:81-298` |
| Registro de pago | `web/src/lib/orders.ts:528-742` |
| Reglas de proveedor | `web/src/lib/payment-rules.ts:13-26` |
| Estados y etiquetas | `web/src/lib/types.ts:1-15`; `web/src/lib/payment-labels.ts:13-178` |
| Lectura de pedido/pagos | `web/src/lib/db.ts:1304-1402`, `1441-1588`; `web/src/lib/orders.ts:1018-1026` |
| Checkout público | `web/src/lib/checkout.ts:54-131` |
| Verificación de comprobante | `web/src/app/api/verify/route.ts:22-268` |
| Regla de producto | `README.md:139-160`; `GOAL.md:42-69`; `AGENTS.md` (regla de oro) |

No se ejecutaron pruebas. Las referencias a scripts en §11 describen **cobertura existente**, no resultados de esta sesión.

---

## 3 · Contrato `createOrder` y `POST /api/orders`

### 3.1 Entrada

`POST /api/orders` recibe JSON de máximo **32 KB** (`web/src/lib/http.ts:9`; la tabla de `SECURITY.md:28` dice 64 KB porque el proxy permite 64 KB, pero la ruta lee 32 KB). Rate limit: 60 por minuto (`api/orders/route.ts:73`).

| Campo | Tipo / límite | Obligatorio | Nota |
|---|---|---:|---|
| `items` | array 1..50 | Sí | Cada ítem: `description` 1..160, `quantity` > 0 ≤ 999, `unitPriceCents` entero > 0 ≤ 10,000,000. |
| `cashCents` | entero ≥ 0, ≤ 100,000,000 | No | Se recorta al total. |
| `creditCents` | entero ≥ 0, ≤ 100,000,000 | No | Se recorta al remanente después del efectivo. |
| `customerName` | string ≤ 120, `null` | No | El servidor lo vuelve `null` si viene vacío. |
| `paymentMethod` | enum `codi/card/wallet/cash/mixed` | No | **Aceptado y descartado**; no se lee en `createOrder`. |
| `requestId` | string ≤ 128 | No | Si se omite, no hay idempotencia. |

Validaciones de `lib/orders.ts`:

| Regla | Línea |
|---|---|
| Al menos un ítem; máximo 50 | `orders.ts:100-108` |
| Cantidad finita, > 0, ≤ 999 | `orders.ts:113-122` |
| Precio unitario redondeado, > 0, ≤ 10,000,000 | `orders.ts:124-134` |
| Descripción no vacía, ≤ 160 | `orders.ts:136-145` |
| Total por ítem entero seguro, > 0 | `orders.ts:147-150` |
| Total de venta entero seguro, > 0, ≤ 100,000,000 | `orders.ts:161-170` |
| `cashCents` finito | `orders.ts:172-175` |
| `creditCents` finito | `orders.ts:178-181` |
| Nombre ≤ 120; vacío → `null` | `orders.ts:187-194` |
| `requestId` ≤ 128; vacío → `null` | `orders.ts:35-45` |

La ruta además aplica Zod (`api/orders/route.ts:30-48`) y responde `400` con `issues` si el JSON no cumple; `appErrorResponse` traduce `ValidationError` a `400` y `ConflictError` a `409` (`lib/errors.ts:28-66`).

### 3.2 Cálculo exacto de `cashCents` y `creditCents`

```text
totalCents   = Σ round(quantity_i × unitPriceCents_i)          // orders.ts:147-161
cashCents    = min(max(0, round(rawCash)), totalCents)         // orders.ts:172-176
creditCents  = min(max(0, round(rawCredit)),
                   max(0, totalCents - cashCents))              // orders.ts:178-185
digitalDue   = totalCents - cashCents - creditCents             // orders.ts:328
```

**Invariante de la UI:** enviar `cashCents` y `creditCents` **ya aplicados** y con `cashCents + creditCents ≤ totalCents`. El servidor no recibe “efectivo entregado por el cliente” ni “cambio”; si se le manda efectivo crudo junto con fiado, su recorte (efectivo primero) reasigna el fiado y produce un reparto distinto al que vio la persona.

Ejemplo correcto (total 70, recibido 100, fiado 40):

```text
aplicado a efectivo = 30
aplicado a fiado    = 40
cambio              = 100 − 30 = 70
payload             = { cashCents: 3000, creditCents: 4000, customerName: "Juan" }
```

Ejemplo incorrecto:

```text
payload = { cashCents: 10000, creditCents: 4000 }
servidor: cashCents = 7000, creditCents = 0
resultado: no hay fiado, el cambio mostrado (30) no cuadra con la venta
```

### 3.3 Efectos de `createOrder`

Dentro de `BEGIN IMMEDIATE` (`orders.ts:222`):

1. Inserta `orders` con `status='confirmed'`, `paid_cents=cashCents`, `payment_method='cash'` si hay efectivo, `credit_cents=creditCents`, `demo` según modo (`orders.ts:234-255`).
2. Inserta los ítems (`orders.ts:269-282`).
3. Si `cashCents > 0`, inserta **un** `payments` con `provider='cash'`, `method='cash'`, `status='paid'`, `amount_cents=cashCents`, `demo` según modo (`orders.ts:284-301`).
4. Si `creditCents > 0`, busca/crea cliente y inserta `credits` con `status='open'`, `balance_cents=creditCents`, `original_cents=creditCents`; actualiza `orders.credit_id` y `customer_name` (`orders.ts:303-326`). Si no hay nombre, usa `"Cliente"` (`orders.ts:305`).
5. Si `digitalDue <= 0`, actualiza el estado a `paid` cuando no hay fiado, o lo deja `confirmed` cuando hay fiado (`orders.ts:328-335`). Si `digitalDue > 0`, **no** cambia el estado: queda `confirmed`.
6. Audita `order.created` (`orders.ts:337-343`) y hace `COMMIT`.

No hay pago digital, link, QR ni evento de webhook en este paso.

### 3.4 Matriz de resultado al crear

| Caso | `cash` | `credit` | `digitalDue` | Estado | Filas `payments` | `credits` |
|---|---:|---:|---:|---|---|---|
| Efectivo exacto | total | 0 | 0 | `paid` | 1 cash | — |
| Efectivo con cambio | total (aplicado) | 0 | 0 | `paid` | 1 cash por el total | — |
| Efectivo + fiado | aplicado | aplicado | 0 | `confirmed` | 1 cash | 1 open |
| Fiado total | 0 | total | 0 | `confirmed` | 0 | 1 open |
| Digital pendiente | 0 | 0 | total | `confirmed` | 0 | — |
| Mixto con digital | aplicado | aplicado | > 0 | `confirmed` | 1 cash | 1 open |
| Efectivo exacto en modo demo | total | 0 | 0 | `paid` | 1 cash con `demo=1` | — |

Nota de demo: el efectivo no se simula por `/api/demo/pay` (esa ruta lo rechaza), pero una venta en efectivo creada con `DEMO_MODE=true` queda `paid` con `payments.demo=1` y `orders.demo=1`. El resumen diario la separa en `demoCashCents`, no en `cashCents` (`db.ts:1809-1829`). La UI debe mantener el sello global DEMO y no presentar ese efectivo como dinero real.

### 3.5 Idempotencia de `requestId`

- Se normaliza con `trim`; vacío equivale a `null` (`orders.ts:35-45`).
- El hash canónico incluye: ítems (`description`, `quantity`, `unitPriceCents`), `cashCents`, `creditCents`, `customerName` (`orders.ts:196-207`). **No** incluye `paymentMethod` (ignorado) ni el cambio (no enviado). Las llaves de objeto se ordenan; el orden del arreglo de ítems sí importa (`lib/request-hash.ts:12-30`).
- Antes de abrir transacción se busca el pedido (`orders.ts:211-216`); dentro del lock se vuelve a buscar para cubrir la carrera (`orders.ts:224-232`).
- Mismo hash → devuelve el pedido existente; la ruta responde igualmente **201** (`api/orders/route.ts:86-89`). No hay bandera `created`/`duplicate`.
- Hash distinto → `409 request_id_conflict` (`orders.ts:84-89`).
- La llave existe en el otro modo (demo/real) → `409 request_id_conflict` (`orders.ts:71-81`).
- Índice único `(merchant_id, request_id) WHERE request_id IS NOT NULL` (`db.ts:350`); la llave está scopeada por comercio. Una carrera de `INSERT` se traduce a `409` (`orders.ts:256-267`).

### 3.6 Respuestas HTTP de `POST /api/orders`

| Código | Cuándo | Cuerpo |
|---:|---|---|
| `201` | Venta creada **o** replay idempotente | `{ order }` |
| `400` | Zod, validación de dominio, JSON inválido | `{ error, issues? }` o `{ error, code }` |
| `409` | `request_id_conflict`, `num_ref_*` (no en esta ruta), etc. | `{ error, code }` |
| `413` | Cuerpo > 32 KB | `{ error, code:"body_too_large" }` |
| `429` | Rate limit 60/min | `{ error, code:"rate_limited" }` + `retry-after` |
| `500` | Fallo interno; no filtra SQLite | `{ error, code:"internal_error" }` |

`GET /api/orders` es una lista paginada con caché `private, max-age=10, stale-while-revalidate=30` (`lib/http-cache.ts:10-16`). **No sirve para polling de verdad de pago**; para eso se usa `GET /api/orders/[id]`, que devuelve `{ order, payments, credit }` (`orders.ts:1018-1026`).

---

## 4 · Contrato `POST /api/orders/[id]/pay` (link/QR)

### 4.1 Entrada y precondiciones

- Rate limit: 30/min; cuerpo máximo 8 KB (`api/orders/[id]/pay/route.ts:121-141`).
- Cuerpo opcional `{ mode?: "link" | "qr" }`; por defecto `"link"` (`route.ts:25-27`, `146-148`).
- El pedido debe existir y ser visible en el modo actual (`route.ts:75-79`; `db.ts:1489-1499`).
- Si el pedido está `paid`, `demo_paid` o `fulfilled`, devuelve el pedido **sin cambios** (`route.ts:81-87`).
- Si `totalCents - paidCents - creditCents <= 0`, devuelve el pedido **sin cambios** (`route.ts:89-90`). Esto incluye fiado total y efectivo exacto.
- Si ya hay `paymentUrl` (link) o `qrString` (QR), devuelve el pedido existente (`route.ts:97`, `115`).

### 4.2 Qué hace

| Modo | Acción | Persistencia |
|---|---|---|
| `link` | `createPaymentLink` con `amountCents = total − paid − credit` y `concept` de hasta 120 caracteres (`route.ts:117-118`; `lib/pey.ts:78-114`). En demo devuelve `${APP_URL}/pay/{id}?demo=1`; en real exige `APP_URL` HTTPS y crea link en pey. | `attachPaymentLink` guarda `payment_link_id`, `payment_url`, `status`, `updated_at` (`orders.ts:366-441`). |
| `qr` | Reserva `numRef` de 6 dígitos, hasta 10 intentos; crea QR CoDi con `expiration: 600` en pey (`route.ts:23`, `54-73`, `96-112`; `lib/pey.ts:116-156`). En demo usa un `qrString` JSON local; si pey no devuelve imagen, genera PNG local con `qrcode`. | `attachQr` guarda `qr_id`, `qr_string`, `qr_image`, `num_ref`, `status`, `updated_at` (`orders.ts:443-526`). |

`attachPaymentLink` y `attachQr`:

- Nunca degradan un pedido `paid`, `demo_paid` o `fulfilled` (`orders.ts:364`, `390-398`, `467-474`).
- Calculan `outstanding = total − paid − credit`; solo pasan a `payment_pending` si `outstanding > 0` y el estado no es `partially_paid` (`orders.ts:409-416`, `495-500`).
- Hacen `BEGIN IMMEDIATE` y vuelven a comprobar si otro proceso ya adjuntó link/QR (`orders.ts:371-407`, `448-482`).
- Auditan `payment_link.attached` / `codi_qr.attached` una sola vez (`orders.ts:422-425`, `506-510`).

### 4.3 Concurrencia e idempotencia

- Hay un lock en memoria por `orderId` (`route.ts:34-47`); dos POST concurrentes en el mismo proceso comparten la misma promesa.
- Entre procesos, la transacción y la comprobación de `payment_url`/`qr_string` dentro del lock evitan dos links/QR locales. El segundo devuelve el existente.
- Puede quedar un link/QR **huérfano en pey** si dos procesos crean recursos externos y uno pierde el attach; localmente solo hay uno. No hay doble cobro local.
- Colisión de `numRef` con otro pedido → `409 num_ref_conflict` y no se adjunta nada (`orders.ts:484-493`). Tras 10 intentos → `409 num_ref_exhausted` (`route.ts:62-73`).
- La ruta responde **200** también cuando devuelve un recurso ya existente. La UI no debe interpretar 200 como “se creó otro link”.

### 4.4 Qué NO hace

- No inserta `payments`.
- No cambia `paid_cents`.
- No confirma ningún pago.
- No entrega el pedido.
- No crea un estado `expired` cuando el QR de pey expira a los 600 s; ese dato no se persiste ni se devuelve.

---

## 5 · Contrato `POST /api/demo/pay`

### 5.1 Entrada y puerta de modo

- Solo funciona con `DEMO_MODE=true`; si no, `403 demo_disabled` (`api/demo/pay/route.ts:22-28`).
- Rate limit 30/min; cuerpo 8 KB (`route.ts:30-45`).
- Body: `{ orderId: string, method?: "codi" | "card" | "wallet" }`, default `"card"` (`route.ts:15-20`).
- **Efectivo prohibido**: `cash` no está en el enum y responde `400` (`route.ts:19`, `88-93`).

### 5.2 Qué hace

1. Busca el pedido (`route.ts:49-52`).
2. Calcula `amountCents = max(0, total − paid − credit)` (`route.ts:54`).
3. Si `amountCents <= 0`, devuelve el pedido sin escribir nada (`route.ts:55-57`).
4. Genera `transactionId = demo_txn_<id>` (`route.ts:60`).
5. Inserta en `payment_events` con `provider="demo"`, `event_type="demo.payment"`, `signature_valid=0`, payload `{orderId, method, amountCents}` (`route.ts:62-76`). **No es un evento firmado.**
6. Llama `recordPayment` con `provider:"demo"`, método digital, monto = saldo, `paymentLinkId` si existe, `rawEvent` demo (`route.ts:78-85`).
7. Responde `200 { order, transactionId }` (`route.ts:87`).

Resultado: `payments` con `demo=1`; `recalculateOrderTotals` marca `demo_paid` si el pedido queda cubierto y el último proveedor es demo (`orders.ts:677-692`; `payment-rules.ts:23-26`).

### 5.3 Límites y riesgos del contrato

- **No exige link/QR**: se puede simular sobre un pedido `confirmed` con saldo.
- **No exige que el pedido sea demo**: en modo demo, `getOrder` devuelve también filas reales si la base se reutiliza; la ruta no comprueba `orders.demo`. La UI debe restringirlo y, si el producto lo requiere, el backend debe añadir la comprobación.
- **No tiene idempotencia por `requestId`**: cada llamada genera un `transactionId` nuevo. Dos llamadas concurrentes pueden leer el mismo saldo y registrar dos pagos completos; `recordPayment` no valida contra el saldo pendiente (`orders.ts:554-604`). Es el riesgo **R-01**.
- Un fallo después de insertar `payment_events` puede dejar un evento demo sin pago; no afecta dinero real, pero ensucia auditoría.
- En modo demo, un webhook firmado también se guarda con `demo=1` y termina en `demo_paid`, no en `paid` (`orders.ts:591`; `webhook-contract` 1b). La UI no debe llamar “verificado” a un demo.

---

## 6 · `recordPayment`, webhook y “qué confirma un pago”

### 6.1 `recordPayment` (capa de biblioteca)

`web/src/lib/orders.ts:528-627`:

1. `assertPaymentProvider` acepta solo `pey` o `demo`; `cash`, `mixed` y cualquier invento lanzan (`payment-rules.ts:13-21`).
2. Exige que el pedido exista.
3. Si `transactionId` ya existe en `payments`, **no inserta**; llama `healOrderFromPayments` para recalcular `paid_cents`/estado desde las filas (`orders.ts:547-552`).
4. Si `amountCents <= 0`, no hace nada (`orders.ts:554-555`).
5. Dentro de `SAVEPOINT payment_record`, vuelve a comprobar la transacción, inserta `payments` con `status='paid'`, recalcula totales y audita (`orders.ts:560-613`).
6. `recalculateOrderTotals` suma todos los pagos `paid`, calcula `method` (`mixed` si hay más de uno), elige el último proveedor (prioriza digital sobre efectivo) y decide estado (`orders.ts:634-707`):
   - `fulfilled` nunca se degrada;
   - `paidCents + creditCents >= total` → `paid` o `demo_paid` según el último proveedor;
   - `paidCents > 0` sin cubrir → `partially_paid`;
   - si no, conserva el estado.

**Importante:** `recordPayment` **no valida** monto contra el saldo, moneda, referencias ni firma. Esa validación vive en el webhook. Ninguna ruta nueva debe exponer `recordPayment` con un monto o proveedor elegido por el cliente.

### 6.2 Webhook `POST /api/webhooks/pey`

Pipeline (`api/webhooks/pey/route.ts:120-284`):

1. Rate limit 120/min; cuerpo crudo máximo 64 KB (`route.ts:121-129`).
2. Lee `webhook-id`, `webhook-timestamp`, `webhook-signature` (`route.ts:132-134`).
3. Verifica HMAC SHA-256 de Standard Webhooks sobre `${id}.${timestamp}.${rawBody}`, tolerancia ±300 s, comparación en tiempo constante (`lib/pey.ts:195-227`).
4. Firma inválida o headers faltantes → `401`, evento `rejected` con `signature_valid=0`, payload truncado/hash, **sin tocar pedidos** (`route.ts:143-157`).
5. Sin `webhook-id` → `400` (`route.ts:159-161`).
6. JSON inválido → `400` y auditoría `webhook.invalid_json` (`route.ts:163-177`).
7. Abre `BEGIN IMMEDIATE`, inserta `payment_events` como `received`; si el `webhook-id` ya existe:
   - si el evento previo **no** era `rejected`, responde `200 {duplicate:true}` sin reprocesar (`route.ts:205-218`);
   - si era `rejected`, lo reutiliza y lo vuelve a intentar (`route.ts:219-229`).
8. `processPeyEvent` aplica el evento (`route.ts:231`), actualiza el resultado y hace `COMMIT` (`route.ts:233-236`).
9. Error de negocio (`PeyWebhookError`) → rollback, auditoría `rejected` (o actualización del reintento), status 404/409/422 (`route.ts:239-276`).

### 6.3 Validaciones de evento

`web/src/lib/pey-events.ts`:

| Evento | Validaciones | Efecto |
|---|---|---|
| `payment_link.status_updated` | `status` debe ser `paid`; si no, `ignored` (`pey-events.ts:159-163`). Exige `paymentLinkId` y `clientReferenceId`; ambos deben resolver al mismo pedido y el link debe pertenecer a ese pedido (`81-112`). Exige `currency=MXN` (`166`), al menos una transacción (`168-171`), `transactionId` único dentro del evento (`173-197`). | Si todas las transacciones son nuevas, suma `amountBreakdown.base` o `amount` y exige que el total sea **exactamente** el saldo (`146-157`, `226-227`). Luego `recordPayment` por cada una (`229-238`). |
| `codi.qr.payment_received` | Resuelve por `metadata.orderId` o `numRef`; si vienen ambos, deben coincidir (`114-144`). Exige `currency=MXN`, `amount` válido, `transactionId` (`243-255`). | Si la transacción ya existe en otro pedido → `ignored`; si es del mismo pedido → cura y responde processed. Si es nueva, exige monto exacto (`257-280`). |
| Cualquier otro `type` | — | `ignored` (`285-298`). |

### 6.4 Qué confirma un pago y qué NO

| Hecho | ¿Confirma dinero? | Efecto real |
|---|---|---|
| `POST /api/orders` con efectivo exacto | Sí, efectivo | Crea `payments` cash y deja `paid`. |
| `POST /api/orders/[id]/pay` link/QR | **No** | Solo crea una solicitud de cobro y deja `payment_pending`. |
| `POST /api/demo/pay` | **No** (simulación) | Inserta pago demo y deja `demo_paid`. |
| Webhook firmado válido de pey | **Sí, digital real** (o demo si `DEMO_MODE=true`) | Inserta `payments` pey y transiciona a `paid`/`demo_paid`. |
| `/api/verify` con `source:"local"` | Consulta un pago ya registrado | No escribe. |
| `/api/verify` con `source:"pey"` | Consulta en vivo a pey | **No escribe**; no cambia el pedido. |
| Captura, comprobante, botón, lógica del cliente | **No** | Nada. |
| `POST /api/credits/[id]/pay` | Abono de fiado | Reduce `credits.balance_cents`; no es una venta nueva ni un pago digital verificado. |
| `PATCH /api/orders/[id]` `{action:"fulfill"}` | Entrega | No cobra; solo marca `fulfilled` si el pedido está cubierto y sin fiado abierto. |

`/api/verify` live (`api/verify/route.ts:159-217`) devuelve `verified:true` si pey dice `PAID`, moneda MXN, monto igual al digital esperado y referencias correctas. Ese `verified` es una **opinión en vivo**, no un asiento contable; la orden sigue pendiente hasta el webhook. La UI puede mostrar “Confirmado ahora por pey”, pero no debe cerrar la venta ni habilitar entrega con eso.

---

## 7 · Estados: los que existen y los que no

### 7.1 Máquina real

```text
createOrder
  ├─ efectivo exacto ───────────────────────────────► paid
  ├─ efectivo + fiado / fiado total ────────────────► confirmed
  └─ saldo digital > 0 ─────────────────────────────► confirmed
                                                       │
                                     POST /pay link/QR │
                                                       ▼
                                                 payment_pending
                                                       │
                          webhook firmado válido ──────┼──────► paid
                          /api/demo/pay ───────────────┘──────► demo_paid

paid / confirmed (con fiado ya saldado) ── PATCH fulfill ──► fulfilled
```

`partially_paid` existe en el recálculo, pero no hay ruta pública que lo produzca: el webhook exige monto exacto y `/api/demo/pay` paga el saldo completo. Solo aparecería por una llamada interna a `recordPayment` con un monto parcial.

### 7.2 Nomenclatura del encargo

| Término del encargo | Estado real | Nota |
|---|---|---|
| “Solicitud creada” | `confirmed` | La venta ya existe; no implica cobro ni link. |
| “Pendiente” | `payment_pending` | Solo después de adjuntar link/QR con saldo. Un `confirmed` con `due>0` es “por cobrar”, no “esperando confirmación”. |
| “Confirmado por pey” | `paid` + fila `payments` `provider="pey"`, `demo=false` | No se alcanza por `/pay`, `/verify` ni demo. |
| “Demo” | `demo_paid` | Pago digital simulado; nunca `paid`. |
| “Expirado” | **No existe** | No hay campo, transición ni endpoint. |
| “Fallido” | **No existe como estado de pedido/pago escrito** | `PaymentStatus.failed` está en el tipo, pero nadie lo escribe. |
| “Cancelado” | **No existe escritor** | `cancelled` está en el tipo y en etiquetas, pero `PATCH` solo acepta `fulfill`. |

### 7.3 Tabla de estados

| Estado | ¿Existe? | Quién lo escribe | Significado | UI permitida |
|---|---|---|---|---|
| `draft` | Tipo/esquema, **no operativo** | Nadie; `orders.status` default en SQLite (`db.ts:111`), pero `createOrder` inserta `confirmed`. | Borrador. | No ofrecerlo; no hay endpoint. |
| `confirmed` | Sí | `createOrder` (`orders.ts:244`) | Venta registrada; puede ser fiado, mixto o digital aún sin link. | “Venta registrada” / “Por cobrar”, según saldo. |
| `payment_pending` | Sí | `attachPaymentLink`/`attachQr` (`orders.ts:409-421`, `495-500`) | Hay link/QR y saldo digital por cobrar. | “Esperando confirmación”; nunca “Pagado”. |
| `partially_paid` | Implementado, **no alcanzable por API pública** | `recalculateOrderTotals` (`orders.ts:688-689`) | Pago parcial. | No diseñar flujo para producirlo; si aparece, “Pago parcial”. |
| `paid` | Sí | `createOrder` (efectivo exacto) o webhook pey (`recalculateOrderTotals`) | Pedido cubierto. Puede tener fiado abierto. | “Pagado”, con fuente: efectivo / pey / mixto. |
| `demo_paid` | Sí | `/api/demo/pay` o webhook firmado en modo demo | Simulación cubierta. | “Pago demo (simulado)”; no entregar. |
| `fulfilled` | Sí | `PATCH /api/orders/[id]` (`orders.ts:967-1016`) | Entrega explícita. | “Entregado”; solo tras acción del servidor. |
| `cancelled` | Tipo/etiqueta/analytics, **sin escritor** | Nadie. `PATCH` solo acepta `fulfill` (`api/orders/[id]/route.ts:41-43`). | Cancelado. | **No ofrecer cancelar**; no hay contrato. |
| `expired` | **No existe** en `OrderStatus` (`types.ts:1-9`) | Nadie. README lo menciona (`README.md:142-143`), pero no hay columna, transición ni endpoint. | Expirado. | **No mostrar expiración**; un QR de pey con `expiration:600` no se refleja localmente. |
| `failed` (pago) | Tipo `PaymentStatus` (`types.ts:13`), **sin escritor** | Nadie. Los rechazos van a `payment_events`, no a `payments`. | Pago fallido. | **No mostrar “Pago fallido”** por timeout; mostrar “Sin confirmar”. |

### 7.4 Mapeo de copy recomendado

| Hecho verificable | Copy | No decir |
|---|---|---|
| `status=paid`, pago cash no demo | “Efectivo recibido” | “Verificado por pey” |
| `status=paid`, pago pey no demo | “Pago verificado por pey” | “Efectivo” |
| `status=paid`, pagos cash + pey | “Pago mixto” | “Pago verificado” para todo |
| `status=demo_paid` o pago `demo` | “Pago demo (simulado)” | “Pagado”, “Verificado”, “Entregable” |
| `status=confirmed`, `creditCents>0`, `due=0` | “Venta a fiado” | “Cobrado” |
| `status=confirmed`, `due>0`, sin link | “Venta registrada · falta cobrar” | “Esperando confirmación” (todavía no hay solicitud) |
| `status=payment_pending` | “Esperando confirmación de pey” | “Pagado”, “Fallido”, “Expirado” |
| `status=fulfilled` | “Entregado” | “Pagado” si el pago fue fiado |

---

## 8 · Secuencias exactas que debe seguir la UI nueva

### 8.1 Efectivo exacto

1. Calcular el total con los ítems; no confiar en el total local como verdad final.
2. Generar `requestId` estable y persistirlo junto con la firma del payload.
3. `POST /api/orders` con `{ items, cashCents: total, creditCents: 0, customerName: null, requestId }`.
4. Esperado: `201`, `order.status="paid"`, `paidCents=total`, `paymentMethod="cash"`, una fila `payments` cash, sin `creditId`.
5. Mostrar “Efectivo recibido” y `Cambio $0.00`. No mostrar “verificado por pey”.
6. Si se requiere entrega, `PATCH /api/orders/:id` `{ action:"fulfill" }` y leer el pedido devuelto.

**Nunca:** mandar `cashCents` mayor al total esperando que el servidor calcule el cambio; mandar `paymentMethod` y creer que se guardó; inferir pago por el `201`.

### 8.2 Efectivo con cambio

1. La persona escribe el efectivo recibido (`received`), que puede ser mayor al total.
2. Calcular `appliedCash = min(received, total - appliedCredit)`; con `credit=0`, `appliedCash=total`.
3. `cambio = max(0, received - appliedCash)`.
4. `POST /api/orders` con `cashCents = appliedCash` (no `received`), `creditCents=0`.
5. Esperado: `201`, `paid`, `paidCents=total`; **no hay campo de cambio** en la respuesta ni en la base.
6. Mostrar el cambio solo como dato de pantalla. No insertarlo como pago, gasto, retiro ni ajuste.
7. Si la pantalla se recarga antes de mostrar el resultado, el cambio se pierde: no hay fuente server. Si se persiste localmente, debe ir atado al `orderId` y marcarse como “cambio calculado”, nunca como dinero recibido.

**Nunca:** enviar `cashCents=received`; sumar el cambio al corte; decir que el servidor “guarda el cambio”.

### 8.3 Efectivo + fiado

1. Calcular `appliedCredit = min(creditInput, total)`; `appliedCash = min(cashInput, total - appliedCredit)`; `cambio = max(0, cashInput - appliedCash)`.
2. Verificar `appliedCash + appliedCredit <= total` y `customerName` no vacío. El servidor acepta nombre vacío y usa `"Cliente"` (`orders.ts:305`), pero la UI **debe** bloquearlo.
3. `POST /api/orders` con `{ items, cashCents: appliedCash, creditCents: appliedCredit, customerName, requestId }`.
4. Esperado: `201`, `status="confirmed"`, `paidCents=appliedCash`, `creditCents=appliedCredit`, `creditId` presente, una fila cash, un `credit` `open`, `digitalDue=0`.
5. Mostrar “Venta registrada”, desglose “Efectivo $X / Fiado $Y”, cambio si aplica. No mostrar “Pagado” por el total ni “verificado”.
6. No ofrecer “Entregado”: `PATCH fulfill` responderá `409 credit_open` (`orders.ts:979-999`) mientras el fiado siga abierto.
7. El abono posterior es otro contrato (`POST /api/credits/:id/pay`), no una nueva venta. Cuando el crédito quede `settled`, la entrega puede habilitarse; el pedido puede seguir `confirmed` y aun así ser entregable (`orders.ts:1000-1009`).

**Nunca:** mandar el efectivo crudo junto con fiado; dejar que el servidor “acomode” el reparto; tratar `creditCents` como dinero recibido; usar `creditCents` como saldo vivo (es el monto original).

### 8.4 Fiado total

1. `POST /api/orders` con `{ items, cashCents: 0, creditCents: total, customerName, requestId }`.
2. Esperado: `201`, `status="confirmed"`, `paidCents=0`, `creditCents=total`, `paymentMethod=null`, **cero filas** `payments`, un `credit` `open` con `balanceCents=total`.
3. Mostrar “Venta a fiado”, “No es dinero recibido”, nombre del cliente y saldo. No hay cambio.
4. No ofrecer link/QR: `POST /pay` verá `due=0` y devolverá el pedido sin cambios (`route.ts:89-90`).
5. No ofrecer entrega mientras el crédito esté abierto.
6. Si el nombre viene vacío, la UI debe bloquear; el servidor no es la validación de producto.

### 8.5 Digital pendiente (link o QR)

1. Crear la venta con el efectivo/fiado que corresponda. Si queda `digitalDue > 0`, la respuesta es `status="confirmed"` y **no** hay pago digital (`orders.ts:244`, `328-335`).
2. Solo si `total - paid - credit > 0`, llamar `POST /api/orders/:id/pay` con `{ mode: "link" }` o `{ mode: "qr" }`.
3. Esperado: `200`, `order.status="payment_pending"`, `paymentUrl` o `qrString`/`qrImage`, `paidCents` sin cambios, cero pagos digitales.
4. Mostrar el link/QR y “Esperando confirmación”. No mostrar “Pagado”, “Verificado” ni “El banco ya debitó”.
5. Polling: `GET /api/orders/:id` con `cache:"no-store"`, cada 3–5 s al inicio, luego backoff (10–30 s), pausado si la pestaña está oculta, una sola petición en vuelo. Parar en `paid`, `demo_paid`, `fulfilled` o `cancelled`; seguir en `confirmed`/`payment_pending`/`partially_paid` solo si `due > 0`.
6. Leer `payments` y `lastPaymentProvider`/`lastPaymentDemo` del detalle para decidir el copy; no alcanza con `status`.
7. Si ya hay `paymentUrl`/`qrString`, no volver a llamar `/pay`; si hay `409 num_ref_*`, mostrar “No se pudo generar el QR, intenta de nuevo” y no adjuntar nada.
8. Si el pedido se recarga, leer el detalle y reanudar el polling; no recrear la venta. La `requestId` de creación no se reutiliza para un pedido nuevo.

**Nunca:** llamar `/pay` en bucle; interpretar `payment_pending` como fallo; inventar un contador de expiración; usar `GET /api/orders` (cacheado 10 s) como fuente de polling.

### 8.6 Demo

1. Solo si `demoMode === true` y el pedido pertenece a la sesión demo; mostrar “Simular pago” únicamente en ese contexto.
2. Verificar `due > 0`; si no, `/api/demo/pay` devuelve el pedido sin cambios (`route.ts:55-57`).
3. `POST /api/demo/pay` con `{ orderId, method: "codi" | "card" | "wallet" }`. No enviar `cash`.
4. Esperado: `200`, `status="demo_paid"`, `lastPaymentProvider="demo"`, pago con `demo=true`; el `payment_events` tiene `signature_valid=0`.
5. Mostrar “Pago demo (simulado)”, “No es dinero real. No se entrega.” Botón “Cerrar demo” (`payment-labels.ts:62-65`, `149-178`).
6. No llamar `PATCH fulfill`: el servidor responde `409 demo_not_deliverable` (`orders.ts:971-978`).
7. Si la persona hace doble clic, bloquear en UI; el servidor **no** tiene idempotencia para esta ruta (R-01).
8. Si `DEMO_MODE=true` y llega un webhook firmado, el resultado sigue siendo `demo_paid`, no `paid` (`orders.ts:591`).

### 8.7 Pago confirmado por evento válido

1. Precondición: pedido con saldo digital, link/QR adjunto, `payment_pending`.
2. pey envía `POST /api/webhooks/pey` con `webhook-id`, `webhook-timestamp`, `webhook-signature` y body crudo. La firma debe validar dentro de ±300 s (`lib/pey.ts:195-227`).
3. El evento debe ser `payment_link.status_updated` con `status="paid"` o `codi.qr.payment_received`; debe traer referencias de **este** pedido, moneda `MXN`, transacciones no vacías y monto exacto al saldo (`pey-events.ts:146-157`, `226-227`, `243-280`).
4. El servidor inserta `payment_events`, `payments` (provider `pey`, `status="paid"`, `transactionId` único) y recalcula la orden en una sola transacción (`route.ts:194-236`; `orders.ts:560-613`).
5. Esperado: `200 {ok:true, result:"processed"}`; `order.status="paid"`, `paidCents` cubierto, `payments` con pey no demo.
6. La UI se entera por polling del detalle: muestra “Pago verificado por pey” solo si el pago es `provider==="pey"` y `demo===false`. Si además `creditCents > 0`, mostrar “Pagado con fiado pendiente” y **no** ofrecer entrega hasta que el crédito esté saldado.
7. Si el evento llega duplicado con el mismo `webhook-id`, el servidor responde `200 duplicate` y no duplica (`route.ts:205-218`).
8. Si el evento es rechazado por monto/moneda/referencia, la orden queda intacta y la UI sigue “Esperando confirmación”; no mostrar “Fallido”.
9. Si el evento es válido pero `DEMO_MODE=true`, el resultado es `demo_paid`; mostrar demo.
10. La entrega es un paso aparte: `PATCH` `fulfill`; nunca automática tras el webhook.

---

## 9 · Riesgos de doble registro, `requestId`, reintentos y polling

| ID | Sev. | Riesgo | Disparador | Impacto | Mitigación / prueba |
|---|---|---|---|---|---|
| R-01 | P1 | Doble `/api/demo/pay` concurrente | Dos clics/llamadas leen el mismo `due`; cada una crea `transactionId` nuevo | `paid_cents` puede superar el total; dos pagos demo; cifras infladas | Lock de UI **y** idempotencia server-side por `requestId` o lock por pedido; prueba A-T/S |
| R-02 | **P0** | Efectivo crudo + fiado | UI envía `cashCents=recibido` y `creditCents>0` | El servidor recorta efectivo primero, deja fiado en 0 y el cambio mostrado no cuadra | Enviar montos aplicados con suma ≤ total; validar antes; prueba A-T/C |
| R-03 | **P0** | Respuesta perdida + edición | `POST /orders` commitea, se pierde la respuesta, la persona edita y reintenta con otra firma | Venta duplicada; el `requestId` viejo ya no sirve | Persistir llave+firma; reintentar el mismo payload antes de editar; no borrar la llave hasta éxito; prueba A-T/R |
| R-04 | P1 | Dos pestañas | Cada pestaña genera su propia llave para el mismo carrito | Dos ventas | Coordinar por `BroadcastChannel`/storage o bloquear la segunda; prueba nueva |
| R-05 | P1 | `requestId` de otro modo | Se reutiliza una llave demo en real (o al revés) | `409 request_id_conflict`; la UI podría reintentar con llave nueva y cobrar dos veces | Namespace por modo; ante 409 no reintentar a ciegas; prueba A-T/Q |
| R-06 | P1 | Polling viejo revive estado | Una respuesta GET anterior llega después de `paid` | La UI vuelve a “Pendiente” | `AbortController` + secuencia monotónica; ignorar respuestas con `updatedAt` menor; prueba A-T/S |
| R-07 | P1 | Polling infinito | `confirmed` con fiado (`due=0`) o estado terminal mal clasificado | Batería/red; UI nunca cierra | Parar si `due<=0` o estado terminal; no usar solo `status`; prueba nueva |
| R-08 | P1 | Demo paga pedido real | `DEMO_MODE=true` con base reutilizada; `/api/demo/pay` no comprueba `orders.demo` | Pedido real pasa a `demo_paid` y desaparece del modo real | Restringir en UI a pedidos demo; agregar guard server-side; prueba A-T/T |
| R-09 | P1 | `paid` tratado como entregable | Pedido mixto/pey con `creditCents>0` y fiado abierto | La UI ofrece “Entregar”; el servidor responde 409 `credit_open` | Consultar `credit.balanceCents`; no ofrecer entrega con fiado abierto; prueba A-T/T |
| R-10 | P1 | `digitalPaidCents` como “verificado” | Incluye pagos demo (`db.ts:1304-1322`) | Se presenta dinero simulado como real | Usar `payments`/`lastPaymentDemo`; no rotular “verificado” por `digitalPaidCents`; prueba A-T/H |
| R-11 | P1 | `paymentMethod` ignorado | La UI cree que el selector quedó guardado | Copy/Reportes inconsistentes; método real es otro | Derivar de `payments`; no usar el campo de entrada; prueba A-T/A |
| R-12 | P2 | Link/QR huérfano externo | Dos procesos crean recurso y uno pierde el attach | Recurso basura en pey; no doble cobro local | Aceptar; auditar; no regenerar por polling |
| R-13 | P2 | Zombi `payment_pending` | QR expira en pey a 600 s; local no lo sabe | Pedido pendiente para siempre; UI podría prometer expiración | No mostrar expiración; si se necesita, contrato backend nuevo |
| R-14 | P2 | `GET /api/orders` cacheado | Polling de la lista | Hasta 10 s de atraso + `stale-while-revalidate` | Polling solo a `GET /api/orders/[id]` con `no-store` |
| R-15 | P2 | `recordPayment` confía en el caller | Una ruta nueva pasa monto/proveedor del cliente | Pago sin validar monto/firma | No exponer `recordPayment`; solo webhook/demo controlados |
| R-16 | P2 | `verify` live no persiste | Se muestra “verificado” y se entrega sin webhook | Pedido sigue pendiente; entrega sin asiento | Mostrar “confirmado ahora”, no “pagado”; esperar webhook |
| R-17 | P2 | `Order` no expone `demo` | UI no puede etiquetar efectivo demo por pedido | Copy “cobrado” sobre datos demo | Sello global DEMO; si se necesita por fila, exponer `demo` |
| R-18 | P2 | Estados documentados pero no implementados | README menciona `cancelled/expired` | La UI ofrece acciones que el servidor no soporta | No implementar en UI sin contrato backend |

---

## 10 · Reglas que la UI NUNCA debe inferir en cliente

| Dato | Fuente correcta | Prohibido |
|---|---|---|
| “Pagado” | `order.status === "paid"` leído del servidor | Deducirlo de `201`, del total, de un botón, de una captura o del éxito de `/pay`. |
| “Verificado por pey” | Fila `payments` con `provider==="pey"` y `demo===false` | Llamar “verificado” a un demo, a un efectivo o a `digitalPaidCents`. |
| “Demo” | `status==="demo_paid"`, `payment.demo===true` o `provider==="demo"` | Deducirlo solo de `DEMO_MODE` (el efectivo demo queda `paid`). |
| Cambio | `max(0, efectivo_recibido − efectivo_aplicado)` | Enviarlo al servidor, guardarlo como pago/gasto, o recalcularlo con `paidCents` después de un abono. |
| Método de pago | Filas `payments` y `order.paymentMethod` devuelto | Usar el `paymentMethod` del request o la pestaña seleccionada como verdad. |
| Monto pendiente | `totalCents − paidCents − creditCents` del servidor | Sumar ventas locales o usar solo `totalCents`. |
| Saldo de fiado | `credit.balanceCents` de `GET /api/orders/[id]` | Usar `order.creditCents` como saldo vivo: es el monto original. |
| Entregable | `PATCH fulfill` debe aceptarlo; revisar `credit.balanceCents` y estado | Deducirlo de `paid`, de `due=0` o de que el webhook llegó. |
| Cancelado / expirado / fallido | No hay transición operativa | Inventar estados, countdowns o botones de cancelar. |
| Éxito de link/QR | `payment_pending` + `paymentUrl`/`qrString` | Decir “cobrado” porque el link se generó. |
| Éxito de `/api/verify` | `verified:true` es una consulta | Cerrar la venta o habilitar entrega sin webhook. |
| `requestId` | Generado por la UI y persistido con la firma | Reutilizarlo con otro payload, vaciarlo antes de éxito o compartirlo entre demo/real. |
| Idempotencia | Mismo hash → mismo pedido | Asumir que un `201` significa “nuevo” o que un reintento siempre es seguro. |
| Total/precio | `createOrder` recalcula desde ítems | Enviar un total distinto o confiar en el total local si el servidor devolvió otro. |
| `lastPaymentProvider` | Último proveedor con prioridad digital | Tratarlo como “último cronológico”; el efectivo puede ser posterior y no ser el elegido (`db.ts:1324-1361`). |
| Expiración de QR | No existe en el contrato local | Mostrar “expira en 10:00” o “QR expirado”. |
| `order.demo` | No está expuesto en `Order` (`types.ts:25-48`) | Filtrar/etiquetar por un campo que la API no devuelve. |

---

## 11 · Matriz obligatoria A–T de este carril

> **Cómo leerla:** los identificadores A–T son los 20 casos mínimos que este carril debe cubrir. La columna “Cobertura actual” describe scripts/evidencia **existentes**; no significa que se hayan ejecutado en esta auditoría. “NUEVO” significa que no hay prueba y debe crearse antes de declarar el caso.

### Clases de evidencia

- **E1 — Venta UI:** `p0-venta` 66/0 con `code.commit` del HEAD, `dirty:false`, JSON de resultados y capturas 360/320.
- **E2 — Dinero/demo:** `p0-dinero` 45/0 + 3 KNOWN, con DB y capturas.
- **E3 — Webhook:** `webhook-contract` 40/40 + filas `payments`/`payment_events` y auditoría.
- **E4 — Datos/seguridad:** `p0-fix-datos` (85 checks) + `security-contract`.
- **E5 — Integración/fiado:** `p0-integracion` 51/0 + `p0-fiado` 51/0; `p0-corte` 69/0 si se toca efectivo.
- **E6 — Nueva UI:** Playwright sobre `/caja`, con payload de red, captura 390/320/1448, consola sin errores y aserción directa a SQLite/API.

| ID | Caso | Resultado esperado | Evidencia exigida | Cobertura actual |
|---|---|---|---|---|
| A | Efectivo exacto | `201`, `paid`, `paidCents=total`, 1 pago cash, sin crédito | E1/E2 + DB `payments` 1 fila cash; captura de resultado “Efectivo recibido” | Parcial en `p0-venta`; falta aserción explícita de 1 pago |
| B | Efectivo con cambio | `201`, `paid`, pago cash por el total; cambio solo visual; DB sin campo de cambio | E1 (`p0-venta-e2e.py:425-460`) + captura “Cambio $10” y DB `paid_cents=total` | Existe en UI legacy; **no** prueba `/caja` nueva |
| C | Efectivo + fiado | `201`, `confirmed`, `paid=cash`, `credit=fiado`, 1 cash + 1 credit open, `digitalDue=0` | E1 (`p0-venta-e2e.py:475-527`) + E5; DB `orders`/`credits` | Existe en UI legacy; **no** prueba `/caja` nueva |
| D | Fiado total | `201`, `confirmed`, `paid=0`, `credit=total`, 0 pagos, `credit.balance=total` | E5 (`p0-fiado`) + `p0-venta-e2e.py:705-729`; captura “Venta a fiado” | Existe; falta captura nueva |
| E | Digital pendiente | `201`, `confirmed`, 0 pagos; luego link → `payment_pending`, `due=total` | E1 (`p0-venta-e2e.py:570-610`) + E5 (`p0-integracion-e2e.py:752-843`) + DB | Existe en legacy; **no** prueba `/caja` nueva |
| F | Link idempotente | Dos POST concurrentes → mismo `paymentLinkId`/`paymentUrl`, 1 audit, `payment_pending` | E4 (`p0-fix-datos-contract.mjs:672-712`) + DB/audit | Existe; reejecutar contra HEAD |
| G | QR idempotente y `numRef` | Dos POST → mismo `qrId`/`numRef`; 10 colisiones → `409`, sin adjuntar | E4 (`p0-fix-datos-contract.mjs:714-789`) + DB | Existe; reejecutar contra HEAD |
| H | Demo | Solo demo; `cash` → 400; `codi` → `demo_paid`; no suma a `cashCents`/verificado | E2 (`p0-dinero-e2e.py:375-424`) + DB `payment_events.signature_valid=0` | Existe; falta doble clic |
| I | Webhook link válido | Firma válida, monto exacto → `processed`, `paid`, 1 pago, audit `processed` | E3 (`webhook-contract.mjs:251-293`) + DB | Existe; reejecutar |
| J | Webhook QR válido | QR firmado, monto exacto → `processed`, `paid`, 1 pago | E3 (`webhook-contract.mjs:598-620`) + DB | Existe; reejecutar |
| K | Firma inválida / timestamp viejo | `401`, sin pagos, orden intacta, evento `rejected` `signature_valid=0` | E3 (`webhook-contract.mjs:352-372`, `541-557`) + DB | Existe; reejecutar |
| L | Monto/moneda/referencia incorrectos | `409`/`422`, sin pagos, orden intacta | E3 (`webhook-contract.mjs:374-560`) + DB | Existe; reejecutar |
| M | Replay mismo `webhook-id` | `200 duplicate`, 1 solo pago, estado sin cambio | E3 (`webhook-contract.mjs:314-331`) + DB | Existe; reejecutar |
| N | Replay misma transacción, otra llave | `processed`, cura `paid_cents`, 1 solo pago | E3 (`webhook-contract.mjs:333-350`) + E4 (`p0-orders-atomic-contract.mjs:211-242`) | Existe; reejecutar |
| O | `requestId` mismo payload | Dos POST → `201` mismo `order.id`, 1 fila DB | E4 (`p0-fix-datos-contract.mjs:485-507`) | Existe; reejecutar |
| P | `requestId` payload distinto | `409 request_id_conflict`, sin nueva orden, total original intacto | E4 (`p0-fix-datos-contract.mjs:509-560`; `security-contract.mjs:660-686`) | Existe; reejecutar |
| Q | `requestId` cross-mode | Demo→real → `409`, sin pedido nuevo | E5/`p0-demo-real-contract.mjs:397-410` | Existe; reejecutar |
| R | Respuesta perdida / 502 post-commit | Reintento con misma llave → mismo pedido, 1 orden | E1 (`p0-venta-e2e.py:321-421`) | Existe en legacy; **no** prueba `/caja` nueva |
| S | Doble tap / polling / doble demo | Un solo POST de venta; un solo pago; polling viejo no revive estado; doble `/api/demo/pay` **no** duplica | E1 doble tap (`p0-venta-e2e.py:390-421`) + E5 poll viejo (`p0-integracion-e2e.py:735-750`) + **NUEVO** test concurrente de `/api/demo/pay` | **Parcial: falta el caso demo concurrente** |
| T | Demo/real y entrega | `demo_paid` → `409 demo_not_deliverable`; `paid` con fiado abierto → `409 credit_open`; solo cubierto sin fiado → `fulfilled` | E3 (`webhook-contract.mjs:295-312`) + E4 (`security-contract.mjs:636-658`) + E4 (`p0-orders-atomic-contract.mjs:244-270`) | Existe; reejecutar |

**Estado de la matriz:** no ejecutada. Los scripts existen para A–R y T; **S tiene un hueco** (doble `/api/demo/pay` concurrente) y **B–E/R** requieren una corrida nueva contra la UI `/caja`, no solo contra la legacy. Sin esa evidencia no se puede declarar A–T en verde.

---

## 12 · Evidencia que debe existir antes de decir “listo”

### 12.1 Gate mínimo del carril

Desde `web/`, con árbol limpio y commit hecho:

```bash
npm run verify:fast        # guardrails + lint + tipos
npm run test:fix-datos     # contrato de datos (incluye idempotencia/atomicidad)
npm run test:security      # CSRF, requestId duplicado, límites
npm run test:payment-labels
npm run test:contracts
npm run verify:full        # 23 gates; para UI/runtime es el válido
npm run verify:evidence    # exige latest.json contra HEAD limpio
```

Para este carril son obligatorios además:

- `node scripts/webhook-contract.mjs` → **40/40** (`harness-gate.mjs:116-122`).
- `p0-venta` → **66 PASS / 0 FAIL / 0 KNOWN** (`harness-gate.mjs:257-266`).
- `p0-dinero` → **45 PASS / 0 FAIL / 3 KNOWN** (`harness-gate.mjs:323-332`).
- `p0-integracion` → **51 PASS / 0 FAIL / 0 KNOWN** (`harness-gate.mjs:307-321`).
- `p0-fiado` → **51/0/0** si se toca fiado o entrega; `p0-corte` → **69/0/0** si se toca efectivo/corte.

### 12.2 Reglas de aceptación de la evidencia

1. `latest.json` debe declarar `gitAtStart.sha` = commit entregado, `dirty:false`, `serverBuildSha` = mismo SHA, `complete:true`, `ok:true`.
2. `npm run verify:evidence` debe pasar; un `--only`/`--skip` es `partial` y no cuenta.
3. Cada artefacto debe tener `sha256`/tamaño y existir; un JSON sin hash o con SHA distinto no cuenta.
4. Las capturas nuevas deben ser de `/caja` (no `/` legacy), en 390, 320 y 1448, con teclado/foco y sin overflow.
5. Para cada caso A–T debe existir una aserción nombrada y, cuando aplique, una consulta DB reproducible (`orders.status`, `paid_cents`, `credit_cents`, `payments`, `payment_events.result/signature_valid`, `credits.balance_cents`).
6. Un caso no ejecutado se reporta `NOT RUN`, no `PASS`.
7. La evidencia actual `latest.json` (SHA `9206ea1`) **no** sirve para este carril; hay que regenerarla sobre el commit nuevo.

---

## 13 · Decisiones que requieren aprobación (no las puede inventar la UI)

| Tema | Estado actual | Decisión necesaria |
|---|---|---|
| Cancelar venta | No hay endpoint; `PATCH` solo `fulfill` | Si el producto lo pide, abrir tarea backend con estado/transición y auditoría. |
| Expiración de QR | pey recibe `expiration:600`, pero no se persiste | No mostrar countdown; si se quiere, guardar `expires_at` y definir transición. |
| Pago fallido | `PaymentStatus.failed` sin escritor | No mostrar “fallido”; definir si un rechazo de webhook debe crear estado visible. |
| `partially_paid` | Implementado en recálculo, sin ruta pública | No diseñar UI para producirlo; decidir si se elimina o se expone con contrato. |
| Idempotencia de `/api/demo/pay` | No existe por pedido | Agregar `requestId`/lock server-side o aceptar el riesgo con bloqueo de UI (no recomendado). |
| `paymentMethod` de entrada | Aceptado e ignorado | Implementarlo o quitarlo del contrato para no confundir a la UI. |
| `Order.demo` | No expuesto | Si la UI necesita etiquetar efectivo demo por fila, exponerlo; mientras, usar sello global. |
| `paid` con fiado abierto | Permitido por diseño; entrega bloqueada | Definir copy: “Pagado, fiado pendiente” y no ofrecer entrega. |
| `/api/verify` live | No escribe | Decidir si la UI lo usa solo como consulta o si se elimina del flujo de caja. |

---

## 14 · Anexo: mapa rápido de archivos y líneas

| Tema | Líneas |
|---|---|
| Límites y validaciones | `web/src/lib/orders.ts:27-45`, `99-170` |
| Recorte efectivo/fiado | `web/src/lib/orders.ts:172-185` |
| Hash e idempotencia | `web/src/lib/orders.ts:56-91`, `196-216`; `web/src/lib/request-hash.ts:12-30` |
| Inserción de orden/pagos/crédito | `web/src/lib/orders.ts:234-335` |
| Link/QR | `web/src/lib/orders.ts:364-526`; `web/src/app/api/orders/[id]/pay/route.ts:75-161` |
| `recordPayment`/recálculo | `web/src/lib/orders.ts:528-742` |
| Entrega | `web/src/lib/orders.ts:967-1016`; `web/src/app/api/orders/[id]/route.ts:20-57` |
| Demo | `web/src/app/api/demo/pay/route.ts:15-99` |
| Webhook | `web/src/app/api/webhooks/pey/route.ts:120-284`; `web/src/lib/pey-events.ts:81-298` |
| Firma | `web/src/lib/pey.ts:195-227` |
| Proveedores/estado cubierto | `web/src/lib/payment-rules.ts:13-26` |
| Estados/tipos | `web/src/lib/types.ts:1-15`, `25-48` |
| Etiquetas de dinero | `web/src/lib/payment-labels.ts:13-178` |
| Lectura de detalle | `web/src/lib/orders.ts:1018-1026`; `web/src/lib/db.ts:1489-1588` |
| Resumen diario/demo | `web/src/lib/db.ts:1809-1846` |
| Checkout público | `web/src/lib/checkout.ts:54-131` |
| Verificación de comprobante | `web/src/app/api/verify/route.ts:22-268` |
| Caché de listas | `web/src/lib/http-cache.ts:10-16` |
| Regla de producto | `README.md:139-160`; `GOAL.md:42-69` |

---

### Cierre

Este documento fija el contrato que la `/caja` nueva debe respetar, pero **no certifica** la implementación actual ni sus pruebas. Para convertir este análisis en un PASS hacen falta, como mínimo: árbol limpio, commit, build con identidad, `verify:full`/`verify:evidence` verdes y la matriz A–T ejecutada con evidencia por caso. Hoy A–R y T tienen guiones reutilizables; S tiene un hueco real (doble `/api/demo/pay`) y B–E/R exigen una corrida contra la UI nueva, no contra la legacy.
