# 07 — Evidencia visual y funcional

**Producto:** `bdfbe8b` + `8101849`

## Regresión funcional

`evidencia/oleada-b1-regression.json` contiene 65 checks con resultado, detalle y base URL. Incluye:

- seed aislado (demoCash 7000, cash 0);
- P0-01/P0-02;
- P1-07 fantasma y split;
- P1-08 historial;
- P1-09 abono demo;
- P1-01 importación/conflicto/legacy;
- P1-06 bandeja;
- P1-12 502, recarga y reconciliación;
- P1-05 foco/paginación;
- P1-02/P1-03/P1-04/P1-13 geometría;
- P1-11 nav.

## Capturas locales

Las capturas PNG están en `evidencia/` y no se versionan por `.gitignore` (`quality-reports/**/*.png`):

- `p0-01-fiado-puro.png` — resultado de fiado puro con efectivo $0.
- `p0-02-mixto-panel.png` — panel con “Ya recibiste $60” y “Falta cobrar $40”.
- `p1-08-ventas-pendiente.png` — fila con cobrado y faltante.
- `p1-09-abono-demo.png` — “Cobrado confirmado” sin el abono demo.

## Medidas de referencia

| Caso | Resultado |
|---|---|
| Importe por línea 1448/1366/1280/768 | ancho >90 px, alto >20 px; no 1×1 |
| CTA 1448×1086 | bottom 1078 ≤ 1086 |
| CTA 1366×768 | bottom 760 ≤ 768 |
| CTA 1280×800 | bottom 792 ≤ 800 |
| CTA 768×1024 | bottom 1016 ≤ 1024 |
| CTA a 200 % en 1366 | bottom 760 ≤ 768 |
| `/ventas` 320 + 200 % | scrollWidth 320 = clientWidth |
| Nav móvil 200 % | 3 columnas (3+2), sin solape de labels |
| Barra de cobro 320 + 200 % | total y botón disjuntos; barra sobre nav |
| Inicio 768 | papel picado oculto; CTA dentro del viewport |

## Límites de la evidencia visual

- Chromium headless; no iOS/Safari ni teclado virtual real.
- Alto contraste emulado; no HCM de Windows real.
- No se escaneó un QR real ni se probó un lector físico.
- Las capturas de la auditoría anterior son de `4130e71`; las de esta entrega son del SHA final y están en la carpeta local.
