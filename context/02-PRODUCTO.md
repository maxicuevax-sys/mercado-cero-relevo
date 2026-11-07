# 02 · Producto: mapa real

> **Código auditado:** `b7154ca` (base de `p0/context-recovery` y código de producto de `p0/final-cognitive`; la final avanzó a `2a786f1` solo con un doc de bloqueo).
> **Regla:** este documento describe **lo que el código hace**, no lo que los reportes dicen que hace. Cuando algo no se pudo ejecutar, se marca `NO VERIFICADO`.
> **Fuente principal:** `web/src`, `web/scripts`, `web/package.json`, `web/next.config.ts`, esquema SQLite en `web/src/lib/db.ts`.

---

## 1 · Tesis y alcance

Mercado Cero es una PWA mobile-first de caja para una comerciante de barrio. El recorrido central es:

```
abrir → vender (voz/texto/manual) → confirmar venta → cobrar (efectivo / link-QR / fiado / mixto)
→ verificar comprobante → corte de caja → meta (apartado declarado)
```

La app **no es un POS genérico**: la diferencia es la **certeza** del pago digital. Un pago digital pendiente solo llega a `paid` por un webhook firmado de pey; el efectivo se registra `paid` al crear la venta; el demo usa `demo_paid`. La UI debe distinguir “venta registrada”, “cobrado confirmado”, “por cobrar”, “fiado”, “demo” y “declarado sin verificar”.

- Tesis y MVP: `README.md:14-30`, `README.md:59-91`.
- Invariantes: `GOAL.md:42-69`.
- Estado de cierre: `GOAL-CIERRE-DEMO.md:8-34`.

---

## 2 · Stack y topología

| Capa | Implementación | Fuente |
|---|---|---|
| Framework | Next.js **16.4.3**, React 19.3, TypeScript, Tailwind 4 | `web/package.json:34-52` |
| Datos | SQLite vía `node:sqlite` (`DatabaseSync`), WAL, `busy_timeout=5000`, foreign keys | `web/src/lib/db.ts:76-104` |
| Estado | Server components + APIs; la caja se hidrata con `getDashboardData` | `web/src/app/page.tsx:10-20` |
| Rutas | App Router: `/`, `/pay/[id]`, `/pay/[id]/success`, APIs | `web/src/app` |
| Voz | MediaRecorder → `/api/voice/transcribe` (OpenAI) → `/api/voice/parse` (OpenAI o parser local) | `web/src/lib/voice.ts:34-93`; `web/src/components/caja-app.tsx:1636-1695` |
| TTS | Frases fijas Kokoro `em_santa` en `public/tts`; dinámicas con Piper `es_MX-claude-high` | `web/src/components/caja-app.tsx:182-197`; `web/src/app/api/tts/route.ts:14-29` |
| Deploy | Next `standalone`/`next start`; preview por Cloudflare Tunnel; producción requiere Cloudflare Access | `SECURITY.md:3-5`, `SECURITY.md:92-103` |
| Build identity | `BUILD_SHA` sellado; `/api/health` lo devuelve | `web/scripts/build-gate.mjs`; `web/src/app/api/health/route.ts:10-24` |

**No hay service worker, IndexedDB, cola offline ni ruta `/api/export`.** `git grep` de `serviceWorker`, `navigator.onLine`, `indexedDB`, `/api/export` no devuelve resultados en `web/src`. Ver §14.

---

## 3 · Rutas y APIs

### 3.1 Páginas

| Ruta | Archivo | Función |
|---|---|---|
| `/` | `web/src/app/page.tsx` | Caja SSR; lee `getDashboardData({ compactPending: true })` y pasa `initialDemoMode`. |
| `/pay/[id]` | `web/src/app/pay/[id]/page.tsx` | Checkout público SSR; `notFound()` si el pedido no existe. |
| `/pay/[id]/success` | `web/src/app/pay/[id]/success/page.tsx` | Confirmación pública; distingue pendiente / verificado / demo / efectivo. |
| `/pay/[id]/not-found` | `web/src/app/pay/[id]/not-found.tsx` | UI “No encontramos este cobro”. |

### 3.2 APIs

| Método y ruta | Archivo | Qué hace |
|---|---|---|
| `GET /api/dashboard` | `web/src/app/api/dashboard/route.ts:15` | Dashboard: resumen, pedidos recientes, pendientes, créditos, metas, tareas, demoMode. |
| `GET /api/analytics?period=today|week|month` | `web/src/app/api/analytics/route.ts:7` | Reporte por periodo, comparación, serie, mejor día/hora. |
| `GET /api/orders` | `web/src/app/api/orders/route.ts:50` | Lista paginada de pedidos. |
| `POST /api/orders` | `web/src/app/api/orders/route.ts:72` | Crea venta; valida items, efectivo, fiado, cliente y `requestId`. |
| `GET /api/orders/[id]` | `web/src/app/api/orders/[id]/route.ts:11` | Detalle: pedido + pagos + crédito. |
| `PATCH /api/orders/[id]` | `web/src/app/api/orders/[id]/route.ts:20` | Solo `fulfill`/`fulfilled`: marca entrega; rechaza demo y fiado abierto. |
| `POST /api/orders/[id]/pay` | `web/src/app/api/orders/[id]/pay/route.ts:121` | Genera link de pey o QR CoDi; lock por pedido; `numRef` reservado. |
| `POST /api/demo/pay` | `web/src/app/api/demo/pay/route.ts:22` | Simula pago digital (`codi`, `card`, `wallet`); nunca efectivo; exige demoMode. |
| `POST /api/demo/reset` | `web/src/app/api/demo/reset/route.ts:10` | Reset demo con CSRF, rate limit, token opcional, backup y bloqueo por datos reales. |
| `GET /api/credits` | `web/src/app/api/credits/route.ts:12` | Lista de fiados. |
| `POST /api/credits/[id]/pay` | `web/src/app/api/credits/[id]/pay/route.ts:19` | Abono: monto, método, nota, `requestId`, `expectedBalanceCents`. |
| `GET /api/cash` | `web/src/app/api/cash/route.ts:4` | Estado del corte del día. |
| `POST /api/cash/preview` | `web/src/app/api/cash/preview/route.ts:40` | Preview no destructivo con fingerprint. |
| `POST /api/cash/close` | `web/src/app/api/cash/close/route.ts:57` | Guarda corte versionado. |
| `GET /api/goals` | `web/src/app/api/goals/route.ts:17` | Lista metas. |
| `POST /api/goals` | `web/src/app/api/goals/route.ts:21` | Crea meta (API existe; la UI no ofrece creación). |
| `POST /api/goals/[id]/contribute` | `web/src/app/api/goals/[id]/contribute/route.ts:28` | Aportación con `requestId` obligatorio. |
| `GET /api/tasks` | `web/src/app/api/tasks/route.ts:45` | Lista pendientes. |
| `POST /api/tasks` | `web/src/app/api/tasks/route.ts:68` | Crea pendiente. |
| `PATCH /api/tasks/[id]` | `web/src/app/api/tasks/[id]/route.ts:28` | `complete`, `reopen`, `postpone`, `delete`. |
| `DELETE /api/tasks/[id]` | `web/src/app/api/tasks/[id]/route.ts:85` | Soft delete. |
| `GET /api/checkout/[id]` | `web/src/app/api/checkout/[id]/route.ts:4` | Payload público del checkout; ETag/304; 404 real. |
| `GET /api/verify?transactionId=&orderId=` | `web/src/app/api/verify/route.ts:44` | Verifica comprobante; local solo `provider='pey'`; demo rechazado. |
| `GET /api/reconcile` | `web/src/app/api/reconcile/route.ts:4` | Conciliación read-only contra pey. |
| `POST /api/voice/parse` | `web/src/app/api/voice/parse/route.ts:13` | Interpreta texto; OpenAI o parser local. |
| `POST /api/voice/transcribe` | `web/src/app/api/voice/transcribe/route.ts:11` | Transcribe audio; 12 MB; CSRF propio. |
| `POST /api/tts` | `web/src/app/api/tts/route.ts:116` | Kokoro fijo / Piper dinámico; sin fallback al navegador. |
| `POST /api/webhooks/pey` | `web/src/app/api/webhooks/pey/route.ts:120` | Webhook firmado; idempotencia; auditoría; transición a `paid`. |
| `GET /api/health` | `web/src/app/api/health/route.ts:10` | `buildSha` + node + uptime. |

**No hay endpoints de auth, sesión, usuarios, exportación, inventario ni proveedores.**

---

## 4 · Modelo de datos

Esquema en `web/src/lib/db.ts:107-273`:

| Tabla | Campos clave | Uso |
|---|---|---|
| `orders` | `id`, `merchant_id`, `status`, `total_cents`, `paid_cents`, `payment_method`, `customer_name`, `credit_id`, `credit_cents`, `payment_link_id`, `payment_url`, `qr_id`, `qr_string`, `num_ref`, `request_id`, `request_hash`, `demo` | Venta y estado. |
| `order_items` | `order_id`, `description`, `quantity`, `unit_price_cents`, `total_cents` | Renglones. |
| `payments` | `order_id`, `provider`, `method`, `amount_cents`, `status`, `transaction_id UNIQUE`, `payment_link_id`, `raw_event`, `demo` | Pagos. |
| `payment_events` | `provider`, `event_type`, `idempotency_key UNIQUE`, `payload`, `payload_hash`, `signature_valid`, `result`, `error` | Auditoría del webhook. |
| `customers` | `name`, `demo`; índice único `(name, demo)` | Fiado demo/real separado. |
| `credits` | `customer_id`, `order_id`, `original_cents`, `balance_cents`, `status` | Deuda. |
| `credit_payments` | `credit_id`, `amount_cents`, `method`, `provider`, `note`, `request_id`, `request_hash`, `demo` | Abonos. |
| `audit_log` | `action`, `entity`, `entity_id`, `detail` | Trazabilidad. |
| `cash_closes` | `date`, `version`, `opening_cents`, `cash_sales_cents`, `cash_credit_cents`, `expenses_cents`, `withdrawals_cents`, `expected_cents`, `counted_cents`, `difference_cents`, `snapshot_*`, `reason`, `request_id` | Corte versionado. |
| `goals` | `title`, `target_cents`, `saved_cents`, `deadline`, `status`, `demo` | Meta. |
| `goal_contributions` | `goal_id`, `amount_cents`, `request_id`, `request_hash` | Apartados. |
| `tasks` | `title`, `note`, `status`, `due_at`, `postponed_until`, `demo`, `completed_at`, `deleted_at` | Pendientes. |

**Migraciones:** el arranque ejecuta `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` condicional, índices, reconstrucción de `customers` si tenía `name UNIQUE` global, migración transaccional de `cash_closes` y deduplicación de `request_id` con auditoría (`db.ts:310-481`, `db.ts:492-781`, `db.ts:553-633`). Es una migración de un solo proceso; el propio `demo/STATUS.md:75` advierte que en multi-proceso habría que mover la lectura del esquema dentro del lock.

---

## 5 · Estados y verdad del pago

### 5.1 Estados canónicos

`web/src/lib/types.ts:1-15`:

```ts
OrderStatus =
  "draft" | "confirmed" | "payment_pending" | "partially_paid" |
  "paid" | "demo_paid" | "fulfilled" | "cancelled";

PaymentMethod = "codi" | "card" | "wallet" | "cash" | "mixed" | "unknown";
PaymentStatus = "pending" | "paid" | "failed";
CreditStatus = "open" | "partial" | "settled";
```

### 5.2 Las cuatro verdades que no se pueden mezclar

| Verdad | Cómo se crea | Estado | Fuente |
|---|---|---|---|
| **Efectivo** | Se inserta al crear la venta; `provider='cash'`, `method='cash'`, `status='paid'` | `paid` (o `confirmed` si además hay fiado) | `web/src/lib/orders.ts:284-300`, `:328-335` |
| **Digital verificado por pey** | Solo `processPeyEvent` → `recordPayment` desde webhook firmado | `paid` | `web/src/lib/pey-events.ts:285-297`; `web/src/app/api/webhooks/pey/route.ts:136-157` |
| **Demo** | `/api/demo/pay` inserta `provider='demo'` y `recordPayment` cubre con `demo_paid` | `demo_paid` | `web/src/app/api/demo/pay/route.ts:54-87`; `web/src/lib/payment-rules.ts:24-26` |
| **Fiado** | `createOrder` inserta `credits`; el abono digital se registra `provider='declared'` | `confirmed` / `open` / `partial` / `settled` | `web/src/lib/orders.ts:303-326`, `:892-937` |

### 5.3 Regla de oro

- La firma se exige **siempre**: `verifyWebhookSignature` se llama antes de cualquier parseo; si falla → 401 y evento de auditoría (`web/src/app/api/webhooks/pey/route.ts:136-157`).
- El monto se compara contra el saldo pendiente exacto (`total - paid - credit`); si no coincide → 409 (`web/src/lib/pey-events.ts:146-157`).
- Idempotencia por `webhook-id` y por `transactionId`; un replay devuelve 200 sin duplicar (`webhook route:191-238`; `pey-events.ts:199-223`, `:257-270`).
- Un `transactionId` demo **no** se verifica: `/api/verify` filtra `provider='pey'` y en demo rechaza (`web/src/app/api/verify/route.ts:74-80`, `:140-145`).
- `fulfillOrder` rechaza `demo_paid` y fiado abierto (`web/src/lib/orders.ts:963-1011`).
- La UI usa `paymentTruth` para no inferir demo del flag global (`web/src/components/caja-app.tsx:7060-7083`).

### 5.4 Copy canónico

`web/src/lib/payment-labels.ts:27-56` define:

- “Efectivo recibido” — dinero físico, no pasó por pey.
- “Pago verificado por pey” — confirmado por evento firmado.
- “Digital declarado, sin verificar” — la comerciante lo registró; pey no lo confirmó.
- “Por cobrar” — todavía no entra a la caja.
- “Fiado” — deuda, no dinero recibido.
- “Pago demo (simulado)” — no es dinero real, no se entrega.
- “Pago parcial” — parte recibida, saldo pendiente.

`DEMO_CLOSE_LABEL = "Cerrar demo"` y `DEMO_NOT_DELIVERABLE = "Pago demo (simulado): no se entrega."` (`payment-labels.ts:62-65`).

### 5.5 Matiz importante: `paid` no es exclusivo del webhook

El efectivo se guarda con `payments.status='paid'` al crear la venta; por eso la invariante correcta es:

> **Ningún pago digital pendiente pasa a `paid` sin webhook firmado; el efectivo se registra `paid` al crear la venta; el demo usa `demo_paid`.**

Esto está documentado en `harness/STATE.md:86-91` y `demo/STATUS.md:84`. No simplificar a “ningún `paid` fuera del webhook”.

---

## 6 · Flujos

### 6.1 Venta por voz / texto / manual

**Pasos:**

1. La persona mantiene presionado el micrófono (`caja-app.tsx:3230-3245`) o escribe.
2. `MediaRecorder` graba; al soltar, envía `FormData` a `/api/voice/transcribe` (`caja-app.tsx:1636-1695`).
3. El texto se interpreta:
   - Primero, consultas locales de deuda (`answerDebtQuery`) y preguntas locales (`isLocalQuestion`) **antes** de tocar la red (`caja-app.tsx:1521-1543`).
   - Si no, `POST /api/voice/parse` (`caja-app.tsx:1545-1553`).
   - `parseSale` usa OpenAI si hay `OPENAI_API_KEY`; si no, `mockParse` local (`web/src/lib/voice.ts:29-53`).
4. El parser devuelve `intent`: `sale`, `query`, `credit_payment`, `unknown`, con items, efectivo, fiado, cliente y confianza (`voice.ts:9-27`).
5. La venta se prellena en el borrador; la persona edita productos, cantidades, precios, efectivo, fiado y cliente.
6. “Agregar a mano” crea un renglón vacío y enfoca Producto; no depende de IA (`caja-app.tsx:3160-3180`).
7. `createOrder` valida items, total, efectivo, fiado, nombre y calcula cambio:
   - `appliedCreditCents = min(credit, total)`;
   - `appliedCashCents = min(cash, total - crédito)`;
   - `changeCents = max(0, cash - appliedCash)`;
   - `overpay` solo si el fiado supera el total (`caja-app.tsx:1711-1732`).
8. `POST /api/orders` con `requestId` estable; doble tap reutiliza la misma llave (`caja-app.tsx:1880-1908`; servidor `orders.ts:196-232`).
9. El servidor inserta pedido + items + pago efectivo + crédito en una transacción; `requestId` + `requestHash` evitan duplicados y detectan reuso con otros datos (`orders.ts:222-355`).

**Estados UI:** hoja vacía, borrador, guardando, error inline, pedido `paid` por efectivo, `confirmed` con saldo digital, `confirmed` con fiado, `demo_paid` tras simulación.

**Límite:** la venta manual funciona con `/api/voice/parse` en 500 (probado por `sin-ia-e2e.py`, según reporte; no re-ejecutado aquí). La creación de la orden sí requiere red/servidor.

### 6.2 Cobro con link/QR

- `POST /api/orders/[id]/pay` con `mode: "link" | "qr"`.
- Si el pedido ya está `paid`/`demo_paid`/`fulfilled`, devuelve el pedido sin generar otro (`orders/[id]/pay/route.ts:81-87`).
- Link: `createPaymentLink` de pey con `clientReferenceId = order.id`; en demo devuelve `APP_URL/pay/[id]?demo=1` (`web/src/lib/pey.ts:78-114`).
- QR: reserva un `numRef` de 6 dígitos, crea QR CoDi (`/codi/qr`); en demo el `qrString` es un JSON demo y la imagen se genera localmente (`orders/[id]/pay/route.ts:96-118`; `pey.ts:116-156`).
- `attachPaymentLink`/`attachQr` no degradan un pedido ya cubierto y solo pasan a `payment_pending` si queda saldo (`orders.ts:366-525`).
- La hoja muestra link, QR, “Copiar”, “Compartir”, “Abrir checkout” y, en demo, “Simular CoDi” / “Simular tarjeta” (`caja-app.tsx:4102-4176`).
- En demo, `POST /api/demo/pay` crea un evento con `signature_valid=0` (es demo, no webhook) y `recordPayment` con `provider='demo'`; el pedido queda `demo_paid` (`demo/pay/route.ts:59-87`).
- La hoja hace polling cada 3 s mientras hay pedido activo (`caja-app.tsx:2030-2074`); el checkout público usa 3 s → 10 s → 30 s (`checkout-client.tsx:117-130`).

### 6.3 Webhook de pey

- `POST /api/webhooks/pey`: rate limit 120/min; body máximo 64 KB; lee texto crudo (`route.ts:120-129`).
- Verifica `webhook-id`, `webhook-timestamp`, `webhook-signature` con Standard Webhooks; firma inválida → 401 + auditoría truncada (`route.ts:131-157`).
- Inserta `payment_events` y procesa en la misma transacción `BEGIN IMMEDIATE`; si el proceso muere, no queda un `received` que bloquee el reintento (`route.ts:191-238`).
- Replay con mismo `webhook-id`: 200 `{duplicate:true}` sin reescribir; si el evento previo fue `rejected`, se puede corregir y reprocesar (`route.ts:205-229`).
- `processPeyEvent` soporta `payment_link.status_updated` y `codi.qr.payment_received` (`pey-events.ts:285-297`).
- Link: resuelve por `clientReferenceId` + `paymentLinkId`; exige que ambos apunten al mismo pedido; exige `status='paid'`, moneda MXN, transacciones no vacías, sin duplicados; compara la suma fresca contra el saldo exacto (`pey-events.ts:81-241`).
- QR: resuelve por `metadata.orderId`/`externalMetadata.orderId` o `numRef`; exige monto, transactionId, moneda; compara contra saldo (`pey-events.ts:114-144`, `:243-283`).
- `recordPayment` usa `SAVEPOINT`; si la transacción ya existe, cura la orden desde los pagos (`orders.ts:528-627`).

**Lo que no está probado:** el payload real de pey. El contrato usa payloads sintéticos (`P0-DINERO-REPORT.md:71-74`); no hay portal/credenciales en el repo. El webhook real no se ejecutó.

### 6.4 Checkout público y success

- `/pay/[id]` lee `getCheckoutData` en el servidor; si no existe, `notFound()` (`page.tsx:21-26`).
- `getCheckoutData` separa `cashPaidCents`, `demoPaidCents`, `verifiedPaidCents`, `digitalPaidCents`, `creditCents` y `amountDueCents` (`web/src/lib/checkout.ts:53-119`).
- Métodos visibles: CoDi, Tarjeta, Wallet; el copy dice “Apple Pay o Google Pay si tu banco lo permite” (`checkout-client.tsx:22-48`). No hay botón oficial de Apple Pay; es una opción de UI.
- En demo, el botón simula; en real, redirige al checkout de pey. No se reciben datos de tarjeta.
- Success usa `SUCCESS_COPY`:
  - pendiente: “Esperando la confirmación de pey”, permite cerrar, conserva el comprobante (`payment-labels.ts:149-156`);
  - verificado: “Pago verificado por pey” (`:157-163`);
  - demo: “Pago demo” (`:164-170`);
  - efectivo: “Efectivo recibido” (`:171-177`).
- El success actual **no** afirma “tu pago ya salió del banco” ni “no cierres” (el texto viejo fue reemplazado por `SUCCESS_COPY`; ver `success-client.tsx:400-434`).

**P0 abierto:** la página `/pay/[id]` con id inexistente devuelve HTTP **200** en la preview `397039d`, aunque muestre la UI de “No encontramos este cobro”; la API `/api/checkout/[id]` sí devuelve 404. Ver `05-EVIDENCIA.md` §3.4.

### 6.5 Fiado

- Pestaña **Fiado** (`caja-app.tsx:2679-2714`), lista de créditos y hoja de abono (`CreditList`, `CreditPaySheet`, `caja-app.tsx:6385-6780`).
- La voz **solo propone**: `openCreditPay` abre la hoja con saldo vivo y monto; no hace POST (`caja-app.tsx:1499-1519`, `:1562-1595`).
- La hoja exige método (`cash`, `codi`, `card`), monto > 0 y saldo no saldado (`caja-app.tsx:2117-2131`).
- `recordCreditPayment`:
  - valida monto y `requestId` + hash;
  - si el `requestId` existe con otro monto/método/nota → 409 `request_id_conflict`;
  - si el saldo cambió vs `expectedBalanceCents` → 409 `balance_changed`;
  - aplica `min(requested, balance)`, calcula `overpayCents` y actualiza `credits.balance_cents`/`status`;
  - método digital → `provider='declared'`, no `pey` (`orders.ts:787-947`).
- La UI muestra “Se aplicaron $X; devuelve $Y” si hay excedente y no inventa devolución en un duplicado (`caja-app.tsx:2173-2191`).
- `fiado` no es venta nueva: la cabecera “Lo que me deben” y el corte lo separan (`caja-app.tsx:3031-3062`).

### 6.6 Corte de caja

- Pestaña **Corte** (`caja-app.tsx:2716-2741`), con `ClosingChecklist` arriba, `CashCloseCard`, `BusinessOverview` y `ReconcileCard`.
- Fórmula: `expected = opening + cashSales + cashCredit - expenses - withdrawals` (`cash.ts:257-258`, `:273-278`).
- `difference = counted - expected` (`cash.ts:289`).
- Preview no escribe; devuelve `fingerprint` de `cashSales:cashCredit:expected` (`cash.ts:73-83`, `:304-333`).
- Guardado:
  - `requestId` idempotente;
  - `BEGIN IMMEDIATE`;
  - relee totales y versión;
  - si el fingerprint cambió → 409 `totals_changed`;
  - `countedCents <= 0` → 400 `counted_required`;
  - `baseNext > counted` → 400 `base_exceeds_counted`;
  - si ya hay corte y no hay motivo → 400 `reason_required`;
  - `expectedVersion` distinto → 409 `version_conflict`;
  - inserta versión `current+1` (o salta versiones demo ocultas), snapshot de efectivo, fiado y pendiente digital, y auditoría (`cash.ts:335-492`).
- La UI no pisa un conteo sucio: si hay cambios sin guardar, marca `stale` y no rellena (`caja-app.tsx:4836-4904`).
- El corte guardado es una foto: movimientos posteriores no lo cambian (`RUNBOOK-DEMO.md:116`).
- **P1 abierto:** el conteo cero se rechaza (`cash.ts:318-323`, `:386-391`). La auditoría P1-9 pedía permitir “no hubo efectivo” (`AUDITORIA-CARGA-COGNITIVA.md:270`).

### 6.7 Meta / apartado

- Pestaña **Meta** (`caja-app.tsx:2745-2757`).
- `GoalCard` carga `/api/goals`, muestra título, ahorrado, progreso, falta, semanas y por semana (`caja-app.tsx:5839-6043`).
- “Apartar” envía `amountCents`, `note`, `requestId`; el requestId se reutiliza si el payload no cambió (`caja-app.tsx:5878-5918`).
- `contributeToGoal` inserta `goal_contributions` y suma `saved_cents` en una transacción; `requestId` obligatorio; el duplicado devuelve la meta sin insertar (`goals.ts:108-245`; ruta `goals/[id]/contribute/route.ts:16-46`).
- Copy explícito: “Apartado declarado: no es una cuenta bancaria ni dinero custodiado. El efectivo sigue en tu resguardo.” (`caja-app.tsx:6043`).
- **No hay UI para crear una meta**; la API `POST /api/goals` existe (`goals/route.ts:21-45`), pero la persona no puede usarla. La meta demo viene sembrada (`db.ts:1090-1113`).

### 6.8 Cobros pendientes, tareas y “Antes de cerrar”

- **Cobros pendientes:** franja “Cobros pendientes (todas las fechas)” en Caja (`pending-payments.tsx:86-244`); total, última comprobación, “Ver”, reintento; refresco al montar, `visibilitychange` y `focus`; polling cada 45 s solo visible (`caja-app.tsx:889-945`).
- **Pendientes de negocio:** quinto tab `Pendientes` (`caja-app.tsx:75`, `:7124-7136`); `PendingTasksPanel` con crear/completar/reabrir/posponer/eliminar (`pending-tasks.tsx:196-1155`); backend `tasks.ts:236-343`; soft delete.
- **“Antes de cerrar”:** componente `ClosingChecklist` dentro de Corte (`caja-app.tsx:2716-2729`). Agrupa vencidos, hoy y mañana (máx. 5), y cobros por confirmar; permite completar, posponer a mañana 09:00 y “Ver en Pendientes” (`closing-checklist.tsx:215-374`). No hace otro fetch de dashboard: recibe `pendingOrders` (`:306-316`).
- **Preferencias:** si “Sugerencias” está apagada, la tarjeta “Antes de cerrar” se oculta; los avisos críticos de dinero siguen en Caja (`companion-preferences.tsx:23-52`, `:201-217`; `closing-checklist.tsx:225-285`).
- **Recordatorios:** la preferencia existe, pero no hay push/correo/notificación automática; el copy lo dice (`companion-preferences.tsx:41-45`).

### 6.9 Verificación de comprobante

- `VerifyCard` en Caja; abre hoja con input de `transactionId` (`caja-app.tsx:6780-6912`).
- `verify` usa `activeOrder?.id` o el pedido más reciente de la actividad; si no hay pedido, error (`caja-app.tsx:2076-2115`).
- `/api/verify`:
  - busca un pago local `provider='pey'`, `status='paid'`, mismo `transactionId`;
  - si es de otro pedido → `order_mismatch`;
  - si los pagos pey no cuadran con el monto digital → `amount_mismatch`;
  - si no está local y `isDemoMode()` → `not_found` (“no corresponde a un pago confirmado”);
  - si no está local y es real → consulta `GET /transaction/{id}`; exige `PAID`, MXN, monto y referencias (`verify/route.ts:44-209`).
- Copy de resultado: “Registrado por webhook firmado” / “Confirmado ahora por pey” / “Pago demo simulado” (`payment-labels.ts:78-106`).
- **No hay prueba de un comprobante real de pey**; solo contrato sintético y demo.

### 6.10 Conciliación

- `ReconcileCard` en Corte; `GET /api/reconcile` (`reconcile/route.ts:4`).
- `getReconciliationReport` compara pagos digitales del día contra pey; no corrige; reporta `ok`, `mismatch`, `not_found`, `not_paid`, `error`, `missing_transaction_id`, `not_pey` (`reconcile.ts:77-180`; `types.ts:114-144`).
- En demo avisa que no hay transacciones reales; con API key consulta `GET /transaction/{id}`.
- **No se ejecutó contra pey real** (`P0-DINERO-REPORT.md:73-74`).

---

## 7 · IA y voz

| Pieza | Comportamiento | Fuente |
|---|---|---|
| STT | OpenAI `gpt-4o-mini-transcribe` (configurable), español; sin key falla con error | `voice.ts:34-49` |
| Parser | OpenAI `gpt-4.1-mini` con JSON schema Zod; sin key usa `mockParse` local | `voice.ts:51-93` |
| Fallback | Si hay key y OpenAI falla, `/api/voice/parse` responde 500; **no** hay fallback local en ese caso | `voice/parse/route.ts:44-49`; `AUDITORIA-CARGA-COGNITIVA.md:62` |
| Consultas locales | Deuda y preguntas de “cuánto vendí” se responden antes del parser | `caja-app.tsx:1528-1543`; `voice-debts.ts` |
| TTS fijo | Kokoro `em_santa`, archivos en `public/tts` | `caja-app.tsx:182-197`; `api/tts/route.ts:26-29` |
| TTS dinámico | Piper `es_MX-claude-high`; si no está instalado → 503 | `api/tts/route.ts:14-29`, `:67-73` |
| Fallback de voz | **No hay**: si el audio falla, silencio + texto; no se usa `speechSynthesis` | `caja-app.tsx:1294-1300`, `:1336-1339` |
| Preferencia de voz | Silencio, velocidad lenta/normal/rápida; se guarda local | `caja-app.tsx:663-666`, `:747-749`, `:1400-1431` |
| Privacidad | Aviso: el audio se envía a OpenAI para transcribir; la app no guarda el audio | `companion-preferences.tsx:206-216` |

**Contradicción documental:** `README.md:177` y `RUNBOOK-DEMO.md:177` dicen que la confirmación hablada usa `speechSynthesis` del navegador. El código actual **no** lo hace: usa TTS propio y prefiere silencio (`caja-app.tsx:1294-1300`, `:1336-1339`). `harness/STATE.md:67` sí dice “No hay fallback a la voz del navegador”, que es lo correcto.

---

## 8 · Accesibilidad

Implementado en código:

- 48 px mínimo en muchos controles (p. ej. `barrio.css:259`, `:618`, `:698`, `:1052`).
- Foco visible (`globals.css:204-214`).
- `prefers-reduced-motion` (`globals.css:784`, `:897-918`).
- Texto normal/grande/muy grande y contraste alto persistentes (`caja-app.tsx:663-666`, `:893-930`; `layout.tsx:60-68`).
- Skip link / `main#main` (`globals.css:78`).
- Nombres accesibles en botones de micrófono, fiado, cobrar, etc. (`caja-app.tsx:3233`, `:3395`, `:3407`).
- Checkout con H1 y foco en el resultado (`checkout.css:543`; `checkout-client.tsx`).
- Voz + texto: la venta se puede hacer sin micrófono.

Límites:

- **No hay regla `@media (forced-colors: active)`** en el código; `HANDOFF-CIERRE.md:129` lo reconoce como P1.
- El 200 % se prueba por inyección de `font-size`, no por zoom real de navegador (`demo/STATUS.md:75`).
- TalkBack/VoiceOver y teléfono físico: pendientes (`ACCESIBILIDAD.md:13`, `:108-115`).
- Pruebas con 6–8 comerciantes: **0/6–8** según docs (`demo/STATUS.md:20`, `demo/feedback.md` vacío).

**No se puede afirmar “accesibilidad completa”.** `ACCESIBILIDAD.md:5` lo dice: no sustituye una auditoría con personas ni lectores reales.

---

## 9 · Offline y exportación

**No implementados.**

- No hay service worker, IndexedDB, `navigator.onLine` ni cola de sincronización en `web/src` (búsqueda sin resultados).
- `page.tsx:12` usa `connection()` y lee en servidor; la caja depende de red para crear ventas, abonar, cerrar corte y tareas.
- La auditoría P1-3 lo describe como brecha (`AUDITORIA-CARGA-COGNITIVA.md:264`).
- No hay `/api/export` ni botón de descarga; P1-5 (`AUDITORIA-CARGA-COGNITIVA.md:266`).
- El README dice “solo borradores” offline (`README.md:80`) y “nunca se marca pagado sin conexión” (`README.md:202`); eso es una promesa de diseño, no una implementación de operación offline.

---

## 10 · Seguridad y autenticación

- **No hay auth de usuaria/sesión.** `SECURITY.md:3-5` y `:168-170` lo dicen: CSRF no es autenticación. Para producción real: Cloudflare Access + sesión firmada + autorización por rol.
- `web/src/proxy.ts` aplica CSRF de mismo origen a mutaciones, excepto `/api/webhooks/pey`; límites de body; token de reset opcional; rate limit en memoria (`SECURITY.md:9-19`).
- Rate limits por IP+ruta, Map de 2048 buckets, **en memoria y por proceso** (`SECURITY.md:14`, `:64-65`).
- Reset demo: exige modo demo, mismo origen, token si `DEMO_RESET_TOKEN`, rate limit antes del token, backup `VACUUM INTO`, bloqueo 409 si hay pagos `pey` reales, retención de 5 backups (`SECURITY.md:67-90`; `db.ts:1943-2010`).
- Webhook: auditoría de rechazos sin firma con hash + prefijo 4 KB, retención de últimos 500 (`SECURITY.md:17`, `:87-90`).
- Headers: CSP, `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS en producción (`next.config.ts:32-65`).
- **No hay autenticación en la app**; la demo es de una sola comerciante. No afirmar “seguro para producción” sin Access/sesión.

---

## 11 · Demo vs real

`isDemoMode()`:

- `DEMO_MODE=true` → demo;
- `DEMO_MODE=false` → real;
- si no está definido → demo si **no** hay `PEY_API_KEY` (`config.ts:10-14`).

`DEMO_MODE` controla:

- si se siembran fixtures (`db.ts:1039-1238`);
- si `/api/demo/pay` y `/api/demo/reset` funcionan;
- si `getPeyTransaction` devuelve `null` (`pey.ts:158-162`);
- si la UI muestra el pill DEMO y el botón de simulación;
- si los reportes incluyen datos demo (`db.ts:1706-1709`; `analytics.ts:64-73`).

**Regla para `demo_paid`:** un pedido con `status='demo_paid'` no se entrega; `fulfillOrder` lo rechaza (`orders.ts:967-974`). La UI no ofrece “Listo para entregar” para `demo_paid` (`caja-app.tsx:3846-3852`, `:4008-4030`).

**Agujero confirmado (P1-1):** en `DEMO_MODE=true`, un webhook **firmado** de pey puede producir `status='paid'` (no `demo_paid`), porque `recordPayment` marca `demo=1` pero el estado se decide por `provider='pey'` (`orders.ts:591`, `:677-683`). Ese pedido **sí** se puede entregar (`orders.ts:968-974` solo bloquea `demo_paid`). La auditoría adversaria lo reprodujo; ver §13.1.

---

## 12 · Estado de la UI (código vs artefactos)

- El código del HEAD implementa la dirección **“amable y de barrio”**: libreta de mostrador, LCD verde, teclas de calculadora, Atkinson Hyperlegible + Fraunces (`layout.tsx:1-26`; `barrio.css:5-112`; `DESIGN-BARRIO.md:8-36`).
- La preview `:3230` / túnel público sirve el build `397039d`, que **sí incluye** el diseño barrio (`5d3fa30` es ancestro de `397039d`), pero **no** incluye los merges cognitivos posteriores (`e6f3107`, `fe97c00`, `b7154ca`). Es una referencia visual cercana, no el build final.
- El MP4 `demo/mercado-cero-demo.mp4` es de la dirección anterior “Mostrador claro” (sidebar, no libreta); muestra $90, corte $570 y meta $325. No es la UI final. Ver `05-EVIDENCIA.md`.
- Los frames `demo/stageshow/01…08` también son de “Mostrador claro”, no de la libreta barrio.

---

## 13 · Límites del producto que el código confirma

| Límite | Evidencia |
|---|---|
| Sin auth/sesión | `SECURITY.md:3-5`, `:168-170` |
| Sin offline real | §9; `AUDITORIA-CARGA-COGNITIVA.md:264` |
| Sin exportación | §9; `AUDITORIA-CARGA-COGNITIVA.md:266` |
| Sin crear meta desde UI | `caja-app.tsx:5946-5955`; API `goals/route.ts:21` |
| Sin cancelar/anular venta | `orders.ts` solo `fulfillOrder`; no `cancel`/`void` |
| Sin reconocimiento de productos/clientes recientes | `AUDITORIA-CARGA-COGNITIVA.md:268` |
| Sin inventario/proveedores | `GOAL.md:153-164`; `GOAL-ACOMPANAMIENTO.md:279-289` |
| Sin pago real probado | `README.md:88-91`; `demo/STATUS.md:82-84` |
| Sin `forced-colors` | `HANDOFF-CIERRE.md:129`; grep sin resultados |
| Sin prueba de 404 HTTP en checkout | `checkout-audit.py:290-333` mide UI, no status; preview devuelve 200 |

---

## 13.1 · Fallos P0/P1 confirmados por la auditoría adversaria (21:51)

La auditoría `p0/adversarial` (`3939133`) auditó `b7154ca` con build de producción, servidor aislado `:3317`, SQLite temporal, webhook HMAC real, mock de pey y Playwright. No reemplaza el `full`, pero es la evidencia runtime más fuerte que existe en el repo. El `adversarial.json` declara 2 P0, 5 P1, 7 P2, 13 confirmados y 1 no verificado. Estos hallazgos **no están cubiertos por el full actual**.

### P0-1 · El reset de demo borra un pago firmado de pey

- `recordPayment` marca `demo=1` si `isDemoMode()`, **incluso cuando `provider='pey'`** (`web/src/lib/orders.ts:591`).
- `listRealPeyPayments` busca `provider='pey' AND status='paid'` sin filtrar `demo` (`db.ts:1848-1855`).
- `resetDemoData` bloquea solo por `realDataCount` (filas `demo=0`), pero **no usa `realPayments` para bloquear** (`db.ts:1943-1957`).
- Luego borra `payments WHERE demo=1` (`db.ts:1973`) y devuelve `preservedRealPayments` calculado antes del borrado (`db.ts:2005`, `:2012`).
- **Reproducción del audit:** orden de $10, link demo, webhook firmado `paid/MXN`, `payments.provider=pey` + `demo=1`, `PATCH fulfill=200`, `POST /api/demo/reset=200` con `preservedRealPayments:1`; después el pedido y el pago ya no existen.
- **Contradice:** `README.md:231` (409 si hay pago real) y `SECURITY.md:84-86`.
- **Estado:** **CONFIRMADO por código + auditoría**.

### P0-2 · `/` SSR contiene datos privados y se cachea público

- `page.tsx:10-18` llama `getDashboardData` y renderiza la caja completa en el HTML.
- `next.config.ts:190-195` declara `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` para `/`.
- El HTML puede contener nombres de clientes, saldo de fiado, `paymentUrl` y `qrString` (`dashboard.ts:97-102`).
- **Riesgo:** una caché compartida que honre `s-maxage` puede servir datos privados de la caja.
- **Estado:** **CONFIRMADO por código + auditoría**; el comentario de `next.config` (“los datos se piden por API”) es falso para el primer render.

### P1-1 · Un webhook firmado en demo produce `paid`, no `demo_paid`

- `recordPayment` pone `paid` si `provider='pey'` (`orders.ts:677-683`) y `demo=1` por `isDemoMode()` (`:591`).
- `fulfillOrder` solo bloquea `status='demo_paid'` (`orders.ts:968-974`); un `paid` con `demo=1` se entrega.
- `getDailySummary` lo suma a `verifiedDigitalCents` (`db.ts:1744-1757`), no a demo.
- **Estado:** **CONFIRMADO**; rompe la promesa “demo solo `demo_paid`”.

### P1-2 · Sin auth de sesión

- `SECURITY.md:3-5`, `:168-170`: la caja y sus mutaciones son públicas; Cloudflare Access es la única barrera, no está en el repo.
- **Estado:** **CONFIRMADO** (limitación declarada).

### P1-3 · `/api/verify` acepta una transacción PAID sin referencias

- `hasReferenceMismatch` solo compara referencias si el payload las trae (`verify/route.ts:212-245`).
- Un mock PAID con monto correcto y sin `payableId`/`metadata`/`clientReferenceId` devuelve `verified:true` (`verify/route.ts:172-190`).
- **Riesgo:** se puede entregar con un comprobante de otra operación del mismo monto.
- **Estado:** **CONFIRMADO con mock**.

### P1-4 · Checkout/success inexistentes devuelven HTTP 200

- `page.tsx:26` usa `notFound()`, pero el audit y nuestra observación en `397039d` ven **200**.
- `checkout-audit.py:296-331` valida texto/foco/consola, no `response.status`.
- **Estado:** **CONFIRMADO**.

### P1-5 · Totales sobre 50/100 filas sin paginación visible

- `pagination.ts:13-16` fija límites; `dashboard.ts:97-102` corta pendientes; `pending-payments.tsx:99-103` suma solo lo cargado; `caja-app.tsx:3035-3040` usa `credits.length` para “personas”.
- El audit reporta 51 pendientes → 50 cargados, total visible $169 vs `summary.pendingCents` $171; 101 créditos → 100, “100 personas” vs 103.
- **Riesgo:** la libreta y el cierre subestiman deudas.
- **Estado:** **CONFIRMADO**.

### P2 relevantes

- “Recordatorios” y “Explicaciones” se guardan pero no tienen efecto (`companion-preferences.tsx:41-48`; solo `suggestions` se consume en `closing-checklist.tsx:85-117`).
- “Antes de cerrar” etiqueta “Esperando confirmación” a pedidos “Sin link” (`closing-checklist.tsx:306-320`, `:592-610`).
- Success de un fiado saldado sigue diciendo “Quedó a fiado” (`success-client.tsx:104-110`).
- “Lo que me deben” cuenta créditos, no personas (`caja-app.tsx:3035`).
- No hay `forced-colors` (P2-5 del audit).
- `/api/demo/pay` no es atómico multi-proceso (P2-6, **NO VERIFICADO**).

**Lectura:** el full de 23 gates no incluye estos casos; pasar 23/23 no probaría que P0-1/P0-2 estén resueltos. El `master` actual bloquea el merge precisamente por esto.

---

## 14 · Resumen de rutas de dinero (para no confundir)

```
Venta
 ├─ efectivo ─────────────► payments(provider=cash, status=paid) ─► orders paid/confirmed
 ├─ fiado ────────────────► credits(open) ─► credit_payments(provider=cash|declared)
 └─ digital pendiente ────► orders.payment_pending
       ├─ demo ───────────► /api/demo/pay ─► payments(provider=demo) ─► orders.demo_paid
       └─ real ───────────► pey link/QR ─► webhook firmado ─► payments(provider=pey) ─► orders.paid

Corte
 expected = opening + cashSales + cashCredit - expenses - withdrawals
 difference = counted - expected
 cash_closes: versión + snapshot + requestId + expectedVersion

Meta
 goal_contributions + goals.saved_cents; no crea payment ni order
```

Ese es el mapa que debe sobrevivir a cualquier handoff.
