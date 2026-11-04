# 09 — Hallazgos priorizados

> Estado de todos: **ABIERTO**. Esta revisión no aplicó fixes. Severidades según el encargo: P0 bloqueante, P1 grave, P2 moderado, P3 mejora.

## P0 — bloqueantes

| ID | Pantalla | Descripción | Reproducción | Esperado | Observado | Evidencia | Archivo | Responsable | Riesgo |
|---|---|---|---|---|---|---|---|---|---|
| **P0-01** | Caja → resultado fiado | El banner afirma que se registró efectivo cuando no hubo ninguno | Vender $100 a fiado; confirmar | “Solo el fiado es deuda; no recibiste dinero” | “el efectivo sí se registró en la caja” con `paid=0` | `EVIDENCIAS/fiado-total-p0.png`, `final-fiado-puro.png`, `fiado-p0.txt` | `sale-result.tsx` | Frontend/copy | La comerciante puede creer que entró efectivo |
| **P0-02** | Caja → panel digital | Mixto efectivo+digital oculta $60 ya cobrados y dice que no se recibió dinero | Vender $100; Mixto; efectivo $60; confirmar; generar link | “Recibiste $60; faltan $40” | “Falta cobrar $40… El dinero aún no se considera recibido” | `EVIDENCIAS/mixto-efectivo-digital-panel.png`, `final-mixto-panel.png`, `mixto-efectivo-digital.txt` | `payment-panel.tsx` | Frontend/pagos | Puede volver a cobrar o entregar mal |

## P1 — graves

| ID | Pantalla | Descripción | Evidencia | Archivo | Responsable |
|---|---|---|---|---|---|
| **P1-01** | `/` + `/caja` | Dos drafts, dos requestId, dos formulas; misma venta puede registrarse dos veces; nav a legacy oculta el draft v2 | `final-two-drafts-*.png`, `final-two-cajas-nav.png`, `shell-probes2.json`, `auditorias/03_shell.md` | `caja-screen.tsx`, `caja-app.tsx` | Frontend/shell |
| **P1-02** | Caja desktop/tablet | Importe por línea invisible: `span.tabular-nums` mide 1×1 px (clip) en 1448/1366/1280/768 | `importe-linea-invisible-1280.png`, `importe-linea-invisible.txt`, `final-line-*.png` | `caja.css:177-184`, `sale-line-items.tsx` | Diseño/frontend |
| **P1-03** | Caja 1366/1280/768 | CTA “Confirmar venta” fuera del primer viewport; a 768 sin paybar | `caja-layout-measures.txt`, `caja-conceptos-top-1366.png`, `final-cta-*.png` | `caja.css`, `caja-screen.tsx` | Diseño/responsive |
| **P1-04** | Caja/Ventas 200% | Cabeceras encimadas, CTA fuera, labels móviles solapados, `/ventas` 320 +17 px | `caja-text200-1366.png`, `caja-text200-360.png`, `ventas-text200-320.png`, `text200-geometry.txt`, `a11y-text-resize.json` | `caja.css`, `ventas.css`, `shell.css` | A11y/frontend |
| **P1-05** | Rutas y `/ventas` | Foco de ruta en BODY; paginación deja foco fuera de pantalla; sin anuncio | `keyboard-focus.json`, `a11y-pagination.json` | `caja-screen.tsx`, `ventas/page.tsx`, `app-shell.tsx` | A11y/frontend |
| **P1-06** | `/caja` pendiente | Un cobro pendiente secuestra la pantalla; no hay Nueva venta/Descartar | `pendiente-secuestra-caja.png`, `pendiente-secuestra.txt`, `final-pending-*` | `caja-screen.tsx`, `payment-panel.tsx` | Frontend/flujo |
| **P1-07** | Caja Mixto | Cambio fantasma: $100 efectivo + $100 fiado → “Cambio $100, aplicado $0”; aviso falso “El total cambió” en split válido | `mixto-cambio-fantasma.png`, `...resultado.png`, `final-mixto-phantom.png`, `repo-mixto-hint.json` | `sale-summary.tsx`, `caja-screen.tsx` | Frontend |
| **P1-08** | `/ventas` | En `payment_pending` oculta “Cobrado $60” y solo muestra pendiente/saldo | `ventas-mixto-pendiente.txt`, `final-ventas-payment-pending.png` | `ventas/page.tsx` | Frontend/read model |
| **P1-09** | `/ventas` demo | Abonos demo suman a “Cobrado confirmado” ($450) con subtítulo “demo no cuenta” | `ventas-demo-abono-real.png`, `final-abono-demo-cobrado.png`, `auditorias/04_ventas_pagos.md` | `db.ts` (preexistente) + `ventas/page.tsx` | Datos/demo |
| **P1-10** | `/api/demo/pay` | Sin `order.demo`; sin idempotencia durable; multiproceso duplicó $100 | `pagos-demo-pay-adversarial.json`, `pagos-demo-lock-race.json`, `pagos-demo-multiproceso.json` | `api/demo/pay/route.ts` | Pagos (dueño) |
| **P1-11** | Nav | Fiados/Corte/Metas/Pendientes salen a legacy sin aviso; labels cambian | `routes-navigation.txt`, `auditorias/03_shell.md` | `nav.ts`, `caja-app.tsx` | Producto/shell |
| **P1-12** | Caja reintento | 502 post-commit + editar + confirmar duplica venta pagada | `pagos-502-edit.json`, `auditorias/04_ventas_pagos.md` | `caja-screen.tsx` | Frontend/pagos |
| **P1-13** | Inicio 768 | Papel picado invade H1; sugerencia/CTA recortados; layout heredado | `capturas/inicio-768x1024.png`, `design-inicio-768-sugerencia.png` | `inicio.css` | Diseño/frontend |

## P2 — moderados (18)

Agrupados por área; todos con evidencia en `EVIDENCIAS/` y detalle en las auditorías.

| ID | Hallazgo | Evidencia |
|---|---|---|
| P2-01 | Mixto demo con fiado se titula “Venta cobrada en efectivo (demo)” | `pagos-ui-flow.json` |
| P2-02 | “Volver a Caja” en resultado es no-op | `auditorias/07_onboarding.md` |
| P2-03 | “Nueva venta” no limpia el puntero pendiente; al recargar resucita | `pagos-ui-flow.json` K1–K3 |
| P2-04 | `?ayuda=1` no abre ayuda en `/caja`/`/ventas`; cerrar deja en legacy | `shell-help-close.json` |
| P2-05 | Paginación sin `aria-current`, sin canónica `page=999/abc/0` | `ventas-pager.txt`, `a11y-pagination.json` |
| P2-06 | 404 Next en inglés; `/pay/inexistente` 200 | `routes-navigation.json` |
| P2-07 | Draft corrupto puede tumbar `/caja` | `auditorias/04_ventas_pagos.md` |
| P2-08 | `/ventas` N+1 de créditos, sin filtros/búsqueda/desglose | `auditorias/06_modulos.md` |
| P2-09 | Caja 768: inputs de concepto truncados; layout desktop estrecho | `capturas/caja-conceptos-top-768.png` |
| P2-10 | Caja vacía 390/320: “Agregar” bajo nav/pliegue | `EVIDENCIAS/caja-layout-measures` / onboarding |
| P2-11 | Forced-colors: método activo indistinguible | `a11y-forced-colors.json` |
| P2-12 | “Pendiente” no se anuncia en panel de cobro | `a11y-payment.json` |
| P2-13 | Error de cantidad marca Producto inválido | `a11y-forms.json` |
| P2-14 | Monto máximo paybar 360 se solapa 10 px | `a11y-max-amounts.json` |
| P2-15 | Caja importa `inicio.css`; shell/tokens acoplados | `auditorias/02_diseno.md` |
| P2-16 | `paymentMethod` aceptado e ignorado por el servidor; mixto se rotula Efectivo | `auditorias/04_ventas_pagos.md` |
| P2-17 | `productId`/`sku` se descartan; catálogo futuro necesitará contrato v2 | `auditorias/06_modulos.md` |
| P2-18 | Demo/real comparten proceso/base; reset 409; datos de auditoría contaminan demo | `auditorias/04_ventas_pagos.md`, `01_TRAZABILIDAD_GIT.md` |

## P3 — mejoras (10)

- Terminología `concepto`/`producto`/`pedido`; “1 conceptos”; “saldo vivo” vs “deuda”.
- “Empezar de nuevo” deja foco en BODY.
- Hints sin `aria-describedby`; `aria-label` sobre `<span>` DEMO.
- `<aside>`/resúmenes sin nombre accesible.
- Sin iconos de estado/método; “×” textual.
- Sin agrupación por día/filtros en historial.
- Sin impresión/exportación/folio completo.
- Sin safe-area-top/visualViewport/interactive-widget.
- Sin `aria-live` para total/conteo.
- El smoke 44/44 no está atado a SHA/build y no cubre P0/P1.
