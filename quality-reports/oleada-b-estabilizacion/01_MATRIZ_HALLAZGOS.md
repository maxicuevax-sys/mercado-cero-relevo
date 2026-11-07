# 01 — Matriz reconciliada de hallazgos

**HEAD verificado:** `8101849` (producto `bdfbe8b`)
**Catálogo original:** 2 P0 + 13 P1 en `quality-reports/oleada-b-review/09_HALLAZGOS_PRIORIZADOS.md`.
**P1-10** ya estaba cerrado en demo local por `de7e339` + `f863df2`; B.1 no lo reimplementó.

## P0

| ID | Hallazgo | Estado B.1 | Evidencia |
|---|---|---|---|
| P0-01 | Fiado puro afirmaba que se registró efectivo con `paidCents=0` | **CERRADO** — resultado dice “No recibiste dinero”; muestra cobrado $0, efectivo $0 y saldo fiado | `oleada-b1-regression.json` checks P0-01; `p0-01-fiado-puro.png` |
| P0-02 | Mixto efectivo+digital ocultaba `paidCents=6000` y decía que no se recibió dinero | **CERRADO** — “Ya recibiste $60.00”, “Falta cobrar $40.00”; fila de Ventas muestra ambos | `oleada-b1-regression.json` checks P0-02; `p0-02-mixto-panel.png` |

## P1

| ID | Hallazgo | Estado B.1 | Evidencia |
|---|---|---|---|
| P1-01 | Dos Cajas/drafts/requestId; nav ocultaba el draft v2 | **CERRADO en alcance B.1** — v1→v2 con aviso, conflicto bloquea confirmación, legacy avisa y bloquea hasta elegir | B.1 regression; `caja-screen.tsx`; `caja-app.tsx`; `nav.ts` |
| P1-02 | Importe por línea 1×1 px por selector clip | **CERRADO** — etiqueta explícita; importe visible 1448/1366/1280/768 | B.1 regression; `caja.css`; `sale-line-items.tsx` |
| P1-03 | CTA fuera del primer viewport | **CERRADO** — barra de cobro fija con “Confirmar venta”; visible 1448/1366/1280/768 y 200 % | B.1 regression; `caja-screen.tsx`; `caja.css` |
| P1-04 | 200 % rompía cabeceras/CTA; `/ventas` 320 +17 px; nav móvil | **CERRADO** — container queries, paginador con wrap, nav 3+2 y barra sobre nav | B.1 regression; a11y B; mobile 320/360 |
| P1-05 | Foco en BODY al navegar; paginación sin foco/anuncio | **CERRADO** — foco de ruta y lista, `aria-live`; skip link primero en carga inicial | B.1 regression; smoke A |
| P1-06 | Un pendiente secuestraba `/caja`; solo el último | **CERRADO** — bandeja completa, “Seguir cobrando”, “Nueva venta” sin borrar el pendiente | B.1 regression; smoke B |
| P1-07 | Cambio fantasma y aviso falso “El total cambió” | **CERRADO** — cambio real si el fiado cubre parte; bloqueo si cubre todo y hay efectivo; aviso falso eliminado | B.1 regression; sale-summary/caja-screen |
| P1-08 | `/ventas` ocultaba “Cobrado $60” en `payment_pending` | **CERRADO** — cobrado y faltante por separado; demo rotulado como simulado | B.1 regression; `p1-08-ventas-pendiente.png` |
| P1-09 | Abonos demo sumaban a “Cobrado confirmado” | **CERRADO** — `db.ts` y `analytics.ts` separan demo de real; p0-dinero actualizado | B.1 regression; p0-dinero 45/0+3 |
| P1-10 | `/api/demo/pay` no era demo-only/idempotente | **CERRADO PREVIO, PRESERVADO** — no se tocó el núcleo; contrato demo-pay sigue verde | `npm run test:demo-pay` |
| P1-11 | Nav presentaba legacy como migrado | **CERRADO** — chip “Clásica” visible y explicación en nombre accesible | smoke A; B.1 regression |
| P1-12 | 502 post-commit + editar duplicaba venta | **CERRADO en `/caja`** — estado desconocido, edición bloqueada, llave durable y reconciliación por `requestId`; legacy con guardia de draft y residual documentado | B.1 regression; smoke B |
| P1-13 | Inicio 768: papel picado invade H1 y CTA recortado | **CERRADO** — arte oculto y sugerencia apilada en 761–1100 | B.1 regression; smoke A |

## P2/P3

No se convirtieron en P0/P1. Los acoplados al alcance quedaron resueltos:

- **P2-03/P2-06:** el puntero terminal se limpia; la bandeja no resucita el cobro solo.
- **P2-07:** draft corrupto y método inválido ya no tumban `/caja`; se sanea o se descarta.
- **P2-11/P2-12:** método activo y estado con `aria-live`; axe 0.
- **P2-14:** paybar y nav no se solapan a 320/200 %.

Siguen fuera de B.1: filtros/búsqueda/N+1 de Ventas, catálogo v2, 404 propio, `?ayuda=1` local, auth, exportación y estudio con personas.
