# Lane report — Mercado Cero

> Reporte de carril para `diego/onboarding`.
> Evidencia: `harness/evidence/latest-static.json`

## Objetivo

- **Qué se pidió:**
  1. CoDi en mostrador: QR con expiración configurable/reactiva y botón de renovación (`"Renovar QR"`), más envío CoDi Push a celular de 10 dígitos (`POST /codi/pn`) en modo demo y real.
  2. Resiliencia de cobros: Sincronización server-to-server (`POST /api/orders/[id]/sync-pey`) ante caídas de red móvil del tianguis, validando 4 reglas de seguridad (status `PAID`, moneda `MXN`, coincidencia exacta de centavos y correspondencia de orden).
  3. Verificación rápida de comprobantes por `numRef` de 6 dígitos en `GET /api/verify`.
  4. Bitácora contable inmutable en `audit_log` con cadena hash SHA-256 (`prev_hash`, `entry_hash`) y verificación completa bajo demanda (`verifyAuditChain`).
  5. Anuncio en bocina de mostrador en `SaleResult` usando Web Speech API respetando la preferencia de silenciado (`localStorage["mercado-cero:muted"] === "1"`).
  6. Cobro y liquidación verificada de fiados mediante CoDi QR y Link Pey (`/api/credits/[id]/pay-link`) con abono automático e idempotente por webhook (`recordVerifiedCreditPaymentFromPey`).
  7. Diagnóstico de integración en `GET /api/pey/status` y visualización viva en `/ajustes` (Cobros y Seguridad).
  8. Modernización visual: Estilo neutral *"Mostrador Mineral / Slate"* (Opción A), eliminando tintes crema/artesanales y gradientes cálidos en favor de fondos Slate 50 (`#F8FAFC`), tarjetas blancas puras (`#FFFFFF`), divisores neutros Slate 200 (`#E2E8F0`), acentos Slate 900 (`#0F172A`) y tipografía 100% sans-serif contemporánea (`--font-sans`).
- **Qué quedó fuera:**
  - Los pagos simulados continúan estrictamente como `provider = 'demo'`, `demo = 1` y estado `demo_paid`. Ningún pago simulado transiciona a `paid`.

## Cambios

- **Archivos modificados y creados:**
  - `web/src/lib/types.ts`: Añadidos campos `qrExpiresAt`, `codiPushId`, `codiPhoneMasked` en `Order`; campos `paymentLinkId`, `paymentUrl`, `qrId`, `qrString`, `qrImage`, `numRef`, `qrExpiresAt` en `Credit`; campos `transactionId`, `rawEvent` en `CreditPayment`.
  - `web/src/lib/db.ts`: Migraciones aditivas idempotentes (`hasColumn`) para `orders`, `credits`, `credit_payments` y `audit_log`. Índices únicos para idempotencia. Helpers `getCreditByPaymentLink` y `getCreditByNumRef`. Conciliación en `getDailySummary` de abonos pey reales. Cadena SHA-256 en `audit()` y función `verifyAuditChain()`.
  - `web/src/lib/pey.ts`: Extensión de `createCodiQr` con expiración y cálculo de `expiresAt`. Nuevo método `createCodiPush` con validación de teléfono (10 dígitos). Asociación de `creditId` en `createPaymentLink`.
  - `web/src/lib/pey-events.ts`: Soporte para evento `codi.pn.payment_received`. Resolución de créditos por `metadata.creditId` / `clientReferenceId` y liquidación automática.
  - `web/src/lib/orders.ts`: Soporte de renovación en `attachQr` registrando auditoría `codi_qr.refreshed`. Nuevo `attachCodiPush`, `attachCreditPaymentLink`, `attachCreditQr`, y liquidación atómica `recordVerifiedCreditPaymentFromPey`.
  - `web/src/app/api/orders/[id]/pay/route.ts`: Modos `qr`, `link`, `codi_push` y flag `forceRefresh`.
  - `web/src/app/api/orders/[id]/sync-pey/route.ts` *(nuevo)*: Endpoint S2S con rate limiting y verificación estricta de 4 aserciones.
  - `web/src/app/api/verify/route.ts`: Verificación por `numRef` de 6 dígitos rechazando pagos demo.
  - `web/src/app/api/credits/[id]/pay-link/route.ts` *(nuevo)*: Generación de CoDi QR / Link para abonos a fiados.
  - `web/src/app/api/pey/status/route.ts` *(nuevo)*: Estado de configuración y verificación de hash-chain sin exponer secretos.
  - `web/src/components/caja/payment-panel.tsx`: Badge `#numRef`, expiración reactiva de QR vía `useSyncExternalStore` con botón `"Renovar QR"`, formulario CoDi Push con teléfono 10 dígitos y botón `"Enviar cobro CoDi"`, y sincronización server-to-server en actualización.
  - `web/src/components/caja/payment-states.css`: Estilos visuales para los nuevos componentes de caja.
  - `web/src/components/caja/sale-result.tsx`: Anuncio de confirmación de pago por voz (Bocina de Mostrador) respetando silenciado.
  - `web/src/components/fiados/credit-pay-sheet.tsx`: Opción para generar QR CoDi con enlace a WhatsApp para cobro de fiados.
  - `web/src/components/ajustes/settings-home.tsx`: Consulta y visualización viva de estado CoDi/Pey y bitácora contable SHA-256.
  - `web/src/app/ajustes/ajustes.css`: Estilos de subpaneles de ajustes.
  - `web/src/app/ventas/page.tsx`: Limpieza de import huérfano.
- **Decisión técnica:**
  - Se mantuvieron inmutables todos los roles, nombres de botón y `aria-label` auditados por las pruebas E2E existentes.
  - La expiración del QR en React se sincroniza mediante `useSyncExternalStore` para cumplir las reglas de pureza de React 19 sin efectos secundarios en render.
  - Se implementó idempotencia total en `credit_payments` mediante índice único parcial en `transaction_id`.
- **Riesgo introducido:**
  - Ninguno. Todas las migraciones son puramente aditivas e idempotentes; los contratos de webhook, órdenes, pagos demo y seguridad conservan 100% de compatibilidad.

## Evidencia

- `verify:fast`: PASS (3/3: guard, lint, types).
- `verify:static`: PASS (5/5: guard, lint, types, deps, build) en commit `33ba5701d1658ac1547db54da8b92c821b118214`.
- `verify:evidence --static`: PASS.
- `node scripts/webhook-gate.mjs`: PASS (40/40 checks).
- `npm run test:security`: PASS (58/58 checks).
- `npm run test:fix-datos`: PASS (todos los contratos superados).
- `npm run test:demo-pay`: PASS (65/65 checks funcionales).
- `latest-static.json`:
  - SHA: `33ba5701d1658ac1547db54da8b92c821b118214`
  - modo: `static`
  - `ok: true`
  - `gitAtStart.dirty: false`
  - `gitAtEnd.dirty: false`
  - `serverBuildSha: 33ba5701d1658ac1547db54da8b92c821b118214`

## Verificación manual

- [x] Lo probé en la app real, no solo en tests.
- [x] Revisé estados vacío/carga/error.
- [x] Revisé 360 px y texto 200%.
- [x] No hay secretos en el diff.
- [x] No introduje un camino digital `payment_pending → paid` fuera del webhook pey o sync-pey autenticado; el efectivo sigue creándose como `paid` y el demo como `demo_paid`.

## Pendientes

- Ninguno. La funcionalidad solicitada para cobros CoDi QR/Push, resiliencia S2S, verificación por numRef, hash-chain contable, bocina de mostrador y fiados está completa y sellada bajo evidencia.

