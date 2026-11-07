# 03 — Lote 1: verdad financiera

**Commits de producto:** `70b2313` (núcleo), `f0bef29` (ajuste de split), `16cb40f` (llave durable), `eab2a6f` (dos pestañas y barra), `bdfbe8b` (instancia del draft).
**Alcance:** P0-01, P0-02, P1-07, P1-08, P1-09.

## Semántica aplicada

| Campo | Significado visible |
|---|---|
| `paidCents` | dinero aplicado (efectivo + digital confirmado) |
| `digitalPaidCents` | parte digital de `paidCents` |
| `cashPaidCents` | `paidCents - digitalPaidCents` |
| `creditCents` | deuda original creada |
| `creditBalanceCents` | saldo vivo de esa deuda |
| `dueCents` | `total - paid - creditCents` (pendiente digital) |
| cambio | efectivo tendido − efectivo aplicado; nunca se persiste |

## Cambios

- **`lib/sale-truth.ts` (nuevo):** una sola función pura para Caja, panel y Ventas.
- **`sale-result.tsx`:** fiado puro dice “No recibiste dinero”; muestra cobrado $0, efectivo $0 y saldo fiado. Demo no se presenta como dinero real.
- **`payment-panel.tsx`:** “Ya recibiste” con desglose efectivo/digital; “Falta cobrar” aparte; no vuelve a decir que no se recibió dinero si `paid>0`.
- **`ventas/page.tsx`:** `paidCents>0` se muestra antes de `payment_pending`; la fila demo muestra “Simulado: cobrado”.
- **`caja-screen.tsx` / `sale-summary.tsx`:** cambio real sobre efectivo aplicado; bloqueo del fantasma cuando el fiado cubre todo y hay efectivo; sin aviso falso “El total cambió”.
- **`db.ts` / `analytics.ts`:** abonos demo fuera de `cashCents`/`declaredDigitalCents`; suman a `demoCashCents`/`demoDigitalCents`.

## Pruebas

- B.1 regression: P0-01, P0-02, P1-07 (fantasma y split), P1-08, P1-09.
- `p0-dinero` actualizado: 45 PASS · 0 FAIL · 3 KNOWN.
- `p0-venta`, `p0-fiado`, `p0-corte`, `p0-integración` verdes.
- Evidencia visual: `evidencia/p0-01-fiado-puro.png`, `p0-02-mixto-panel.png`, `p1-08-ventas-pendiente.png`, `p1-09-abono-demo.png`.

## Contratos preservados

No se modificaron `orders.ts`, `cash.ts`, webhook, checkout, `/pay/**` ni el esquema de DB. `paid` solo lo marca el webhook firmado. `demo_paid` sigue separado. El fiado sigue siendo deuda.
