# Auditoría de accesibilidad — Inicio (Mercado Cero)

**Rol:** `mc-accesibilidad` · **Modo:** solo lectura (sin ediciones de código ni commits)
**Fecha de reauditoría:** 2026-11-03
**Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
**Rama:** `design/mercado-cero-v2` · **HEAD:** `b8f127d`
**Servidor auditado:** `http://localhost:3100` · **buildSha:** `b8f127d85985fd519a0010128a1f42bf5346e24e`
**Árbol de trabajo:** sucio; el servidor corre desde el árbol actual. `buildSha` no autentica el CSS/TSX no commiteado. Archivos relevantes: `web/src/app/inicio/inicio.css`, `web/src/app/inicio/page.tsx`, `web/src/app/layout.tsx` (nuevo cambio), `web/src/components/caja-app.tsx`, `manifest.ts` y assets de Inicio.
**Herramientas:** Playwright Python 1.64.0 · Chromium 156.0.8078.4 · axe-core 4.14.0 · Python 3.14.3.
**Rutas:** `/inicio` (principal), `/` (regresión Caja) y `/?tab=fiado|corte|meta|pendientes`.
**Referencia visual:** `design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png` (solo contexto; no se usó para medir accesibilidad).

> **Esto no es una certificación WCAG.** Es una auditoría técnica con evidencia reproducible. La prueba con lector de pantalla real sigue **NOT RUN** y Windows High Contrast real no se pudo activar en esta máquina (tema inactivo, `HKCU\Control Panel\Accessibility\HighContrast\Flags = 126`).

---

## Veredicto

| Ámbito | Veredicto |
|---|---|
| `/inicio` en modo normal | **APROBADO CON LIMITACIONES** |
| `/inicio` con `data-contrast=high` | **APROBADO CON LIMITACIONES** |
| `/inicio` con `forced-colors: active` | **APROBADO CON LIMITACIONES**: P1 de bloques blancos **resuelto**; sin regresión visual en 1448/390/320 |
| Certificación WCAG | **NO EMITIDA**: lector de pantalla real **NOT RUN** |
| Caja (`/`) frente al baseline | **Sin regresiones nuevas**; conserva un fallo preexistente de `label-content-name-mismatch` y un objetivo de 28×28 preexistente |

**Lectura corta:** el P1 de `forced-colors` quedó resuelto. La ruta de arranque con `forced-colors` activo aplica `data-contrast=high` + `forced-color-adjust:none` y muestra texto legible negro/blanco; la ruta de alternancia posterior al load conserva la paleta normal y también es legible. Axe da 0 violaciones en normal y en las dos variantes de forced-colors. No hay P1 restante. Quedan P2 de diseño/semántica (nav móvil 40 px, “Productos/Proveedores”, estado “hecho”) y la prueba real con lector de pantalla; por eso el veredicto es **APROBADO CON LIMITACIONES**, no APROBADO limpio.

### Checklist de los 10 puntos

| # | Punto | Resultado | Nota |
|---:|---|---|---|
| 1 | axe-core en 1448/390/320 + alto contraste | **PASS** | 0 violaciones en normal, `data-contrast=high`, forced-colors startup y post-load; incompletos de gradiente resueltos a mano |
| 2 | Skip link | **PASS** | Primer Tab, 48 px, Enter a `<main>`, sin trampa |
| 3 | Foco visible (sidebar, nav activa, CTA, Ver todos, hero, sugerencia) | **PASS** | Outline 3 px, contrastes 9–21:1; también en forced-colors |
| 4 | Orden de tabulación, landmarks, `aria-current`, nombres, iconos | **PASS** con 2 fallos parciales | F-02 (Productos/Proveedores) y F-03 (estado hecho) |
| 5 | Texto large/xlarge + 200 % zoom | **PASS** | Sin overflow ni recorte en 1448/390/320/724 y en HC+xlarge |
| 6 | Contraste real, no solo color, estados demo/fiado | **FAIL parcial** | Todo pasa salvo F-02 (3.64–4.07:1) y F-03 (estado no anunciado) |
| 7 | Objetivos táctiles ≥44/48; “Ver todos” 48 | **FAIL parcial** | Nav móvil 40 px (F-01); “Ver todos” 48 px **PASS** |
| 8 | Formularios, errores, QR; hidratación de Ayuda | **N/A en Inicio; PASS en Caja/Ayuda** | Sin formularios/QR en Inicio; `?ayuda=1` sin errores de hidratación |
| 9 | Movimiento reducido | **PASS** | 135 elementos, 0 movimiento; scroll auto |
| 10 | Lector de pantalla real | **NOT RUN** | NVDA/TalkBack/VoiceOver no disponibles; Narrator no ejercitado |

---

## 1. axe-core en `/inicio`

**Configuración:** `axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } })`; Chromium headless; sin animaciones; `document.fonts.ready` y espera de 300–500 ms.

| Caso | Viewport | Modo | Violaciones | Passes | Incomplete |
|---|---|---:|---:|---:|---:|
| `inicio-1448-normal` | 1448×1086 | normal | **0** | 36 | 1 regla / **7 nodos** |
| `inicio-390-normal` | 390×844 | normal | **0** | 36 | 1 regla / **7 nodos** |
| `inicio-320-normal` | 320×640 | normal | **0** | 36 | 1 regla / **8 nodos** |
| `inicio-1448-dc-high` | 1448×1086 | `data-contrast=high` | **0** | 36 | 0 |
| `inicio-390-dc-high` | 390×844 | `data-contrast=high` | **0** | 36 | 0 |
| `inicio-320-dc-high` | 320×640 | `data-contrast=high` | **0** | 36 | 1 regla / 1 nodo |
| `inicio-1448-forced-startup` | 1448×1086 | forced-colors antes de navegar | **0** | 36 | 0 |
| `inicio-390-forced-startup` | 390×844 | forced-colors antes de navegar | **0** | 36 | 0 |
| `inicio-320-forced-startup` | 320×640 | forced-colors antes de navegar | **0** | 36 | 1 regla / 1 nodo |
| `inicio-1448-forced-postload` | 1448×1086 | forced-colors después del load | **0** | 36 | 1 regla / 7 nodos |
| `inicio-390-forced-postload` | 390×844 | forced-colors después del load | **0** | 36 | 1 regla / 7 nodos |
| `inicio-320-forced-postload` | 320×640 | forced-colors después del load | **0** | 36 | 1 regla / 8 nodos |

**Incomplete relevantes (no son violaciones):**
- 1448/390 normal: `color-contrast` en marca + 6 textos del sidebar no puede determinar el fondo por el **gradiente** `#064b3e → #003f31`. Se resolvió a mano: nav 8.05:1 en el tope y 9.55:1 en el fondo; marca 9.91–11.76:1. **PASS**.
- 320 normal: los 7 anteriores + `.inicio-topbar__name` “parcialmente oscurecido por otro elemento”. La medición real es negro `#000` sobre blanco `#fff` en HC = **21:1**; en normal `#1d241f` sobre `#fbefe2` = **14:1**. Es un falso positivo de axe por el chevron/acciones del topbar. **PASS**.

**Lectura de los dos caminos de forced-colors:**
- **Startup real:** `forced-colors` activo antes de navegar → el script inline de `layout.tsx` fija `data-contrast=high`; el shell aplica `forced-color-adjust:none`; la captura independiente es negro/blanco, sin bloques; axe 0.
- **Post-load (método de `audit_capture.py`):** `forced-colors` se activa después del load → el script inline ya no corre; `data-contrast` queda `null`; `forced-color-adjust:none` conserva la paleta normal; la captura es legible y axe 0. **La captura final `.../capturas/inicio-desktop-1448x1086-hc-viewport.png` corresponde a este camino post-load** (por eso se ve la paleta normal, no la negra/blanca). No es un fallo de accesibilidad, pero no documenta la rama del script inline. Ver §11.

---

## 2. Skip link

| Comprobación | Resultado | Evidencia independiente |
|---|---|---|
| Primer `Tab` enfoca el skip link | **PASS** | Activo: `A.inicio-skip`, texto “Saltar al contenido”, `href="#inicio-main"`, rect `12,10 172.8×48` a 1448; `12,10 172.8×48` a 390/320 |
| Texto y foco visibles | **PASS** | `transform: none`; outline `3px solid #004b3c`, offset 2; fondo blanco, texto negro; 48 px de alto |
| `Enter` mueve el foco a `<main>` | **PASS** | Activo: `MAIN#inicio-main`; `hash=#inicio-main`; outline `3px solid #004b3c`; `scrollY=0` a 1448, `256` a 390 y `298` a 320 (el main queda visible bajo el sidebar móvil) |
| Sin trampa | **PASS** | Tras `Enter`, el siguiente `Tab` va a `A.inicio-hero__cta` “Registrar”; la secuencia continúa y luego pasa a `BODY` y vuelve al skip. No hay bucle ni foco atrapado |
| En Caja (`/`) | **PASS** | Primer Tab: “Saltar al contenido” `#main` 48 px; Enter enfoca `MAIN#main`; mismo comportamiento |

**Evidencia previa consistente:** `14_EVIDENCIAS/navegacion/resumen.json` (checks “primer Tab = saltar al contenido”, “Enter mueve foco a main”, `skip-link-focus-1448.png`). **Reproducido de forma independiente.**

---

## 3. Foco visible

Secuencia de tabulación a 1448×1086 (normal):

| # | Elemento | Outline medido | Contraste del indicador |
|---:|---|---|---:|
| 1 | Saltar al contenido | 3 px `#004b3c` offset 2 | 9.21:1 (sobre papel) |
| 2 | Marca “Mercado Cero” | 3 px `#fffdf7` offset 2 | 9.91:1 (sobre sidebar) |
| 3 | Inicio (`aria-current=page`) | 3 px `#004b3c` offset 2 | 9.00:1 (sobre crema activa) |
| 4–7 | Ventas / Fiados / Caja / Reportes | 3 px `#fffdf7` offset 2 | 9.91:1 |
| 8–9 | Ayuda / Ajustes | 3 px `#fffdf7` offset 2 | 9.91:1 |
| 10 | Registrar (hero) | 3 px `#fffdf7` offset 2 | 9.91:1 (sobre verde) |
| 11 | Ver todos | 3 px `#004b3c` offset 2 | 9.23:1 (sobre superficie) |
| 12 | Ir a ventas (sugerencia) | 3 px `#004b3c` offset 2 | 9.23:1 |

- **Sidebar, nav activa, CTA, “Ver todos”, hero y sugerencia: PASS** en normal y en `data-contrast=high`.
- En `data-contrast=high`, la nav activa usa outline **maíz `#f2c768`** con offset 2; el anillo cae sobre el sidebar negro, no sobre el fondo blanco del ítem. Contraste **13.14:1** contra negro. **PASS**.
- En `data-contrast=high`, CTA y “Ver todos” usan outline negro/blanco con contraste 21:1. **PASS**.
- En **forced-colors startup** (`data-contrast=high` + `forced-color-adjust:none`): skip negro sobre blanco, marca blanca sobre negro, activa maíz sobre negro, CTA blanca sobre negro, “Ver todos” negro sobre blanco. **PASS**; ya no hay texto bloqueado detrás del anillo.
- A 390 y 320, todos los elementos enfocados muestran outline de 3 px; no hay foco perdido. El ítem “Ajustes” a 1448×1086 HC queda pegado al borde inferior y el borde inferior del anillo se recorta ~5 px por `overflow-y:auto`; el resto del anillo es visible. **Observación menor, no FAIL**.

---

## 4. Orden de tabulación, landmarks, `aria-current`, nombres e iconos

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Orden de tabulación | **PASS** | Skip → marca → Inicio → Ventas → Fiados → Caja → Reportes → Ayuda → Ajustes → Registrar → Ver todos → Ir a ventas → body/cycle. Los ítems “Productos” y “Proveedores” no son enfocables (ver F-02) |
| Landmarks | **PASS** | `complementary "Navegación principal"`; `navigation "Secciones"`; `banner`; `main#inicio-main`; regiones “¡Buen día, Lupita!”, “Resumen del negocio”, “Nueva venta”, “Pendientes”, “Tu negocio, en orden.” |
| Jerarquía de encabezados | **PASS** | 1 `h1` (“¡Buen día, Lupita!”) y 3 `h2` (“Nueva venta”, “Pendientes”, “Tu negocio, en orden.”); sin saltos |
| `aria-current` | **PASS** | Un solo nodo: `A` “Inicio” con `aria-current="page"` |
| Nombres accesibles | **PASS** | Los 12 enfocables tienen nombre: “Inicio”, “Ventas”, “Fiados”, “Caja y corte”, “Reportes del día, dentro de Corte”, “Ayuda”, “Ajustes”, “Registrar”, “Ver todos”, “Ir a ventas”, “Mercado Cero, ir a Inicio”, “Saltar al contenido”. Los `aria-label` de Caja/Reportes incluyen el texto visible (2.5.3 OK) |
| Iconos decorativos | **PASS** | 15/15 `.inicio-icon` con `aria-hidden="true"`; 4 `svg[aria-hidden="true"]`; 7 imágenes con `alt=""` + `aria-hidden`; 0 `img` sin `alt`; 0 iconos enfocables |
| Idioma / título | **PASS** | `<html lang="es-MX">`; `title="Inicio · Mercado Cero"` |
| Estado “Próximamente” en Productos/Proveedores | **FAIL** | El AX tree solo expone `StaticText "Productos"` y `StaticText "Proveedores"`; `title="Próximamente"` no llega como nombre/descripción; no son enfocables. Ver F-02 |
| Estado “hecho” de la tarea demo | **FAIL** | “Cobrar a Juan” se ve con check, pero el check sigue `aria-hidden`; el AX tree dice `Cobrar a Juan Ejemplo $50.00` sin “hecho/completado”. Ver F-03 |

**Landmarks/regiones del AX tree (resumen):** 1 banner, 1 complementary, 1 navigation, 1 main, 5 regiones con nombre; sin `main` duplicado ni encabezados vacíos.

---

## 5. Texto ampliado y zoom 200 %

La preferencia se probó por dos vías: (a) `localStorage` + recarga; (b) flujo real desde Caja: `/?ayuda=1#ajustes` → “Muy grande” → “Alto contraste” → navegar a `/inicio`.

| Viewport / preferencia | `html` font | H1 | Nav | KPI value | CTA hero | “Ver todos” | Overflow H |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1448 normal | 16 px | 52 | 18 | 42 | 20 | 16 | 0 |
| 1448 large | 18.5 px | 60.1 | 20.8 | 46.25 | 23.1 | 18.5 | 0 |
| 1448 xlarge | 20 px | 65 | 22.5 | 47.3 | 25 | 20 | 0 |
| 390 normal | 16 px | 30 | 13 | 24 | 16 | 14 | 0 |
| 390 xlarge | 20 px | 37.5 | 16.25 | 30 | 20 | 17.5 | 0 |
| 320 normal | 16 px | 30 | 13 | 20 | 16 | 14 | 0 |
| 320 large | 18.5 px | 34.7 | 15.0 | 23.1 | 18.5 | 16.2 | 0 |
| 320 xlarge | 20 px | 37.5 | 16.25 | 25 | 20 | 17.5 | 0 |
| 724×543 (zoom 200 %) | 20 px (xlarge) | 37.5 | 16.25 | 30.4 | 20 | 17.5 | 0 |

- **PASS:** la preferencia large/xlarge se aplica a Inicio en H1, nav, KPI y CTA; el cambio se conserva al recargar (script inline en `<head>` que lee `localStorage` antes del primer paint).
- **Flujo real probado:** `/?ayuda=1#ajustes` → “Muy grande” → “Alto contraste” → `/inicio`: `data-contrast=high`, `data-text-size=xlarge`, `html 20 px`, H1 65, nav 22.5, KPI 47.3, CTA 25, overflow 0.
- **Diálogo (abierto desde “Abrir guía”):** el foco entró al `h2` “Ayuda y ajustes”; 35 `Tab` consecutivos quedaron dentro; `Escape` devolvió el foco al botón “Abrir guía”. **PASS**.
- **PASS:** `scrollWidth == clientWidth` en todos los casos; 0 elementos con texto recortado (`scrollWidth/scrollHeight` vs `clientWidth/clientHeight` con overflow hidden/clip); 0 elementos fuera del viewport.
- **PASS 200 %:** para simular zoom 200 % en una pantalla 1448×1086 se usó un viewport CSS de **724×543** (la mitad). No hay scroll horizontal ni recorte; el layout pasa a móvil/tablet y sigue siendo legible. Es una aproximación de reflow, no un cambio de `zoom` CSS.
- **PASS combinado:** `data-contrast=high` + `xlarge` a 390 y 320: html 20 px, H1 37.5, nav 16.25, KPI 25–30, CTA 20; overflow 0 y 0 textos recortados.
- **PASS combinado forced-colors + xlarge:** 390 y 320, `data-contrast=high`, `forced-color-adjust:none`, overflow 0 y 0 recortes.
- **Observación 320 HC:** el nombre del comercio “Antojitos de Lupita” envuelve y el chevron cae a una segunda línea; no hay recorte ni overflow. Es cosmético, no un fallo de accesibilidad.

---

## 6. Contraste real, estados y dependencia del color

### 6.1 Texto normal (calculado con los colores computados y los extremos del gradiente)

| Elemento | Fondo | Ratio | Resultado |
|---|---|---:|---|
| H1 | `#fbf3e7` | 14.40:1 | PASS |
| Saludo / fecha | `#fbf3e7` | 6.74:1 | PASS |
| “Datos demo” | `#fbf3e7` | 5.28:1 | PASS |
| Nav (tope / fondo) | `#064b3e` / `#003f31` | 8.05 / 9.55:1 | PASS |
| Marca (tope / fondo) | `#064b3e` / `#003f31` | 9.91 / 11.76:1 | PASS |
| Nav activa | `#fff0d2` | 9.00:1 | PASS |
| KPI nota | `#fdf3e4` | 6.75:1 | PASS |
| Hero p | `#004b3c` | 8.09:1 | PASS |
| Hero CTA | `#fff0d2` | 9.00:1 | PASS |
| “Ver todos” | `#fdf3e4` | 9.23:1 | PASS |
| “Sugerencia” | `#fdf3e4` | 5.30:1 | PASS |
| Badge “Ejemplo” | `#fff4e9` | 7.57:1 | PASS |
| Dirección topbar | `#fbefe2` | 6.55:1 | PASS |
| Badge “DEMO” | `#fff3e7` | 5.33:1 | PASS |
| **Productos / Proveedores (56 % opacidad)** | `#064b3e` / `#003f31` | **3.64 / 4.07:1** | **FAIL** si se exige 4.5; ver F-02 |

**Nota:** los ítems “Productos” y “Proveedores” son inactivos y podrían quedar exentos como “componentes inactivos” de 1.4.3; aun así son texto de navegación que el usuario necesita leer y el criterio de la tarea pide contraste real. Recomiendo subirlos a ≥4.5:1.

### 6.2 Alto contraste

- `data-contrast=high`: sidebar negro/texto blanco, superficies blancas/texto negro, hero negro/texto blanco, nav activa blanca/negra. Todos los pares medidos son 21:1 o 13.14:1 (anillo maíz). **PASS**.
- **forced-colors startup:** el script de `layout.tsx` activa `data-contrast=high` y `.inicio-shell` aplica `forced-color-adjust:none`. La captura independiente es negro/blanco, sin bloques; texto de nav, marca y hero legible. **PASS**.
- **forced-colors post-load:** `forced-color-adjust:none` conserva la paleta normal; también legible. **PASS**.
- **Trade-off:** `forced-color-adjust:none` opta por la paleta propia de la app en lugar de los colores forzados del sistema. Es consistente y legible, pero un usuario que personalice su paleta forzada no la verá reflejada. Es una decisión de producto, no un fallo de contraste; si se exige respetar la paleta del SO al 100 %, hay que revisarlo.

### 6.3 Dependencia del color

| Estado | ¿Solo color? | Resultado |
|---|---|---|
| Nav activa | No: `aria-current`, fondo, peso y outline | PASS |
| Demo | No: texto “DEMO”, “Datos demo” y nota “Ejemplos demo…” | PASS |
| Fiado | No: texto “Lo que te deben, no dinero recibido”, “Saldo pendiente”, “Fiado es una libreta de deudas…” | PASS |
| Tarea hecha (demo) | Para videntes: check + relleno, no solo color; para lector de pantalla: **no se anuncia** | **FAIL parcial** (F-03) |
| Errores de Caja | No: texto + `role="alert"` + borde/icono | PASS (Caja) |

---

## 7. Objetivos táctiles

| Viewport | Elemento | Tamaño | Criterio pedido | Resultado |
|---|---|---:|---|---|
| 1448 | Nav (cada ítem) | 208×52 | ≥44/48 | PASS |
| 1448 | Brand | 208×174.9 | ≥44/48 | PASS |
| 1448 | Registrar (hero) | 220×60 | ≥44/48 | PASS |
| 1448 | **Ver todos** | **90.3×48** | **48** | **PASS** |
| 1448 | Ir a ventas | 200×56 | ≥44/48 | PASS |
| 390 | **Nav (cada ítem)** | **67.6–96 × 40** | ≥44/48 | **FAIL** (altura 40) |
| 390 | Brand | 366×49 | ≥44/48 | PASS |
| 390 | Registrar | 133.2×48 | ≥44/48 | PASS |
| 390 | **Ver todos** | **81×48** | **48** | **PASS** |
| 390 | Ir a ventas | 126.8×48 | ≥44/48 | PASS |
| 320 | **Nav (cada ítem)** | **67.6–96 × 40** | ≥44/48 | **FAIL** (altura 40) |
| 320 | Registrar | 133.2×48, `y=492.9` | ≥44/48 | PASS (visible en viewport) |
| 320 | **Ver todos** | **81×48** | **48** | **PASS** |
| 320 xlarge | **Ver todos** | **90.8×50.8** | **48** | **PASS** |

- Los **7 ítems enfocables** de navegación móvil (Inicio, Ventas, Fiados, Caja, Reportes, Ayuda, Ajustes) miden **40 px de alto** a 390 y 320; el CSS los define en `inicio.css:901-924` (`min-height: 40px`). Es el fallo F-01.
- **Matiz WCAG:** el mínimo de 2.5.8 (AA) es 24×24; 40 px **no** viola ese mínimo. Sí incumple el criterio de esta auditoría (≥44/48) y la guía táctil de 44 px. Lo mismo aplica al enlace de 28×28 de Caja: pasa 2.5.8, falla 44.
- **“Ver todos” cumple 48 px** en 1448, 390, 320 y 320 xlarge. **PASS.**
- **CTA visible a 390 y 320:** 133.2×48, `y=711.7` a 390 y `y=492.9` a 320, dentro del viewport inicial. **PASS.**
- En Caja móvil, el enlace de marca “Ir a Inicio” mide **28×28**; es **preexistente** (mismo valor en `antes-baseline/metricas/caja-mobile-390x844.json`) y no se introdujo con este cambio. F-05.

---

## 8. Formularios, errores, QR e hidratación

### Inicio
- **N/A:** 0 `form`, 0 `input/select/textarea`, 0 `canvas`, 0 imágenes/QR con “QR”. No hay formularios, errores de validación ni QR que auditar en `/inicio`.

### Caja (revisión de lo existente, sin inventar)
- `#sale-text` tiene etiqueta visible “Escribe la venta”; axe no reporta `label` en Caja. **PASS**.
- Los inputs del borrador (`Producto`, `Cantidad`, `Precio unitario`) tienen `aria-label`. **PASS**.
- Errores de venta/ítem: `aria-invalid`, `aria-describedby` y `role="alert"`; el foco se mueve al campo (`caja-app.tsx:3726-3835`, `3929-3966`). **PASS por inspección + axe**; no se forzó un error de servidor.
- **QR:** no se encontró un QR renderizado en Inicio ni en el estado base de Caja. No hay flujo QR que auditar en estas rutas; **N/A**, no se inventa.

### Hidratación de Ayuda y ajustes
- `/?ayuda=1` y `/?ayuda=1#ajustes` a 1448, 390 y 320: **1 diálogo**, `aria-modal="true"`, foco en `h2 “Ayuda y ajustes”`, `#ajustes` dentro del diálogo, **0 pageerrors y 0 console errors**. **PASS**.
- Desde `/inicio`, clic en “Ajustes” → `http://localhost:3100/?ayuda=1#ajustes`, diálogo abierto, foco en el título, `#ajustes` presente. **PASS**.
- El diálogo mantiene 35 `Tab` consecutivos dentro y `Escape` devuelve el foco al botón “Abrir guía”. **PASS**.

---

## 9. Movimiento reducido

- Con `prefers-reduced-motion: reduce`, se inspeccionaron **135 elementos** del shell: **0** con `animation-duration` o `transition-duration` > 0.001 s; `scroll-behavior: auto`.
- En modo normal, `scroll-behavior: smooth`; el media query lo desactiva correctamente.
- No hay video, carrusel ni animación automática en Inicio. **PASS**.
- `inicio.css:793-802` aplica la regla; `audit_variants.py` además fuerza `reduced_motion="reduce"` en todas las capturas de variantes.

---

## 10. Lector de pantalla real

| Lector | Estado | Nota |
|---|---|---|
| NVDA (Windows) | **NOT RUN** | No instalado en esta máquina |
| TalkBack (Android) | **NOT RUN** | Sin dispositivo/emulador Android |
| VoiceOver (macOS/iOS) | **NOT RUN** | Sin macOS/iOS disponible |
| Narrator (Windows) | **NOT RUN** | `Narrator.exe` existe, pero no se ejercitó; no se capturó audio ni se validó habla |

**Lo que sí se verificó:** árbol de accesibilidad de Chromium (CDP `Accessibility.getFullAXTree`) y `aria_snapshot()`: roles, nombres, `aria-current`, landmarks, listas y estados. Eso **no sustituye** una prueba con lector real.

### Procedimiento mínimo antes de certificar

1. **NVDA + Chrome/Edge en Windows**
   - Arrancar NVDA; abrir `http://localhost:3100/inicio`.
   - `Insert+F7` (lista de enlaces): confirmar 12 enlaces con nombres; “Caja y corte” y “Reportes del día, dentro de Corte” deben incluir el texto visible.
   - `D` (landmarks): complementary “Navegación principal”, navigation “Secciones”, banner, main, regiones.
   - `H` (encabezados): un H1 y tres H2 en orden.
   - `Tab`: skip link primero; `Enter` debe llevar a `<main>`; siguiente `Tab` a “Registrar”; sin trampa.
   - Confirmar que “Inicio” se anuncia como página actual; que los iconos no se anuncian; que “DEMO”, “Datos demo” y “Ejemplos demo…” se leen; que “Productos/Proveedores” anuncian “próximamente” (hoy no) y que “Cobrar a Juan” anuncia “hecho” (hoy no).
   - Repetir con **Windows High Contrast** activo (Settings → Accessibility → Contrast themes) y con el toggle **Alto contraste** de la app (`/?ayuda=1#ajustes`).
2. **TalkBack + Chrome en Android**
   - Activar TalkBack; abrir la URL; swipe derecha; verificar skip link, nav, headings, current, estados demo/fiado y formularios de Caja.
3. **VoiceOver + Safari en macOS/iOS**
   - Rotor (`VO+U`): landmarks, headings, links; verificar skip link, main, formularios/errores de Caja y diálogo de ajustes.

Registrar versión de lector, navegador, SO, texto hablado y PASS/FAIL por checkpoint. Sin eso, **no hay certificación WCAG**.

---

## 11. P1 de `forced-colors`: resuelto

**Estado:** **RESUELTO**. Ya no hay bloques blancos.

**Qué cambió:**
- `layout.tsx` añade al script inline: si `(forced-colors: active)` y `location.pathname === "/inicio"`, fija `document.documentElement.dataset.contrast = "high"`.
- `inicio.css` elimina el bloque de colores de sistema que causaba el fallo y deja:
  ```css
  @media (forced-colors: active) {
    .inicio-shell { forced-color-adjust: none; }
  }
  ```
- El resto del alto contraste lo aporta `html[data-contrast="high"]` (negro/blanco, sin bloques).

**Verificación independiente:**

| Camino | 1448 | 390 | 320 |
|---|---|---|---|
| forced-colors antes de navegar (startup) | `data-contrast=high`, `adjust=none`, negro/blanco, axe 0 | igual, axe 0 | igual, texto legible, axe 0 (1 incomplete de topbar) |
| forced-colors después del load (post-load) | `data-contrast=null`, `adjust=none`, paleta normal legible, axe 0 | igual, axe 0 | igual, legible, axe 0 (8 incomplete de gradiente/topbar) |

- Capturas independientes: `reaudit-forced-startup-390.png`, `reaudit-forced-startup-320.png`, `reaudit-forced-1448.png` (startup, negro/blanco); `reaudit-forced-postload-1448.png` (post-load, paleta normal). Ruta base: `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode`.
- En las capturas de startup se leen “Mercado Cero”, los 7 ítems de nav, “Nueva venta”, “Registrar”, “Pendientes”, “Cobrar a Juan”, etc.; no hay rectángulos blancos.
- **Axe 0** en startup y post-load; el fallo P1 anterior era visual y axe no lo detectaba. Ahora la inspección visual y axe coinciden.

**Matiz de evidencia:** la captura final `.../capturas/inicio-desktop-1448x1086-hc-viewport.png` es el camino **post-load** (alternar forced-colors después de cargar). Por eso muestra la paleta normal y `metricsHighContrast.contrast = null`, no la negra/blanca. Sigue siendo una captura legible y sin regresión, pero **no ejercita el script inline**. Si se quiere que la captura final documente el modo `data-contrast=high` en forced-colors, hay que activar forced-colors **antes** de `goto` (o recargar después de activarlo). La ruta startup ya fue verificada aparte.

**Trade-off:** `forced-color-adjust:none` evita que el navegador pinte los bloques, pero también ignora la paleta forzada personalizada del usuario y usa la paleta propia. Es legible y coherente; si el requisito es respetar al 100 % los colores del SO, hay que revisar esta decisión.

---

## 12. Caja (`/`) — regresión frente al baseline

### 12.1 axe

| Caso | Baseline | Actual independiente | Diferencia |
|---|---|---|---|
| Caja 1448 normal | 1 `label-content-name-mismatch` (`.brand-lockup`) | 1 `label-content-name-mismatch` (`.brand-lockup`) | **Igual, preexistente** |
| Caja 390 normal | 0 | 0 | Sin cambio |
| Caja 1448 `data-contrast=high` | No medido en baseline (los `*-hc` eran forced-colors) | 1 `label-content-name-mismatch`; **0 color-contrast** | PASS de contraste; label preexistente |
| Caja 390 `data-contrast=high` | No medido | 0 | PASS |
| Caja 1448 `forced-colors` | 10 `color-contrast` + 1 label = 11 nodos | 10 + 1 = **11 nodos, set exacto** | **Igual, preexistente** |
| Caja 390 `forced-colors` | 2 `color-contrast` (`.topbar-merchant`, `.topbar-address`) | 2, set exacto | **Igual, preexistente** |
| Tabs `fiado`, `corte`, `meta`, `pendientes` a 1448 normal/HC | 1 label cada uno | 1 label cada uno | Sin nuevos |

**Nodos exactos de Caja 1448 `forced-colors` (todos preexistentes):**
- `color-contrast` (10): `.brand-name`, `.brand-tagline`, `button[data-index="02"] > .min-w-0` (Fiado), `button[data-index="03"] > .min-w-0` (Corte), `button[data-index="04"] > .min-w-0` (Meta), `button[aria-label="Pendientes"] > .min-w-0`, `.min-h-\\[48px\\].text-left.hover\\:text-ink:nth-child(1) > .min-w-0` (Modo demo), `.sidebar-label` (Ayuda), `.home-sale__kicker` (Nueva venta), `.home-sale__title` (Registrar).
- `label-content-name-mismatch` (1): `.brand-lockup` (nombre “Ir a Inicio”; texto visible “Mercado Cero / La caja que habla”).
- Caja 390 `forced-colors` (2): `.topbar-merchant`, `.topbar-address`.
- Caja 1448/390 `data-contrast=high` y normal: **0 `color-contrast`**; solo el label preexistente a 1448.

**Conclusión:** **no hay violaciones nuevas** en Caja. El `label-content-name-mismatch` del brand es preexistente y sigue fallando 2.5.3:
- HTML: `<a class="brand-lockup" href="/inicio" aria-label="Ir a Inicio">`
- Texto visible: “Mercado Cero” + “La caja que habla”
- Nombre accesible: “Ir a Inicio” (no contiene el texto visible)
- Fix: quitar el `aria-label` y dejar que el texto visible nombre el enlace, o usar un nombre que incluya **todo** el texto visible: `aria-label="Mercado Cero, La caja que habla, ir a Inicio"`.

### 12.2 ¿Los “fallos de alto contraste” del baseline son reales?

- `audit_capture.py:226-236` usa `page.emulate_media(forced_colors="active")` y guarda el resultado como `*-hc`. **No** usa `data-contrast=high`.
- En Caja, la captura de forced-colors del baseline y la actual muestran texto legible (negro/azul sobre blanco); axe reporta “cream sobre blanco” porque evalúa los colores de autor, no la paleta forzada. Es un **falso positivo de axe en forced-colors**.
- En Inicio ya no hay ese problema: tanto startup como post-load son legibles; axe 0.
- El modo propio de la app (`data-contrast=high`, `variantes/alto-contraste-*.json`) sí pasa: 0 violaciones y captura legible.

### 12.3 Teclado, foco, diálogo y targets en Caja

- Skip link: primer Tab, 48 px, `#main`; Enter enfoca `MAIN#main`. **PASS**.
- Foco: 12 primeros controles con outline de 3 px; sidebar/topbar visibles en normal y `data-contrast=high`. **PASS**.
- Diálogo “Ayuda y ajustes”: `aria-modal`, título como nombre, 35 tabs dentro, Escape devuelve al disparador. **PASS**.
- Target móvil “Ir a Inicio”: **28×28** a 390, preexistente (`antes-baseline/metricas/caja-mobile-390x844.json` ya lo registra 28×28). **FAIL del criterio 44**, no regresión.
- No hay regresiones nuevas de Caja por el cambio de Inicio; el CSS de Inicio está scopeado a `.inicio-shell`.

---

## 13. Hallazgos priorizados

| ID | Sev. | Estado | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|---|---|
| **R-01** | ~~P1~~ | **RESUELTO** | `forced-colors` ya no pinta bloques blancos; startup aplica `data-contrast=high` + `forced-color-adjust:none`; post-load conserva paleta normal; ambos legibles y axe 0 | Capturas independientes startup/post-load 1448/390/320; `layout.tsx:66`; `inicio.css:1475-1479`; axe 0 | Mantener; añadir captura startup al set final y no confiar solo en axe |
| **F-01** | **P2** | **Nuevo** | Nav móvil 40 px de alto; criterio pedido ≥44/48 | 390/320: 67.6–96×40 en los 7 ítems enfocables; `inicio.css:901-924` | Subir `min-height` a 44/48 en móvil sin romper el wrap; re-medir 320/390 |
| **F-02** | **P2** | **Nuevo** | “Productos/Proveedores” al 56 %: 3.64–4.07:1; “Próximamente” solo en `title`, no está en el AX tree; no son enfocables | Contraste calculado; AX `StaticText "Productos"`/`"Proveedores"`; `page.tsx:151-162`; `inicio.css:149-151` | Subir opacidad/contraste a ≥4.5; exponer “Próximamente” como texto visible o `aria-label`/`aria-describedby`; decidir si serán enlaces deshabilitados enfocables |
| **F-03** | **P2** | **Nuevo** | Estado “hecho” de “Cobrar a Juan” solo visual; el check es `aria-hidden` | AX listitem “Cobrar a Juan Ejemplo $50.00”; `page.tsx:323-330`; fixture `done: true` | Añadir un `<span class="sr-only">Hecho</span>` junto al título (o texto visible); si se vuelve interactivo, usar checkbox con `aria-checked` |
| **F-04** | **P2** | **Preexistente Caja** | `label-content-name-mismatch` en `.brand-lockup`: nombre “Ir a Inicio” no incluye “Mercado Cero / La caja que habla” | `antes-baseline/axe/caja-desktop-1448x1086.json` y actual, 1 nodo; `caja-app.tsx:7388-7402` | Quitar `aria-label` y dejar que el texto visible nombre el enlace, o incluir todo el texto visible en el nombre |
| **F-05** | **P3** | **Preexistente Caja** | Enlace de marca móvil “Ir a Inicio” 28×28 (<44) | `antes-baseline/metricas/caja-mobile-390x844.json` focusOrder; actual 28×28 | Ampliar el hit area a ≥44 sin agrandar el icono |
| **F-06** | **P3 metodológico** | — | La captura final `-hc` es post-load: no ejercita el script inline y muestra paleta normal (`metricsHighContrast.contrast=null`); la rama startup sí aplica high contrast | `audit_capture.py:226-236`; `metricas/inicio-desktop-1448x1086.json`; capturas independientes | Añadir una captura con forced-colors antes de `goto` (o recargar) para documentar la rama startup |

---

## 14. ¿Los P2 impiden aprobar Inicio?

- **F-01 (nav 40 px):** **no** viola WCAG 2.2 AA 2.5.8 (mínimo 24×24), pero **sí** incumple el criterio de esta auditoría (≥44/48) y la guía táctil de 44. Es una limitación de diseño/HIG, no un bloqueo de conformidad AA.
- **F-02 (Productos/Proveedores):** el contraste 3.64–4.07 puede quedar exento como “componente inactivo” de 1.4.3; el problema semántico es que “Próximamente” no se anuncia y los ítems no son enfocables. Es una limitación real de descubribilidad, no un bloqueo de la ruta principal.
- **F-03 (estado hecho):** el estado no es programáticamente determinable; es un fallo semántico acotado a las tareas demo. Debe corregirse para una aprobación limpia.
- **F-04 (Caja label mismatch):** preexistente y fuera de Inicio; no impide aprobar Inicio, pero sigue siendo un fallo 2.5.3 de Caja.
- **Lector de pantalla:** **NOT RUN**; sin esto no hay certificación ni APROBADO limpio.

**Conclusión:** ningún P1 restante. Los P2 no bloquean la navegación principal ni el contraste global; F-03 es un fallo semántico acotado a las tareas demo y debe corregirse. En conjunto impiden un **APROBADO limpio** y deben entrar en el plan de cierre. El veredicto máximo defendible es **APROBADO CON LIMITACIONES**.

---

## 15. Lo que no se ejecutó / límites

- **No** se editaron archivos de código ni se hicieron commits.
- **No** se ejecutaron `npm run verify:fast`, `verify:static`, `verify:full` ni `verify:evidence`; el árbol está sucio y el servidor corre desde el árbol de trabajo, por lo que una atestación de evidencia no sería válida.
- **No** se probó Windows High Contrast real: el tema está inactivo en esta máquina. `forced-colors` se probó con emulación de Chromium, en startup y post-load; ambos caminos son legibles.
- **No** se probó NVDA/TalkBack/VoiceOver (NOT RUN). El árbol de accesibilidad y `aria_snapshot()` no son un lector de pantalla.
- **No** se forzó un error de servidor de Caja; los errores se revisaron por ARIA/código y por los formularios existentes.
- **No** se auditó todo el producto: el foco fue Inicio y la regresión de Caja. Las rutas `/pay`, checkout y flujos de pago quedan fuera de alcance.
- La referencia canónica es una imagen; no se usó para calcular contraste ni targets.
- La captura final `-hc` no ejercita el script inline (post-load); ver F-06.

---

## 16. Evidencia y reproducibilidad

**Evidencia final citada:**
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/capturas/inicio-desktop-1448x1086-hc-viewport.png` → legible, sin bloques; es el camino post-load (paleta normal).
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/capturas/inicio-mobile-390x844-hc-viewport.png` → legible, sin bloques; post-load.
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/axe/inicio-*.json` → 0 violaciones; `incomplete: 1` (gradiente/topbar), no violación.
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/variantes/alto-contraste-1448x1086.json` → `contrast: "high"`, axe 0, foco nav activo maíz.
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/navegacion/resumen.json` → skip link, Enter a main, deep links y “Ver todos” 48 px.
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/metricas/caja-mobile-390x844.json` → “Ir a Inicio” 28×28 preexistente.
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/antes-baseline/axe/caja-desktop-1448x1086-hc.json` → 10+1 nodos, set idéntico al actual.

**Capturas independientes de la reauditoría (temporales, fuera del repo):**
`C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\`:
`reaudit-forced-startup-1448.png`, `reaudit-forced-startup-390.png`, `reaudit-forced-startup-320.png`, `reaudit-forced-postload-1448.png`, `reaudit-forced-1448.png`.

**Reproducción de forced-colors startup:**

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1448, "height": 1086})
    page.emulate_media(forced_colors="active")   # antes de navegar
    page.goto("http://localhost:3100/inicio", wait_until="networkidle")
    print(page.evaluate("document.documentElement.dataset.contrast"))  # "high"
    print(page.evaluate("getComputedStyle(document.querySelector('.inicio-shell')).forcedColorAdjust"))  # "none"
    page.screenshot(path="inicio-forced-startup.png", full_page=True)
```

**Reproducción de forced-colors post-load (método de la captura final):**

```python
page.goto("http://localhost:3100/inicio", wait_until="networkidle")
page.emulate_media(forced_colors="active")       # después del load
# data-contrast queda null; forced-color-adjust:none conserva la paleta normal
```

**Reproducción de axe:**

```python
page.add_script_tag(path="web/node_modules/axe-core/axe.min.js")
page.evaluate("""async () => (await axe.run(document, {
  runOnly: {type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"]},
  resultTypes: ["violations","incomplete"]
})).violations.map(v => ({id: v.id, nodes: v.nodes.map(n => n.target)}))""")
```

---

## 17. Para pasar a APROBADO

1. **F-01:** nav móvil ≥44 px (ideal 48), sin perder el wrap actual.
2. **F-02:** contraste ≥4.5 en Productos/Proveedores y “Próximamente” expuesto en el nombre/descripción.
3. **F-03:** anunciar el estado “hecho” de las tareas demo.
4. **F-04:** corregir el nombre accesible del brand de Caja (preexistente, pero sigue siendo un fallo 2.5.3).
5. **Lector real:** ejecutar NVDA y al menos uno de TalkBack/VoiceOver; adjuntar transcripción.
6. **Evidencia:** añadir captura startup de forced-colors (forced-colors antes de `goto`) además de la post-load; separar `data-contrast=high` de `forced-colors` en los artefactos.

**Con esos puntos, la ruta normal, `data-contrast=high` y `forced-colors` quedan aprobables. Hoy el veredicto honesto es APROBADO CON LIMITACIONES, sin certificación WCAG ni lector de pantalla.**
