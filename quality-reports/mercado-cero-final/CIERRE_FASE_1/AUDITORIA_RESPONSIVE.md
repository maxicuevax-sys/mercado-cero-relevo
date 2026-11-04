# Auditoría responsive y navegación — Inicio

- **Agente:** `mc-shell-responsive`
- **Fecha de la pasada:** 2026-11-03
- **Modo:** SOLO LECTURA. No se editó código, datos ni configuración; no se hizo commit. El único archivo escrito dentro del repo es este informe; los scripts y capturas de verificación quedaron fuera del repo, en el directorio temporal.
- **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
- **Rama / HEAD:** `design/mercado-cero-v2` / `b8f127d`
- **Árbol:** sucio (modificados `web/src/app/inicio/inicio.css`, `web/src/app/inicio/page.tsx`, `web/src/app/layout.tsx`, `web/src/app/manifest.ts`, `web/src/components/caja-app.tsx` y assets; nuevos `web/src/assets/inicio/icons/`, logos y `quality-reports/`). El servidor auditado compila el árbol de trabajo actual, no un commit limpio.
- **Servidor:** `http://localhost:3100`, `/api/health` → `{"ok":true,"buildSha":"b8f127d85985fd519a0010128a1f42bf5346e24e","node":"v25.7.0"}`.
- **Referencia canónica:** `design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png` (1448×1086).
- **Comparación existente:** `quality-reports/mercado-cero-final/CIERRE_FASE_1/comparacion-1448.png` (2956×1166; panel derecho = app en 1448×1086, estado demo anterior con `$190.00` / `$120.00`; la pasada actual vio `$290.00` / `$180.00`).

## Veredicto

**APROBADO CON LIMITACIONES** para responsive/navegación de Inicio. La aprobación cubre el layout responsive; la navegación queda condicionada a corregir F2 (destinos), F1 (target móvil) y F4 (foco de la nav activa) antes de considerarla cerrada.

El layout resiste los seis anchos/estados pedidos: no hay scroll horizontal, el CTA del hero no se recorta en 390×844 ni 320×640, el título no se solapa con la ilustración, el sidebar/topbar no se pisan, Ayuda y Ajustes son visibles y clicables a 1366×768 y 1448×700, el reflow de 200 % no desborda y el KPI `$1,245.00` cabe en todas las variantes probadas. Tampoco se encontraron errores de página.

Las limitaciones que impiden aprobarlo sin reservas son concretas y medidas:

1. **Navegación semánticamente ambigua:** “Caja” y “Reportes” apuntan ambos a `/?tab=corte`; “Caja” no abre la pestaña Caja, y “Ventas” es la que aterriza en Caja (`page.tsx:50-68`).
2. **Objetivos táctiles:** la nav móvil mide **40 px** de alto (`inicio.css:901-908` y `:923-925`), por debajo de 44/48; la marca de Inicio en el topbar móvil de Caja mide **28×28** (`caja-app.tsx:7483-7490`). El CTA y “Ver todos” sí cumplen 48.
3. **Foco:** el anillo de la nav activa en modo normal es verde sobre verde (contraste **1.01–1.18:1**) y no se percibe; además, el foco de “Ajustes” se recorta por abajo en 1448×700, 1366×768 y en los estados de alto contraste a 1448×1086/700/1366 (`inicio.css:57-65`, `:175-185`, `:789-790`, `:1448-1453`).
4. **“Ver todos” lleva a Pendientes vacío** (“Aún no hay pendientes”) mientras Inicio muestra 3 tareas `fixture` con badge “Ejemplo” (`page.tsx:98-115`, `:318`).

No hay defectos que hagan recomendar `RECHAZADO`: no hay enlaces muertos, ni rotura de layout, ni recorte del CTA normal, ni overflow horizontal. Los fallos son de semántica de destinos, tamaño táctil, indicador de foco y consistencia de estado; el shell responsive sí resiste.

## Matriz de resultados

| # | Verificación | Estado | Resultado |
|---:|---|---|---|
| 1 | CTA del hero visible y no recortado a 390×844 y 320×640 | **PASS** | 133.2×48 en ambos; dentro del hero y del viewport; hit-test central OK. A 320×640 xlarge queda parcialmente bajo el pliegue, pero no recortado (ver §1). |
| 2 | Sin solapamiento título/ilustración; sin scroll horizontal | **PASS** | Intersección `h2`/arte = 0 en todos los estados; `html/body scrollWidth === clientWidth` en los 18 estados; 0 elementos fuera del viewport. |
| 3 | Sidebar/topbar; Ayuda y Ajustes visibles a 1366×768 y 1448×700; no ocultos por overflow | **PASS*** | Visibles y con hit-test central OK en ambos; sidebar `overflow-x:hidden`, `overflow-y:auto`; contenido a la altura exacta del viewport. *Foco de Ajustes recortado (F3). |
| 4 | Inicio activo; destinos Ventas/Fiados/Caja/Reportes; Ver todos; CTA a Caja; marca de Caja vuelve a Inicio | **FAIL** | Inicio activo, CTA a Caja y marca de vuelta funcionan. “Caja” y “Reportes” → `/?tab=corte`; “Caja” aterriza en **Corte**; “Ventas” aterriza en **Caja**. Ver §4. |
| 5 | Targets: CTA ≥48, “Ver todos” 48, nav ≥40/44/48 | **FAIL (44/48) / PASS (40 mínimo)** | CTA 48 móvil y 60 escritorio; “Ver todos” 48; nav 40 móvil, 46 en 1366/1448×700, 52 en 1448×1086. Cumple 40 y 44/48 según el viewport, pero no 44 en móvil ni 48 en escritorio corto. |
| 6 | Reflow 200 % y xlarge; KPI `$1,245.00` sin overflow | **PASS** | 724×543 y xlarge sin scroll horizontal ni solapamientos. `$1,245.00` cabe en las 4 tarjetas en 1448/1366/390/320/724 normal y xlarge; peor margen 15.1 px (320 xlarge). Ver §6. |
| 7 | Alto contraste: CTA, nav activa, foco visible, texto legible | **PASS en HC / FAIL de foco en normal** | HC: CTA/nav/texto 21:1; foco de nav activa amarillo `#f2c768` sobre negro = 13.14:1; foco de CTA y “Ver todos” visible. En modo normal el anillo de la nav activa es 1.01–1.18:1 e invisible (F4). |
| 8 | Estados vacíos / listas largas / importes grandes | **PASS (simulación DOM) / NOT RUN (datos reales)** | Vacío y lista de 15 filas simulados sin overflow ni solape. No se modificó el estado real. El destino real `/?tab=pendientes` sí es vacío y su layout no desborda. |
| 9 | Comparación con la referencia solo en 1448×1086 | **PASS (comparación ejecutada)** | Paridad estructural del grid; no es pixel-perfect: greeting ~60 px a la izquierda, nav 6 px más arriba, hero/sugerencia más arriba y copy/estado demo distintos. Ver §9. |

`PASS*` = PASS con salvedad documentada. Los estados compuestos separan la parte de alto contraste de la parte de modo normal. No hubo verificaciones **BLOCKED**. Las únicas **NOT RUN** son la modificación de datos reales para forzar vacío/lista larga/importe grande, el zoom nativo de la UI de Chrome (se emuló el reflow de 200 % con viewport CSS 724×543) y los layouts completos de los destinos Caja/Fiado/Corte/Meta/Pendientes.

## Método y evidencia

- Playwright Python + Chromium headless, `deviceScaleFactor=1`, viewport exacto por estado, `wait_until="networkidle"`, `document.fonts.ready` y 350–500 ms de asentamiento.
- Medidas con `getBoundingClientRect()`, `Range.getBoundingClientRect()` para el texto, `scrollWidth/clientWidth`, `elementFromPoint()` y `getComputedStyle()`.
- `xlarge`: `localStorage["mercado-cero:text-size"]="xlarge"` (clave que lee el script de `layout.tsx` y el shell de Caja). `high`: `localStorage["mercado-cero:contrast"]="high"`.
- Reflow 200 %: viewport CSS **724×543**, equivalente al área de layout de 1448×1086 al 200 %. No se usó el zoom de la UI de Chrome; se documenta como emulación.
- Simulación de estados: solo DOM (texto de KPI, filas clonadas, mensaje vacío). No se tocaron datos, API ni código.
- Artefactos frescos de esta pasada (fuera del repo, no copiados por ser solo lectura): `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-responsive-verify\`
  - `layout.json`, `navigation.json`, `kpi-injected.json`, `stress.json`, `axe.json`
  - capturas `base-*`, `xlarge-*`, `hc-*`, `focus-*`, `kpi-injected-*`, `stress-*`, `contrast-*`.
- Evidencia de repo (bajo `quality-reports/mercado-cero-final/`) que coincide en layout y medidas: `14_EVIDENCIAS/metricas/inicio-desktop-1448x1086.json` (CTA 220×60, sidebar 236, hero 538×304, nav 52, scroll 1448/1448), `.../inicio-mobile-390x844.json` (CTA 133×48, nav 40, scroll 390/390), `.../variantes/summary.json` (320/390/xlarge/HC) y `.../montos/resumen.json` (importes canónicos). La captura actual coincide con `14_EVIDENCIAS/capturas/inicio-desktop-1448x1086-viewport.png` y `inicio-mobile-390x844-viewport.png`; las diferencias son de datos demo (`$290.00`/`$0.00`/`$180.00`/17 % actuales frente a `$190.00`/`$120.00` anteriores), no de geometría.
- Axe (WCAG 2.0/2.1/2.2 AA + best-practice) en 1448×1086, 1448×700, 1366×768, 390×844, 320×640, 320×640 xlarge, 390×844 HC y 1448×700 HC: **0 violations**; en normal queda 1 `incomplete` de `color-contrast` (gradiente del sidebar), revisado manualmente en §7; en HC, 0 `incomplete`. Axe no evalúa la apariencia del anillo de foco, por eso F4 se midió aparte.

## 1. CTA del hero

Selector: `.inicio-hero__cta` (`inicio.css:541-557`; móvil `:1102-1108`).

| Viewport | Rect CTA (x, y, w, h) | Derecha / abajo | Hero | ¿Dentro del hero? | ¿En viewport inicial? |
|---|---|---:|---|---|---|
| 390×844 | 162.4, 711.7, 133.2, 48 | 295.6 / 759.7 | 12, 599.7, 366×190 | Sí | Sí |
| 320×640 | 128.5, 492.9, 133.2, 48 | 261.7 / 540.9 | 12, 384.1, 296×190 | Sí | Sí |
| 390×844 xlarge | 162.4, 546.9, 151, 48 | 313.4 / 594.9 | 12, 396.2, 366×210.8 | Sí | Sí |
| 320×640 xlarge | 128.5, 625.4, 151, 48 | 279.5 / 673.4 | 12, 467.5, 296×217.9 | Sí | **No inicialmente** (33.4 px bajo el pliegue); tras scroll de 45 px: 580.4–628.4, hit-test OK |
| 724×543 (200 %) | 296, 705.1, 133.2, 48 | 429.2 / 753.1 | 12, 550.9, 700×274.4 | Sí | No; requiere scroll vertical; tras scroll: 247.1–295.1, hit-test OK |
| 1448×1086 | 535, 646.1, 220, 60 | 755 / 706.1 | 260, 492.4, 537.5×304 | Sí | Sí |
| 1366×768 | 535, 593.2, 220, 60 | 755 / 653.2 | 260, 450.4, 514.8×280 | Sí | Sí |
| 1448×700 | 535, 604.1, 220, 60 | 755 / 664.1 | 260, 450.4, 537.5×280 | Sí | Sí |

- En 390 y 320 normales el CTA está **completamente dentro del hero y del viewport**; `hero.scrollWidth === hero.clientWidth` y `content.scrollWidth === content.clientWidth`.
- `elementFromPoint` en el centro devolvió el propio `<a>` en 390 y 320 (y en 320 xlarge/724 después de `scrollIntoView`). Los puntos de esquina caen fuera del radio de la píldora y devuelven `.inicio-hero__content`; es el comportamiento normal del `border-radius`, no un recorte.
- El hero usa `overflow:hidden` (para las esquinas redondeadas), pero el CTA está íntegramente dentro de su caja; no se recorta. Tampoco lo corta el `overflow-x:clip` del contenido.
- A 320 xlarge el CTA está inicialmente **parcialmente bajo el pliegue** (no recortado): 625.4–673.4 frente a un viewport de 640. Al hacer scroll queda completo y clickeable. Se documenta como salvedad de tamaño de texto, no como fallo del estado normal.

**Estado: PASS** en 390/320 normales; **PASS con salvedad** en xlarge (requiere scroll, no hay recorte).

## 2. Título del hero vs. ilustración y scroll horizontal

Selectores: `#inicio-hero-title` y `.inicio-hero__art` (`inicio.css:493-540`).

| Viewport | Rect título | Rect arte | Intersección | Separación horizontal |
|---|---|---:|---:|---:|
| 390×844 | 162.4, 629.7, 177.7×32 | 12, 599.7, 146.4×190 | 0 | 4.0 px |
| 320×640 | 128.5, 417.4, 155.5×28 | 12, 384.1, 112.5×190 | 0 | 4.0 px |
| 390×844 xlarge | 162.4, 408.2, 203.6×80 | 12, 396.2, 146.4×210.8 | 0 | 4.0 px |
| 320×640 xlarge | 128.5, 479.5, 167.5×70 | 12, 467.5, 112.5×217.9 | 0 | 4.0 px |
| 724×543 | 296, 623.1, 177.7×32 | 12, 550.9, 280×274.4 | 0 | 4.0 px |
| 1448×1086 | 535, 526.4, 249.7×45 | 260, 492.4, 269×304 | 0 | 6.0 px |

La comprobación usa las cajas `getBoundingClientRect()`; como la imagen usa `object-fit: contain`, la caja es conservadora. El título nunca entra en la caja de la ilustración. La separación de 4 px en móvil es estrecha, pero no hay solapamiento ni recorte. En alto contraste la ilustración se oculta por CSS (`inicio.css:1448-1453`), por lo que la intersección es 0.

Scroll horizontal: `document.documentElement.scrollWidth === clientWidth` y `body.scrollWidth === clientWidth` en **los 18 estados** (1448×1086, 1448×700, 1366×768, 390×844, 320×640, 724×543, cada uno normal/xlarge/HC). Ejemplos: 1448/1448, 1366/1366, 390/390, 320/320, 724/724. El escaneo de todos los elementos visibles buscando `rect.left < 0` o `rect.right > innerWidth` dio **0 elementos**; solo se excluyó `.inicio-skip` fuera de foco, que se posiciona con `translateY(-180%)` intencionalmente.

**Estado: PASS.** Advertencia: `.inicio-content` tiene `overflow-x: clip` (`inicio.css:339`), que evita que un desbordamiento interno se convierta en scroll; por eso se hizo el escaneo independiente de rectángulos y el hit-test del CTA, no solo la medida de `scrollWidth`.

## 3. Sidebar, topbar, Ayuda y Ajustes

Selectores: `.inicio-sidebar` (`inicio.css:57-70`), `.inicio-topbar` (`:203-322`), enlaces `.inicio-sidebar__foot .inicio-nav__item` (`page.tsx:177-185`).

| Viewport | Sidebar | Topbar | `overflow` sidebar | Ayuda (y..bottom) | Ajustes (y..bottom) | Gap inferior de Ajustes |
|---|---|---|---|---:|---|---:|
| 1448×1086 | 236×1086 | 236, 0, 1212×100 | x hidden, y auto; 1086/1086 | 674..726 | 728..780 | 306 px |
| 1448×700 | 236×700 | 236, 0, 1212×84 | x hidden, y auto; 700/700 | 606..652 | 654..700 | **0 px** |
| 1366×768 | 236×768 | 236, 0, 1130×84 | x hidden, y auto; 768/768 | 674..720 | 722..768 | **0 px** |
| 1448×1086 HC | 236×1086 | 236, 0, 1212×100 | x hidden, y auto; 1086/1086 | 980..1032 | 1034..1086 | **0 px** |
| 1448×700 HC | 236×700 | 236, 0, 1212×84 | x hidden, y auto; 700/700 | 606..652 | 654..700 | **0 px** |
| 1366×768 HC | 236×768 | 236, 0, 1130×84 | x hidden, y auto; 768/768 | 674..720 | 722..768 | **0 px** |
| 390×844 | 390×204 | 0, 204, 390×64 | visible; 204/204 | 12,156,79.1×40 | 95.1,156,86.3×40 | 648 px |
| 320×640 | 320×246 | 0, 246, 320×64 | visible; 246/246 | 12,198,79.1×40 | 95.1,198,86.3×40 | 402 px |

- Topbar y sidebar **no se superponen**: en escritorio la topbar empieza exactamente en `x=236`; en móvil empieza en `y=204/246`, debajo del sidebar.
- En 1448×700 y 1366×768 el último ítem queda exactamente en el borde inferior (`bottom === innerHeight`; 0 px de margen). El texto y el icono son visibles y el hit-test central devuelve el enlace; no está oculto por `overflow:hidden` porque el sidebar usa `overflow-y:auto` y su `scrollHeight === clientHeight`.
- **F3:** al enfocar “Ajustes” con teclado, el outline de 3 px con offset 2 px se extiende 5 px por debajo del viewport y la parte inferior del anillo se recorta. En 1366×768 el rect termina en 768 y el outline en 773; en 1448×700 termina en 700 y el outline en 705. En HC 1448×1086 el ítem termina en 1086 y el anillo también se recorta, porque al ocultarse `inicio-sidebar__art` el pie sube al fondo (`inicio.css:1448-1453`). La causa es `padding: 18px 14px 0` (`inicio.css:63`) sin `padding-bottom`/`scroll-padding-bottom` en el sidebar y el `margin-top:auto` del pie (`:175-185`).

**Estado: PASS** para “visibles y accesibles” (ambos enlaces son alcanzables y clicables); **FAIL menor de foco** por F3, detallado en §7.

## 4. Navegación y destinos

`/inicio` tiene `aria-current="page"` en Inicio. Se hizo clic real con Playwright en 1448×1086 y se repitió en 390×844 y 320×640; las URLs y pestañas activas fueron las mismas. Tabla con el estado de escritorio:

| Control | `href` | URL final | Activo / `h1` en destino | Resultado |
|---|---|---|---|---|
| Inicio (sidebar) | `/inicio` | `/inicio` | Inicio | **PASS**; activo correcto. |
| Ventas | `/?tab=caja` | `/?tab=caja` | **Caja** | Navega, pero la etiqueta “Ventas” aterriza en la pestaña Caja. |
| Fiados | `/?tab=fiado` | `/?tab=fiado` | **Fiado** | **PASS** de clic; etiqueta en plural, pestaña en singular. |
| Caja | `/?tab=corte` | `/?tab=corte` | **Corte** | **FAIL de semántica:** “Caja” no abre Caja; abre Corte. |
| Reportes | `/?tab=corte` | `/?tab=corte` | **Corte** | **FAIL / duplicado:** mismo destino que “Caja”; no hay URL, hash ni sección “Reportes” propia. El `aria-label` “Reportes del día, dentro de Corte” reconoce la agrupación, pero el usuario no llega a un bloque identificable como Reportes. |
| Ver todos | `/?tab=pendientes` | `/?tab=pendientes` | Pendientes | Navega; el destino real está vacío (“Aún no hay pendientes”) mientras Inicio muestra 3 ejemplos. |
| CTA “Registrar” | `/` | `/` | **Caja** | **PASS**. |
| “Ir a ventas” | `/` | `/` | **Caja** | **PASS** de clic; misma convención “ventas = Caja”. |
| Marca de Caja (desktop) | `/inicio` | `/inicio` | Inicio | **PASS**; `a.brand-lockup` mide 216×65. |
| Marca de Caja (topbar móvil) | `/inicio` | `/inicio` | Inicio | **PASS** a 390 y 320; el target mide **28×28**. |
| Ayuda (sidebar) | `/?ayuda=1` | `/?ayuda=1` | Caja + `role=dialog` | **PASS** de acceso; abre “Ayuda y ajustes”. |
| Ajustes (sidebar) | `/?ayuda=1#ajustes` | `/?ayuda=1#ajustes` | Caja + `role=dialog` | **PASS** de acceso; abre la misma hoja y posiciona `#ajustes`; no es una pantalla separada. |

Detalles y ambigüedades que quedan:

1. **“Caja” no va a Caja.** `page.tsx:58-62` asigna `href="/?tab=corte"` al ítem “Caja” (`aria-label="Caja y corte"`). La pestaña real “Caja” se alcanza con “Ventas” (`page.tsx:53`) y con el CTA “Registrar” (`page.tsx:306`).
2. **“Caja” y “Reportes” son el mismo destino.** Ambos usan `/?tab=corte` (`page.tsx:56-68`). “Reportes” no tiene URL, hash ni sección propia; la pantalla de Corte contiene “Corte de caja”, “Antes de cerrar”, “Cuenta el efectivo”, “Así va la caja” y “¿Cuadra con pey?”, no un título “Reportes”.
3. **“Ver todos” lleva a una lista vacía.** En Inicio la tarjeta muestra 3 `fixture` con badge “Ejemplo” y el aviso “Ejemplos demo; no son tareas reales. Se administran en Tareas.”; al pulsar “Ver todos” el destino `/?tab=pendientes` dice “Aún no hay pendientes.” Es una inconsistencia de estado/contenido, no del `href`.
4. **Ajustes y Ayuda comparten `?ayuda=1`.** Abren la misma hoja “Ayuda y ajustes”; Ajustes añade `#ajustes` y desplaza el contenido dentro de la hoja. Es aceptable si se busca una sola superficie, pero no son destinos independientes.
5. **“Productos” y “Proveedores”** son `<span class="inicio-nav__soon" aria-disabled="true">`, no enlaces (`page.tsx:149-160`); no hay ruta muerta, pero visualmente parecen navegación. No forman parte de los destinos pedidos.
6. **Target de la marca de Caja en móvil:** 28×28 (`caja-app.tsx:7483-7490`), por debajo de 44. Es un enlace de navegación real y se suma al hallazgo de objetivos táctiles.

**Estado: FAIL** de semántica/duplicidad de navegación, aunque todos los clics y la marca de vuelta funcionan. El fallo está en el mapeo, no en que los enlaces estén rotos.

## 5. Objetivos táctiles

| Objetivo | Viewport | Rect | Criterio | Estado |
|---|---|---|---|---|
| CTA hero `.inicio-hero__cta` | 390×844 | 133.2×48 | ≥48 | **PASS** |
| CTA hero | 320×640 | 133.2×48 | ≥48 | **PASS** |
| CTA hero | 390/320 xlarge | 151×48 | ≥48 | **PASS** |
| CTA hero | 1448×1086 / 1448×700 / 1366×768 | 220×60 | ≥48 | **PASS** |
| “Ver todos” `.inicio-pending__head a` | 390×844 | 81×48 | 48 | **PASS** |
| “Ver todos” | 320×640 | 81×48 | 48 | **PASS** |
| “Ver todos” | 320×640 xlarge | 90.8×50.8 (texto en 2 líneas) | 48 | **PASS** |
| “Ir a ventas” `.inicio-suggestion__cta` | 390/320 | 126.8×48 | ≥48 | **PASS** |
| “Ir a ventas” | 1448/1366 | 200×56 | ≥48 | **PASS** |
| Nav `.inicio-nav__item` | 1448×1086 | 208×52 | ≥48 | **PASS 48** |
| Nav / Ayuda / Ajustes | 1366×768 y 1448×700 | 208×46 | ≥44 / 48 | **PASS 44**; no llega a 48 |
| Nav / Ayuda / Ajustes | 390×844 | 67.6–96 × **40** | ≥44/48 | **FAIL 44/48**; cumple el mínimo absoluto de 40 |
| Nav / Ayuda / Ajustes | 320×640 | 67.6–96 × **40** | ≥44/48 | **FAIL 44/48**; cumple 40 |
| Nav xlarge | 390×844 | 74.5–110 × **40** | ≥44/48 | **FAIL 44/48** |
| Nav xlarge | 320×640 | 74.5–110 × **40** | ≥44/48 | **FAIL 44/48** |
| Marca Caja topbar móvil | 390/320 | 28×28 | ≥44 (si cuenta como navegación) | **FAIL** adicional |

El CTA y “Ver todos” son los dos objetivos que el pedido marcaba explícitamente a 48; ambos cumplen. El fallo principal es la barra de navegación móvil: el CSS baja a `min-height: 40px` en `@media (max-width:760px)` (`inicio.css:901-908`) y el pie repite 40 px (`:923-925`). No es un fallo de WCAG 2.5.8 (mínimo 24 px), pero sí del criterio HIG/solicitado de 44–48. En escritorio corto, los 46 px cumplen 44 pero no 48. En 724×543 (200 %) la nav también es la variante móvil de 40 px, así que el mismo criterio se incumple en reflow.

## 6. Reflow 200 %, xlarge y KPI `$1,245.00`

### Reflow 200 % (viewport CSS 724×543)

- `html.scrollWidth = clientWidth = 724`; `body` igual.
- 0 elementos visibles con rect fuera del viewport.
- Hero 700×274.4; título 177.7×32; arte 280×274.4; intersección 0; CTA 133.2×48 dentro del hero.
- El CTA queda inicialmente en y=705.1..753.1 (bajo 543), pero al hacer scroll queda completo y el hit-test da OK. El scroll vertical es el comportamiento esperado del reflow; no hay scroll horizontal.
- El layout cambia a la variante móvil porque el CSS viewport es 724 (<760). Es correcto para 200 % sobre 1448: no se exige conservar la disposición de escritorio, solo evitar overflow.
- xlarge + 724×543: mismas anchuras; CTA 151×48; sin overflow.
- HC + 724×543: CTA 137.2×48; sin overflow.

**Estado: PASS.**

### Texto xlarge (20 px root)

- 1448×1086: `scrollWidth 1448/1448`; hero 537.5×329.8; CTA 220×60 dentro; sin solapamiento.
- 1366×768: 1366/1366; hero 514.8×321.8; CTA 220×60 dentro; sin solapamiento.
- 390×844: 390/390; hero 366×210.8; título 203.6×80; arte 146.4; gap 4; CTA 151×48; sin overflow.
- 320×640: 320/320; hero 296×217.9; título 167.5×70; arte 112.5; gap 4; CTA 151×48; sin overflow.
- 320×640: el topbar pasa de 64 a 75.1 px; el orden del grid cambia a greeting → hero → kpis (regla `max-width:360px`, `inicio.css:1219-1235`). No hay solapamiento.
- 320×640: “Ver todos” pasa a dos líneas (50.8 px de alto); sigue siendo un objetivo válido. Los labels de KPI se parten en dos líneas; el bloque de sugerencia crece; todo el contenido queda legible.
- En 320 xlarge el CTA queda inicialmente bajo el pliegue (ver §1); al hacer scroll se ve completo.

**Estado: PASS** en el layout actual. La salvedad es que a 320 xlarge el CTA requiere scroll vertical y que el KPI depende de que el importe no crezca más allá de `$1,245.00`.

### KPI `$1,245.00` (inyección DOM; 4 tarjetas)

Se inyectó `textContent = "$1,245.00"` en las cuatro `.inicio-kpi__value` y se midió el texto con `Range` contra el content-box del `<p>` y contra el borde de la tarjeta. No se modificaron datos.

| Viewport | Fuente | Texto `$1,245.00` | Content-box `.inicio-kpi__value` | Tarjeta | Margen al borde de tarjeta | Resultado |
|---|---|---:|---:|---:|---:|---|
| 1448×1086 | 42 px | 199.7 | 227 | 268.8 | 47.1 | **PASS** |
| 1366×768 | 42 px | 199.7 | 215 | 257 | 35.3 | **PASS** |
| 390×844 | 24 px | 114.1 | 156 | 178 | 51.9 | **PASS** |
| 320×640 | 20 px | 95.1 | 126 | 144 | 38.9 | **PASS** |
| 724×543 (200 %) | 28 px | 133.1 | 323 | 345 | 199.9 | **PASS** |
| 1448×1086 xlarge | 47.3 px | 224.9 | 227 | 268.8 | 21.9 | **PASS** |
| 1448×700 xlarge | 47.3 px | 224.9 | 227 | 268.8 | 21.9 | **PASS** |
| 1366×768 xlarge | 45.4 px | 215.9 | 215 | 257 | 19.1 | **PASS**; el texto supera 0.9 px el content-box del `<p>`, pero queda 19.1 px dentro de la tarjeta y no se recorta (`overflow: visible`). |
| 390×844 xlarge | 30 px | 142.6 | 156 | 178 | 23.4 | **PASS** |
| 320×640 xlarge | 25 px | 118.9 | 126 | 144 | 15.1 | **PASS** |
| 724×543 xlarge | 30.4 px | 144.5 | 323 | 345 | 188.5 | **PASS** |

- El texto no genera scroll horizontal del documento en ningún caso (`html sw === cw`).
- El peor margen es **15.1 px** al borde de la tarjeta a 320×640 xlarge (**7.1 px** al content-box del `<p>`); el texto no se pinta fuera de la tarjeta. `.inicio-kpi` no tiene `overflow:hidden`; el texto queda visible y contenido.
- **Nota de evidencia:** la pasada previa reportaba que `$1,245.00` desbordaba a 320×640 xlarge con 142.6 px de texto. En esta pasada, a 320×640 xlarge el texto mide **118.9 px**; 142.6 px es la medida de **390×844 xlarge**. La medición previa no se reproduce. `montos/resumen.json` no incluye el caso 320-xlarge y su bandera `overflow` usa `scrollWidth`, que no detecta texto pintado fuera con `overflow: visible`; por eso aquí se usó `Range` + borde de tarjeta.
- A 1366×768 xlarge el texto es 0.9 px más ancho que el content-box del `<p>`; no hay recorte ni invasión del padding de la tarjeta (19.1 px de margen). Se recomienda prueba de regresión si se cambia la fuente o el importe.

**Estado: PASS** para `$1,245.00` en todos los casos pedidos.

## 7. Alto contraste y foco

### Contraste de texto (normal, calculado contra el fondo efectivo)

| Elemento | Color / fondo | Ratio |
|---|---|---:|
| CTA hero | `#004b3c` sobre `#fff0d2` | 9.00 |
| Nav activa | `#004b3c` sobre `#fff0d2` | 9.00 |
| Nav inactiva | `#dce9df` sobre gradiente `#064b3e`–`#003f31` | 8.05–9.55 |
| Hero título | `#fffdf7` sobre `#004b3c` | 9.97 |
| Hero párrafo | `#dce9df` sobre `#004b3c` | 8.09 |
| Sugerencia título | `#1d241f` sobre `#fdf3e4` | 14.43 |
| Sugerencia cuerpo | `#4d5851` sobre `#fdf3e4` | 6.75 |
| “Ver todos” | `#004b3c` sobre `#fdf3e4` | 9.23 |
| KPI valor | `#1d241f` sobre `#fdf3e4` | 14.43 |
| KPI nota | `#4d5851` sobre `#fdf3e4` | 6.75 |

Todos los textos principales superan 4.5:1. La nav inactiva se calculó contra los dos extremos del gradiente porque `getComputedStyle` devuelve `rgba(0,0,0,0)` en el fondo con gradiente; no es un fallo.

### Alto contraste (`data-contrast="high"`)

- CTA: 21:1 (negro sobre blanco).
- Nav activa: 21:1 (negro sobre blanco).
- Nav inactiva: 21:1 (blanco sobre negro).
- Hero título/párrafo: 21:1 (blanco sobre negro).
- Sugerencia y pendientes: 21:1 (negro sobre blanco).
- Aviso fixture conserva `#8f2d1c` sobre blanco: 8.2 (pasa).
- Avatar: 20.65; sello DEMO 21.
- La ilustración del hero y de sugerencia se ocultan por CSS en el modo HC de la app (`inicio.css:1448-1453`); el hero pasa a una columna y la sugerencia a una columna. Es una degradación visual intencional, legible y sin overflow. También se emuló `forced-colors: active` a 1448/390/320: `scrollWidth === clientWidth` y CTA dentro del hero, sin overflow. En esa emulación los colores y el arte se conservan porque el shell usa `forced-color-adjust:none`; no debe confundirse con `data-contrast="high"`, que sí oculta el arte.

**Estado HC: PASS** de contraste y legibilidad.

### Foco

| Elemento | Modo normal | Alto contraste | Resultado |
|---|---|---|---|
| CTA hero | outline blanco 3 px, offset 2; visible sobre verde | outline blanco 3 px; visible sobre negro | **PASS** |
| Nav activa | outline verde `#004b3c` 3 px; el anillo queda fuera de la píldora crema, sobre el sidebar `#064b3e`–`#003f31`: **1.01–1.18:1** | outline amarillo `#f2c768`; 13.14:1 sobre negro | **FAIL en normal**; PASS en HC |
| Nav inactiva | outline blanco 3 px; 8.05–9.55:1 | outline blanco; 21:1 | **PASS** |
| “Ver todos” | outline verde 3 px; 9.23:1 sobre crema | outline negro; 21:1 | **PASS** |
| “Ajustes” | outline blanco 3 px; visible, pero se recorta por abajo en 1448×700 y 1366×768 | outline blanco; también se recorta en HC 1448×1086/700/1366 | **FAIL de recorte** (F3) |
| Skip link | outline verde 3 px; visible al primer Tab; 172.8×48 en (12,10) | visible | **PASS** |

- **F4 (nuevo):** la captura de foco de Inicio a 1448×700 no muestra el anillo: el CSS pinta `outline-color: var(--inicio-green)` para `[aria-current="page"]:focus-visible` (`inicio.css:789-790`), pero el anillo se dibuja con `outline-offset: 2px` fuera de la píldora crema y cae sobre el sidebar verde. El ratio calculado es 1.01:1 contra `#064b3e` y 1.18:1 contra `#003f31`; el anillo no se distingue. En HC el override amarillo sí funciona (13.14:1) y la captura lo muestra.
- Secuencia de Tab a 1448×700 y 1366×768: skip → marca → Inicio → Ventas → Fiados → Caja → Reportes → Ayuda → Ajustes → Registrar → Ver todos → Ir a ventas → body. No hay trampa de foco. Solo “Ajustes” tiene `bottomClipped: true`.
- **F3:** el foco de “Ajustes” termina exactamente en el borde inferior del viewport (700/768/1086 en HC) y el outline de 3 px + offset 2 px se recorta. Se ve el anillo superior/lateral, no el inferior. Es consecuencia de `padding: 18px 14px 0` (`inicio.css:63`) y del `margin-top:auto` del pie, sin `padding-bottom`; en HC se agrava porque el arte del sidebar se oculta y el pie sube al fondo.

**Estado: PASS de contraste y foco en HC; FAIL del indicador de foco de la nav activa en modo normal; FAIL de recorte del foco de Ajustes.**

## 8. Estados vacíos, listas largas e importes grandes

**Estado real actual:** modo demo; KPIs `$290.00`, `$0.00`, `$180.00`, meta 17 %; 3 tareas `fixture` con badge “Ejemplo”. No hay vacío, lista larga ni importe grande en los datos actuales de Inicio. Para esos tres casos el estado real es **NOT RUN**.

Se hizo una simulación exclusivamente DOM (sin tocar datos/API/código):

| Caso | Resultado | Evidencia |
|---|---|---|
| Vacío: quitar lista y aviso fixture, insertar `.inicio-pending__empty` | **PASS** | Pendientes 304 px de alto en 1448, 112.6 px en 390/320; mensaje 336/266 px de ancho; `sw === cw`; sin solapamiento con sugerencia (gap 12–20 px). |
| Lista larga: 15 filas, títulos largos y horas/importes | **PASS** | Pendientes 1069.2 px en 1448, 884.4 en 390, 915.9 en 320, 1274.9 en 320 xlarge; sugerencia baja debajo; sin solapamiento (`pending.bottom < suggestion.top`); `sw === cw`; 0 elementos fuera del viewport. |
| Importes `$1,245.00` | **PASS** | Ver §6; cabe en todas las variantes. |

- **Vacío real en destino:** `/?tab=pendientes` a 1448/390/320 muestra “Aún no hay pendientes.” con `sw === cw` y el mensaje dentro del panel (1096.5/320/250 px de ancho). El layout del vacío real es correcto; la inconsistencia es que Inicio muestra 3 ejemplos y el destino no los muestra.
- **Lista larga real:** no probada; solo simulación. **NOT RUN.**
- **Importe grande real:** no probado; solo `$1,245.00` inyectado en DOM. **NOT RUN.**
- No se modificó el registro real para forzar estos estados.

**Estado: PASS en simulación; NOT RUN en datos reales de Inicio.** El vacío real de Pendientes, que sí se puede observar sin tocar datos, no desborda.

## 9. Comparación con la referencia (1448×1086)

Ruta/estado comparado: `/inicio`, 1448×1086, estado actual (demo: “Datos demo”, 3 tareas “Ejemplo”, fecha martes 3 de noviembre). La referencia es la lámina canónica estática de Lupita con otros importes/fecha; por tanto la comparación es **estructural**, no de contenido.

- La captura actual coincide en **layout** con el panel derecho de `comparacion-1448.png` (misma app, build `b8f127d` + cambios de trabajo), pero el panel está en un estado demo anterior: `$190.00` / `$120.00` frente a `$290.00` / `$180.00` de la pasada actual. La captura de repo `14_EVIDENCIAS/capturas/inicio-desktop-1448x1086-viewport.png` también coincide en layout; su diferencia es de datos demo, no de geometría.
- Grid y medidas que coinciden: sidebar 236 px (referencia ≈241), topbar 100 px, contenido de 1129 px, 4 KPIs desde y=260, hero 537.5×304, pendientes 573.5×304, sugerencia 1129×211. La estructura de dos columnas hero/pendientes y la fila de 4 KPIs es equivalente.
- Diferencias medidas/visibles:
  - **Greeting desplazado a la izquierda:** el `h1` actual empieza en x=340 (texto oscuro desde x≈344); en la referencia empieza en x≈401. Diferencia ≈57–61 px. El sol actual está en x=260; la referencia lo sitúa en x≈275. El bloque actual no tiene el padding izquierdo de la referencia.
  - **Ritmo del sidebar:** la píldora activa actual mide 52 px y va de y=206.9 a 258.9; la referencia mide ≈58 px y va de y≈213 a 270. La navegación actual está ≈6 px más arriba y 6 px más comprimida; el pie (Ayuda/Ajustes) también queda más arriba en 1448×1086.
  - **Hero:** el hero actual empieza en y=492.4; la referencia ≈500. El título actual está en y=526 y el CTA en y=646; en la referencia el título está más abajo (≈570) y el CTA ≈676. La referencia no tiene la línea descriptiva que el actual añade; su píldora “Registrar” es más ancha (≈248 px frente a 220 px actuales).
  - **Sugerencia:** actual empieza en y=816.4; referencia ≈840; actual no tiene el icono de destello y usa “Tu negocio, en orden.” / “Ir a ventas +”, mientras la referencia usa “Agrega un producto nuevo.” / “Agregar +”. El contenido actual empieza en x=633; la referencia ≈670.
  - **Fondo/final:** el contenido actual termina en y≈1027.4; la referencia ≈1051. El actual conserva más aire inferior.
  - **Estado/copy:** fecha, “Datos demo” (no está en la referencia), “Ejemplo” en tareas, “DEMO”, notas explicativas en KPI, importes y meta distintos, “Mi primera sombrilla”. Son diferencias de estado demo, no de responsive.
- La comparación se ejecutó solo a 1448×1086, como se pidió; no se usó para evaluar móvil, HC o reflow.

**Estado: PASS de comparación ejecutada; paridad visual parcial.** La estructura está alineada, pero no es pixel-perfect: greeting, ritmo del sidebar y composición vertical del hero/sugerencia difieren de la referencia.

## Hallazgos priorizados

| ID | Severidad | Hallazgo | Archivo / selector | Impacto |
|---|---|---|---|---|
| F1 | Media | Nav móvil de 40 px de alto; no cumple 44/48. | `web/src/app/inicio/inicio.css:901-908`, `:923-925` (`.inicio-nav__item`, `.inicio-nav__soon`) | Objetivo táctil por debajo de HIG; en 320 xlarge hay 4 filas de 40 px. |
| F2 | Media | “Caja” y “Reportes” apuntan a `/?tab=corte`; “Caja” no abre la pestaña Caja; “Ventas” abre Caja. | `web/src/app/inicio/page.tsx:50-68` (`href: "/?tab=corte"`) | Destino ambiguo/duplicado; el usuario que busca Caja aterriza en Corte. |
| F3 | Media-baja | Anillo de foco de “Ajustes” recortado en 1448×700, 1366×768 y HC 1448×1086/700/1366; el ítem termina exactamente en el borde. | `inicio.css:57-65` (`.inicio-sidebar { padding: 18px 14px 0 }`), pie `:175-185`; HC oculta arte `:1448-1453` | Indicador de foco incompleto; último objetivo pegado al borde. |
| F4 | Media | Foco de la nav activa invisible en modo normal: outline verde sobre sidebar verde, 1.01–1.18:1. | `inicio.css:789-790` (`.inicio-nav__item[aria-current="page"]:focus-visible { outline-color: var(--inicio-green) }`) | El usuario que tabula no percibe el foco en Inicio; en HC sí se ve (amarillo 13.14:1). |
| F5 | Baja | “Ver todos” conduce a Pendientes vacío mientras Inicio muestra 3 ejemplos. | `page.tsx:98-115`, `:318` (`Ver todos`), fixtures en `:104-115` | Inconsistencia de estado/expectativa; no es un enlace roto. |
| F6 | Baja | Marca de Inicio en topbar móvil de Caja mide 28×28. | `web/src/components/caja-app.tsx:7483-7490` | Objetivo táctil pequeño para volver a Inicio desde Caja. |
| F7 | Baja | Paridad visual con la referencia: greeting ≈60 px a la izquierda, nav 6 px más arriba y 6 px más comprimida, hero/sugerencia más arriba, copy distinto. | `inicio.css:357-405`, `:493-556`, `:699-770`; `page.tsx:230-362` | No rompe responsive; sí baja la fidelidad al rescate visual. |

No se mantiene el hallazgo previo de desbordamiento de `$1,245.00` a 320 xlarge: la medición fresca da 118.9 px de texto contra 126 px de content-box y 144 px de tarjeta (15.1 px de margen). Se deja como recomendación de regresión, no como FAIL actual.

## Recomendaciones (sin aplicar)

1. Subir `.inicio-nav__item`/`.inicio-nav__soon` a `min-height: 44px` o `48px` en móvil (`inicio.css:901-908`, `:923-925`) y revisar 320 xlarge; mantener separación entre filas. Si se busca HIG estricto, usar 48 en todos los breakpoints y 52 en 1448×1086.
2. Corregir el mapeo: “Caja” → `/?tab=caja`; dar a “Reportes” una URL/hash/sección propia dentro de Corte, o renombrar “Caja” a “Corte” si la intención es el corte de caja. Homologar “Fiados”/“Fiado” y revisar que “Ventas” no confunda al abrir Caja.
3. Añadir `padding-bottom`/`scroll-padding-bottom` de 8–12 px al sidebar y comprobar el anillo de foco del último ítem en 1366×768, 1448×700 y HC 1448×1086.
4. Cambiar el color del anillo de la nav activa en modo normal: usar blanco/maíz con offset 2 px (como en HC) o un anillo interior sobre la píldora crema; verificar ≥3:1 contra el sidebar y que no se confunda con el estado activo.
5. Resolver la inconsistencia de “Ver todos”: o el destino muestra las tareas de ejemplo, o el enlace se oculta/etiqueta como “Ver ejemplos” cuando la lista es fixture.
6. Ampliar el target de la marca de Inicio en el topbar móvil de Caja a ≥44×44 (mantener el icono de 28 px dentro).
7. Añadir una prueba de regresión de `$1,245.00` en 320×640 xlarge y 1366×768 xlarge; no se requiere cambio de CSS para el estado actual, pero el margen de 1366 xlarge es de solo 0.9 px sobre el content-box del `<p>` (19.1 px hasta el borde de la tarjeta). Si se busca más holgura, usar `min()`/container query en `.inicio-kpi__value` (`inicio.css:459-469`, `:1063-1065`, `:1237-1238`).
8. Si se busca paridad con la referencia, ajustar el padding izquierdo del greeting, el ritmo del sidebar y la alineación vertical del contenido del hero/sugerencia; la comparación actual es estructural, no pixel-perfect. No es un requisito de responsive.

## Resumen final

- **Responsive de Inicio:** sólido en los casos base; sin scroll horizontal, sin recorte del CTA normal, sin solape título/arte, con reflow y xlarge correctos y KPI `$1,245.00` contenido en todas las variantes medidas.
- **Navegación:** funcional en clics, pero con deuda de semántica (`Caja`/`Reportes` → `Corte`, `Caja` no abre Caja) y una inconsistencia de estado (`Ver todos` → Pendientes vacío).
- **Accesibilidad:** contraste de texto correcto en normal y HC; déficit de target móvil de 40 px, anillo de foco de nav activa invisible en normal y foco de “Ajustes” recortado en alturas cortas/HC.
- **Datos extremos:** `$1,245.00` no desborda; vacío y lista larga simulados no desbordan. Los estados reales de datos distintos de `$1,245.00` quedan **NOT RUN**.
- **Veredicto:** **APROBADO CON LIMITACIONES**.
