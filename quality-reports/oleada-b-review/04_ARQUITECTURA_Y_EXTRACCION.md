# 04 — Arquitectura y extracción

## Veredicto

**No es una extracción del monolito; es una reimplementación presentacional paralela sobre las mismas APIs.** Funciona y no toca el motor, pero duplica la orquestación de venta, draft, idempotencia, validación y copy. No hay ciclos ni mocks de negocio en `/caja`. Es mantenible como pantalla nueva, no como sustituto del monolito.

## Qué se creó

| Archivo | Responsabilidad | Destino |
|---|---|---|
| `web/src/app/caja/page.tsx` | Página real; solo merchant/demo | Servidor |
| `web/src/components/caja/caja-screen.tsx` | Estado, draft, requestId, POST, resultado | Cliente |
| `.../sale-line-items.tsx` | Conceptos, cantidades, precios | Cliente |
| `.../sale-summary.tsx` | Total, método, efectivo/fiado, CTA | Cliente |
| `.../payment-panel.tsx` | Link/QR, polling, demo | Cliente |
| `.../sale-result.tsx` | Resultado y copy de verdad | Cliente |
| `.../types.ts` | Tipos y parsers | Cliente |
| `.../caja.css` | Layout operativo | CSS |
| `web/src/app/ventas/page.tsx` + CSS | Historial read-only | Servidor |

Total nuevo aproximado: **1.681 líneas TSX de Caja + 1.017 CSS** (medido en `auditorias/01_repo.md`).

## Extracción real

- `caja-app.tsx` **no se descompuso** en `SaleComposer`, `SaleSummary`, `PaymentPanel`, etc. La Caja nueva es una composición paralela.
- El único cambio en el monolito es `ClosingChecklist` lazy (`next/dynamic`), para bajar el JS inicial. No es una extracción.
- No se comparten módulos de:
  - cálculo de cambio / aplicación de efectivo y fiado;
  - draft/storage (`v1` vs `v2`);
  - `requestId` / reintento;
  - validación de líneas;
  - copy de estados.
- Se comparten: `formatMxn`, `Order`/`Credit`, APIs `/api/orders`, `/api/orders/[id]/pay`, `/api/demo/pay`, `CurrencyAmount`, shell, tokens y `EmptyState`.

## Fuentes de verdad

| Dato | Fuente nueva | Fuente legacy | Riesgo |
|---|---|---|---|
| Venta/draft | estado React + `caja-draft:v2` | estado React + `draft:v1` | Dos borradores, dos llaves |
| Request idempotente | `caja-request:v2` + `requestRef` | `sale-request:v1` | Duplicado entre pantallas |
| Pendiente | `caja-pending:v2` (cola) | `pending-order:v1` | Solo se reanuda el último |
| Cálculo de cambio | cliente (`appliedCash/appliedCredit`) | cliente legacy | Dos fórmulas |
| Estado de pago | API + `PaymentPanel` | API + `PaymentPanel` legacy | UI distinta, misma API |
| Historial | `listOrders`/`getCredit` | `CajaApp`/dashboard | Read models distintos |

## Hallazgos

- **P1 — Dos Cajas/dos drafts/dos llaves** sin migración ni lock. Evidencia: `auditorias/03_shell.md`, `EVIDENCIAS/final-two-drafts-*.png`.
- **P1 — Cálculo de cambio duplicado**: el caso mixto produce “Cambio $100 / aplicado $0” cuando el fiado cubre todo. La fórmula del servidor no se toca; la presentación local sí se equivoca. Evidencia: `EVIDENCIAS/mixto-cambio-fantasma*.png`.
- **P1 — 502 + edición + reintento** puede duplicar: el `requestId` se reutiliza solo si la firma no cambió; editar después de un 502 post-commit crea otra llave y otra orden. Evidencia: `auditorias/04_ventas_pagos.md` (`pagos-502-edit.json`).
- **P2 — Read model de `/ventas`**: `getCredit` por fila (N+1), sin filtros/búsqueda/desglose de pagos. No es un motor nuevo, pero no es consulta operativa completa.
- **P2 — `ClosingChecklist` lazy** cambia el ciclo de montaje de Corte legacy; p0-corte pasa, pero es un cambio en el monolito que la entrega no declaró con precisión.
- **P3 — `formatMxn`/parsers duplicados**, `MERCHANT` hardcodeado, folio de 4 caracteres, `paymentMethod` aceptado e ignorado por el servidor, `productId`/`sku` descartados.
- **P3 — Caja importa `inicio.css`** para heredar shell; acopla la pantalla a la ruta Inicio y mantiene dos capas de tokens.

## Contratos financieros

Sin cambios en `lib/orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `api/**` ni `pay/**`. El motor persistente y los webhooks son los mismos. Los P0 de esta revisión son de presentación/verdad visible, no de asientos.

## Dependencias

- `/caja` no depende de inventario, productos, proveedores ni precios maestros.
- `/ventas` depende de `listOrders`, `getCredit`, `getDailySummary`, `sumPendingOrderBalances`.
- El catálogo futuro necesitará `productId`/`sku`/precio sugerido/stock advisory; hoy no existe y no debe bloquear la venta manual.
- No se detectaron ciclos de imports ni mocks de negocio en `/caja`.

## Evidencia

- `auditorias/01_repo.md`
- `auditorias/04_ventas_pagos.md`
- `auditorias/06_modulos.md`
- `EVIDENCIAS/repo-*`
- `EVIDENCIAS/pagos-*`

## Conclusión

La nueva Caja es una **capa presentacional paralela** correcta para un prototipo, no la extracción modular prometida. Para Oleada C hay que decidir: (a) retirar la Caja legacy y quedarse con esta, compartiendo storage/validación; o (b) extraer de verdad los módulos del monolito. Mantener ambas con dos llaves es deuda P1.
