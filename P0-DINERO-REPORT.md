# P0 · Fix de dinero/verdad — reporte de carril

> Worktree: `mercado-cero-fix-dinero` · rama `p0/fix-dinero` · base `7bb0dc5`.
> Alcance: auditoría de dinero/verdad (seed real, webhook, verify por orden,
> demo-cash, abonos declarados, fechas, allowlist, `fulfilled`, timeout de pey
> y endurecimiento del corte). No se hizo merge.

## 1 · Resultado

| Prioridad | Estado | Qué cambió |
|---|---|---|
| 1. Seed real | **Hecho** | `seed()`/`seedGoal()` no siembran con `DEMO_MODE=false`. Los fixtures demo usan `provider='demo'`, `status='demo_paid'`, ids `demo_seed_*` y se separan de los reportes reales. |
| 2. Reintento webhook | **Hecho** | Un `payment_events` rechazado se reutiliza si llega el mismo `webhook-id` corregido; un replay procesado sigue siendo 200 duplicate. No se ackea 200 un rechazo. |
| 3. `/api/verify` por orden | **Hecho** | Exige `orderId`; valida orden, monto, moneda, link/QR y referencias. Una transacción real de otra orden responde `verified:false`. |
| 4. Demo-cash | **Hecho** | `/api/demo/pay` solo acepta `codi/card/wallet` (400 para `cash`). `provider='demo'` no suma a `cashCents`/`cashSalesCents`; checkout/success reciben `cashPaidCents` real y `demoPaidCents` separado. |
| 5. Abonos de fiado | **Hecho** | `credit_payments.provider` (`cash`/`declared`); los digitales aparecen en `declaredDigitalCents`, no como verificados por pey. Suma consistente en `summary` y corte. |
| 6. Fechas | **Hecho** | Cobro (`verifiedDigital`, `declared`, demo, cash, `collected`, reconcile) por `payments.created_at`/`credit_payments.created_at`; venta por `orders.created_at`. |
| 7. Allowlist | **Hecho** | `recordPayment` solo acepta `pey` (→ `paid`) y `demo` (→ `demo_paid`); cualquier otro proveedor lanza antes de escribir. |
| 8. `fulfilled` | **Hecho** | `createOrder`/`recordPayment` ya no ponen `fulfilled` con fiado. La entrega es explícita, exige deuda saldada y los reportes no cuentan `fulfilled` con fiado como pedido pagado. Badge/detalle muestran “Fiado”/“Quedó anotado”. |
| 9. Timeout / método pey | **Hecho** | `peyFetch` usa timeout (10 s por defecto, `PEY_TIMEOUT_MS`); `mapPeyMethod` desconocido devuelve `unknown`, no inventa `card`. |
| 10. Payload real de pey | **KNOWN P1-4** | No hay portal/credenciales para validar el payload real. El contrato sintético queda documentado y marcado; ver §6. |
| Addendum 1. Esperado negativo | **Hecho** | `preview`/`close` responden 400 `expected_negative` si `opening + cashSales + cashCredit < expenses + withdrawals`. |
| Addendum 2. Preview vs guardado | **Hecho** | El preview devuelve `fingerprint`; `close` exige `previewFingerprint` y responde 409 `totals_changed` si entraron movimientos. Obliga a re-preview. |
| Addendum 3. Conteo viejo | **Contrato documentado** | El backend no acepta una corrección con la huella vieja. La UI de flujos debe reemplazar el conteo guardado por el vigente; el carril de dinero no la presenta como actual. |

## 2 · Cambios por archivo

- `web/src/lib/db.ts`: seed demo-only y marcado; migración `credit_payments.provider`; resumen por fecha de movimiento; separación demo/real; exclusión de fixtures demo en listas y metas reales.
- `web/src/lib/orders.ts`: allowlist de proveedor, estados sin `fulfilled` con fiado, `provider` en abonos, entrega explícita con deuda saldada.
- `web/src/lib/payment-rules.ts`: reglas puras de allowlist y estado cubierto.
- `web/src/lib/analytics.ts`: ventas por fecha de pedido; cobros por fecha de pago; buckets real/verificado/declarado/demo.
- `web/src/lib/cash.ts`: exclusión de demo; `expected_negative`; fingerprint de `cashSales/cashCredit/expected`; 409 `totals_changed`.
- `web/src/lib/pey-events.ts`, `web/src/lib/pey.ts`: base de transacción compartida, timeout y `mapPeyMethod` honesto.
- `web/src/lib/reconcile.ts`: filtra por fecha del pago y excluye demo.
- `web/src/app/api/webhooks/pey/route.ts`: reintento de eventos rechazados, sin doble pago.
- `web/src/app/api/verify/route.ts`: verificación por orden con monto/moneda/referencias.
- `web/src/app/api/demo/pay/route.ts`: zod `codi|card|wallet`; rechaza efectivo.
- `web/src/app/api/credits/[id]/pay/route.ts` + `orders.ts`: `provider` y método del abono.
- `web/src/app/api/cash/preview|close/route.ts`: contrato de fingerprint y errores nuevos.
- `web/src/app/api/checkout/[id]/route.ts`, `checkout-client.tsx`, `success-client.tsx`: efectivo real vs demo.
- `web/src/components/caja-app.tsx`: labels de fiado/entrega, separación declarado/demo, verificación con `orderId`, guardado con fingerprint. **Nota de coordinación:** este archivo también lo editan a11y/flujos/diseño; los cambios son de copy/estado y deben revisarse al integrar.
- `web/src/lib/types.ts`, `goals.ts`, `voice.ts`: campos nuevos y metas demo.
- `web/scripts/`: nuevo `p0-dinero-e2e.py`, `payment-rules-test.mjs`; actualización de `webhook-contract.mjs`, `verify-truth.mjs`, `p0-corte-e2e.py`, `p0-fiado-e2e.py`, `p0-integracion-e2e.py`, `p0-venta-e2e.py`, `preflight.mjs`.

## 3 · Contrato del webhook (reintentos)

- `payment_events.idempotency_key` sigue siendo único por `webhook-id`.
- Si la fila existente es `processed`/`ignored`/`received`, el replay responde `200 {duplicate:true}` sin escribir.
- Si la fila existente es `rejected`, el mismo `webhook-id` con payload corregido se reprocesa en la misma fila (`result='received'` → `processed`).
- Si el reintento vuelve a fallar, la fila conserva `rejected` y el nuevo motivo; se devuelve el mismo 4xx.
- La idempotencia por `transactionId` sigue evitando doble pago.

## 4 · Contrato de verificación

`GET /api/verify?transactionId=...&orderId=...`

- 400 si falta `transactionId` u `orderId`.
- `verified:false` si la orden no existe, la transacción pertenece a otra orden, el monto/moneda no coincide o las referencias (link/QR/payableId/metadata) apuntan a otro pedido.
- `verified:true` solo si la transacción local `provider='pey'` pertenece a esa orden y el total digital cuadra; en modo real, si no hay fila local, se consulta pey y se aplican las mismas comparaciones.
- Un `transactionId` demo nunca se verifica (`provider='demo'` no entra a la consulta local; en demo responde `not_found`).

## 5 · Contrato del corte (addendum)

- `POST /api/cash/preview` devuelve `preview.fingerprint` (sha256 corto de `cashSalesCents:cashCreditCents:expectedCents`).
- `POST /api/cash/close` exige `previewFingerprint`.
- Si los totales vivos cambiaron: `409 {code:'totals_changed', currentFingerprint}` y **no** se escribe ninguna versión.
- Si `opening + cashSales + cashCredit < expenses + withdrawals`: `400 {code:'expected_negative'}` en preview y close.
- Tras un cierre con movimientos nuevos, el conteo guardado no es el vigente. El backend obliga a re-preview; la UI de flujos debe reemplazar el valor mostrado y no rellenarlo como si fuera actual.
- `requestId` sigue devolviendo la versión ya creada (idempotencia) sin volver a evaluar la huella.

## 6 · KNOWN / P1

1. **P1-4 · Payload real de pey.** No se puede validar sin portal/credenciales. El contrato del webhook y `/api/verify` usan el payload sintético (link `payment_link.status_updated` y QR `codi.qr.payment_received`); la forma real de pey queda pendiente de una prueba con el portal. Marcado también en `p0-dinero-e2e.py` como KNOWN.
2. **Reconciliación de red no ejecutada.** `reconcile.ts` ya filtra por fecha del pago y excluye demo, pero no se llamó a pey real en este carril. La lógica local queda cubierta por el E2E; la conciliación real es P1.
3. **Conteo posterior al cierre.** El backend exige `previewFingerprint`, pero la UI de flujos debe decidir cómo mostrar el conteo vigente después de un cierre. Documentado como contrato, no como cambio de UI profundo.
4. **Filas históricas `fulfilled` con fiado.** No se migraron. Los nuevos estados ya no se crean así; el badge y los reportes evitan presentarlas como “Entregado/pedido pagado”. Una migración explícita de datos viejos queda como P1.
5. **Demo-cash histórico.** Los pagos demo viejos con `method='cash'` siguen en la base; se excluyen de efectivo real y se muestran como demo. No se reescribieron.

## 7 · Evidencia

Servidor aislado `:3122` con DB temporal. No se tocó `:3000` ni `:3101`.

| Gate | Resultado |
|---|---|
| `npm run lint` | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| `node --test scripts/payment-rules-test.mjs` | **3/3 PASS** |
| `node scripts/webhook-contract.mjs` | **34/34 PASS** |
| `node scripts/verify-truth.mjs` | **VERDAD OK** |
| `python scripts/p0-dinero-e2e.py` | **45 PASS · 0 FAIL · 3 KNOWN** |
| `python scripts/p0-fiado-e2e.py` | **50 PASS · 0 FAIL · 0 KNOWN** |
| `python scripts/p0-integracion-e2e.py` | **51 PASS · 0 FAIL · 0 KNOWN** |
| `python scripts/p0-corte-e2e.py` (aislado, con migración) | **69 PASS · 0 FAIL · 0 KNOWN** |
| `python scripts/p0-venta-e2e.py` | **43 PASS · 0 FAIL · 0 KNOWN** |
| `preflight.mjs` | No ejecutado: requiere `.env.local`/túnel HTTPS. Se actualizaron sus asserts a la semántica demo correcta; conserva **18 checks**. |

Evidencia generada:
- `harness/evidence/p0-dinero-e2e.json`
- `harness/evidence/p0-fiado-e2e.json`
- `harness/evidence/p0-integracion-e2e.json`
- `harness/evidence/p0-corte-e2e.json`
- `harness/evidence/p0-venta-e2e.json`

## 8 · Coordinación de marcadores (para harness)

- `web/scripts/webhook-contract.mjs`: el conteo sube de **27/27** a **34/34** (4b: 3 checks; 5b: 4 checks). La última línea imprime `34/34 pruebas en verde`.
- `web/scripts/verify-truth.mjs`: conserva **`VERDAD OK`**.
- `web/scripts/preflight.mjs`: conserva **18/18** checks; cambia el detalle de “Cobrado” ($0 real + $70 demo) y el esperado del corte ($500, sin efectivo demo).
- `web/scripts/rehearse-demo.py`: no se tocó ni se ejecutó (requiere `:3000`); su marcador esperado sigue siendo `todo en verde: True`.
- **No se editó `harness-gate.mjs`**. El carril de harness debe actualizar `expected` del gate webhook a `34/34` cuando integre.

## 9 · Verificación manual

- [ ] Lo probé en la app real, no solo en tests. *(No aplica: carril backend; E2E con Playwright en :3122.)*
- [x] Revisé estados vacío/carga/error en los E2E de fiado/integración/corte.
- [x] Revisé 360 px y texto 200 % en los E2E existentes.
- [x] No hay secretos en el diff.
- [x] No marqué `paid` fuera del webhook pey; demo usa `demo_paid`.
