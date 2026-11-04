# 05 — Ventas y pagos

## Veredicto

**Semántica del servidor: correcta en el camino probado. Verdad visible de la UI: NO-GO.** El motor sigue marcando solo `paid` por webhook/efectivo registrado; los P0 son de presentación y pueden inducir a error sobre dinero recibido.

## P0 reproducidos

### P0-01 — Fiado puro afirma que se registró efectivo

- Orden: `total=10000`, `paidCents=0`, `creditCents=10000`, estado `confirmed`.
- Resultado visible: “Quedó anotado en Fiado. **Solo el fiado es deuda; el efectivo sí se registró en la caja**.”
- Realidad: no hay `payments`, no entró efectivo. La frase contradice la regla de oro.
- Evidencia: `EVIDENCIAS/fiado-total-p0.png`, `EVIDENCIAS/fiado-p0.txt`, `EVIDENCIAS/final-fiado-puro.png`.
- Archivo: `web/src/components/caja/sale-result.tsx` (banner de fiado).

### P0-02 — Mixto efectivo+digital oculta el efectivo ya cobrado

- Orden: `total=10000`, `paidCents=6000`, `digital=0`, `due=4000`; estado `confirmed`/`payment_pending` al generar link.
- Panel visible: “Falta cobrar $40.00. El pedido ya está registrado. **El dinero aún no se considera recibido**.”
- Realidad: $60 de efectivo ya están aplicados; no se muestran “Recibiste $60” ni el desglose.
- Evidencia: `EVIDENCIAS/mixto-efectivo-digital-panel.png`, `EVIDENCIAS/mixto-efectivo-digital.txt`, `EVIDENCIAS/final-mixto-panel.png`.
- Archivo: `web/src/components/caja/payment-panel.tsx`.

## P1

### P1-08 — `/ventas` oculta “Cobrado” en `payment_pending`

Pedido mixto con `paid=6000`, `credit=2000`, `due=4000` y link generado: la fila muestra “PENDIENTE / Pendiente de cobro / Falta cobrar $40 / Saldo vivo $20”, pero **no** “Cobrado $60”. El comerciante no ve el efectivo ya recibido. Evidencia: `EVIDENCIAS/ventas-mixto-pendiente.txt`, `...png`, `EVIDENCIAS/final-ventas-payment-pending.png`.

### P1-09 — Abonos demo suman a “Cobrado confirmado”

Con abonos demo de fiado, `/ventas` muestra “Cobrado confirmado $450.00” y el subtítulo “Solo efectivo real y pagos verificados; **demo no cuenta**”. `dashboard.summary.cashCents` incluye `credit_payments` demo. Es un bug preexistente de `db.ts` que la nueva pantalla expone. Evidencia: `EVIDENCIAS/ventas-demo-abono-real.png`, `EVIDENCIAS/demo-abono-real.txt`, `EVIDENCIAS/final-abono-demo-cobrado.png`.

### P1-10 — `/api/demo/pay` heredado

- No comprueba `order.demo`: un pedido `demo=0` puede terminar `demo_paid` en una copia de base.
- No tiene idempotencia durable por pedido: con dos procesos y contención de escritura se insertaron dos pagos de $100 sobre un total de $100 (`paid_cents=20000`).
- En un solo proceso, 10 POST concurrentes no duplicaron; el riesgo requiere multiproceso/ventana de lock.
- Evidencia: `auditorias/04_ventas_pagos.md`, `EVIDENCIAS/pagos-demo-pay-adversarial.json`, `pagos-demo-lock-race.json`, `pagos-demo-multiproceso.json`.

### P1-12 — 502 post-commit + edición + reintento duplica

El smoke H prueba 502 + reintento sin editar: una sola orden. Si el usuario edita después del 502 post-commit, la firma cambia, se genera otro `requestId` y se crea otra venta. Evidencia: `auditorias/04_ventas_pagos.md` (`pagos-502-edit.json`), B smoke no cubre edición.

### P1-07 — Cambio fantasma en Mixto

Con total $90, efectivo $100 y fiado $90: el resumen dice “Cambio a devolver $100. Se aplicaron $0 al cobro” y el CTA “Registrar fiado $90”. El servidor registra `paid=0`, `credit=9000`; la UI sugiere que entraron $100 y se devolvieron. Evidencia: `EVIDENCIAS/mixto-cambio-fantasma.png`, `...resultado.png`, `...txt`, `final-mixto-phantom.png`.

### P1-06 — Un pendiente secuestra `/caja`

Al crear un cobro digital y volver a `/caja`, se reanuda el panel de pago; no hay “Nueva venta”, “Descartar” ni “Volver a Caja” que reinicie. El cajero no puede iniciar otra venta desde esa pantalla. Evidencia: `EVIDENCIAS/pendiente-secuestra-caja.png`, `pendiente-secuestra.txt`, `final-pending-trap` (verificador).

### P1-05 — Foco de ruta/paginación

Tras navegar, `activeElement=BODY`; al paginar, el foco queda en “Siguiente” fuera de pantalla. Evidencia: `EVIDENCIAS/keyboard-focus.json`, `auditorias/08_accesibilidad.md`.

## Lo que sí funciona

- Efectivo exacto/cambio/insuficiente; $100 con $200 → cambio $100; decimales/miles; cantidades; eliminación; borrador; doble clic; `requestId` mismo payload → misma orden; payload distinto → 409.
- Digital: link/QR, `payment_pending`, demo `demo_paid`, nunca `paid` por UI/QR; `/api/verify` demo/pey-demo `verified:false`.
- Webhook existente 40/40; checkout 19/19; p0-venta 66/0.
- `/ventas` lista, pagina, muestra método/saldo/pendiente; la verdad de filas es correcta salvo los casos P1.

## Cobertura del smoke 44/44

El smoke valida DB y algunos textos, pero **no**:
- la frase falsa de fiado puro;
- el panel mixto post-confirmación;
- el importe por línea;
- el CTA a 1366/1280/768 con 3 conceptos;
- 200 % con rectángulos disjuntos;
- dos Cajas/drafts;
- `payment_pending` con `paid>0`;
- abono demo en “Cobrado confirmado”.

Por eso no se usa como aprobación.

## Evidencia

- `auditorias/04_ventas_pagos.md`
- `EVIDENCIAS/smoke-b.txt`, `smoke-b.json`
- `EVIDENCIAS/cash-200-100-result.*`
- `EVIDENCIAS/demo-pay-sequential.txt`, `demo-pay-race.txt`
- `EVIDENCIAS/webhook.txt`, `EVIDENCIAS/checkout.txt`
- `EVIDENCIAS/ventas-pager.txt`
