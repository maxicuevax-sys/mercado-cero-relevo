# 05 — Lote 3: operación, responsive y accesibilidad

**Commits:** `70b2313` (base), `f0bef29` (foco/nav/CTA), `4d4695e` (barra sobre nav), `eab2a6f` (barra fuera del sidebar).
**Alcance:** P1-02, P1-03, P1-04, P1-05, P1-11, P1-13.

## P1-02 — Importe por línea

El selector `.mc-caja-line__total > span` ocultaba también el importe (`span.tabular-nums`). Se añadió `mc-caja-line__label` a la etiqueta y se cambió el selector. Medido >20 px de ancho y >10 px de alto en 1448/1366/1280/768.

## P1-03 — CTA

La acción primaria vive en una barra de cobro fija (`mc-caja-paybar`) con total y “Confirmar venta”, deshabilitada si falta completar. “Revisar cobro” aparece como acción secundaria. La barra está en el viewport en 1448/1366/1280/768 y a 200 %. En 0 conceptos también existe, deshabilitada.

## P1-04 — Reflow 200 % y 320 px

- Líneas de Caja: container query `34em` sobre la tarjeta; cabecera oculta y línea apilada cuando no cabe. A 200 % no se encima CANTIDAD/PRECIO/IMPORTE.
- `/ventas` 320: paginador con `flex-wrap`; `scrollWidth=320`.
- Nav móvil: 5 columnas normal; 3+2 cuando el ancho en em baja de 18 (texto grande). La barra de cobro sube 65 px (128 px en 3+2) y el contenido reserva 280 px.
- Barra de cobro con `flex-wrap`; total y botón no se solapan a 390/320.
- Marca del sidebar con tamaño máximo de logotipo para no desbordar a 200 %.

## P1-05 — Foco y anuncio

`RouteFocus` (cliente, dentro del AppShell):
- primera carga de la pestaña: no mueve el foco; el skip link sigue primero;
- navegación: foco al `h1` de la ruta;
- paginación: foco a `#mc-ventas-list-title`, scroll al inicio y `aria-live` con “página X de Y”.

## P1-11 — Nav honesta

`ShellNavItem.legacy` marca Fiados/Corte/Metas/Pendientes/Ayuda/Ajustes. El chip visible “Clásica” y un `sr-only` “abre la Caja clásica” forman el nombre accesible sin `aria-label` que viole label-in-name. Axe 0 en 1448 y 390.

## P1-13 — Inicio 768

En 761–1100 se oculta el papel picado y la sugerencia pasa a dos columnas con CTA debajo del texto. Sin intersección arte/H1, sin recorte y sin scroll horizontal.

## Pruebas

- B.1 regression: P1-02/P1-03/P1-04/P1-05/P1-11/P1-13.
- Smoke A 33/33 (skip link, axe 0, nav 5 accesos, CTA 390/320, alias).
- Smoke B 45/45.
- HIG 5/5 viewports.
- a11y B: axe 0 normal/HC, 0 targets <44, sin overflow a 200 % en 1448/1366/390/320.
- Mobile 320/360: 60/60 en Chromium/Firefox/WebKit.
