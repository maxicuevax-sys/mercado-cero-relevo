# Accesibilidad — Oleada B (`/caja`, `/ventas`)

**Agente:** `mc-accesibilidad` (subagente, solo lectura)
**Fecha:** 2026-11-04, 09:26 (America/Mexico_City)
**Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
**Rama:** `design/oleada-b-caja-ventas`
**Servidor:** `http://localhost:3100` · `buildSha` `26c7741433f18e4f4d0e78b1913df76ed09dae7e` · `BUILD_ID` `JBGQbx6F2zXGxreG2_XtW`
**Árbol:** sucio (nuevas rutas/componentes sin commit). El build servido se compiló a las 09:24; la fuente cambió a las 09:26, después del build, así que este informe evalúa `JBGQ…`, no ese cambio posterior. No es evidencia de `verify:evidence` sobre HEAD limpio.
**Alcance:** `/caja` y `/ventas` con AppShell, formulario, resultado, pagos, paybar móvil, `/ventas` con historial.
**Declaración:** no edité producto, no hice commits, no certifiqué WCAG. Solo navegué, usé teclado/Playwright/axe y escribí este informe + evidencia.

---

## Veredicto para B

**NO-GO para cerrar B como pantalla accesible.** No hay P0, pero hay **3 P1** que incumplen criterios de cierre del propio diseño y, en dos casos, WCAG 2.2 AA:

1. **El foco de teclado queda tapado por la paybar/nav fija** a 390 y 320 px.
2. **El total se desborda** con el importe máximo permitido a 100 % y con texto al 200 % en contenido real.
3. **Al quitar un concepto el foco cae en `body`**, contra el criterio explícito “nunca a body”.

La base es buena: axe 0 en normal/alto contraste, nombres accesibles correctos, targets ≥44, un solo `main`/skip/nav visible, foco al resultado correcto y estados con texto (no solo color). Pero eso no alcanza para declarar B cerrada.

> **No certificar WCAG 2.2 AA.** Falta lector de pantalla real, iOS/Safari, teclado virtual real, HCM real y paginación con >25 ventas. Este informe es evidencia de teclado + DOM + axe en Chromium headless, no una certificación.

---

## 1. Método y evidencia existente

- **Chromium** headless vía Playwright 1.64, locale `es-MX`.
- **Viewports:** 1448×1086, 1366×768, 760×900, 761×900, 390×844, 320×640; aproximación de zoom 200 % 724×543.
- **Texto ampliado:** raíz a `32px` (200 % de 16px) con contenido real.
- **Alto contraste propio:** `localStorage['mercado-cero:contrast']='high'`.
- **Reduced motion:** `emulate_media(reduced_motion="reduce")`.
- **Axe:** tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`; estados vacío, con conceptos, cambio, fiado, digital, ventas y pager inyectado. Resultado/pago se revisaron con foco y DOM, no con axe.
- **Datos:** durante la auditoría el dataset cambió (otro proceso creó ventas). Al cierre: 16 pedidos — 14 `demo_paid`, 1 `payment_pending`, 1 `paid` de prueba; no había filas `credit`. `paid` y `demo` se ejercieron con respuestas simuladas por intercepción de red; `fiado` se revisó en código (sin fila real), sin mutar el servidor.
- **Evidencia existente:** `quality-reports/oleada-b/a11y.json` (0 axe normal/HC, targets ≥44, 200 % sin overflow) y smoke 33/33. El smoke **no se re-ejecutó** porque crea ventas. El `a11y.json` es correcto para el estado vacío, pero **no prueba el estado con conceptos ni importes grandes**.

**Artefactos de esta auditoría:**

- `quality-reports/oleada-b/ACCESIBILIDAD.md` (este informe)
- `quality-reports/oleada-b/accesibilidad-evidence.json` (mediciones crudas seleccionadas)
- `quality-reports/oleada-b/capturas/a11y-foco-fiado-paybar-390.png`
- `quality-reports/oleada-b/capturas/a11y-total-1m-1448-normal.png`
- `quality-reports/oleada-b/capturas/a11y-total-1m-320-text200.png`

---

## 2. Hallazgos

### P0 — ninguno

No encontré un bloqueo total de lectura, navegación o cobro.

### P1 — corregir antes de cerrar B

#### P1-1. El foco de teclado queda oculto bajo la paybar/nav fija

**Criterio:** WCAG 2.2 SC 2.4.11 *Focus Not Obscured (Minimum)*; también afecta la visibilidad de foco del criterio de cierre.

**Evidencia (390×844, normal, con conceptos y paybar visible):**

| Foco | Rect del control | Paybar | `elementFromPoint` en el centro |
|---|---|---|---|
| `Fiado` | 710–758 | 715–780 | devuelve el total de la paybar |
| `Mixto` | 710–758 | 715–780 | devuelve `Cobrar` (botón de la paybar) |

El anillo de foco del botón queda detrás de la paybar; el usuario de teclado no ve dónde está. Captura: `capturas/a11y-foco-fiado-paybar-390.png`.

**Evidencia (320×640, normal):**

| Foco | Rect | Overlay | Resultado |
|---|---|---|---|
| `Fiado` / `Mixto` | 506–554 | paybar 511–576 | tapado por la paybar |
| `Efectivo recibido` | 580–628 | nav 575–640 | tapado por la nav; el hit devuelve el icono de la nav |
| `la vista anterior` (footnote) | 494–528 | paybar 511–576 | tapado por la paybar |

No es un problema de “solo 200 %”: ocurre a tamaño normal en 390 y 320. La paybar se activa al agregar el primer concepto y el navegador no reserva su altura al hacer `scrollIntoView` del foco.

**Fix esperado:** `scroll-padding-bottom` en `main` = altura real de paybar + nav + separación, `scroll-margin-bottom` en los focusables, o —mejor— paybar `sticky` en flujo (como proponía `DISENO_CAJA.md` §5.2/§5.4). Probar Tab desde “Agregar” hasta métodos, efectivo, paybar y footnote en 390/320.

---

#### P1-2. El total se desborda con contenido real y al 200 % de texto

**Criterios:** WCAG 1.4.4 *Resize Text* y 1.4.10 *Reflow*.

El total usa `font-size: clamp(2.6rem, 5vw, 4rem)` sin tope por ancho de contenedor. El importe máximo del contrato es `$1,000,000.00` (`MAX_ORDER_TOTAL_CENTS`), y ya a 100 % no cabe en la columna de escritorio:

| Caso | Medición |
|---|---|
| 1448×1086, 100 %, `$1,000,000.00` | texto 1076→**1471**; viewport 1448; `document.scrollWidth=1471` |
| 1366×768, 100 %, `$1,000,000.00` | texto 1021→**1416**; viewport 1366; `scrollWidth=1416` |
| 1366×768, texto 200 % (raíz 32), `$1,234.50` | total `scrollWidth=359` vs `clientWidth=285`; documento **1380** vs 1366 |
| 390×844, texto 200 % (raíz 32), `$1,234.50` | documento **392** vs 390 |
| 320×640, texto 200 % (raíz 32), `$1,234.50` | documento **388** vs 320; total 359 vs 262 |
| 320×640, texto 200 % (raíz 32), `$1,000,000.00` | documento **543** vs 320; texto 514 px |

El importe no se recorta con `overflow:hidden`: se sale de la tarjeta y del viewport, generando scroll horizontal o contenido fuera de pantalla. A 320 normal el máximo sí cabe (257 px de texto en 262); el fallo aparece a 100 % en escritorio con el máximo y a 200 % de texto con importes ordinarios.

**Discrepancia con la evidencia previa:** `web/scripts/oleada-b-a11y.py` mide `zoom200` después de recargar **sin agregar conceptos** y solo cambia `document.documentElement.style.fontSize='32px'` (líneas 77–82). Por eso `a11y.json` da 320/320 y 1448/1448: mide `$0.00`, no un estado con conceptos. La evidencia no cubre el caso real.

**Fix esperado:** tope tipográfico dependiente del contenedor (`cqi`/container query), `font-size` máximo calculado, o reducir el tamaño en la columna estrecha; probar `$1,000,000.00` a 320/1366/1448 y texto 200 %. No partir el importe; usar `white-space: nowrap` solo si el tamaño se adapta.

---

#### P1-3. Al quitar un concepto el foco cae en `body`

**Criterio del diseño:** `DISENO_CAJA.md` §5.6: “Al borrar un renglón, el foco va al botón ‘Agregar concepto’ o al siguiente renglón; nunca a `body`.”

**Evidencia:** con dos conceptos, foco en “Quitar Uno” + Enter:

```
activeElement = BODY
lines = 1
siguiente Tab = INPUT "Concepto" del renglón restante
```

No hay `role=status` ni `aria-live` que anuncie “concepto eliminado” o el nuevo total. El siguiente Tab recupera un campo cercano, así que **no bloquea** la venta, pero el usuario pierde el indicador y la confirmación de la acción. Mismo patrón en el aviso de borrador: “Seguir” desmonta el botón y deja `BODY` (ver P2-1).

**Fix esperado:** después de `onRemove`, enfocar la descripción del siguiente renglón o “Agregar concepto”; anunciar el nuevo conteo/total con `role=status`/`aria-live=polite`.

---

### P2 — deuda de accesibilidad / criterios de diseño

#### P2-1. Al agregar, el foco se queda en “Agregar” y no se anuncia el nuevo concepto

- Con teclado: `activeElement` sigue siendo el botón **Agregar**.
- Para llegar al nuevo renglón hay que hacer **7 Shift+Tab** (Precio unitario → Cantidad → Producto → Quitar → Precio → Cantidad → Concepto).
- `.mc-caja-count` cambia a “1 concepto” pero **no** tiene `aria-live`; no hay región viva.
- El total tampoco se anuncia (ver P2-4).
- El aviso de borrador “Seguir” también deja `activeElement=BODY` al desmontarse; mismo patrón de foco.

**Fix:** enfocar la descripción del nuevo renglón o anunciar “Concepto agregado; total $X” sin mover el foco si se prefiere captura rápida.

#### P2-2. Errores de línea: se marcan campos válidos y falta asociación en precio/cantidad

Al confirmar con el precio de una línea en 0 y otra línea válida:

- El foco **sí** va al campo Precio inválido (correcto).
- Pero los tres campos de la fila reciben `aria-invalid="true"`: Concepto, Cantidad y Precio, aunque solo Precio falla.
- Solo el input de Concepto tiene `aria-describedby`; **Precio y Cantidad no** apuntan al mensaje de error.
- Hay dos `role=alert` (“El precio…” y “Revisa los conceptos marcados.”), lo que puede duplicar el anuncio.
- El error de “Agregar” (descripción vacía) deja el foco en **Agregar** y no pone `aria-invalid`/`aria-describedby` en “Producto o servicio”.

**Fix:** error por campo, `aria-invalid` solo en el campo que falla, `aria-describedby` en precio/cantidad, y foco/estado inválido en el alta manual.

#### P2-3. En móvil hay dos CTA primarios para la misma acción

Con un concepto y la paybar visible:

- Chip superior: enlace `TOTAL $70.00 COBRAR`.
- Paybar: botón `Cobrar`.
- Tarjeta de cobro: botón `Confirmar venta` (`display:inline-flex`, y=1280 en 390×844).

La paybar no oculta el CTA de la tarjeta; el diseño (`DISENO_CAJA.md` §5.1/§5.2) pedía que el CTA no se duplicara visible y que la paybar fuera el único primario cuando está activa. No es una violación axe, pero duplica tab stops y dos acciones primarias.

**Fix:** ocultar `.mc-caja-confirm` cuando la paybar esté activa, o eliminar la paybar y dejar la tarjeta; una sola acción primaria por estado.

#### P2-4. Total y conteo cambian sin announcement

- `.mc-caja-total` y `.mc-caja-count` no tienen `aria-live`.
- Solo el bloque de cambio (`Cambio`/`Falta cobrar`) tiene `aria-live="polite"`.
- Al editar cantidad/precio o agregar/quitar, un lector no recibe el nuevo total salvo que navegue a leerlo.

No es un fallo automático de axe; es una carencia de estado dinámico. Añadir una región `polite` con el total al confirmar edición, evitando anunciar cada tecla.

#### P2-5. Resultado/pago: el foco al H2 funciona, pero el H1 queda “Nueva venta” y no hay live region

- Confirmar efectivo → foco en `H2` “Venta cobrada en efectivo” (`tabIndex=-1`). **Correcto.**
- Confirmar digital → foco en `H2` “Pedido 0001”. **Correcto.**
- Demo → foco en `H2` “Pago demo (simulado)”. **Correcto.**
- En los tres casos el `H1` sigue siendo **“Nueva venta”**. Navegar por encabezados en el estado de resultado/pago devuelve un H1 que ya no describe la pantalla.
- No hay `role=status`/`aria-live` en el resultado del pago; la única señal es el foco programático. Funciona en Chromium, pero no se probó con lector real.
- La reanudación de un pago pendiente también enfoca el H2 y deja el H1 anterior; no anuncia el cambio de vista.

**Fix:** actualizar el H1 (o añadir un encabezado de vista) por estado; opcionalmente `role=status` en el contenedor del resultado. Mantener el foco al H2.

#### P2-6. Navegación de ruta y paginación sin foco gestionado

- `/ventas` → clic/Enter en “Nueva venta” → `/caja`: `activeElement` termina en **BODY**; no hay foco a `main`/`h1`.
- El pager no se pudo ejercitar: con 16 ventas y límite 25, `pageCount=1`, no se renderiza (`.mc-ventas-pager=0`). En código, el pager usa “Anterior/Siguiente”, spans con `aria-disabled` y sin `aria-current`; no hay foco a la lista/encabezado al cambiar de página. El markup inyectado pasó axe 0.
- `?page=2` con 16 ventas se queda en 16 filas (clamp a página 1) y la URL conserva `page=2`; no es un fallo de accesibilidad, pero conviene canonicalizar.

**Fix:** `RouteFocus` en AppShell (foco a `main`/H1 en cambio de pathname) y foco al encabezado/lista al paginar. Probar con >25 ventas y `aria-current` en la página actual.

#### P2-7. `prefers-reduced-motion` no respeta el scroll suave de la paybar

- El spinner sí se desactiva (`@media (prefers-reduced-motion: reduce)` → `animation:none`). **Pass.**
- `goToPayment()` llama `scrollIntoView({ behavior:"smooth" })` de forma incondicional. Con `reduce` activo, el test capturó `{behavior:"smooth", block:"start"}`.

**Fix:** `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`.

#### P2-8. Enlace externo sin aviso y copy sin anuncio

- “Abrir link” tiene `target="_blank"` y `rel="noreferrer"`, pero su nombre accesible es solo “Abrir link”: no avisa que abre pestaña nueva.
- El botón de copiar cambia su nombre a “Link copiado” mediante `.sr-only`, pero no hay `aria-live`; el cambio puede no anunciarse.

**Fix:** añadir “(abre en pestaña nueva)” al nombre o texto visible; anunciar “Link copiado” con `role=status`.

#### P2-9. Teclado virtual: simulación pasa, pero el riesgo real sigue abierto

- Simulación 390×400: foco en “Efectivo recibido” queda 176–224; paybar 271–336; nav 335–400. El campo sigue visible y no hay overflow horizontal. **Pass en simulación.**
- `layout.tsx` no declara `interactive-widget=resizes-content`; no hay `visualViewport` en Caja. La paybar es `position:fixed` contra el borde inferior.
- No se probó iOS/Safari ni Android real. En iOS el layout viewport no se redimensiona igual; la paybar podría quedar bajo el teclado.

**Fix / verificación:** añadir `interactiveWidget: "resizes-content"` si Next 16 lo soporta, escuchar `visualViewport` y probar en dispositivo real. No declarar este punto cerrado con la simulación.

---

### P3 — observaciones, no bloqueantes

- **Métodos como 4 botones `aria-pressed`** en un `fieldset`/`legend`: accesible, pero no es un `radiogroup`; no se mueve con flechas y son 4 tab stops. Un grupo de radios sería más eficiente.
- **`window.confirm` para “Limpiar venta”**: diálogo nativo bloqueante; accesible por teclado, pero no es el patrón inline que pedía el diseño.
- **“Volver a Caja”** en el resultado apunta a `/caja` (misma URL); funciona como recarga, no como “nueva venta”. No es un fallo WCAG, pero el nombre no describe el efecto.
- **Guardando/pago busy:** el label cambia a “Registrando…” o se muestra spinner, pero no hay `aria-busy`; el foco permanece en el botón. Añadir `aria-busy` y un estado anunciado si se quiere precisión.
- **Moneda:** los importes se renderizan como `$1,234.50`; no hay “MXN” textual ni `aria-label` “pesos”. No se probó cómo lo verbaliza un lector real; verificar con NVDA/TalkBack antes de afirmar que se lee bien.
- **Color de “éxito”:** el icono del resultado usa el mismo verde para efectivo, fiado y demo. El título y la nota lo aclaran, así que no depende solo del color, pero la señal visual es ambigua.

---

## 3. Lo que sí pasa

| Área | Resultado |
|---|---|
| **Landmarks** | 1 `main`, 1 skip link, 1 nav visible, 1 `aria-current` visible en 390/760/761/1280. El DOM tiene 2 nav y 2 `aria-current`, pero uno está `display:none`; no se expone. **Pass visible.** |
| **Skip link** | Primer Tab = “Saltar al contenido”; visible a 48 px; Enter enfoca `#caja-main`/`#ventas-main`; no cambia el hash. **Pass.** |
| **Orden de tabulación** | Sin trampas. Escritorio: skip → marca → 7 nav → 2 foot → topbar → main. Móvil: skip → topbar → main → nav fija al final. **Pass.** |
| **Foco visible** | Todos los stops de teclado con outline sólido de 3 px (`rgb(0,75,60)` en claro; blanco en sidebar). **Pass salvo P1-1.** |
| **Nombres accesibles** | Inputs con label (“Producto o servicio”, “Cantidad”, “Precio unitario”, “Efectivo recibido”, “Monto a fiado”, “¿Quién queda a deber?”); métodos “Efectivo/Digital/Fiado/Mixto” con `aria-pressed`; chip “TOTAL $70.00 COBRAR”; paybar “Total $70.00” + “Cobrar”; confirmaciones “Confirmar venta”/“Generar cobro $X”/“Registrar fiado $X”. **Pass.** |
| **Pago/QR/link** | Región “Pedido A919”, estado “Pendiente”, “Abrir link”, “Copiar link”, “Generar QR”, “Actualizar estado”, “Simular CoDi/tarjeta”, “Ver historial de ventas”. El QR tiene `alt="QR de cobro del pedido XXXX"` en código; no se generó un QR real. **Pass de nombres; QR no ejercitado.** |
| **Resultado** | Región “Venta cobrada en efectivo”; foco al H2; “Pagado”, “Nueva venta”, “Ver ventas”, “Volver a Caja”. **Pass de foco; ver P2-5 por H1/live.** |
| **Estados** | Demo: “Demo, no es dinero real” + “Pago demo (simulado)” + banner “Modo demo”; pendiente: “Pendiente” + “Pendiente de cobro”; fiado: “Fiado, no cobrado” + “Saldo vivo” (código, sin fila real); pagado: “Pagado”/“Cobrado” (código, sin fila real). **No depende solo del color.** |
| **Targets** | Controles ≥44×44; CTA ≥48/56; métodos 48; “Más” 64; links de “Más” 48; detalles 44. Enlaces inline de 15–34 px de alto quedan exentos por 2.5.8; no se cuentan como target de bloque. **Pass.** |
| **Axe** | 0 violaciones en `/caja` vacío, con línea, cambio, fiado, digital, `/ventas` móvil, alto contraste propio y pager inyectado. **Pass automatizado.** |
| **Alto contraste propio** | `data-contrast=high`: axe 0 en `/caja` y `/ventas`; acento #004d38 sobre blanco; focus negro. **Pass.** |
| **Reduced motion** | Spinner sin animación. **Pass; P2-7 por smooth scroll.** |
| **“Más”** | Abre, links de 48, Escape cierra y devuelve el foco al `summary`. **Pass.** |
| **Ventas detalles** | `summary` “Ver conceptos” con Enter abre; foco permanece en el summary; 28 ítems visibles. **Pass.** |
| **Sin doble shell** | 1 `main`, 1 skip, 1 nav visible, 1 `aria-current` visible; 760/761 verificado. **Pass.** |

---

## 4. Evidencia concreta (resumen)

| Prueba | Dato |
|---|---|
| Skip link | Primer Tab `A.inicio-skip`; Enter → `MAIN#caja-main` |
| Foco al agregar | `ACTIVE=BUTTON "Agregar"`; 7 Shift+Tab al nuevo “Concepto”; `count` sin `aria-live` |
| Foco al quitar | `ACTIVE=BODY`; siguiente Tab `INPUT "Concepto"` |
| Error de precio | foco `INPUT "Precio"`; los 3 campos `aria-invalid=true`; Precio `aria-describedby=null` |
| Error de alta | foco sigue en “Agregar”; input sin `aria-invalid`/`aria-describedby` |
| Confirmar efectivo | foco `H2 "Venta cobrada en efectivo"`; H1 sigue “Nueva venta”; 0 live regions |
| Confirmar digital | foco `H2 "Pedido 0001"`; H1 sigue “Nueva venta” |
| Demo | foco `H2 "Pago demo (simulado)"`; título/nota demo correctos |
| Paybar 390 | paybar 715–780; nav 779–844 (1 px de solape); `Fiado`/`Mixto` tapados |
| Paybar 320 | paybar 511–576; nav 575–640; efectivo 580–628 tapado por nav |
| Total 1448 normal, $1M | texto 1076–1471; viewport 1448; doc 1471 |
| Total 1366 normal, $1M | texto 1021–1416; viewport 1366; doc 1416 |
| Total 1366 texto 200 %, $1,234.50 | doc 1380 vs 1366; total 359 vs 285 |
| Total 320 texto 200 %, $1,234.50 | doc 388 vs 320; total 359 vs 262 |
| Total 320 texto 200 %, $1M | doc 543 vs 320; texto 514 |
| Zoom navegador 200 % aprox. 724×543 | doc 724/724 (sin overflow); paybar+nav 129 px |
| Landmarks 390/760/761/1280 | main 1; skip 1; nav visible 1; current visible 1 |
| Axe normal/HC | 0 en los estados con axe listados (vacío, línea, cambio, fiado, digital, ventas, HC propio, pager inyectado) |
| Pager inyectado | axe 0; no se pudo probar el pager real (16 ventas < 25) |

---

## 5. Lo que NO se probó

- **Lector de pantalla real** (NVDA, JAWS, VoiceOver, TalkBack). Los nombres y el foco se verificaron en DOM/ARN; no sé cómo verbaliza el lector un importe `$1,234.50` ni el H2 enfocado.
- **iOS/Safari real**, safe areas y teclado virtual real; solo simulé viewport 390×400.
- **Windows HCM real**. En emulación `forced-colors: active` la captura se ve legible y axe reporta `color-contrast` como falso positivo de la emulación; no lo tomo como fallo ni como pase.
- **Paginación real con >25 ventas**. No se crearon datos. El pager no se renderizó; solo revisé código y markup inyectado.
- **Filas `paid` y `credit` reales**. Al cierre: 14 demo + 1 pendiente + 1 paid de prueba; `fiado`/credit no tenía fila real. Los estados se revisaron en código.
- **QR real**. El pedido pendiente no tenía QR; no lo generé para no mutar datos. El `alt` está en código.
- **Smoke 33/33**. No se re-ejecutó; crea ventas. Se cita como evidencia funcional existente, no como evidencia de accesibilidad.
- **Firefox/WebKit**. Solo Chromium headless.

---

## 6. Recomendaciones priorizadas

1. **P1-1:** reservar la altura de paybar + nav al enfocar (`scroll-padding-bottom`/`scroll-margin-bottom`) o mover la paybar a flujo `sticky`. Repetir Tab completo en 390/320.
2. **P1-2:** hacer que el total quepa por contenedor y no por viewport; probar `$1,000,000.00` a 1448/1366/390/320 y texto 200 %. Añadir un test con contenido, no solo vacío.
3. **P1-3:** enfocar el siguiente renglón o “Agregar” al quitar; anunciar el nuevo conteo/total.
4. **P2-2:** errores por campo, `aria-describedby` en precio/cantidad, no marcar campos válidos; asociar el error de alta.
5. **P2-3:** un solo CTA primario en móvil; ocultar el confirm de la tarjeta cuando la paybar esté activa.
6. **P2-4/5:** región viva para total/conteo y estado de resultado/pago; actualizar H1 por vista.
7. **P2-6:** foco de ruta (main/H1) y foco al cambiar de página; `aria-current` de paginación; probar >25 ventas.
8. **P2-7:** `behavior:auto` con `prefers-reduced-motion`.
9. **P2-8/9:** aviso de pestaña nueva, live de “Link copiado”, `interactive-widget` y `visualViewport`; prueba real iOS/Android.
10. **Antes de declarar B:** repetir esta matriz con NVDA/TalkBack, iOS/Safari y HCM real; no certificar WCAG sin eso.

---

## 7. Cierre

- **P0:** 0.
- **P1:** 3 (foco tapado, total desbordado, foco a body al quitar).
- **P2:** 9 (agregar, validación, CTA duplicado, live de total, H1/resultado, ruta/paginación, reduced motion, enlace externo/copy, teclado virtual).
- **Axe:** 0 en normal/alto contraste; sin que eso sustituya teclado/lector.
- **Veredicto:** **NO-GO para cerrar B como accesible**; sí para seguir iterando. No certificar WCAG 2.2 AA.
