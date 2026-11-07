# 03 — Paridad visual y experiencia

## Veredicto

**NO-GO visual para cerrar Oleada B.** No es una fachada del shell antiguo: la migración de shell, tipografía y encuadre editorial es real. Pero hay defectos P1 que afectan la operación y la lectura del dinero: importe por línea invisible, CTA fuera del primer viewport y colapso del layout al 200 %. La composición de Caja/Ventas es coherente, aunque más genérica y “card-based” que la materialidad editorial de Inicio.

## Comparación de identidad

| Elemento | Inicio | Caja | Ventas | Lectura |
|---|---|---|---|---|
| Shell | Sidebar verde, topbar crema | Igual | Igual | Consistente |
| Hearth | H1 editorial | “Nueva venta” / “Cobrar venta” | “Ventas” | Correcto |
| Alder | KPIs/importes | Todos los importes, campos, estados | Filas/importes | Correcto |
| Paleta | Crema, verde, terracota, maíz | Cercana, con ligeras diferencias de crema/verde | Igual | Consistente, no idéntica |
| Ilustraciones | Hero, Lupita, papel picado | Solo navegación; sin ilustración operativa | Ninguna | Caja no copia el dashboard (correcto), pero pierde materialidad |
| Iconografía | SVG de Inicio | Métodos sin icono; “×” textual; sin iconos de estado | Sin iconos | P2/P3 de consistencia |
| Densidad | Editorial, mucho aire | Operativa, correcta | Lista densa | Adecuada a la función |

Capturas comparativas:

- `EVIDENCIAS/comparativa-inicio-caja-ventas-1280.png`
- `EVIDENCIAS/comparativa-caja-estados-1280.png`
- `EVIDENCIAS/comparativa-movil-390-320.png`
- `EVIDENCIAS/capturas/inicio-{1448,1366,1280,768,390,320}.png`
- `EVIDENCIAS/capturas/caja-*.png`
- `EVIDENCIAS/capturas/ventas-*.png`

## A. Arquitectura de información

Caja sigue el orden correcto: conceptos → total → método → efectivo/fiado → confirmar. Ventas: resumen → lista → detalle. En móvil, la acción “Agregar” del estado vacío queda debajo del pliegue o tapada por la nav (390: `y=745–793`, nav `y=779`; 320: `y=767–815`, nav `y=575`). Es un P1 de onboarding: la primera acción no está visible en el primer viewport.

## B. Jerarquía

- Total y CTA son los elementos dominantes; el total es claro.
- **P1:** el CTA “Confirmar venta” no está en el primer viewport con 3 conceptos en 1366×768 (`y=817.9`), 1280×800 (`y=852.6`) y 768×1024 (`y=1447.4`, además sin paybar). En 1448×1086 sí está (`y=839.6`).
- En móvil el paybar “Revisar cobro” está visible, pero no confirma; solo desplaza al panel. El botón real sigue lejos.

Evidencia: `EVIDENCIAS/caja-layout-measures.txt`, `EVIDENCIAS/capturas/caja-conceptos-top-1366.png`, `...-768.png`, `...-390.png`.

## C. Tipografía

Hearth se limita a títulos/encabezados; Alder a la interfaz. Correcto. Al 200 %:

- Cabeceras de tabla “CANTIDAD”/“PRECIO” se enciman (`CANTIDAD` mide 128 px en columna de 78).
- “Mercado Cero” del sidebar se recorta.
- Labels de la nav móvil se solapan (“CajaVentas”, “Ventas/Fiados”).
- Paybar puede solapar el total con “Revisar cobro”.

Evidencia: `EVIDENCIAS/caja-text200-1366.png`, `EVIDENCIAS/caja-text200-360.png`, `EVIDENCIAS/text200-geometry.txt`, `auditorias/08_accesibilidad.md`.

## D. Importes

- **P1:** el importe por línea es invisible en escritorio/tablet (1448/1366/1280/768). El `span` del importe mide **1×1 px** por `clip` (`caja.css:177-184`); solo se ve a ≤760. Captura: `EVIDENCIAS/importe-linea-invisible-1280.png`; medición: `EVIDENCIAS/importe-linea-invisible.txt`.
- El total grande es legible y tabular; el desglose de resultado usa “Recibiste / Efectivo aplicado / Cambio” (correcto en efectivo).
- **P0:** fiado puro muestra banner falso de efectivo; mixto efectivo+digital oculta el efectivo ya cobrado. Ver 05.

## E. Composición

- Caja escritorio: buen equilibrio composer/ticket, pero el panel de cobro es alto y empuja el CTA.
- 768: el layout conserva sidebar de 210 px y una sola columna de 558; los inputs de concepto se ven truncados (“Quesadill”, “Agua de l”). Es un P2 de responsive.
- Ventas 1280/768: correcto; en 390/320 el resumen de 3 tarjetas ocupa casi todo el primer viewport y la lista queda debajo. P2 de densidad móvil.
- Inicio 768: el papel picado invade el H1 y la sugerencia inferior se recorta; es deuda visual heredada (P1-13/P2 según verificador). Evidencia: `EVIDENCIAS/capturas/inicio-768x1024.png`, `EVIDENCIAS/design-capturas/design-inicio-768-sugerencia.png`.

## F. Iconografía

Caja nueva no usa iconos en métodos; el borrado es una “×” textual. Es consistente entre Caja/Ventas, pero no con la iconografía SVG de Inicio ni con el lenguaje de estados. P3, no bloqueante.

## G. Ilustraciones

No hay ilustraciones operativas en Caja/Ventas; la navegación conserva la planta. Es una decisión correcta para una herramienta, pero la superficie pierde la materialidad de Inicio. P2 de sistema, no funcional.

## H. Responsive

- 1448: correcto.
- 1366/1280: CTA fuera del fold.
- 768: sidebar desktop + composer estrecho + CTA a 1.300+ px; sin paybar.
- 390/320: paybar presente, pero el CTA real está a 1.500–1.850 px; el primer “Agregar” queda bajo la nav.
- 200 %: fallo P1 de reflow (tabla, nav, paybar, Ventas 320 +17 px).
- No hay `safe-area-inset-top` ni `visualViewport`/`interactive-widget`; riesgo iOS/teclado no probado.

## I. Estados

Vacío, conceptos, error, cambio, pendiente, demo, fiado y resultado tienen tratamiento. **P0** de copy en fiado/mixto; **P2** de títulos demo en mixto (“Venta cobrada en efectivo (demo)” con fiado abierto); **P2** de “Registrado” vs “Pendiente” antes/después de generar link.

## J. Navegación

Shell compartido real entre Inicio/Caja/Ventas. Fiados/Corte/Metas/Pendientes salen a legacy; la nav no lo avisa. P1 de continuidad (ver 02).

## K. Accesibilidad visual

Axe 0 normal/HC, targets ≥44 y contraste normal. Fallan el reflow 200 % (P1), el foco de ruta/paginación (P1), `forced-colors` del método activo (P2) y el anuncio de estado pendiente (P2). No se certifica WCAG.

## L. Originalidad

Caja/Ventas pertenecen al mismo producto por shell, tipografía y paleta; no son una plantilla administrativa completamente ajena. Pero el contenido usa cards blancas genéricas y estados sin iconos, y pierde la materialidad editorial de Inicio. Es una migración real, no una obra de paridad visual completa.
