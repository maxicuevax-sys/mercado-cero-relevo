# HANDOFF — Cierre de Operación B.1

> **Este documento sustituye a `harness/HANDOFF_OLEADA_B1.md` como handoff
> operativo.** El anterior queda como registro de recuperación (commit
> `e025895`).
>
> **Fecha:** 4 de noviembre de 2026.
> **Estado:** Operación B.1 ejecutada; GO local pendiente de la firma
> independiente. Handoff público NO-GO. Oleada C no iniciada.

## Identidad

- **Rama:** `fix/oleada-b1-estabilizacion`
- **Producto:** `bdfbe8b` (fix) + `8101849` (pruebas)
- **Base:** `844f759`; handoff de recuperación `e025895`
- **Build verificado:** `8101849`; la entrega documental se sella en HEAD.
- **Evidencia:** `quality-reports/oleada-b-estabilizacion/`

## Qué cambió

- Verdad financiera: fiado puro, mixto efectivo+digital, historial parcial,
  cambio real vs fantasma, abonos demo fuera de cobrado confirmado.
- Integridad: draft v1/v2 con aviso y bloqueo, bandeja completa de pendientes,
  502 post-commit con llave durable y reconciliación por `requestId`.
- Operación: importe por línea visible, barra de cobro persistente, reflow
  200 %, foco de ruta/paginación, nav legacy honesta, Inicio 768 y Ventas 320.

## Contratos que no se deben romper

- `paid` solo por webhook firmado de pey; `demo_paid` es simulación.
- Fiado es deuda; un abono no crea venta nueva.
- `POST /api/orders` sigue siendo el motor de venta; `GET ?requestId=` es
  read-only para reconciliar.
- `/api/demo/pay` ya estaba corregido; no reimplementar.
- `/` legacy y `/pay/**` se preservan; no presentar legacy como migrado.
- No usar `web/data/mercado-cero.db` para pruebas destructivas.

## Regresión obligatoria

```powershell
cd web
npm run test:b1-regression      # 65/65, servidor y SQLite propios
npm run test:demo-pay           # 59/59 en árbol limpio
npm run verify:static           # 5/5
```

Suites financieras: p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0,
p0-integración 51/0, p0-dinero 45/0+3 KNOWN, webhook 40/40, checkout 19/19.

## Bloqueos

- `verify:full` completo no aplicable: `tunnel`/`preflight` sin URL pública.
- `latest.json` full no existe para este HEAD.
- pey real, QR/lector, iOS/Safari y lector de pantalla real no probados.
- Residual R-01: venta legacy sin reconciliación guiada de 502 (P2).

## Siguiente

1. Leer `quality-reports/oleada-b-estabilizacion/10_GO_NO_GO.md`.
2. No iniciar Oleada C hasta decisión formal.
3. Para handoff público, resolver túnel/preflight, pey real, QR/lector/iOS y
   full 23/23 en árbol limpio.
