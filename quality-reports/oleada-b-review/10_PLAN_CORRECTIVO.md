# 10 — Plan correctivo priorizado

> **No ejecutado.** Esta revisión no aplicó fixes ni inició Oleada C. El plan es una propuesta para autorización posterior.

## Fase 0 — Contener y congelar el guion

1. No usar fiado puro ni mixto efectivo+digital en demo hasta corregir P0-01/P0-02.
2. No presentar `/caja` como sustituto completo de la Caja legacy.
3. Mantener el handoff público NO-GO.
4. Añadir estos P0/P1 a la lista de aceptación de B.

## Fase 1 — P0 de verdad visible (bloqueantes)

| Orden | Fix | Archivo | Prueba de aceptación |
|---|---|---|---|
| 1 | P0-01: el banner de fiado debe decir “No recibiste dinero; queda como deuda” y nunca “el efectivo sí se registró” cuando `paidCents=0` | `sale-result.tsx` | Fiado puro: `paid=0`, texto sin “efectivo”, captura y assert de copy |
| 2 | P0-02: el panel de cobro debe mostrar “Recibiste $60 / falta $40” y no decir “el dinero aún no se recibió” si `paid>0` | `payment-panel.tsx` | Mixto cash 60 + digital 40: assert de “Recibiste $60” y “Falta $40”; API `paid=6000` |

**Gate:** no se puede avanzar a P1 sin estos dos verdes y regresión de copy.

## Fase 2 — P1 de flujo y verdad

| Orden | Fix | Archivo | Prueba |
|---|---|---|---|
| 3 | P1-02: mostrar importe por línea; separar el `<span>` de label del importe | `caja.css`, `sale-line-items.tsx` | 1448/1366/1280/768: importe >0 y visible |
| 4 | P1-03: CTA visible en 1366/1280/768; paybar/compact summary hasta 980 | `caja.css`, `caja-screen.tsx` | `confirm` bottom ≤ viewport, 3 conceptos |
| 5 | P1-07: cambio solo si hay efectivo aplicado; bloquear/avisar Mixto sin efectivo; eliminar aviso falso “total cambió” | `sale-summary.tsx`, `caja-screen.tsx` | $100 efectivo + $100 fiado no muestra cambio; split válido no avisa |
| 6 | P1-08: `/ventas` muestra “Recibido/Cobrado” y “Falta” en `payment_pending` | `ventas/page.tsx` | Mixto paid 60/due 40: ambos visibles |
| 7 | P1-09: `cashCents` no debe incluir abonos demo; o `/ventas` debe desglosar demo/real | `db.ts` (dueño datos) + `ventas/page.tsx` | Abono demo no suma a “Cobrado confirmado” |
| 8 | P1-06: salida “Nueva venta”/“Descartar” en panel pendiente, o cola visible | `caja-screen.tsx`, `payment-panel.tsx` | Tras recargar pendiente, se puede iniciar otra venta |
| 9 | P1-01: unificar draft/requestId v1/v2 o lock/migración; avisar al cambiar de Caja | `caja-screen.tsx`, `caja-app.tsx` | Misma venta no se registra dos veces; v1 visible en `/caja` o aviso |
| 10 | P1-12: no permitir editar durante POST y no generar nueva llave tras 502 sin confirmación | `caja-screen.tsx`, `sale-line-items.tsx` | 502+edición+reintento: una sola orden |
| 11 | P1-10: dueño de pagos decide `order.demo`/idempotencia de `/api/demo/pay` | `api/demo/pay/route.ts` | Dos procesos no duplican; pedido real no pasa a demo |
| 12 | P1-11: nav debe marcar “legacy” o no enlazar módulos no migrados | `nav.ts`, `caja-app.tsx` | Usuario sabe que Fiados/Corte salen de la pantalla nueva |

## Fase 3 — P1 de responsive/a11y

| Orden | Fix | Prueba |
|---|---|---|
| 13 | P1-04: 200% con rectángulos disjuntos (tabla, nav, paybar) y `/ventas` 320 sin overflow | 1366/768/390/360/320 + 200% con 3 conceptos |
| 14 | P1-05: foco a H1/main tras navegar; foco al inicio de lista/página al paginar; anuncio | Teclado completo y `activeElement` correcto |
| 15 | P1-13: Inicio 768 sin solapamiento de papel picado/CTA | Captura 768 y assert de intersección |
| 16 | P2-10: “Agregar” visible antes del pliegue/nav en 390/320 | Empty CTA rect + nav rect |
| 17 | P2-11/12: forced-colors del método activo; live region de “Pendiente” | Captura HC y ARIA snapshot |

## Fase 4 — P2/P3 de producto

- Historial: filtros, búsqueda, desglose de pagos, agrupación por día, `aria-current` y canónica `?page`.
- Copy: unificar concepto/producto/pedido, “1 concepto”, “saldo vivo” vs deuda, “Volver a Caja” real.
- Ayuda: `?ayuda=1` en rutas nuevas o retirar el enlace hasta tener hoja compartida.
- 404 propia en español; `/pay/inexistente` 404.
- Eliminar `inicio.css` de Caja o extraer shell/tokens compartidos.
- Catálogo futuro: `SaleItemInputV2` con `productId/sku` opcionales; no bloquear venta manual.
- Seguridad/demo: separar base demo/real o impedir reset silencioso; no mezclar fixtures.

## Pruebas de regresión a añadir

1. Fiado puro: copy sin “efectivo”, `paid=0`.
2. Mixto cash+digital: panel muestra recibido y falta.
3. Mixto cash+fiado: no cambio fantasma.
4. Importe de línea visible 1448/1366/1280/768.
5. CTA visible 1366/1280/768 con 3 conceptos.
6. 200% con intersección de rects, no solo `scrollWidth`.
7. Dos drafts v1/v2 y doble registro.
8. `payment_pending` con `paid>0` en `/ventas`.
9. Abono demo no suma a “Cobrado confirmado”.
10. 502 + edición + reintento.
11. Foco de ruta/paginación.
12. Smoke atado a SHA/build/árbol.

## Criterio de salida

- P0=0, P1=0 o waivers escritos con dueño/fecha/mitigación.
- `verify:static`/`verify:evidence` PASS sobre HEAD limpio.
- Full aplicable (sin tunnel/preflight) documentado como parcial, nunca `ok:true`.
- Capturas nuevas del HEAD corregido.
- Verificador independiente re-reproduce P0/P1 y firma.

## Lo que NO se debe hacer

- Bajar el umbral de gates o “maquillar” el smoke.
- Declarar GO público sin pey/QR/lector/iOS.
- Iniciar Oleada C antes de cerrar estos P0/P1.
- Reescribir el motor financiero.
