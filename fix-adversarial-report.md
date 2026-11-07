# Fix adversario P0/P1 — reporte

- **Worktree:** `mercado-cero-fix-adversarial`
- **Rama:** `p0/fix-adversarial`
- **Base:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045`
- **Commit de código y tests:** `ac9e5a63a0258c8d70edee1d2d5123c2163f4352`
- **Fecha:** 2 nov 2026
- **Servidores usados:** `127.0.0.1:3306` (demo), `127.0.0.1:3307` (real temporal) y `127.0.0.1:3308` (mock de pey). No se tocaron `:3000`, `:3230` ni la preview.

Los cinco hallazgos se trataron como hipótesis y se reprodujeron primero en servidores aislados con SQLite temporal. Los P0 se corrigieron; P1-1, P1-3 y P1-5 también. No se hizo merge.

## 1. Reproducción antes de corregir

### P0-1 — reset borraba un pago pey firmado y reportaba que lo preservaba

Flujo real: orden demo → link → webhook HMAC válido `paid` → `POST /api/demo/reset`.

```json
{
  "reset": {
    "status": 200,
    "body": {
      "ok": true,
      "preservedRealPayments": 1,
      "realDataCount": 0
    }
  },
  "afterReset": { "orders": 0, "payments": 0 }
}
```

El pedido y el pago `provider=pey, status=paid, demo=1` desaparecieron. El 200 y `preservedRealPayments: 1` eran falsos.

### P0-2 — `/` con caché pública

```text
GET / -> 200
Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300
```

### P1-1 — webhook firmado en demo producía `paid`, sumaba a verificado y se entregaba

```text
order.status = paid
payments = [('pey', 'paid')]
dashboard.verifiedDigitalCents = 1000
dashboard.demoDigitalCents = 0
PATCH fulfill = 200 fulfilled
```

### P1-3 — `/api/verify` aceptaba PAID sin referencias

Mock de pey: `{ "id": "txn_no_refs", "status": "PAID", "amount": 10.0, "currency": "MXN" }`, orden de 1000 centavos.

```json
{ "verified": true, "source": "pey", "amountCents": 1000, "method": "codi" }
```

### P1-5 — totales truncados

```text
pendingOrders.length = 50
pagination.pendingOrders = { limit: 50, total: 52, hasMore: true }
summary.pendingCents = 17100
suma visible = 16900
HTML: "Cobros pendientes (todas las fechas)", 50, $169.00

credits.length = 100
pagination.credits.total = 102
suma visible = $100.00
saldo real de fiado = $151.00
```

## 2. Correcciones

### P0-1 — reset seguro

- `resetDemoData` bloquea con `409 real_data_present` si hay **cualquier** pago `provider='pey' AND status='paid'`, aunque su fila tenga `demo=1`. También sigue bloqueando datos reales `demo=0`.
- El 409 no borra ni el pedido ni el pago, y no devuelve `preservedRealPayments`.
- `FORCE_DEMO_RESET=1` continúa, pero **conserva** los pagos pey firmados y sus pedidos.
- `preservedRealPayments` y `realPaymentCount` se calculan **después** del borrado, contra la base resultante. Ya no se reporta la intención previa.
- La API devuelve `realPayments` y un mensaje específico cuando el bloqueo es por pago firmado.
- La UI lee el JSON de error y muestra el mensaje del servidor; solo limpia estado y dice “Demo reiniciada” cuando la respuesta es `ok`.
- Regresión nueva: `security-contract.mjs` inserta un pedido/pago firmado `demo=1`, exige 409 y verifica que las filas sobrevivan. El E2E repite el camino real completo (orden, link, webhook firmado, reset).

### P0-2 — `/` privado y `no-store`

- `next.config.ts` aplica a `/` el mismo `Cache-Control: private, no-store, max-age=0, must-revalidate` de las APIs sensibles.
- Se añadió aserción en `security-contract.mjs` y en el E2E: exige `private`, `no-store`, y ausencia de `public`/`s-maxage`.
- No se tocó el render SSR ni el diseño; el E2E comprueba que `/` sigue respondiendo 200 con el HTML de la caja.

### P1-1 — demo firmado no es dinero verificado ni entregable

- `recalculateOrderTotals` decide el estado con `payments.demo`: si el pago cubierto es demo, el pedido queda `demo_paid`; solo un pago `demo=0` con provider `pey` queda `paid`.
- `getDailySummary` manda **cualquier** pago `payments.demo=1` al bucket demo, no a `verifiedDigitalCents`. Se mantuvo sin cambios la semántica histórica de `credit_payments` para no ampliar el alcance.
- `fulfillOrder` ya bloqueaba `demo_paid`; el contrato del webhook ahora lo comprueba y exige 409 `demo_not_deliverable`.
- `webhook-contract.mjs` detecta el modo demo y espera `demo_paid`, no `paid`; añadió dashboard y fulfill. Sigue en **40/40**.
- `p0-dinero-e2e.py` se actualizó a la misma semántica demo. El camino `DEMO_MODE=false` conserva `paid`.

### P1-3 — referencias obligatorias

- `hasReferenceMismatch` ahora devuelve `true` si la transacción PAID no trae ninguna de `metadata.orderId`, `metadata.externalMetadata.orderId`, `clientReferenceId` o `payableId`.
- Referencias presentes pero de otra orden/link/QR siguen rechazándose.
- El E2E levanta un mock de pey y comprueba:
  - `txn_no_refs` → `verified:false`, `reason:reference_mismatch`.
  - `txn_with_order_ref` con `metadata.orderId` correcto → `verified:true`.

### P1-5 — totales del servidor y conteos honestos

- Nuevos totales de servidor en `/api/dashboard`:
  - `pendingCentsTotal`: suma de **todos** los cobros pendientes.
  - `creditsOpenTotal`: todos los fiados abiertos.
  - `creditsCustomersTotal`: clientes distintos con fiado abierto.
  - `creditsBalanceCents`: saldo abierto total.
- `PendingPayments` usa `totalCount`/`totalCents`: muestra “50 de 52” y el total real; se eliminó “(todas las fechas)”.
- `CajaBook` y `CreditList` usan el saldo y los conteos del servidor; muestran “Mostrando 100 de 102 fiados” cuando la lista está paginada.
- No se inventó paginación nueva: la UI declara el truncamiento y el total. El E2E comprueba 52 pendientes y 102 fiados abiertos.

## 3. Evidencia después

### E2E nuevo

`web/scripts/p0-adversarial-e2e.py` — **28/28 checks**.

```text
P0-2 / -> Cache-Control: private, no-store, max-age=0, must-revalidate

P0-1/P1-1 webhook firmado -> 200 processed
P1-1 estado -> demo_paid
P1-1 verifiedDigitalCents 0 -> 0
P1-1 demoDigitalCents 0 -> 1000
P1-1 fulfill -> 409 demo_not_deliverable
P0-1 reset -> 409 real_data_present, realPayments=1
P0-1 pedido y pago siguen en SQLite
P0-1 FORCE -> 200; preservedRealPayments=1; DB=1

P1-3 txn sin referencias -> verified:false / reference_mismatch
P1-3 txn con metadata.orderId -> verified:true

P1-5 pendingCentsTotal api=17100 db=17100 total=52
P1-5 créditos=102/102 saldo=15100/15100
P1-5 HTML: "50 de 52", "$171.00", "100 de 102 fiados", "$151.00"
```

### Gates

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS (`BUILD OK`) |
| `npm run test:security` | PASS **52/52** |
| `node scripts/webhook-gate.mjs` | PASS **40/40** |
| `python scripts/p0-adversarial-e2e.py` | PASS **28/28** |
| `python scripts/p0-dinero-e2e.py` | PASS **45 + 3 KNOWN** |
| `npm run test:fix-datos` | PASS (63 + 20 + 8 + 32 checks) |
| `npm run test:payment-labels` | PASS 6/6 |

`npm run verify:fast` ejecutó sus 3 gates en verde (guard, lint, types), pero el comando global termina en rojo únicamente porque el árbol estaba sucio antes de commitear; no se usó como evidencia.

### Archivos principales

- `web/src/lib/db.ts` — reset, totales de cobros/fiado y resumen diario.
- `web/src/lib/orders.ts` — `demo_paid` por marca `demo` del pago.
- `web/src/app/api/demo/reset/route.ts` — 409 específico y conteos reales.
- `web/src/app/api/verify/route.ts` — referencias obligatorias.
- `web/next.config.ts` — `/` privado.
- `web/src/components/pending-payments.tsx`, `caja-app.tsx` — totales y conteos honestos, error de reset.
- `web/scripts/webhook-contract.mjs`, `webhook-gate.mjs`, `security-contract.mjs`, `p0-dinero-e2e.py`, `p0-adversarial-e2e.py`.

## 4. Lo que no se cerró

- **P1-2 (autenticación):** sigue sin sesión propia; la única barrera es Cloudflare Access. P0-2 evita la caché compartida, no sustituye auth.
- **P1-3 con payload real de pey:** el caso sin referencias se probó con mock; la forma exacta del payload real sigue sin validarse contra el portal.
- **P1-5 sin paginación completa:** la UI ya no subestima ni miente, pero no hay botón para cargar los pendientes 51+ ni los fiados 101+. Los límites de API siguen siendo 100 pendientes / 200 créditos.
- **HTML privado por diseño:** `/` sigue renderizando la caja completa en el primer paint; el header evita cachés compartidas, pero el despliegue sigue necesitando Access.
- **`FORCE_DEMO_RESET`:** un operador puede forzar el reset, pero los pagos firmados y sus pedidos se conservan. El `webhook-gate` usa `FORCE` solo para limpiar su DB temporal y no borrar los eventos firmados que acaba de probar.
