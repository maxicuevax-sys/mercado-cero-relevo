# 06 — Fiados, abonos y corte

## Veredicto

**Contrato financiero APTO en el camino probado; presentación de fiado NO-GO por los P0 de copy de 05.** No se encontró error de asiento, doble pago ni corrupción del corte.

## Invariantes verificados

| Prueba | Resultado |
|---|---|
| Fiado $100 | `paid_cents=0`, `credit_cents=10000`, **0 payments**, crédito `original=balance=10000` |
| Venta mixta $90 (efectivo $100, fiado $30) | payload `6000/3000`; un solo pago cash de 6000; cambio 4000 solo presentación; replay misma orden, 0 filas nuevas |
| Abono parcial $40 | saldo 10000→6000; `orders.credit_cents` sigue 10000; no crea venta; `cashCredit +4000`; replay `duplicate=true` sin segunda fila |
| Liquidación $60 | saldo 0, `settled` |
| Corte | `cashSales=11000`, `cashCredit=10000`, `expected=71000`, snapshot `cash=21000`, `credit=8000`, `pendingDigital=20000`; fingerprint viejo → 409 `totals_changed` |
| Digital pendiente | no entra como efectivo físico; `pendingDigital` separado |
| Venta efectivo | `cashSales` sube; `paid_cents` coincide; cambio no se persiste |
| Venta fiado | `cashSales` no cambia; no hay payment |
| Abono | `cashCredit` sube; no crea order |

Evidencia: `EVIDENCIAS/fiado-corte-deltas.txt`, `abono-no-new-order.txt`, `auditorias/05_fiado_corte.md`, `EVIDENCIAS/fiado-corte-mcfc-*.json`.

## Hallazgos

### P2 — `/ventas` rotula “Fiado, no cobrado” tras abono parcial

Con saldo vivo $60 tras abonar $40, la fila muestra “Fiado, no cobrado” y “Saldo vivo $60”. El saldo es correcto, pero el texto ignora los $40 cobrados. Archivo: `web/src/app/ventas/page.tsx:161-178`. Evidencia: `auditorias/05_fiado_corte.md`, `fiado-corte-mcfc-real-ventas.json`.

### P2 — Abono demo cuenta en “Cobrado confirmado”

`/ventas` usa `summary.cashCents`, que incluye abonos demo, mientras el subtítulo dice “demo no cuenta”. Es preexistente de `db.ts`, expuesto por la nueva pantalla. Evidencia: `EVIDENCIAS/ventas-demo-abono-real.png`, `final-abono-demo-cobrado.png`.

### P3 — Demo tapa estados de fiado

En modo demo, la fila muestra “Demo” y “Demo, no es dinero real” encima de “Saldado/Cobrado/Fiado”; solo conserva “Demo · pendiente”. Dificulta leer el estado de deuda. Evidencia: `auditorias/05_fiado_corte.md`.

### P3 — Mixto saldado no muestra el total cobrado real

Un mixto saldado muestra “SALDADO”, “Cobrado $60” y “Fiado saldado $30”, pero no un total cobrado de $90. Es presentación.

### P3 — Cambio no persistente

El cambio es solo presentación (`recibido − aplicado`); no existe columna. Es correcto, pero el historial no puede reconstruirlo; no debe prometerlo.

## Lo que no se probó

- Corte real en producción o multi-proceso natural.
- Abonos con métodos digitales reales/pey; solo demo/declarado.
- Cierre con concurrencia de dos cajas y corte simultáneo (p0-corte cubre versiones/409 en aislado).
- Impacto contable fuera de SQLite local.

## Evidencia

- `auditorias/05_fiado_corte.md`
- `EVIDENCIAS/fiado-corte-deltas.txt`
- `EVIDENCIAS/abono-no-new-order.txt`
- `EVIDENCIAS/fiado-corte-*.json`
- `EVIDENCIAS/fiado-total-p0.png` (P0 de copy, no de asiento)
