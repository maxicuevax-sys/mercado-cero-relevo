# 08 — Accesibilidad · Oleada B (`/caja`, `/ventas`)

**Rol:** `mc-accesibilidad` — revisión adversarial, solo lectura. No edité producto ni hice commits.
**Fecha:** 2026-11-04 11:26 –06:00
**Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
**HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`
**Servidor:** `http://127.0.0.1:3100` · `buildSha=4130e71…` · `health.ok=true`
**Herramientas:** Playwright 1.64 + Chromium 156 headless, axe-core 4.14.0, teclado sintético, emulación de `forced-colors`, `prefers-reduced-motion` y viewports de reflow.
**Alcance:** `/caja` (compose, error, payment, result) y `/ventas` (lista, estados, paginación), escritorio 1280×800, móvil 360×740 y 320×640, zoom de navegador equivalente 640×400 / 512×320, texto 200 % y montos máximos.

> **No es una certificación WCAG.** axe no sustituye lector de pantalla, iOS/VoiceOver, HCM real ni teclado físico. Al final documento lo no probado.

---

## 0. Veredicto

| Severidad | Hallazgos | ¿Bloquea declarar a11y cerrada? |
|---|---:|---|
| **P0** | **0** | No hay trampa de foco, control inoperable por teclado, `main`/skip ausentes ni doble shell visible. |
| **P1** | **2** | **Sí**: texto 200 % rompe contenido; foco de paginación queda invisible/fuera de pantalla. |
| **P2** | **4** | No bloquean por sí solos, pero deben tener dueño y fecha antes de decir “AA”. |
| **P3** | **5** | Deuda menor, documentada. |

**Lectura corta:** la base semántica está bien (skip, landmarks, `aria-current`, foco al agregar/quitar/confirmar, formularios etiquetados, estados con texto, contraste normal). Lo que falla es la **resistencia del layout al texto 200 %**, el **foco al paginar** y cuatro detalles de estado/forma que axe no detecta.

No incluyo el P0 de “dos Cajas” de `03_shell.md`: es riesgo de producto, no un fallo de accesibilidad. Donde coincide, lo referencio.

---

## 1. P1-1 — Texto 200 % rompe el layout y provoca scroll horizontal

**Criterio:** WCAG 2.2 **1.4.4 Resize Text** y **1.4.10 Reflow** (AA). Afecta a personas con baja visión que usan zoom de texto del navegador o tamaño de fuente del sistema, no solo zoom de página.

**Evidencia:** `../EVIDENCIAS/a11y-text-resize.json`, capturas `a11y-caja-text200-normal-desktop.png`, `a11y-caja-text200-normal-mobile.png`, `a11y-caja-text200-max-desktop.png`, `a11y-caja-text200-max-mobile.png`, `a11y-ventas-320-text200.png`.

### Reproducción

1. `/caja`, agregar `Quesadilla`, cantidad `2`, precio `35`.
2. En DevTools: `document.documentElement.style.fontSize = '32px'` (200 % sobre 16 px).
3. En `/ventas?page=2` a 320×640, hacer lo mismo.

### Mediciones

| Escenario | Medición | Resultado |
|---|---|---|
| Caja 1280, texto 200 %, contenido normal | Cabecera `CANTIDAD` `scrollWidth=128` en columna de `78`; `IMPORTE=112` en `96` | “CANTIDADPRECIO” encimado; marca del sidebar “Mercado Cero” recortada |
| Caja 360, texto 200 % | “Ventas” mide `80.03 px` y “Fiados” `73.89 px` en celdas de `72 px`; solape `4.96 px` entre ambas | Etiquetas de la tab bar ilegibles (“CajaVentasFiados”) |
| Ventas 320, texto 200 % | `document.scrollWidth=337` vs `clientWidth=320` (17 px de scroll horizontal) | El enlace “Siguiente” mide 167 px y empieza en x=168; la nav móvil mide 337 px |
| Caja 360, texto 200 %, montos máximos | La captura muestra el total de la tarjeta y la etiqueta “Faltan …” desbordando su caja; a 360 con texto normal y monto máximo el resumen ya excede su contenido (`319` en `302`) | Importe y CTA ilegibles; ver también P2-4 |
| Caja 640×400 y 512×320, montos máximos | `scrollWidth == clientWidth` | **El zoom de navegador equivalente no desborda**; el fallo es específico de texto 200 % real |

**Matiz importante:** medí dos cosas distintas. El zoom de navegador (viewport CSS reducido a 640/512) **pasa** el reflow básico. El zoom **solo de texto** al 200 % **no pasa**. Ambos son mecanismos reales de 1.4.4; el segundo es el que rompe.

**Impacto:** una persona que aumenta solo el texto no puede leer la tabla de conceptos ni la navegación inferior; a 320 px además aparece scroll horizontal, lo que incumple reflow. No es un caso extremo de “importe máximo”: la cabecera se solapa con `$70.00`.

**Recomendación:** en `<=480 px` o cuando el texto crezca, apilar concepto/cantidad/precio/importe; usar columnas `minmax(0, 1fr)` con mínimos en `em`; permitir que las etiquetas de la tab bar envuelvan o pasar a icono + nombre accesible; paybar en dos filas cuando el importe no quepa; `overflow-wrap:anywhere` en totales. El test debe comprobar **rectángulos disjuntos**, no solo `scrollWidth`.

**Coincide con:** `03_shell.md` P1-1 (allí se midió 390/320 y 3 conceptos). Esta auditoría aporta la medición de la tab bar a 360, la cabecera de conceptos y el contraste texto-200 vs zoom-navegador.

---

## 2. P1-2 — Paginar deja el foco invisible (fuera del viewport)

**Criterio:** WCAG 2.2 **2.4.7 Focus Visible** y **2.4.3 Focus Order**; anuncio de contexto como buena práctica.

**Evidencia:** `../EVIDENCIAS/a11y-pagination.json`, captura `a11y-ventas-pager-focus.png` (página 2 arriba, sin anillo de foco visible).

### Reproducción

1. `/ventas` (125 órdenes, página 1 de 5 en la ventana de prueba).
2. Enfocar con teclado el enlace **“Siguiente”** y pulsar **Enter**.
3. Observar: URL `?page=2`, `scrollY=0`, pero `document.activeElement` sigue siendo el `<a>Siguiente</a>` en `y=4674` (fuera de pantalla); `:focus-visible=true` pero no se ve.
4. Pulsar Tab: el foco cae en `BODY`.

| Acción | Foco resultante | Scroll |
|---|---|---|
| Enter en “Siguiente” | `A “Siguiente”` en `y=4674` | `0` |
| Tab siguiente | `BODY` | `0` |
| Clic de puntero en “Siguiente” | `A “Siguiente”` fuera de pantalla, `focus-visible=false` | `0` |

No hay `aria-live` que anuncie “página 2 de 5” ni foco al `h1`/`h2` de la lista. El usuario de teclado pierde el lugar y el siguiente Tab lo devuelve al inicio del documento.

**Impacto:** cada paginación obliga a reorientarse; la persona no ve dónde está el foco. En una lista larga de ventas esto ocurre en cada página.

**Recomendación:** tras paginar, `focus()` al `h2#mc-ventas-list-title` (o `h1`) después del render, `scrollIntoView` al inicio de la lista y anunciar la página en un `role=status`. Si se conserva navegación cliente, no dejar el foco en el enlace que se moverá fuera del viewport.

**Coincide con:** `03_shell.md` P1-4 (foco de ruta/paginación). Allí se agrupa como P1 global; aquí lo limito a `/ventas`.

---

## 3. P2-1 — El error de “Cantidad” marca inválido el campo “Producto”

**Criterio:** WCAG **3.3.1 Error Identification**, **1.3.1 Info and Relationships**, **4.1.2 Name, Role, Value** (el `role=alert` sí existe, pero la relación de campo es incorrecta).

**Evidencia:** `../EVIDENCIAS/a11y-forms.json`, capturas `a11y-caja-error-zero-quantity.png` y `a11y-caja-error-empty-description.png`.

### Reproducción

1. `/caja`, escribir `Quesadilla` en **Producto o servicio**.
2. Poner `0` en **Cantidad** y `35` en **Precio unitario**.
3. Pulsar **Agregar**.

Resultado medido:

| Campo | `aria-invalid` | `aria-describedby` |
|---|---|---|
| Producto o servicio (valor `Quesadilla`) | **`true`** | **`mc-caja-add-error`** |
| Cantidad (valor `0`) | ausente | ausente |
| Precio unitario (valor `35`) | ausente | ausente |

El foco se queda en el botón **Agregar**. El mensaje “La cantidad debe ser mayor que cero.” se anuncia por `role=alert`, pero si la persona navega de vuelta al formulario, el lector dice que **Producto** es inválido y no que **Cantidad** lo es.

**Impacto:** corrección de errores a ciegas; el usuario puede corregir el campo equivocado. En el caso de descripción vacía sí funciona (Producto es el campo correcto), por eso el bug es intermitente y fácil de no ver en axe.

**Recomendación:** guardar `field` del error (`description | quantity | price`) y aplicar `aria-invalid`/`aria-describedby` solo al input correspondiente; enfocar ese input (`focusDraftField` ya existe en la Caja clásica, replicar el patrón). El `role=alert` puede quedarse.

---

## 4. P2-2 — En forced-colors el método de pago seleccionado se vuelve indistinguible

**Criterio:** WCAG **1.4.1 Use of Color** y **1.4.11 Non-text Contrast** (indicación visual del estado), en Windows High Contrast / forced-colors.

**Evidencia:** `../EVIDENCIAS/a11y-forced-colors.json`, capturas `a11y-caja-forced-colors.png` y `a11y-caja-forced-colors-focus.png`.

### Reproducción

1. Emular `forced-colors: active` en Chromium (Playwright `forced_colors="active"`).
2. Abrir `/caja` y comparar los cuatro botones de “Cómo se paga”.

| Botón | `aria-pressed` | Fondo | Texto | Borde |
|---|---|---|---|---|
| Efectivo | `true` | `rgb(255,255,255)` | `rgb(0,0,0)` | `rgb(0,0,0)` |
| Digital | `false` | `rgb(255,255,255)` | `rgb(0,0,0)` | `rgb(0,0,0)` |
| Fiado | `false` | `rgb(255,255,255)` | `rgb(0,0,0)` | `rgb(0,0,0)` |
| Mixto | `false` | `rgb(255,255,255)` | `rgb(0,0,0)` | `rgb(0,0,0)` |

El estado seleccionado solo queda en `aria-pressed`; visualmente los cuatro son idénticos. En modo normal el botón activo tiene fondo verde, pero forced-colors sustituye ese fondo. Un usuario vidente con HCM no puede saber qué método está activo sin deducirlo por el campo que aparece debajo.

**Impacto:** selección de método ambigua; el usuario puede cambiar de método sin darse cuenta o creer que está en otro.

**Recomendación:** añadir una marca no cromática (check, borde interior, subrayado, “Seleccionado” visible) o usar `forced-color-adjust` con colores de sistema para el estado activo. Mantener `aria-pressed`.

**No probado:** HCM real de Windows; solo emulación. El resto de forced-colors (foco, bordes, texto) se ve correctamente.

---

## 5. P2-3 — En “Cobrar venta” el estado “PENDIENTE” no se anuncia

**Criterio:** WCAG **4.1.3 Status Messages** y **1.3.1** (relación estado↔pedido). No es un fallo de color: el texto “PENDIENTE” existe y es legible.

**Evidencia:** `../EVIDENCIAS/a11y-payment.json`, captura `a11y-caja-payment-pending.png`.

### Reproducción

1. Sembrar `localStorage["mercado-cero:caja-pending:v2"] = {"orderIds":["<orden pendiente>"]}` y recargar `/caja` (solo GET; no modifiqué la orden).
2. La vista pasa a “Cobrar venta” y el foco programático cae en `h2#mc-caja-payment-title` → “Pedido AE9B”.
3. Inspeccionar `.mc-caja-status`: `role=null`, `aria-live=null`. En el panel no hay ningún `[aria-live]`, `role=status` ni `role=alert`.

El lector anuncia “Pedido AE9B”, pero no “PENDIENTE” ni el importe. El subtítulo “El pago sigue pendiente…” está en el `h1`/header, no asociado al `h2` enfocado. El polling cada 5 s tampoco anuncia cambios de estado que no cambien de vista (p. ej. `partially_paid`).

**Impacto:** una persona ciega puede creer que el pedido está listo para entregar, precisamente en la pantalla donde el estado es la información crítica.

**Recomendación:** `role="status"`/`aria-live="polite"` en el badge, o incluir el estado en el nombre del `h2` (`Pedido AE9B, pendiente`) y `aria-describedby` al importe/nota. Anunciar el resultado de “Actualizar estado” y de cualquier cambio de estado del polling.

**Nota:** los estados visibles sí llevan texto (no dependen solo de color): DEMO, PENDIENTE, FIADO, Saldado, Cambio, etc. Este hallazgo es de anuncio, no de etiqueta.

---

## 6. P2-4 — Monto máximo recortado en la paybar móvil

**Criterio:** WCAG **1.4.4** y verdad financiera visible; no es un fallo de contraste.

**Evidencia:** `../EVIDENCIAS/a11y-max-amounts.json`, captura `a11y-caja-max-360.png`.

### Reproducción

1. `/caja` a 360×740.
2. Agregar `Quesadilla`, cantidad `999`, precio `9999999.99`.
3. Mirar la paybar fija.

Medición: el span del total termina en `x=228`; el botón **“Revisar cobro”** empieza en `x=218`. Hay **10 px de solape**: el último dígito (`1` de `$9,989,999,990.01`) queda tapado por el botón. El total completo sí está en el chip superior y en el resumen; el problema es la barra que acompaña el trabajo.

**Impacto:** un importe de dinero se muestra incompleto en la zona más visible mientras se arma la venta. Con montos grandes puede inducir a error.

**Recomendación:** permitir dos filas o reducir el importe con `min()`/`clamp()` y `font-variant-numeric`; en su defecto, mover “Revisar cobro” a icono con nombre accesible. Añadir un test con el máximo permitido por `parseMoneyCents`.

**Relación:** en texto 200 % el desborde es mayor y forma parte de P1-1.

---

## 7. P3 — Hallazgos menores

### P3-1 — “Empezar de nuevo” pierde el foco
- Al activar por teclado **Empezar de nuevo** en el aviso de borrador recuperado, el botón se desmonta y `document.activeElement` queda en `BODY` (`focusVisible=false`), sin anuncio.
- Evidencia: `../EVIDENCIAS/a11y-restore-focus.json`.
- Recomendación: enfocar `#mc-caja-new-description` y anunciar “Borrador descartado” en el `role=status` existente.

### P3-2 — Hints de efectivo/fiado/cliente no están asociados al campo
- `Efectivo recibido`, `Monto a fiado` y `¿Quién queda a deber?` no tienen `aria-describedby`; los avisos (“Faltan…”, “Escribe el nombre…”) son texto global o `role=alert`, no descripción del input.
- Evidencia: `../EVIDENCIAS/a11y-forms-extra.json`.
- Recomendación: ids estables y `aria-describedby` en cada input; `aria-invalid` en el campo de fiado cuando el monto excede el total.

### P3-3 — `aria-label` sobre `<span>` DEMO es terreno frágil
- axe deja `aria-prohibited-attr` (incomplete) en `.inicio-demo`; Chrome lo expone como `generic` con nombre “Datos simulados, no dinero real”, pero la spec no permite `aria-label` en `generic` y otros AT pueden ignorarlo.
- Evidencia: `../EVIDENCIAS/a11y-axe.json`, `../EVIDENCIAS/a11y-forms-extra.json` (`demo_ax`).
- Recomendación: `role="note"`/`role="img"` con nombre, o texto visible “Datos simulados”; no confiar en `aria-label` sobre un span genérico.

### P3-4 — Landmarks complementarios/artículos sin nombre
- El `<aside>` del sidebar es `complementary` sin nombre; en `/ventas` los tres `<article>` de resumen (“Ventas hoy”, “Cobrado confirmado”, “Por cobrar digital”) no tienen encabezado ni `aria-label`.
- Evidencia: `../EVIDENCIAS/a11y-landmarks.json`.
- Recomendación: `aria-label="Marca y navegación"` al aside; `aria-labelledby` o `<h2>` en cada tarjeta de resumen.

### P3-5 — Preferencias de accesibilidad escondidas en la Caja clásica
- Tamaño de texto y alto contraste se ajustan en la Caja clásica (`/?ayuda=1#ajustes`); en el shell nuevo el enlace se llama **“Ajustes”** y no menciona accesibilidad. La preferencia guardada sí se aplica en `/caja` y `/ventas` vía `localStorage`, pero no hay control directo en la Caja nueva. No es un fallo WCAG; es descubribilidad.
- Recomendación: enlace “Accesibilidad” en el pie/sidebar de ambas rutas, o mover el control al shell compartido.

### Observación (no hallazgo) — targets
- Todos los controles visibles son ≥44×44 px salvo **“Caja clásica”**: 68×15 en escritorio y 297×34 en móvil. Es un enlace dentro de una frase, por lo que cae en la excepción “inline” de 2.5.8; no lo cuento como fallo. Los botones, summaries, links de paginación, nav y campos están a 44–64 px.

---

## 8. Lo que sí pasa (confirmado con evidencia)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| **1 `main`** | `/caja` → `#caja-main`; `/ventas` → `#ventas-main`. Tras paginar sigue habiendo 1 `main` y 1 `h1` visibles. | `a11y-landmarks.json`, `a11y-pagination.json` |
| **1 skip link** | “Saltar al contenido” es el primer Tab; 48 px; Enter enfoca el `main` (`tabindex=-1`) con anillo de 3 px; no deja hash. | `a11y-tabs-desktop.json`, `a11y-caja-skip-focus.png` |
| **1 nav principal visible** | Escritorio: sidebar; móvil: tab bar. La otra está `display:none`. En `/ventas` hay además 1 `nav` de paginación **con nombre** (“Páginas de ventas”), que es correcta y no es doble shell. | `a11y-landmarks.json` |
| **1 `aria-current` visible** | 2 en DOM (sidebar + tab bar), 1 visible en cada viewport. | `a11y-landmarks.json` |
| **Sin doble shell** | No hay dos shells visibles; los `main/h1` ocultos de Next no aparecen en esta navegación. | `a11y-landmarks.json` |
| **Orden de tabulación** | Desktop: skip → marca → 7 destinos → Ayuda/Ajustes → topbar → total → conceptos → métodos → confirmar. Móvil: skip → topbar → contenido → tab bar. Sin trampas. | `a11y-tabs-desktop.json`, `a11y-tabs-mobile.json` |
| **Foco visible** | Anillo 3 px en todos los controles probados; sidebar usa blanco, contenido verde; no se pierde en `display:none`. | capturas y JSON de tabs |
| **Foco no tapado** | Con venta válida, a 360×740 y 360×400 simulando teclado, ningún foco quedó bajo paybar/nav; paybar y nav se tocan 1 px (visual, no foco). A 360×400 dos métodos quedaron 8 px cortados arriba (observación de simulación, no fallo confirmado). | `a11y-valid-tabs.json`, `a11y-tabs-mobile.json` |
| **Foco tras agregar** | Va al `input` Concepto de la línea nueva. | `a11y-forms.json` |
| **Foco tras eliminar** | Va a la línea vecina o a “Producto o servicio”; no se pierde. | `a11y-forms.json` |
| **Foco tras confirmar** | Va al `h2#mc-caja-result-title` (“Venta cobrada en efectivo (demo)”). | `a11y-confirm-focus.json`, `a11y-caja-result-focus.png` |
| **Foco tras “Revisar cobro”** | Va al método activo (`Efectivo`); no queda bajo la paybar. | `a11y-revisar-cobro.json` |
| **“Más”** | Enter abre; Tab entra a Corte/Metas/Pendientes/Ayuda/Ajustes; Escape cierra y devuelve foco al `summary`; panel dentro del viewport. | `a11y-mas.json`, `a11y-caja-mas-open.png` |
| **Labels de formulario** | Todos los inputs tienen nombre accesible (Producto, Cantidad, Precio, Efectivo recibido, Monto a fiado, Cliente). | `a11y-forms.json`, `a11y-forms-extra.json` |
| **Errores de línea** | Cantidad/precio de una línea sí reciben `aria-invalid` + `aria-describedby` y el texto correcto. | `a11y-forms.json` |
| **Métodos** | Botones con `aria-pressed` y `fieldset/legend` “Cómo se paga”; selección por teclado funciona. | `a11y-axe.json` |
| **Estados con texto** | DEMO, PENDIENTE, FIADO, Saldado, Parcial, Cambio, “Demo, no es dinero real” no dependen solo del color. | `a11y-axe.json`, capturas de `/ventas` |
| **Contraste normal** | `ink/surface 15.2`, `ink-2/surface 6.94`, `placeholder/surface 5.89`, `attention/saffron 7.28`, `info/blue 9.25`, `green/green-soft 10.46`, `white/accent 11.86`. Todos ≥4.5 (texto normal). | tabla propia + `a11y-axe.json` |
| **Reduced motion** | `prefers-reduced-motion: reduce` deja transiciones en `1e-05s`, scroll `auto`; no hay animación esencial. | `a11y-context.json`/medición |
| **Alto contraste de la app** | `data-contrast="high"`: negro/blanco, bordes y foco visibles; no se pierde texto. | `a11y-caja-high-contrast.png` |
| **Reflow con zoom de navegador** | 640×400 y 512×320 con montos máximos: `scrollWidth == clientWidth`; sin scroll horizontal. | `a11y-text-resize.json` |
| **320 normal** | `/ventas` y `/caja` sin scroll horizontal; targets principales ≥44. | `a11y-text-resize.json` |

**axe-core 4.14.0:** 0 `violations` en 10 estados normales (Caja vacía, venta válida, error de agregar, payment, result demo, móvil con línea, Ventas p1/p2/móvil, alto contraste). Incompletos: `aria-prohibited-attr` en `.inicio-demo` y `color-contrast` en 9 nodos del sidebar por gradiente. En forced-colors axe reportó 10 `color-contrast`; **no los uso como veredicto** porque la emulación sustituye los colores del autor; el hallazgo P2-2 se basa en estilos computados idénticos.

---

## 9. Evidencia

Todo en `quality-reports/oleada-b-review/EVIDENCIAS/` con prefijo `a11y-`:

| Archivo | Para qué |
|---|---|
| `a11y-context.json` | HEAD, buildSha, tools, viewports, caveat de datos compartidos |
| `a11y-axe.json` | Matriz axe por estado |
| `a11y-tabs-desktop.json` / `a11y-tabs-mobile.json` / `a11y-tabs-mobile-empty.json` | Orden de tabulación, skip, foco y cobertura |
| `a11y-forms.json` | Error de agregar, error inline, foco add/remove |
| `a11y-forms-extra.json` | Hints sin `aria-describedby`, nodo DEMO en AX |
| `a11y-pagination.json` | Foco teclado/puntero tras paginar |
| `a11y-text-resize.json` | Texto 200 %, zoom navegador, 320, nav 360 |
| `a11y-forced-colors.json` | Estados computados de métodos y foco |
| `a11y-payment.json` | Estado PENDIENTE sin `role`/`aria-live`, foco en h2 |
| `a11y-max-amounts.json` | Solape paybar/CTA con monto máximo |
| `a11y-restore-focus.json` | Pérdida de foco al descartar borrador |
| `a11y-revisar-cobro.json` | Foco al método activo tras “Revisar cobro” |
| `a11y-landmarks.json` | Conteo de landmarks y `aria-current` |
| `a11y-reduced-motion.json` | Verificación de `prefers-reduced-motion` |
| `a11y-caja-*.png` | Capturas de skip, error, pago, resultado, 200 %, HCM, paybar, “Más” |
| `a11y-ventas-*.png` | Lista/estados, pager sin foco visible, 320 + texto 200 % |

**Caveat de datos:** el servidor :3100 es compartido. Durante la auditoría el número de órdenes cambió de 15 → 70 → 125 por actividad de otros revisores. Los conteos de paginación (“125, página 1 de 5”) son de esa ventana; los hallazgos de layout, formularios y foco se reproducen sin depender del número de filas. No escribí en la base: la confirmación de venta se probó con `route.fulfill` sobre `POST /api/orders` y la vista de pago sembrando un ID pendiente existente en `localStorage` (solo GET).

---

## 10. Reproducciones mínimas

1. **Texto 200 % (P1-1):** `/caja` → agregar línea normal → `document.documentElement.style.fontSize='32px'` → mirar cabecera “CANTIDADPRECIO” y tab bar. En `/ventas?page=2` a 320: `document.documentElement.scrollWidth` = 337.
2. **Error de cantidad (P2-1):** `/caja` → Producto “Quesadilla”, Cantidad “0”, Precio “35” → Agregar → inspeccionar `aria-invalid` de Producto (`true`) y Cantidad (`null`).
3. **Forced colors (P2-2):** emular `forced-colors: active` → comparar `getComputedStyle` de los 4 botones de método: idénticos; solo cambia `aria-pressed`.
4. **Pago pendiente (P2-3):** sembrar un ID pendiente en `mercado-cero:caja-pending:v2` → recargar → foco en `h2` “Pedido …”; `.mc-caja-status` sin `role`/`aria-live`.
5. **Paginación (P1-2):** `/ventas` → foco en “Siguiente” → Enter → el foco sigue en “Siguiente” a `y≈4674` con `scrollY=0`; Tab → `BODY`.

---

## 11. No probado / límites

| No probado | Por qué importa |
|---|---|
| **NVDA, JAWS, VoiceOver, TalkBack, Narrator** | No puedo certificar anuncios reales, orden de lectura ni verbosidad. Los hallazgos de `aria-live`/nombre se basan en DOM/AX de Chromium. |
| **iOS Safari / Android Chrome reales + teclado virtual** | La simulación fue viewport 360×400; no reproduce `visualViewport`, safe-area ni el comportamiento del teclado. El riesgo de que la paybar tape el campo sigue abierto. |
| **Windows HCM real** | forced-colors emulado; no es lo mismo que HCM con tema de alto contraste. |
| **Teclado físico real / switch / voz** | Playwright emite eventos; no cubre repetición, teclas muertas, lectores de teclado ni control por voz. |
| **Firefox / WebKit** | Solo Chromium 156. `details/summary`, `:focus-visible` y Axe pueden variar. |
| **Zoom de navegador del usuario (menú)** | Emulado reduciendo el viewport CSS (640/512), no con el zoom real del navegador. |
| **Estados de resultado fiado/pendiente/parcial** | El resultado se probó con venta demo en efectivo y la lista con datos reales; no recorrí todos los resultados. |
| **WCAG completo** | No es una auditoría de conformidad ni un VPAT. Faltan 2.4.11/2.4.12, 2.5.x completos, 3.3.4, etc. |

---

## 12. Orden de corrección sugerido

1. **P1-1** texto 200 %: layout de líneas, tab bar y paybar; test de rectángulos disjuntos a 320/360 + 200 % y montos máximos.
2. **P1-2** foco de paginación: `RouteFocus`/foco al heading de la lista + anuncio de página.
3. **P2-1** asociación de errores del formulario de agregar.
4. **P2-2** estado de método en forced-colors.
5. **P2-3** estado de pago en `aria-live` y descripción del `h2`.
6. **P2-4** paybar con montos máximos.
7. P3 en una sola pasada de pulido (foco al descartar, hints, DEMO, landmarks, enlace de accesibilidad).

**No declaro Oleada B accesible ni conforme a WCAG 2.2 AA.** La base es sólida, pero P1-1 y P1-2 son fallos AA reproducibles y P2-2/P2-3 afectan decisiones de dinero.
