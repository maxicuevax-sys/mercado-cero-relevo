# Auditoría adversaria — Mercado Cero

> **Código auditado:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045` (`p0/adversarial`).
> **Método:** lectura independiente del código, rutas, tests y documentos; build de producción; servidor aislado en `127.0.0.1:3317` con SQLite temporal; contratos existentes; sondas propias con webhook firmado, mock de pey, API y Playwright.
> **No se usaron como evidencia** `AUDITORIA-CARGA-COGNITIVA.md`, `AUDITORIA-COGNITIVA.md`, los reportes de carril ni el handoff. Se citan solo para contrastar sus afirmaciones.
> **Límite principal:** no hubo pago real, no se usó pey real, no se tocó la app, `:3000`, `:3230` ni la preview. No se ejecutó el full de 23 gates.

---

## 0. Veredicto corto

La app tiene una base transaccional mejor de lo que sugieren algunos reportes: el webhook firmado resiste los 40 casos del contrato, el build pasa, `verify:fast` pasa 3/3 y el contrato de seguridad pasa 48/48. **Pero hay dos fallos P0 que el arnés actual no cubre**:

1. **El reset de demo borra un pago firmado de pey** cuando ese pago se registró en modo demo, aunque responde `preservedRealPayments: 1` y la documentación promete 409.
2. **La página `/` renderiza el dashboard completo en HTML y lo declara cacheable públicamente** (`s-maxage=60`), con nombres, saldos, fiado y URLs de cobro.

Además, el modo demo **no aísla los webhooks firmados**: un evento firmado produce `paid` (no `demo_paid`), se puede entregar y se cuenta como “verificado por pey”. El comprobante (`/api/verify`) acepta una transacción PAID sin ninguna referencia a la orden si coincide el monto. El 404 público devuelve HTTP 200. Y los totales de cobros/fiado se calculan sobre páginas truncadas (50/100) sin paginación visible.

**No se puede afirmar que el producto esté listo para dinero real** con estos hallazgos. Para la demo, los P0-1 y P0-2 son evitables con configuración/operación, pero no con el código actual.

---

## 1. Resumen de hallazgos

| ID | Severidad | Estado | Hallazgo | Evidencia principal |
|---|---|---|---|---|
| P0-1 | P0 | CONFIRMADO | Reset demo borra pago firmado de pey y reporta que lo preservó | `web/src/lib/db.ts:1943-1957`, `:1848-1855`, `:1973`, `:2005` |
| P0-2 | P0 | CONFIRMADO | `/` SSR con datos privados y `Cache-Control: public, s-maxage=60` | `web/src/app/page.tsx:12-17`, `web/next.config.ts:190-195` |
| P1-1 | P1 | CONFIRMADO | Webhook firmado en demo produce `paid`, no `demo_paid`, y permite entregar | `web/src/lib/orders.ts:591`, `:677-683`, `:968-974` |
| P1-2 | P1 | CONFIRMADO (limitación declarada) | No hay autenticación de sesión; toda la caja y sus mutaciones son públicas | `web/src/proxy.ts:60-103`, `SECURITY.md:168` |
| P1-3 | P1 | CONFIRMADO con mock | `/api/verify` acepta una transacción PAID sin referencias si el monto coincide | `web/src/app/api/verify/route.ts:229-240` |
| P1-4 | P1 | CONFIRMADO | Checkout y success inexistentes responden HTTP 200, no 404 | `web/src/app/pay/[id]/page.tsx:26` |
| P1-5 | P1 | CONFIRMADO | Totales de cobros/fiado se calculan sobre 50/100 filas; no hay paginación | `web/src/lib/pagination.ts:13-16`, `pending-payments.tsx:99-103`, `caja-app.tsx:3035-3040` |
| P2-1 | P2 | CONFIRMADO | Preferencias “Recordatorios” y “Explicaciones” no tienen efecto | `companion-preferences.tsx:41-48`, `closing-checklist.tsx:85-117` |
| P2-2 | P2 | CONFIRMADO (código) | “Antes de cerrar” etiqueta todo cobro como “Esperando confirmación”, incluso “Sin link” | `closing-checklist.tsx:306-320`, `:592-610` |
| P2-3 | P2 | CONFIRMADO | Success de un fiado ya saldado sigue diciendo “Quedó a fiado” | `success-client.tsx:104-110`, `lib/checkout.ts:88-104` |
| P2-4 | P2 | CONFIRMADO (código) | “Lo que me deben” cuenta créditos, no personas | `caja-app.tsx:3035` |
| P2-5 | P2 | CONFIRMADO (ausencia) | No hay reglas `forced-colors`; foco/contraste en ese modo no está probado | CSS completo; `checkout.css:543-544` |
| P2-6 | P2 | NO VERIFICADO | `/api/demo/pay` no es atómico en multi-proceso; posible doble simulación | `web/src/app/api/demo/pay/route.ts:60-85` |
| P2-7 | P2 | CONFIRMADO (proceso) | Docs mezclan “F3 desplegado” con “full pendiente”; no hay `latest.json` | `README.md:8`, `demo/STATUS.md:3,56` |

---

## 2. P0 — Lo que no debe entrar a una demo con dinero (ni a producción)

### P0-1 — El reset de demo borra un pago firmado de pey y reporta que lo conservó

**Estado: CONFIRMADO.**

**Archivos:**
- `web/src/lib/orders.ts:591` — `recordPayment` marca `demo = 1` si `isDemoMode()`, incluso cuando el `provider` es `pey`.
- `web/src/lib/orders.ts:677-683` — el estado se decide por `latestProvider`: si es `pey`, pone `paid`; `isDemoMode()` no participa.
- `web/src/lib/db.ts:1848-1855` — `listRealPeyPayments()` busca `provider = 'pey' AND status = 'paid'` **sin filtrar `demo`**.
- `web/src/lib/db.ts:1945-1957` — el bloqueo solo mira `realDataCount`, que cuenta filas `demo = 0`; `realPayments` se calcula pero **no se usa para bloquear**.
- `web/src/lib/db.ts:1973` — `DELETE FROM payments WHERE demo = 1` borra también ese pago de pey.
- `web/src/lib/db.ts:2005` y `:2012` — `preservedRealPayments` se calcula con `realOrderIds` antes del borrado.

**Reproducción (servidor aislado 3317, SQLite temporal, `DEMO_MODE=true`):**
1. `POST /api/orders` por 1000 centavos.
2. `POST /api/orders/{id}/pay` con `mode=link` (link demo).
3. Enviar un webhook **firmado correctamente** (`payment_link.status_updated`, `paid`, MXN, transacción por 10.00).
4. El webhook responde `200 processed`; el pedido queda `paid`; la fila de `payments` queda `provider=pey`, `status=paid`, `demo=1`.
5. `POST /api/demo/reset`.

**Resultado real observado:**

```json
{
  "resetAfterSignedWebhook": {
    "status": 200,
    "body": {
      "ok": true,
      "preservedRealPayments": 1,
      "realDataCount": 0
    }
  },
  "afterReset": {
    "order": [],
    "payment": []
  }
}
```

El evento de auditoría sí queda (`payment_events.result = "processed"`), pero el pedido y el pago firmado desaparecen. El backup se crea, pero el operador no recibe una señal de que debe restaurarlo: la ruta responde `200` y la UI dice “Demo reiniciada”.

**Por qué importa:** un pago firmado es la única evidencia fuerte de que el dinero llegó. El reset no solo lo borra: **miente sobre haberlo preservado**. La documentación dice lo contrario:
- `README.md:231`: “se niega si detecta un pago `pey` confirmado”.
- `SECURITY.md:84-86`: “Si existe al menos un pago `provider = 'pey' AND status = 'paid'`, responde 409”.

Ambas afirmaciones son falsas en modo demo.

**Prueba que falta:** el contrato de seguridad inserta un pago `pey` manual con `demo = 0` (`scripts/security-contract.mjs:749-751`) y por eso pasa; nunca ejecuta el camino real `recordPayment` en demo. El contrato del webhook (`scripts/webhook-contract.mjs:243` y `:601-605`) crea pagos firmados en `DEMO_MODE=true` y termina con un reset que los borra, sin comprobar que sobrevivan. Falta un test que:
- registre un pago por el camino real en demo,
- llame al reset,
- exija `409` o, si se permite, verifique que el pago y el pedido siguen existiendo,
- y compare `preservedRealPayments` con la base.

---

### P0-2 — El dashboard privado se sirve en HTML con caché pública

**Estado: CONFIRMADO.**

**Archivos:**
- `web/src/app/page.tsx:12-17` — `await connection(); const initialDashboard = getDashboardData(...)`; el dashboard completo se pasa a `CajaApp` en el render del servidor.
- `web/next.config.ts:190-195` — la ruta `/` responde `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`.

**Verificación real (servidor 3317):**

```text
GET /  -> 200
Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300
Vary: rsc, next-router-state-tree, ...
HTML: 111 KB
  contiene "Cliente Límite ...", "100 personas", "Saldo vivo de fiado $100.00",
  "paymentUrl", "qrString", nombres y saldos.
```

El comentario de `next.config.ts:188-189` dice que `/` es un “Shell público de la caja” y que “los datos se piden por API con no-store”. Eso ya no es cierto: los datos están en el HTML inicial. `s-maxage` está pensado para cachés compartidas; no hay `private`, `no-store` ni `Vary: Cookie/Authorization`.

**Por qué importa:** si el despliegue usa un CDN/reverse proxy que cachea HTML (Cloudflare puede hacerlo según reglas), el HTML con ventas, fiado, nombres y URLs de cobro puede reutilizarse para otro visitante. Aunque hoy no hay autenticación, el header impide que una futura sesión/Access confíe en la caché. Es una exposición de datos privados y una violación del contrato que el propio archivo declara.

**Prueba que falta:** el contrato de seguridad revisa `nosniff`, CSP, etc. sobre `/` (`security-contract.mjs:266-288`), pero **no revisa `Cache-Control`** ni que el HTML no contenga PII. Falta un test que:
- pida `/` sin credenciales,
- exija `Cache-Control: private, no-store` (o al menos `private`/`Vary` correcto),
- busque nombres/saldos/URLs de cobro en el HTML y falle si aparecen.

---

## 3. P1 — Errores de producto, dinero o seguridad

### P1-1 — Un webhook firmado en modo demo produce `paid`, se puede entregar y cuenta como verificado

**Estado: CONFIRMADO.**

**Archivos:**
- `web/src/lib/orders.ts:591` — la fila se marca `demo=1` por `isDemoMode()`.
- `web/src/lib/orders.ts:677-683` — el estado se calcula con `coveredStatus(latestProvider === "demo" ? "demo" : "pey")`; como el `provider` es `pey`, el estado es `paid`, no `demo_paid`.
- `web/src/lib/orders.ts:968-974` — `fulfillOrder` solo bloquea `demo_paid`; un `paid` sí se entrega.
- `web/src/lib/db.ts:1744-1757` — en demo (`includeDemo=true`), un pago `provider=pey` con `demo=1` entra a `verifiedDigitalCents`, no a `demoDigitalCents`.
- `web/src/lib/payment-labels.ts` — el copy de demo existe, pero no se aplica a este camino.

**Reproducción real:** el mismo webhook firmado de P0-1 dejó:
- `order.status = "paid"`, `paidCents = 1000`, `lastPaymentProvider = "pey"`.
- `payments.provider = "pey"`, `payments.demo = 1`.
- `GET /api/dashboard` devolvió `verifiedDigitalCents = 1000`, `demoDigitalCents = 0`.
- `PATCH /api/orders/{id}` con `{"action":"fulfill"}` devolvió **200** y `status = "fulfilled"`.

**Por qué importa:** contradice las afirmaciones centrales de la demo:
- `README.md:231`: “Todo se marca como demo: no son pagos reales ni dinero verificado por el banco.”
- `demo/STATUS.md`: “los pagos se simulan con `demo_paid`”.
- `README.md:188`: “solo dice ‘pagado’ cuando pey lo confirma”.

Un evento firmado con el secreto de pruebas no es dinero real, pero la app lo presenta como “Pago verificado por pey” y permite entregar. El contrato del webhook incluso exige que en demo el resultado sea `paid` (`webhook-contract.mjs` casos 1/9), por lo que el test **codifica** la ambigüedad en vez de detectarla. No hay test de `fulfill` ni de que el resumen excluya `demo=1`.

**Prueba que falta:** en `DEMO_MODE=true`, un webhook firmado debe producir `demo_paid` (o ser rechazado), `fulfill` debe dar 409 y `verifiedDigitalCents` no debe sumar el pago. Añadir ese caso a `webhook-contract` y a `payment-truth`.

---

### P1-2 — No hay autenticación de sesión; la única barrera es Cloudflare Access

**Estado: CONFIRMADO como limitación declarada; impacto condicionado al despliegue.**

**Archivos:**
- `web/src/proxy.ts:60-103` — el proxy solo hace CSRF, límites de cuerpo y token de reset; no hay sesión, cookie firmada ni autorización.
- `web/SECURITY.md:168` — el propio documento lo admite: “No hay autenticación de usuaria/sesión. CSRF no es autenticación”.
- `web/src/app/page.tsx:12-17` — el dashboard se renderiza sin comprobar identidad.

**Verificación:** en el servidor aislado, sin cookies ni cabecera de autorización:
- `GET /api/dashboard` → 200 con ventas, fiado y clientes.
- `POST /api/orders` → 201.
- `GET /api/credits` → 200 con nombres y saldos.
- `POST /api/demo/reset` → 200 (sin token configurado).

**Por qué importa:** el README dice que Cloudflare Access es obligatorio fuera de la demo. Si el túnel está público, cualquiera puede leer la caja, crear ventas, abonar fiado o cerrar pedidos. Si Access está bien configurado, el riesgo baja; pero el repo no tiene defensa en profundidad y el P0-2 puede saltarse la caché. No es una afirmación falsa: es una limitación declarada. Se incluye porque el encargo pedía auditar auth y porque **la demo pública no debe presentarse como protegida**.

**Prueba que falta:** un test de despliegue que, sin sesión, espere 401/302 en `/`, `/api/dashboard`, `/api/orders`, `/api/credits` y `/api/demo/reset`, y que verifique que Access está delante. No existe.

---

### P1-3 — `/api/verify` acepta una transacción PAID sin referencias si el monto coincide

**Estado: CONFIRMADO con mock; falta validar el payload real de pey.**

**Archivos:**
- `web/src/app/api/verify/route.ts:229-240` — `hasReferenceMismatch` solo rechaza si hay `metadataOrderId`, `clientReferenceId` o `payableId`. Si todos faltan, devuelve `false` y la transacción se acepta.
- `web/src/app/api/verify/route.ts:172-190` — solo compara `amountCents` con `expectedDigitalCents`.

**Reproducción:** se levantó un mock de pey en `:3320` y un Next aislado en `:3318` (`PEY_API_KEY=test`, `PEY_BASE_URL=http://127.0.0.1:3320`, `DEMO_MODE=false`). El mock devolvió:

```json
{ "id": "txn_no_refs", "status": "PAID", "amount": 10, "currency": "MXN", "paymentMethod": "CODI" }
```

Para una orden de 1000 centavos, `GET /api/verify?transactionId=txn_no_refs&orderId=...` devolvió:

```json
{ "verified": true, "source": "pey", "amountCents": 1000, "method": "codi" }
```

**Por qué importa:** la función estrella es “verificar que el comprobante corresponde a esta venta”. Si pey alguna vez entrega una transacción sin `payableId`/metadata, la ruta acepta una transacción de otra operación con el mismo monto. El comerciante puede entregar con una confirmación que no está atada a su pedido. La ruta tampoco exige `payableType`; el fallback `else if (payableId && ...)` solo actúa si hay `payableId`.

**Prueba que falta:** un test con un mock de pey que devuelva PAID, MXN, monto correcto y **sin** `payableId`, `payableType`, `metadata.orderId` ni `clientReferenceId`, y que exija `verified: false`. `p0-dinero-e2e.py:525-537` prueba A contra B, pero no el caso sin referencias.

---

### P1-4 — Checkout y success inexistentes devuelven HTTP 200

**Estado: CONFIRMADO.**

**Archivos:**
- `web/src/app/pay/[id]/page.tsx:26` — `if (!initialOrder) notFound();`
- `web/src/app/pay/[id]/success/page.tsx` — no llama `notFound`; pasa `initialOrder = null` al cliente.
- `web/src/app/pay/[id]/success/success-client.tsx` — muestra “No encontramos este cobro” en cliente.

**Verificación (Playwright, `wait_until=networkidle`, servidor 3317):**

```text
/pay/ord_no_existe                 -> status 200, body "EXTRAVIADO / No encontramos este cobro"
/pay/ord_no_existe/success         -> status 200, body "EXTRAVIADO / No encontramos este cobro"
```

El body es correcto; el status no. `checkout-audit.py:296-331` comprueba el texto y el foco, pero **no el status HTTP**. `HANDOFF-CIERRE.md:127` ya lo reconocía como pendiente; sigue vigente en `b7154ca`.

**Por qué importa:** los rastreadores, previews de enlace, caches y monitores ven un 200; un link inválido se puede indexar o tratar como página válida. Además, el título inicial de `/pay/...` sigue siendo “Pagar — Mercado Cero” antes de mostrar el estado extraviado.

**Prueba que falta:** assert de `response.status == 404` para ambos paths, no solo del texto.

---

### P1-5 — Los totales de cobros y fiado se calculan sobre páginas truncadas

**Estado: CONFIRMADO.**

**Archivos:**
- `web/src/lib/pagination.ts:13-16` — `DEFAULT_DASHBOARD_PENDING_LIMIT = 50`, `DEFAULT_DASHBOARD_CREDITS_LIMIT = 100`.
- `web/src/lib/dashboard.ts:97-102` — entrega `pendingOrders` y `credits` ya limitados.
- `web/src/components/pending-payments.tsx:99-103` — `totalPendingCents` y `countLabel` se calculan sobre el array recibido, no sobre `pagination.total`.
- `web/src/components/caja-app.tsx:2324-2326` — `pendingCredits` filtra el array ya truncado.
- `web/src/components/caja-app.tsx:3035-3040` — “personas” y total de fiado salen de ese array.
- `web/src/components/caja-app.tsx:6398` — `CreditList` también suma solo el array.
- `web/src/lib/db.ts:1420` y `:1618` — los límites por defecto de las consultas.

**Reproducción 1 (cobros):** se crearon 51 pedidos pendientes de 100 centavos (más el fixture de 12000). `GET /api/dashboard` devolvió:

```json
{
  "pendingOrdersLength": 50,
  "pagination": { "limit": 50, "returned": 50, "total": 52, "hasMore": true },
  "summary.pendingCents": 17100,
  "loadedSum": 16900,
  "missing": 200
}
```

La UI mostró “Cobros pendientes (todas las fechas) — 50 — Total pendiente $169.00”, mientras el resumen de la misma pantalla decía “Por cobrar de hoy $171.00”. Los dos pedidos más nuevos no existen para el total ni para “Ver todos” (que solo expande a 50).

**Reproducción 2 (fiado):** se insertaron 101 créditos abiertos de 100 centavos. `GET /api/dashboard` devolvió `credits.length = 100` y `creditsTotal = 103`; la UI mostró “100 personas — $100.00”. `GET /api/credits?limit=200` devolvió 103 créditos y un saldo abierto de **$151.00**. El crédito más antiguo (Juan, $50) desapareció del dashboard por el orden `created_at DESC` y el límite 100.

**Por qué importa:** el cierre y la libreta pueden subestimar lo que falta cobrar. La etiqueta “todas las fechas” es falsa y no hay botón de paginación. Es un problema de verdad de dinero, no solo de rendimiento.

**Prueba que falta:** tests con 51+ pendientes y 101+ créditos que comparen el total mostrado con la suma completa de la base y que exijan paginación o un total del servidor. No existen.

---

## 4. P2 — Carga cognitiva, copy y deuda de proceso

### P2-1 — “Recordatorios” y “Explicaciones” se guardan, pero no hacen nada

**Estado: CONFIRMADO.**

- `web/src/components/companion-preferences.tsx:41-48` promete “Recordatorios de pendientes” y “Explicaciones en contexto”.
- `web/src/components/companion-preferences.tsx:73-81` solo persiste las tres claves; `:113` dispara el evento.
- El único consumidor real es `suggestions` en `web/src/components/closing-checklist.tsx:85-117`.
- No hay ninguna lectura de `reminders` ni `explanations` fuera del propio componente (búsqueda en `web/src`).

El test `companion-preferences-e2e.py` verifica persistencia, foco y que no se enciendan solas; **no verifica que apagar “Explicaciones” cambie una explicación**. Es una falsa affordance: la persona cree que configuró algo y no cambió nada. La copia de “Recordatorios” dice que no hay push, pero tampoco hay recordatorio in-app.

**Prueba que falta:** un E2E que apague “Explicaciones” y compruebe que desaparece un texto explicativo concreto; otro para “Recordatorios”.

### P2-2 — “Antes de cerrar” llama “Esperando confirmación” a un cobro sin link

**Estado: CONFIRMADO por código.**

- `web/src/components/closing-checklist.tsx:306-320` arma `chargeRows` con todos los `confirmed`, `payment_pending` y `partially_paid` con saldo.
- `web/src/components/closing-checklist.tsx:592-610` pinta siempre el texto “Esperando confirmación”.

Un pedido `confirmed` sin `paymentUrl`/`qrString` no está esperando ninguna confirmación: no existe un cobro digital iniciado. La franja de Caja sí distingue “Sin link” (`pending-payments.tsx:29-35`), pero la tarjeta de cierre no. En una demo con 51 pendientes, la tarjeta mostraría los 50 como “esperando” aunque muchos sean “Sin link”.

**Prueba que falta:** un E2E con un pedido `confirmed` sin link y otro `payment_pending`; la tarjeta debe mostrar “Sin link” para el primero.

### P2-3 — El success de un fiado saldado sigue diciendo “Quedó a fiado”

**Estado: CONFIRMADO.**

- `web/src/app/pay/[id]/success/success-client.tsx:104-110` define `isCredit` solo con `creditCents > 0` y `amountDueCents <= 0`; no consulta el saldo del crédito.
- `web/src/lib/checkout.ts:88-104` no incluye el saldo del crédito en el payload público.

**Reproducción:** se creó un pedido de $50 a fiado, se pagó el crédito completo (`status=settled`, `balance=0`) y se abrió `/pay/{id}/success`. El HTML siguió mostrando:

```text
FIADO ANOTADO
Venta a fiado
Quedó anotado
$50.00
Quedó a fiado: $50.00. Está en la libreta de fiado...
```

No dice “saldo pendiente”, pero un comprador o la comerciante puede leer que la deuda sigue. El success no refleja el estado actual del fiado.

**Prueba que falta:** abrir el success después de saldar y exigir “Fiado saldado” o al menos “saldo $0.00”.

### P2-4 — “Lo que me deben” cuenta créditos, no personas

**Estado: CONFIRMADO por código.**

`web/src/components/caja-app.tsx:3035` usa `credits.length` para el texto “N personas”. Si un cliente tiene dos fiados abiertos, cuenta como dos personas. `CreditList` sí usa `new Set(credits.map(...customerId))` (`:6399`), pero `CajaBook` no. Es un detalle de copy, pero en una libreta de barrio el número de personas importa.

**Prueba que falta:** dos créditos del mismo `customerId` y un assert de “1 persona”.

### P2-5 — No hay reglas `forced-colors`; el foco en ese modo no está probado

**Estado: ausencia CONFIRMADA; impacto NO VERIFICADO.**

- No hay ninguna regla `@media (forced-colors: active)` en `web/src/app/globals.css`, `barrio.css` ni `checkout.css` (búsqueda sin resultados).
- `web/src/app/checkout.css:543-544` quita el outline del `h1` del recibo.
- `web/src/app/globals.css:208-216` define foco visible con variables de color; en forced-colors el sistema puede sustituir colores/fondos.

Playwright con `forced_colors="active"` confirmó que el media query se activa y el body se vuelve blanco/negro, pero no se hizo una inspección visual de todos los controles ni de foco con lector. **No afirmo que haya una violación WCAG confirmada**, solo que falta la prueba y la regla explícita que el handoff ya reconocía.

**Prueba que falta:** captura/axe en forced-colors con foco de teclado en los controles críticos (Cobrar, Fiar, Completar, Verificar).

### P2-6 — `/api/demo/pay` no es atómico en multi-proceso

**Estado: NO VERIFICADO en runtime; riesgo estático.**

`web/src/app/api/demo/pay/route.ts:60-85` lee `getOrder`, calcula `amountDue` y llama `recordPayment` sin `BEGIN IMMEDIATE` ni `requestId`. En un solo proceso Node el tramo es síncrono y el doble tap de la UI está bloqueado; en varias instancias (cluster/PM2), dos peticiones pueden leer el mismo saldo y crear dos transacciones demo distintas. No se reprodujo porque el despliegue validado es un solo `next start`; el riesgo queda para multi-proceso.

**Prueba que falta:** dos procesos o dos peticiones concurrentes con una barrera; exigir un solo pago demo.

### P2-7 — La documentación de cierre no coincide con la evidencia del árbol

**Estado: CONFIRMADO (proceso).**

- `README.md:8` dice “F3 implementado, verificado de forma independiente y desplegado en producción”.
- `demo/STATUS.md:3,56` dice que el servidor observado es `665d72e` (no la base), que **no hay `latest.json`** y que el full **no se ejecutó contra HEAD**.
- `harness/evidence/latest.json` no existe en el árbol; `harness/evidence` solo tiene el README y un `companion-preferences-e2e.json` con `gitAtStart.sha = e6f3107` y `dirty: true`.
- `HANDOFF-CIERRE.md:41,82,118` presenta el “Full 23/23” como pendiente/necesario, no como hecho; el handoff es más honesto que el README.

No es un bug de código, pero **no se puede declarar “desplegado/verificado”** con la evidencia disponible. El `verify:fast` que corrí escribe un run local, no `latest.json`, y el propio harness avisa “HANDOFF no actualizado”.

**Prueba que falta:** `verify:full` + `verify:evidence` sobre este HEAD, y actualizar README/demo STATUS con el SHA servido. No se ejecutó (requiere servidor `:3000`/túnel; fuera de este encargo).

---

## 5. Accesibilidad medida (sin sobreafirmar)

| Comprobación | Resultado | Límite |
|---|---|---|
| 320 px, home | `scrollWidth = innerWidth = 320`; sin overflow horizontal | El CTA “Cobrar” está bajo el pliegue (`top≈827` con viewport 640); alcanzable con scroll |
| 360 px, home | Sin overflow horizontal | — |
| 200 % (font-size 200 % inyectado) | `scrollWidth = 360`, sin overflow; “Cobrar” y “Fiar” quedan muy abajo (`top≈1419/1355`, tab bar `733`) | No es zoom real de navegador; es la prueba que usa el repo |
| axe (WCAG 2.0/2.1/2.2 AA, home 360) | 0 violaciones serious/critical en normal y alto contraste | `color-contrast` salió “incomplete”, no “pass”; no se midió todo el texto |
| Tokens de color principales | `ink-2/surface` 6.72:1; `attention/terracotta-soft` 5.53:1; `danger/terracotta-soft` 5.02:1; `green/green-soft` 6.53:1; `info/blue-soft` 5.77:1; placeholder 4.82:1 | Cálculo puntual, no todas las combinaciones con opacidad |
| `forced-colors` | No hay reglas; media query activa en Chromium, body blanco/negro | No se inspeccionó foco/contraste en todos los controles |
| Teclado/foco | Hay skip link, `main#main`, foco en hojas y `focus-visible` de 3 px; los E2E existentes lo cubren en parte | No se ejecutaron los E2E de shell/HIG; no hay lector real |

**Conclusión de accesibilidad:** no encontré una violación de contraste confirmada; sí faltan `forced-colors`, lector real, teléfono físico y zoom real. El 320/200 % no tiene overflow horizontal, pero el CTA principal queda lejos del primer viewport, lo que es carga cognitiva más que un fallo de reflow.

---

## 6. Lo que sí resistió (para no repetir alarmas viejas)

- **Build de producción:** PASS, `BUILD SHA b7154ca...`, TypeScript incluido.
- **`npm run verify:fast`:** 3/3 (guard, lint, types).
- **Webhook firmado:** `webhook-gate.mjs` → **40/40** en servidor aislado `:3193`; firma falsa 401, replay no duplica, monto distinto 409, timestamp viejo 401, QR CoDi, reintentos corregidos. El núcleo del webhook está bien.
- **Seguridad HTTP:** `security-contract.mjs` → **48/48** en `:3121`; CSRF, headers, body limits, rate limit, token de reset, poda de rechazos, backups y bloqueo de pagos manuales `pey` con `demo=0`.
- **Idempotencia de venta:** el código usa `requestId` + hash + índice único + `BEGIN IMMEDIATE` (`orders.ts:220-330`); no ejecuté el contrato atómico, pero el diseño es sólido.
- **Fiado:** `recordCreditPayment` usa `BEGIN IMMEDIATE`, idempotencia durable y `expectedBalanceCents`; el overpay se reporta, no se recorta en silencio.
- **Corte:** versiones inmutables, `expectedVersion`, fingerprint del preview y snapshot; no ejecuté `p0-corte-e2e.py`, pero la estructura es la correcta.
- **Secretos:** no hay `.env.local` ni claves versionadas; `.gitignore` cubre `web/.env.local`, `web/data/` y artefactos.
- **320 px:** sin overflow horizontal en la home; axe sin violaciones serious/critical.

---

## 7. NO VERIFICADO — lo que no se pudo probar

- **Pago real de pey / BBVA / CoDi.** No se ejecutó; no se usó dinero real. El webhook y `/api/verify` se probaron con firma/mock, no con el portal.
- **Payload real de pey.** No sé si una transacción real siempre trae `payableId`/`payableType`/metadata; el P1-3 es un riesgo si no los trae.
- **Full 23/23, `verify:evidence`, `latest.json`.** No se ejecutó; no hay `latest.json` en el árbol.
- **Gates no ejecutados:** `mobile`, `checkout`, `hig`, `motion`, `contrast`, `mobile-320`, `p0-venta`, `p0-fiado`, `p0-corte`, `p0-integracion`, `p0-dinero`, `rehearsal`, `tunnel`, `preflight`, `film`. No se afirma que fallen; simplemente no los corrí.
- **TalkBack/VoiceOver, lector de pantalla real, teléfono físico 320/360, zoom real de navegador, estudio con 6–8 comerciantes.** No se hicieron.
- **Cloudflare Access / configuración del túnel / caché del CDN.** No se inspeccionó la preview; el P0-2 es el header y el HTML, no una prueba de que el CDN esté cacheando.
- **Carrera multi-proceso de `/api/demo/pay`.** No reproducida; solo lectura de código.
- **Contraste completo.** axe reportó `color-contrast` como incomplete; los tokens principales pasan, pero no medí cada texto con opacidad/fondo.
- **Forced-colors real.** Solo ausencia de CSS y emulación del media query, no inspección visual exhaustiva.
- **Migraciones de bases viejas.** No se ejecutaron los contratos de migración; el foco fue dinero/cognitiva/seguridad del HEAD.

---

## 8. Recomendación de prioridad

1. **No usar el reset de demo como “limpieza segura”** hasta corregir P0-1. Si hay un pago firmado, el reset debe bloquear o conservarlo, y `preservedRealPayments` debe ser verdadero.
2. **Quitar `public/s-maxage` de `/`** o dejar de renderizar datos privados en el HTML; mientras tanto, no cachear HTML en el CDN.
3. **Aislar el modo demo de los webhooks firmados** (P1-1): el evento firmado en demo debe ser `demo_paid` o rechazarse; `fulfill` no debe aceptar un demo.
4. **Exigir referencias en `/api/verify`** (P1-3) y añadir el caso sin `payableId` al contrato.
5. **Corregir los totales truncados** (P1-5) con paginación visible o totales del servidor.
6. **Arreglar el 404 HTTP** (P1-4) y añadir el assert de status.
7. **Documentar la falta de auth como bloqueo de producción** (P1-2) y no presentar la demo pública como “protegida” sin Access.

---

*Auditoría independiente. No se modificó código, tests ni documentos existentes. El servidor aislado se apagó al terminar. Los archivos de este informe son los únicos cambios de la rama `p0/adversarial`.*
