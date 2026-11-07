# 07 — Responsive y accesibilidad

## Veredicto

**NO-GO de accesibilidad/reflow para cerrar B.** Axe normal/HC y los targets pasan, pero el zoom de texto al 200 % rompe la operación y el foco de ruta/paginación no se gestiona. No se certifica WCAG 2.2 AA.

## P1

### P1-04 — Texto al 200 %

- Caja 1366×768, 3 conceptos: cabeceras “CANTIDAD”/“PRECIO” encimadas; “Mercado Cero” recortado; CTA en `y=1359.7` (fuera).
- Caja 360×800: labels de nav se solapan (“CajaVentas”, “Ventas/Fiados”); paybar puede solapar el total con “Revisar cobro”.
- `/ventas` 320×640 + 200 %: `scrollWidth=337` vs `clientWidth=320` (**17 px** de scroll horizontal por “Siguiente”).
- El simple `scrollWidth===clientWidth` del smoke no detecta solapamientos ni CTA fuera.
- Evidencia: `EVIDENCIAS/caja-text200-1366.png`, `caja-text200-360.png`, `ventas-text200-320.png`, `text200-geometry.txt`, `a11y-text-resize.json`, `auditorias/08_accesibilidad.md`.

### P1-05 — Foco de ruta y paginación

- Tras navegar con clic/Enter, `document.activeElement` es `BODY`; no hay foco a `main`/H1 ni anuncio.
- En `/ventas`, activar “Siguiente” deja el foco en el enlace a `y=4674`; siguiente Tab a `BODY`.
- Evidencia: `EVIDENCIAS/keyboard-focus.json`, `a11y-pagination.json`, `a11y-ventas-pager-focus.png`.

## P2

- **Forced-colors:** el método activo (`aria-pressed=true`) y los demás quedan con los mismos colores del sistema; no se distingue la selección.
- **“Pendiente” no se anuncia:** al entrar a “Cobrar venta”, el foco va al H2, pero el badge no tiene `role/status` ni live region.
- **Error de cantidad marca Producto:** con Cantidad `0`, Producto recibe `aria-invalid=true`; Cantidad no. Evidencia: `a11y-forms.json`, `a11y-caja-error-zero-quantity.png`.
- **Monto máximo en paybar 360:** total `$9,989,999,990.01` se solapa 10 px con “Revisar cobro”. Evidencia: `a11y-max-amounts.json`, `a11y-caja-max-360.png`.
- **“Empezar de nuevo”** deja foco en `BODY`; hints sin `aria-describedby`; `aria-label` sobre `<span>` DEMO; `<aside>` sin nombre.
- **CTA fuera del primer viewport** en 1366/1280/768 (ver 03); a 390/320 el paybar está visible pero solo desplaza, no confirma.
- **“Agregar” inicial** en Caja vacía queda bajo la nav a 390/320: 390 `y=745–793`, nav `y=779`; 320 `y=767–815`, nav `y=575`.
- **Sin `safe-area-inset-top` ni `visualViewport`/`interactive-widget`**; riesgo iOS/teclado no probado.

## Lo que sí pasa

- Skip link primero, 48 px, Enter enfoca `caja-main`/`ventas-main`.
- 1 `main`, 1 skip, 1 nav principal visible, 1 `aria-current` visible; sin doble shell visible.
- Foco tras agregar (nuevo input), quitar (siguiente/Agregar), confirmar (H2 de resultado), “Más” (summary) y “Revisar cobro”.
- Labels de formulario, errores inline de línea, estados con texto, contraste normal, `prefers-reduced-motion` en spinner/scroll; targets ≥44 salvo enlaces inline.
- Axe 0 normal/HC en 10 estados; no es certificación.

## No probado

NVDA/JAWS/VoiceOver/TalkBack, iOS/Safari, HCM real de Windows, teclado virtual real, Firefox/WebKit, zoom real del menú del navegador, estudio con personas.

## Evidencia

- `auditorias/08_accesibilidad.md`
- `EVIDENCIAS/a11y.json`
- `EVIDENCIAS/keyboard-focus.json`
- `EVIDENCIAS/a11y-*`
- `EVIDENCIAS/capturas/caja-conceptos-top-*.png`
- `EVIDENCIAS/text200-geometry.txt`
