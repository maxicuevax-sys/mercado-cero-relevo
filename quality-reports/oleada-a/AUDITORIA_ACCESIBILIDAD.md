# Auditoría de accesibilidad — Oleada A (fundación)

> **Rol:** `mc-accesibilidad` · **Modo:** solo lectura · **Fecha:** 3 de noviembre de 2026
> **Repo:** `mercado-cero` · **Rama:** `design/oleada-a-fundacion` · **HEAD:** `62c3fed`
> **Servidor auditado:** `http://localhost:3100` · `buildSha` `62c3fed6874bc500db16b4a9260fb62cf9626453`
> **Alcance:** propuesta de shell, navegación, `PageHeader`, componentes base y carga prevista de Hearth/Alder.
> **Fuera de alcance:** lógica financiera, webhooks, base de datos, certificación WCAG y pruebas con personas.

**Veredicto de accesibilidad: NO-GO para implementar A2/A3 sin resolver los P0.**

No se encontró una falla WCAG 2.2 AA catastrófica en la build actual de Inicio/Caja, pero la propuesta de fundación **todavía no tiene una arquitectura que garantice AA**. Hay tres bloqueos de decisión/arquitectura y varias deudas que, si se copian al shell nuevo, se vuelven fallas sistémicas.

**No se certifica WCAG 2.2 AA. No se ejecutaron NVDA, TalkBack, VoiceOver, Windows High Contrast real, Safari/iOS ni dispositivos físicos.** Las pruebas de este informe son Chromium headless, `axe-core 4.14.0`, teclado simulado y cálculo de contraste; sirven para detectar riesgo, no para certificar.

---

## 1. Resumen ejecutivo

| Nivel | Cantidad | Lectura |
|---|---:|---|
| **P0** | 3 | Bloquean A2; sin decisión no se puede implementar un shell correcto |
| **P1** | 9 | Riesgo alto de AA, regresión o deuda que no debe heredarse |
| **P2** | 8 | Calidad, consistencia y deuda legacy a controlar |

### P0

1. **No hay decisión de modelo de navegación**: rutas reales vs `?tab=`, y tres mapas de navegación distintos en los documentos.
2. **El shell está duplicado** en Inicio y en `CajaApp`; un `AppShell` en `layout.tsx` produciría dos `main`, dos skip links y dos navegaciones si no se extrae primero.
3. **Los tokens de foco no son seguros**: `--color-focus` verde sobre verde da **1.98:1**; hoy se salva con overrides por página, no por sistema.

### Lo que sí se debe conservar

| Pieza | Evidencia | Por qué |
|---|---|---|
| `Sheet` con foco atrapado | `caja-app.tsx:7594-7734` | `role="dialog"`, `aria-modal`, `aria-labelledby`, trampa, `Escape`, retorno de foco e `inert` probados |
| Skip link funcional | `caja-app.tsx:2407-2418`, `inicio/page.tsx:117-119` | Primer tabulador; en Chromium enfoca `main` y muestra anillo |
| Targets de Caja | 5 tabs × 390/1448 | 0 controles visibles <44 px en la muestra; solo el skip link oculto mide 1×1 |
| `aria-current` en enlaces reales | `inicio/page.tsx:166` | Inicio sí lo expone correctamente |
| Reduced motion | `inicio.css:794-802`, `globals.css:769+` | Se respeta la preferencia |
| `lang="es-MX"`, `viewport-fit=cover` | `layout.tsx:53-58`, `45-51` | Base correcta para lectores y safe areas |
| Patrón móvil de Caja | `globals.css:289-345`, `barrio.css:1121-1188` | Barra como fila del shell, `main` con scroll propio y `--mc-chrome-*` medido |

---

## 2. Método y límites

### Ejecutado

- Lectura de código de `layout.tsx`, `inicio/page.tsx`, `inicio.css`, `globals.css`, `barrio.css`, `caja-app.tsx`, `screen-heading.tsx`, `pending-tasks.tsx`, `checkout-client.tsx`.
- Lectura de `MIGRACION_INTEGRAL_MERCADO_CERO.md`, `HIG-DESIGN.md`, `GOAL-HIG.md`, `ACCESIBILIDAD.md`, `03_CONTRATOS_COMPONENTES.md`, `16_navegacion_y_shell.md` y `.font-staging/SOURCE.md`.
- Playwright/Chromium **156.0.8078.4** headless contra `localhost:3100` (build `62c3fed`):
  - `/inicio` a 320×640, 390×844, 1448×1086.
  - `/` (Caja) en los 5 tabs, a 390×844 y 1448×1086.
  - `/pay/[id]?demo=1` a 390×844.
  - Texto al 200 %, `data-contrast="high"` y `forced-colors: active`.
  - Tabulación, skip link, modal de Ayuda, `Escape`, retorno de foco, targets, overflow y árbol accesible.
- `axe-core 4.14.0` con `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` y best-practice.
- `fontTools 4.67.0` sobre los TTF variables de Hearth/Alder.
- Cálculo matemático de contraste WCAG para pares de tokens.

### No ejecutado

- NVDA, JAWS, TalkBack, VoiceOver, Orca.
- Windows High Contrast Mode real (solo emulación `forced-colors` de Chromium).
- Safari/iOS, Chrome Android, teclado virtual real, safe areas reales, notch.
- Zoom 400 % del navegador (se probó 200 % de texto y 320 CSS px).
- Pruebas con personas, SUS, baja visión, motoras o cognitivas.
- Gates `verify:fast/static/full` y `verify:evidence`; este informe no es evidencia de handoff.

### Regla de lectura

- **P0** = bloquea A2 o puede producir un fallo AA sistémico si se implementa.
- **P1** = riesgo alto, deuda que no debe trasladarse o incumplimiento probable en algún estado.
- **P2** = calidad, consistencia o deuda histórica controlable.
- Cuando un hallazgo es un **candidato** y no una falla demostrada, se dice expresamente. No se convierte una herramienta en certificado.

---

## 3. Hallazgos P0

### P0-1 — El modelo de navegación no está decidido y los documentos se contradicen

**Evidencia**

- `MIGRACION_INTEGRAL_MERCADO_CERO.md:60` declara las rutas objetivo como **“Propuesta, no aprobada”** y exige confirmar `?tab=` vs rutas independientes antes de Oleada A.
- `MIGRACION...:176-192` propone escritorio con sidebar compartido y móvil con **Inicio / Ventas / Fiados / Caja / Más**.
- `HIG-DESIGN.md:265` propone **5 destinos fijos: Caja, Fiado, Corte, Meta, Pendientes**, sin “Más”.
- `01_BRAND_GUIDE.md:45` propone barra inferior de **4–5 destinos máximo; el resto en “Más”**.
- La implementación actual tiene **tres navegaciones distintas**:
  - Inicio: 7 ítems (5 enlaces + 2 no disponibles) + 2 de pie (`inicio/page.tsx:50-68`).
  - Caja escritorio: 5 botones (`caja-app.tsx:7370-7382`).
  - Caja móvil: los mismos 5 botones en barra inferior (`caja-app.tsx:7550-7591`).

**Impacto**

No se puede implementar correctamente `aria-current`, estado activo, deep links, botón Atrás, foco tras navegación ni un solo shell mientras el mapa de destinos sea ambiguo. “Caja” y “Reportes” ya comparten `/?tab=corte` (`inicio/page.tsx:56-67`), lo que rompe el propósito de enlace y la identificación consistente.

**Acción requerida (antes de A2)**

Aprobar por escrito una de estas dos arquitecturas:

| Opción | Semántica | Estado activo | Deep link / Atrás |
|---|---|---|---|
| **A. Rutas reales** (recomendada) | `<a href>` + `aria-current="page"` | URL = ruta | Sí, nativo |
| **B. Tabs en una página** | `role="tablist"` + `role="tab"` + `aria-selected` + `tabpanel` + roving tabindex | `aria-selected` | No; no se afirma “página” |

No se puede mezclar: **botón + `aria-current="page"` + URL que no cambia** es la deuda actual de Caja y no debe pasar al shell.

**Criterios relacionados:** 2.4.4 Link Purpose, 3.2.3 Consistent Navigation, 4.1.2 Name/Role/Value.

---

### P0-2 — Shell duplicado: Inicio y Caja ya tienen cada uno su propio shell

**Evidencia**

- Inicio renderiza su propio `<aside>`, `<header>`, `<main id="inicio-main">`, skip link y nav (`inicio/page.tsx:116-365`).
- `CajaApp` renderiza su propio skip link, `AppSidebar`, `TopBar`, `MobileTabBar` y `<main id="main">` (`caja-app.tsx:2397-2449`).
- La propuesta de Oleada A dice que `AppShell` vive en `layout.tsx` (`MIGRACION...:196-201`), pero no define cómo se retira el shell de `CajaApp` ni el de Inicio.
- `ScreenHeading` ya asume un `h1` por destino (`screen-heading.tsx:23-33`), pero Inicio tiene otro `h1` distinto (“¡Buen día!”).

**Impacto**

Si se añade `AppShell` en `layout.tsx` sin extraer los shells internos:

- dos `<main>`, dos skip links, dos `<nav>` y dos `h1` en el árbol;
- orden de tabulación duplicado;
- `aria-current` contradictorio;
- violación de 1.3.1/2.4.3 y de la regla de un solo landmark principal.

**Acción requerida**

- **AppShell es el único dueño** del chrome: skip link, banner, nav, main, footer.
- Las páginas devuelven **solo contenido** (`PageHeader` + secciones), sin `<main>`, sin skip link y sin nav.
- Si por continuidad se mantiene un shell por página, debe ser el **mismo componente** y no puede haber dos en el DOM.
- Antes de tocar `caja-app.tsx` (monolito de ~8.2k líneas), extraer el chrome o crear un wrapper que no duplique landmarks. No paralelizar ediciones sobre ese archivo.

**Criterio de aceptación A2:** exactamente **1 `main`, 1 skip link, 1 nav visible y 1 `h1` visible** por ruta.

---

### P0-3 — El token de foco falla sobre superficies verdes y no hay una regla sistémica

**Evidencia**

- `globals.css:21`: `--color-focus: #0e6f5a`.
- `globals.css:193-201`: anillo de 3 px con ese token; `.on-accent` lo cambia a blanco.
- `HIG-DESIGN.md:143`: `--color-focus: #0A5B42`.
- Contraste calculado:
  - `#0e6f5a` sobre verde profundo `#0f3d36` = **1.98:1** → no cumple 3:1 para indicador de foco.
  - `#0A5B42` sobre `#F3ECE0` = **6.91:1** (correcto sobre canvas).
  - `#0A5B42` sobre `#0A5B42` = **1.0:1** (invisible si el control es del mismo verde).
- Hoy se evita el fallo con overrides por superficie:
  - `barrio.css:2184-2187` pone blanco en sidebar/topbar.
  - `inicio.css:779-792` pone blanco en sidebar/hero.
- Esos overrides **no son un sistema**: cualquier componente nuevo sobre `--color-accent` que no use `.on-accent` reproduce el “foco verde sobre verde”.

**Impacto**

Candidato a fallo de **2.4.7 Focus Visible** y **1.4.11 Non-text Contrast** en el shell nuevo. No se observó un control sin foco en la muestra actual porque los overrides existen; el riesgo es la fundación que se va a reutilizar.

**Acción requerida**

Definir un solo mecanismo de foco que funcione sobre cualquier fondo:

```css
/* Propuesta, no implementación */
:focus-visible {
  outline: 3px solid var(--focus-inner);      /* claro u oscuro según superficie */
  outline-offset: 2px;
  box-shadow: 0 0 0 5px var(--focus-outer);   /* segundo tono de respaldo */
}
```

- El par interior/exterior debe dar **≥3:1 contra el fondo adyacente** en canvas, surface, accent, danger, sidebar y estado activo.
- Prohibido `outline: none` sin reemplazo.
- Probar foco en: ítem activo del sidebar, CTA sobre hero verde, botón primario, botón destructivo, badge, tab, icon button y link inline.
- Añadir una prueba visual/automática que recorra todos los `:focus-visible` y verifique el contraste del anillo contra el fondo compuesto.

**Criterios relacionados:** 2.4.7, 1.4.11, 2.4.11.

---

## 4. Hallazgos P1

### P1-1 — Hearth/Alder: Alder a 13 px es demasiado pequeño para textos esenciales

**Evidencia**

- `.font-staging/SOURCE.md:46` reserva **Alder para importes, tablas, botones, navegación y estados**; Hearth para marca/encabezados.
- Medición con `fontTools`:
  - Alder: UPM 1000, `x-height` 496, `cap-height` 700; dígitos 535 unidades.
  - Hearth: UPM 1000, `x-height` 520, `cap-height` 700; dígitos 639 unidades.
- A 13 px, la altura de x de Alder es ≈ **6.4 px**. Es más pequeña que una UI típica con x-height 0.52–0.54.
- La app actual ya baja textos esenciales a **11 px** en 320 y **12 px** en 390:
  - `inicio-kpi__note` (“Registradas, no necesariamente cobradas”) = 11 px a 320.
  - `inicio-task__badge` (“Ejemplo”) = 10 px a 320.
  - `inicio-pending__fixture` = 12 px.
- La prueba visual de Hearth/Alder a 13 px se lee, pero se ve claramente más pequeña y estrecha que Segoe/Arial.

**Impacto**

Riesgo de legibilidad para personas mayores y baja visión. No es un fallo automático de AA (no hay tamaño mínimo en WCAG), pero es un riesgo de producto incompatible con la promesa HIG de cuerpo 17 y footnote 13.

**Acción requerida**

- Alder: **mínimo 15–16 px para UI esencial**; cuerpo 17/24; footnote 14/20 o Inter; 13 px solo si es texto no esencial y con contraste ≥4.5.
- Hearth: solo display/marca, **nunca por debajo de 24 px**, nunca importes ni navegación.
- No usar pesos 100–300 para texto esencial; restringir UI a 400–700.
- Prohibir 10/11 px en notas financieras, estados y “Ejemplo”.
- Validar con 320/390/200 % y con una persona mayor; no sustituir la prueba por el proof de fuentes.

**Criterios relacionados:** 1.4.4, 1.4.10 (sin fallo automático, pero riesgo real).

---

### P1-2 — Carga de Hearth/Alder: fallback, glifos y preload no están cerrados

**Evidencia**

- Ambas familias tienen **297 glifos / 285 caracteres**; cubren español, `¿¡ñÑáéíóúü`, `$ % € · — – … °`, pero **no cubren `✓`**.
- No tienen itálica ni feature `tnum`; los dígitos son monoespaciados por construcción (Alder 535, Hearth 639), así que `font-variant-numeric: tabular-nums` es seguro pero no cambia nada.
- No están integradas: `layout.tsx:2-25` sigue usando **Fraunces + Inter**; `.font-staging` no está versionado (`SOURCE.md:3`).
- `next/font/local` permite `adjustFontFallback: 'Arial'`, `display`, `preload`, `fallback` y `variable`; la alternativa de `@font-face` manual exige `size-adjust`/`ascent-override`.
- En la prueba de 200 % a 390 px no hubo overflow ni texto recortado, y `document.fonts.check` devolvió `true` para Hearth 600 y Alder 400. **Eso no prueba CLS ni fallback bloqueado.**

**Impacto**

- Si el fallback no está ajustado, el cambio de métricas produce salto de layout (CLS) y reflujo; Alder es más estrecha que Segoe/Arial.
- Si se precargan ambas fuentes en `layout.tsx`, **todas** las rutas —incluido el checkout público— pagan ~53 KB antes del primer paint.
- `✓` faltante: si se usa como texto, cae a una fuente del sistema y rompe la consistencia; usar icono SVG (lucide) y no el glifo.
- Sin itálica: no usar `font-style: italic`; el navegador sintetizará una oblicua y puede degradar la lectura.

**Acción requerida**

- Copiar WOFF2 + OFL a `web/src/assets/fonts/`, registrar hashes, usar `next/font/local` con `weight: "100 900"`, `style: "normal"`, `display: "swap"`, `adjustFontFallback: "Arial"` y `fallback: ["Segoe UI", "system-ui", "sans-serif"]`.
- Definir `--font-alder` y `--font-hearth`; no usar `font-feature-settings: "tnum"` (no existe); usar `font-variant-numeric: tabular-nums`.
- Preload de Alder sí; Hearth `preload: false` o carga por ruta si no es LCP. Medir LCP/CLS con fuente bloqueada y red lenta.
- Prohibir el glifo `✓` en texto; iconos SVG con `aria-hidden="true"` y texto visible.
- Incluir licencia OFL y no renombrar las fuentes.
- No aplicar las fuentes globalmente hasta probar checkout y Caja; hacerlo por scope o feature flag.

**Criterios relacionados:** 1.4.4, 1.4.10, 3.1.1; rendimiento y consistencia.

---

### P1-3 — `aria-current="page"` sobre botones que no cambian la URL

**Evidencia**

- `caja-app.tsx:7425` y `7571`: los 5 destinos son `<button>` con `aria-current={active ? "page" : undefined}`.
- `selectTab` solo actualiza estado local (`caja-app.tsx:1229-1241`); no hay `router.push`, `history.pushState` ni `document.title`.
- La URL se queda en `/?tab=caja` (o el tab inicial); Atrás/recargar no conserva el destino.
- En cambio, Inicio usa `<Link>` reales con `aria-current="page"` (`inicio/page.tsx:166`).

**Impacto**

Un lector de pantalla puede anunciar “página actual” en un botón que no es una página y cuya URL no corresponde. Es candidato a **4.1.2** y **2.4.4**, y rompe la expectativa de Atrás/recargar. Tampoco es un patrón de tabs válido: faltan `role="tablist"`, `role="tab"`, `aria-selected`, `tabpanel` y navegación con flechas.

**Acción requerida**

- Si se elige ruta real: `<a href>` + `aria-current="page"` + URL/título sincronizados + foco al `h1`/`main` tras navegar.
- Si se elige tab: `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, roving tabindex, flechas Inicio/Fin, y **no** `aria-current="page"`.
- No mezclar ambos.

**Criterios relacionados:** 4.1.2, 2.4.4, 3.2.3.

---

### P1-4 — “Próximamente” no está expuesto y el texto deshabilitado queda en 4.07:1

**Evidencia**

- `inicio/page.tsx:149-160`: Productos y Proveedores son `<span aria-disabled="true" title="Próximamente">`.
- El árbol accesible los fusiona en un solo texto: `text: Productos Proveedores`; no hay “Próximamente” ni dos elementos separados.
- `inicio.css:149-152`: `opacity: 0.56; cursor: not-allowed`.
- Contraste calculado del texto compuesto sobre la barra: **3.64:1–4.07:1** a 13 px (el extremo favorable es 4.07).
- `axe` no lo marca (0 violaciones en Inicio), probablemente por el `aria-disabled`; es un falso negativo de la herramienta, no una prueba de cumplimiento.

**Impacto**

- Usuarios de lector de pantalla no saben que esas opciones no están disponibles.
- Baja visión pierde el texto; 4.07:1 no alcanza 4.5:1 para texto normal.
- El `title` no sustituye la información accesible y no aparece en táctil.

**Acción requerida**

- Preferible: **no mostrar destinos inexistentes** en la navegación principal.
- Si deben mostrarse: un elemento real con `role="link"`/`button` deshabilitado, texto visible “Próximamente”, `aria-disabled="true"`, contraste ≥4.5 y sin `title` como única fuente.
- No usar `aria-disabled` sobre un `<span>` sin rol.
- Separar los dos ítems; no permitir que el árbol los fusione en una sola línea.

**Criterios relacionados:** 1.3.1, 1.4.3, 4.1.2.

---

### P1-5 — El estado “hecho” de una tarea es solo visual en Inicio

**Evidencia**

- `inicio/page.tsx:324-330`: el check es un `<span aria-hidden="true">`; no hay texto “Hecho”.
- El fixture `Cobrar a Juan` tiene `done: true` (`inicio/page.tsx:109`), pero el árbol accesible solo lee `Cobrar a Juan Ejemplo $50.00`.
- Caja sí lo hace bien en tareas reales: `pending-tasks.tsx:136-141` genera “Hecho”, “Hecho hoy”, “Hecho el…” y la lista “Pendientes hechos” tiene etiqueta.

**Impacto**

Candidato a **1.3.1** y **1.4.1**: la condición “hecha” se transmite solo por un check visual. Si el `TaskRow` compartido copia el patrón de Inicio, la deuda se multiplica.

**Acción requerida**

- `TaskRow` debe recibir `status` y renderizar **texto + icono**: “Hecho”, “Pendiente”, “Vencida”.
- Si es interactivo, usar checkbox real con label accesible que incluya el estado; si es solo lectura, texto visible y `sr-only` si hace falta.
- No usar solo color, borde, tachado o check.

**Criterios relacionados:** 1.3.1, 1.4.1, 4.1.2.

---

### P1-6 — Navegación móvil de Inicio: 7 destinos, 2–3 filas y 40 px; no hay barra inferior

**Evidencia medida**

| Viewport | Sidebar/nav | Filas | Contenido empieza | Hero | Pendientes |
|---|---:|---:|---:|---:|---:|
| 390×844 | 204 px / 90 px | 2 | 280 px | 600 px | 802 px |
| 320×640 | 246 px / 132 px | 3 | 322 px | 384 px | 835 px |

- `inicio.css:902-909`: en ≤760 px los ítems bajan a `min-height: 40px`.
- Hay 7 ítems + Ayuda/Ajustes en el pie; la propuesta aprobada habla de **4–5 destinos + “Más”** (`MIGRACION...:188-189`).
- Caja ya tiene barra inferior de 5 destinos con 56–60 px y safe bottom (`caja-app.tsx:7550-7591`, `barrio.css:2071`).
- **Breakpoints incompatibles:** Inicio cambia a móvil en `max-width: 760px` (`inicio.css:849`); Caja cambia en `max-width: 1023.98px` (`barrio.css:1121`, `globals.css:289`). A 768–1023 px, Inicio muestra sidebar de escritorio y Caja muestra barra inferior: dos aplicaciones distintas en la misma tablet.

**Impacto**

- La tarea principal se empuja 200–250 px; en 320 el primer viewport es casi todo navegación.
- A 768–1023 px la misma persona ve sidebar en Inicio y barra inferior en Caja; no hay una adaptación única.
- 40 px **no incumple 2.5.8 Target Size (Minimum) de WCAG 2.2 AA**: el mínimo es 24×24 y 40 > 24. **Sí incumple el contrato interno de 44/48** (`HIG-DESIGN.md:179`, `GOAL-HIG.md:49`) y es peor para manos con temblor.
- No hay “Más”, no hay safe bottom y no hay patrón único entre Inicio y Caja.

**Acción requerida**

- Barra inferior con **4–5 destinos + “Más”**; 56–64 px; labels permanentes; icono + texto; `aria-current`; safe bottom.
- “Más” debe ser botón real con `aria-expanded`/`aria-controls` y sheet/dialog (o ruta `/mas`), no un enlace falso.
- En móvil: barra como fila del shell (como Caja), `main` con scroll propio y `--mc-chrome-bottom` medido; no `position: fixed` que tape campos con teclado.
- No reutilizar el sidebar de 204 px como bloque previo al contenido.
- 44/48 es criterio de producto/HIG; no llamarlo “fallo WCAG” ni rebajarlo.

**Criterios relacionados:** 1.4.10, 2.4.3, 2.4.11; 2.5.8 se cumple, contrato HIG no.

---

### P1-7 — Alto contraste y forced-colors dependen de la ruta y de `forced-color-adjust: none`

**Evidencia**

- `layout.tsx:63-68`: el script de preferencias solo activa el alto contraste automático si `location.pathname === '/inicio'`.
- `inicio.css:1476-1479`: `.inicio-shell { forced-color-adjust: none; }`.
- Caja no tiene ese bloqueo; en `forced-colors` real, los colores del sistema mandan. La emulación de Chromium dio 2 nodos `color-contrast` en Caja, pero los colores computados eran **negro sobre blanco** (falso positivo de axe al leer estilos de autor); no lo cuento como falla.
- `html[data-contrast="high"]` en `barrio.css:2118-2201` es una lista larga de selectores por componente; cualquier componente nuevo queda fuera si no se añade.

**Impacto**

- Un usuario de Windows HCM que entre a Inicio recibe la paleta propia, no la suya; `forced-color-adjust: none` puede eliminar `Highlight`, bordes del sistema y selección.
- Las rutas nuevas (`/ventas`, `/fiados`, etc.) no activarán el alto contraste automático porque el script está atado a `/inicio`.
- El modo alto contraste de Caja es frágil: depende de selectores, no de tokens semánticos.

**Acción requerida**

- Eliminar `forced-color-adjust: none` del shell; usar `@media (forced-colors: active)` con `Canvas`, `CanvasText`, `ButtonText`, `ButtonFace`, `Highlight`, `HighlightText`, `LinkText`, `GrayText`.
- No atar la preferencia a `location.pathname`; usar `prefers-contrast: more` + `forced-colors` + preferencia manual, con el mismo resultado en todas las rutas.
- En HC: bordes visibles, iconos con texto, imágenes decorativas ocultas, foco con dos tonos, estados no solo por color.
- Verificar en Windows HCM real antes de afirmar cumplimiento.

**Criterios relacionados:** 1.4.3, 1.4.11, 2.4.7, 1.4.1.

---

### P1-8 — Destinos duplicados, ayuda/demo duplicados y affordances falsas

**Evidencia**

- `inicio/page.tsx:56-67`: “Caja” y “Reportes” apuntan ambos a `/?tab=corte`; “Ventas” abre `/?tab=caja` (Caja), así que la etiqueta “Ventas” no describe un destino propio.
- Caja tiene **dos** entradas a la misma ayuda: `Ayuda y accesibilidad` en sidebar (`caja-app.tsx:7452-7460`) y `Abrir guía` en topbar (`7535-7543`), con nombres distintos.
- Caja tiene **dos** entradas a demo: `Modo demo` (`7441-7450`) y `Demo` (`7516-7524`).
- Inicio muestra un chevron junto al nombre del negocio (`inicio/page.tsx:204-205`) y una campana con punto (`212-213`) que **no son controles**; el chevron sugiere un menú que no existe.

**Impacto**

- 2.4.4: dos enlaces con el mismo destino y nombres distintos.
- 3.2.3/3.2.4: misma función con identificaciones distintas; usuarios de lector o de voz pueden dudar.
- Affordance falsa: el chevron/campana parecen interactivos pero no lo son; no es un fallo WCAG automático, pero sí de percepción y confianza.

**Acción requerida**

- Un solo destino por etiqueta; “Reportes” debe tener ruta propia o desaparecer hasta que exista.
- Una sola entrada de ayuda y una sola de demo por viewport, con el mismo nombre accesible.
- Si el negocio se puede cambiar (dos comercios en el brief), hacer un botón real con `aria-haspopup`/`aria-expanded`; si no, quitar el chevron.
- La campana: implementar como enlace/acción real o retirarla; no dejarla `aria-hidden` con apariencia de control.

**Criterios relacionados:** 2.4.4, 3.2.3, 3.2.4; 1.3.2 si se añaden iconos con significado.

---

### P1-9 — Foco oculto bajo chrome y foco de ruta no resuelto para el shell nuevo

**Evidencia**

- Caja mide el chrome y publica `--mc-chrome-top/bottom` (`globals.css:54-56, 66-76`); `main#main` tiene `scroll-margin` y el `main` móvil tiene `scroll-padding`.
- Inicio no tiene chrome fijo hoy, por eso no necesita esas variables; el shell nuevo sí tendrá topbar y barra inferior.
- Caja enfoca el `h1` del tab al activar con teclado (`caja-app.tsx:1254`); Inicio no tiene equivalente porque navega con recarga completa.
- Si el shell nuevo usa rutas cliente (`next/link`), el foco puede quedarse en el enlace de navegación y el título no anunciarse.

**Impacto**

- **2.4.11 Focus Not Obscured (Minimum)** si un control enfocado queda bajo la barra fija o el topbar.
- **2.4.3 Focus Order** si el foco no se mueve al contenido tras navegar.
- El usuario de teclado/lector no sabe que cambió de pantalla.

**Acción requerida**

- Medir el chrome real con `ResizeObserver`, publicar `--mc-chrome-top/bottom` y usarlos en `scroll-padding` y `scroll-margin`.
- Tras navegación de ruta: mover foco a `h1` o `main` (`tabIndex={-1}`), actualizar `document.title` y no anunciar dos veces.
- Probar Tab/Shift+Tab en 320/390 con barra inferior y topbar; comprobar que ningún control queda tapado.
- No usar `position: fixed` en móvil si el teclado virtual puede tapar el campo; preferir la fila flex de Caja.

**Criterios relacionados:** 2.4.3, 2.4.11, 3.2.1 (no cambiar contexto solo por foco).

---

## 5. Hallazgos P2

### P2-1 — Skip link: funciona en Chromium, pero el foco nativo no es uniforme

- Inicio usa `<a href="#inicio-main">` (`page.tsx:117-119`); Caja usa JS `preventDefault` + `focus()` (`caja-app.tsx:2407-2418`).
- Prueba: primer Tab = “Saltar al contenido”; Enter = `MAIN#inicio-main`, `scrollY 256`, `outline: solid`. Correcto en Chromium.
- Safari y algunos lectores no enfocan un `main` con `tabIndex=-1` al seguir un ancla. Unificar con JS y `main.focus()`; mantener 44 px, visible y sin duplicar.
- **Criterios:** 2.4.1.

### P2-2 — Landmarks y etiquetas de navegación inconsistentes

- Inicio: `<aside aria-label="Navegación principal">` contiene `<nav aria-label="Secciones">`; Ayuda/Ajustes quedan fuera del `nav` (`page.tsx:121-185`).
- Caja: `<aside aria-label="Índice de la libreta">` contiene `<nav aria-label="Navegación principal">` (`caja-app.tsx:7398-7416`).
- Un `aside` con label es un landmark complementario, no la navegación principal; el nombre “Navegación principal” en el aside y “Secciones” en el nav no ayudan a orientarse.
- Nuevo shell: `<header>` banner, `<nav aria-label="Principal">`, `<main id="main">`, `<footer>` si aplica; sin `aside` envolviendo la nav; una sola etiqueta estable.
- **Criterios:** 1.3.1, 2.4.1.

### P2-3 — Textos esenciales a 10–12 px

- A 320: “Ejemplo” 10 px, notas KPI 11 px; a 390: 12 px.
- No es un fallo de tamaño WCAG, pero contradice HIG (footnote 13) y empeora con Alder (P1-1).
- Regla: 13 px mínimo para metadatos esenciales; 12 px solo texto no esencial; 10/11 px prohibidos en estados, dinero y demo.
- **Criterios:** 1.4.4 (riesgo), legibilidad.

### P2-4 — Target 28×28: no se reproduce en la muestra actual, pero no se declara cerrado

- Medición en los 5 tabs de Caja a 390 y 1448: **0 controles visibles <44 px**; solo el skip link oculto mide 1×1.
- Un target de 28×28 **sí pasaría 2.5.8 AA** (mínimo 24×24), pero **fallaría el contrato 44/48**. No confundir ambos.
- La deuda puede vivir en un sheet, estado de error o checkout no muestreado; añadir regresión en todos los estados, no asumir que el commit `a3ea6bf` la cerró.
- **Criterios:** 2.5.8 (pasa si ≥24); HIG 44.

### P2-5 — Toast de 3 s en la parte superior

- `caja-app.tsx:7159-7201`: `role="status"`/`alert`, cierre de 48 px, `fixed top`; `showToast` lo cierra a los 3 s (`caja-app.tsx:790-797`).
- 3 s es poco para leer un error; no hay pausa al hover/focus. Puede tapar el topbar, no el CTA principal.
- Regla: errores en banner inline persistente; toast solo para lo no crítico; 6–8 s o pausa; no tapar la acción.
- **Criterios:** 2.2.1 (si se considera timing), 4.1.3.

### P2-6 — El indicador DEMO se oculta en móvil en Inicio

- `inicio.css:969-971`: `.inicio-demo { display: none; }` en ≤760.
- Queda “Datos demo” en el saludo, pero el estado demo es información financiera crítica y debe ser persistente y visible en todos los breakpoints.
- Nuevo shell: badge “Modo demo” siempre visible (texto + icono), no solo color, con nombre accesible “Datos simulados, no dinero real”.
- **Criterios:** 1.4.1, comunicación de estado.

### P2-7 — `start_url` y títulos deben seguir el mapa de rutas

- `manifest.ts`: `start_url: "/inicio"`; si se aprueban rutas nuevas, actualizar `start_url`, `shortcuts` y títulos.
- `layout.tsx` define un título global; las rutas nuevas deben tener `metadata.title` propio y un `h1` que lo corresponda.
- **Criterios:** 2.4.2 Page Titled, 2.4.6 Headings and Labels.

### P2-8 — Nota de herramienta: axe en forced-colors no es certificado

- En Caja con `forced-colors: active`, axe 4.14.0 reportó 2 nodos `color-contrast` (`topbar-merchant`, `topbar-address`) con colores de autor `#fffdf7/#cfe3d4`; los colores computados eran **negro sobre blanco**.
- Es un artefacto de la emulación/axe, no una falla demostrada. No usar axe en forced-colors como prueba única; verificar en Windows HCM real y hacer inspección visual.
- **Criterios:** ninguno directo; metodología.

---

## 6. Revisión por área

### 6.1 Shell y navegación

**Lo que la propuesta acierta**

- Sidebar compartido, topbar ligera, barra inferior con “Más”, `aria-current`, skip link y targets son la dirección correcta (`MIGRACION...:176-192`).
- Caja ya tiene el patrón móvil correcto: barra como fila del shell, `main` con scroll propio, `--mc-chrome-*` y safe bottom.

**Lo que falta para que sea AA**

1. **Un solo dueño del chrome** (P0-2) y **un solo mapa de destinos** (P0-1).
2. **Una sola fuente de tokens**; hoy hay cuatro capas: `inicio.css` local, `globals.css` `@theme`, `barrio.css` overrides y `checkout.css`. La propia cabecera de `inicio.css:1-2` dice “No importar tokens globales aquí”, lo que garantiza divergencia.
3. **PageHeader con un `h1`**: `ScreenHeading` ya lo hace en Caja; Inicio tiene un `h1` de saludo. El shell nuevo debe definir si el `h1` es “Inicio” o “Buen día, Lupita” y no duplicarlo.
4. **Navegación honesta**: no duplicar Caja/Reportes; no mostrar Productos/Proveedores sin “Próximamente” accesible; no prometer “Ventas” si abre Caja.
5. **Estado activo**: texto + icono + marca, no solo color; `aria-current` solo en enlaces reales.

### 6.2 Hearth/Alder

**Fortalezas**

- Licencia OFL, hashes, glifos españoles y cifras monoespaciadas verificados.
- Hearth/Alder tienen jerarquía visual clara; el proof a 200 % no desborda.
- Alder es adecuada para importes/tablas por dígitos de ancho fijo.

**Riesgos**

- Alder a 13 px es pequeña; el plan la usa en demasiadas superficies (navegación, formularios, botones, importes, tablas, estados).
- No hay itálica ni `tnum`; no usar `font-feature-settings` como si existiera.
- Falta `✓`; iconos SVG, no glifos.
- Fallback más ancho que Alder; CLS y reflujo si no se ajusta.
- Carga global en `layout.tsx` afectaría checkout y Caja antes de migrarlas.

**Contrato mínimo**

| Rol | Fuente | Tamaño mínimo | Peso | Regla |
|---|---|---:|---|---|
| Marca/hero | Hearth | 24 px | 500–600 | Nunca datos ni navegación |
| Título de página | Hearth o Alder | 28 px | 600 | Un `h1` |
| Cuerpo | Alder | 17 px | 400 | `line-height` ≥1.45 |
| UI/nav/botón | Alder | 15–16 px | 500–700 | 44/48 target |
| Importe | Alder | 17 px+ | 600 | `font-variant-numeric: tabular-nums` |
| Footnote | Alder o Inter | 14 px | 400 | 13 px solo si no es esencial |
| Caption | Inter | 12–13 px | 400 | Nunca una acción |

### 6.3 Foco, orden de tabulación y landmarks

**Requisitos para A2**

- **Skip link** primero, visible, 44 px, `href="#main"`, JS `focus()`; un solo skip link.
- **Un `main`** con `id="main"` y `tabIndex={-1}`; foco visible al saltar.
- **Un `h1` visible** por ruta; `PageHeader` lo renderiza; las secciones usan `h2`/`h3` sin saltos.
- **Landmarks**: `header` banner, `nav aria-label="Principal"`, `main`, `footer` opcional; no `aside` alrededor de la nav principal.
- **Orden**: skip → topbar esencial → nav → main; sin `tabindex` positivo; el orden DOM debe coincidir con el visual; la barra inferior puede ir antes de `main` en DOM si el skip link permite saltar.
- **`aria-current="page"`** solo en enlaces reales; en tabs, `aria-selected`.
- **Nombres accesibles**: icon-only con `aria-label`; el nombre incluye el texto visible; no usar `title` como único nombre; evitar `aria-label` que oculte el texto visible.
- **Foco tras ruta**: mover a `h1`/`main`, actualizar título, no robar foco en cada render.
- **Modales**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, foco inicial, trampa, Escape, retorno, `inert`, un solo modal, backdrop solo sin cambios sin guardar, `aria-live` para estado asíncrono.
- **Targets**: 44×44 de producto; 24×24 de WCAG 2.2 AA es el mínimo legal, no el objetivo. 8 px de separación.

### 6.4 Navegación móvil

**Contrato**

- 5 destinos máximo: 4 fijos + “Más”, o 5 fijos si se decide explícitamente. No 7.
- Barra de 56–64 px + `env(safe-area-inset-bottom)`; labels permanentes; icono + texto.
- `main` con scroll propio; barra como fila del shell, no `fixed` que tape campos con teclado.
- `--mc-chrome-bottom` medido; `scroll-padding-bottom` y `scroll-margin-bottom` para que el foco no quede bajo la barra.
- “Más”: botón real, `aria-expanded`, `aria-controls`, sheet/dialog con foco atrapado y retorno; si es ruta, `<a>` normal.
- Activo: `aria-current="page"` + texto/icono/marca; si el destino está dentro de “Más”, el trigger debe indicarlo (“Más, sección actual: Reportes”) o mostrar el ítem activo.
- Teclado virtual: probar iOS/Android reales; `inputMode`, `autocomplete`, `scroll-margin-bottom`; no confiar en `100dvh` solo.
- Safe top: topbar con `padding-top: max(8px, env(safe-area-inset-top))` en PWA standalone; Caja ya lo hace (`barrio.css:2033`), Inicio no.
- Landscape 844×390 y 320×640: sin scroll horizontal, sin contenido tapado, sin dos scrolls.

### 6.5 Deuda legacy que NO debe trasladarse

| Deuda | Evidencia actual | Regla nueva |
|---|---|---|
| Foco verde sobre verde | `--color-focus` 1.98:1 sobre `#0f3d36`; overrides por página | Anillo de dos tonos ≥3:1 en toda superficie |
| Nav móvil de 40 px | `inicio.css:902-909` | 44/48; barra 56–64 |
| “Próximamente” no expuesto | `page.tsx:149-160`; árbol “Productos Proveedores” | Texto visible/`sr-only` + contraste, o retirar |
| 4.07:1 en ítems deshabilitados | `opacity .56` sobre verde | ≥4.5:1 o no mostrar |
| Estado “hecho” solo visual | `page.tsx:324-330`; check `aria-hidden` | Texto “Hecho” + icono/checkbox |
| `aria-current` en botones sin URL | `caja-app.tsx:7425/7571` | Enlaces reales o tabs con `aria-selected` |
| Caja/Reportes mismo destino | `page.tsx:56-67` | Un destino por etiqueta |
| `forced-color-adjust: none` | `inicio.css:1477` | Respetar colores del sistema |
| Textos de 10/11 px | badge y notas KPI a 320 | Mínimo 13 px en esencial |
| Chevron/campana falsos | `page.tsx:204-213` | Control real o retirar |
| Ayuda/demo duplicados | `caja-app.tsx:7441-7460, 7516-7543` | Una entrada por viewport y mismo nombre |
| Toast de 4 s | `caja-app.tsx:7159-7201` | Banner inline persistente para errores |
| `label-content-name-mismatch` | Corregido en `a3ea6bf`; axe 0 en muestra | Mantener texto visible dentro del nombre accesible |
| Target 28×28 | No reproducido en 5 tabs × 390/1448 | 44/48; regresión en sheets/errores/checkout |

---

## 7. Criterios de aceptación A2 — estructura

> **Definición operativa:** A2 es la puerta de fundación estructural (tokens, AppShell, navegación, PageHeader, foco, responsive). No es un nivel WCAG; es un gate interno. Si el equipo usa otra definición de A2, estos criterios se remapean sin cambiar su contenido.

### A2.1 Decisión escrita

- [ ] Modelo de navegación aprobado: rutas reales **o** tabs, con mapa de destinos y redirects.
- [ ] Mapa único de 4–5 destinos + “Más”; “Caja” y “Reportes” separados o uno retirado.
- [ ] Propietario único del shell y plan de extracción de `CajaApp`.
- [ ] Alcance de Hearth/Alder: rutas, pesos, tamaños, preload y rollback.
- [ ] Contrato de targets: 44/48 de producto; 24×24 de WCAG 2.2 AA documentado como mínimo legal, no como objetivo.
- [ ] Foco: dos tonos y criterio 3:1.

### A2.2 Invariantes de DOM (automatizables)

- [ ] Exactamente **1 `<main id="main">`** por ruta.
- [ ] Exactamente **1 skip link** y es el primer focusable.
- [ ] Exactamente **1 `<nav aria-label="Principal">` visible** por breakpoint.
- [ ] Exactamente **1 `<h1>` visible** por ruta; los paneles ocultos no cuentan.
- [ ] **0** `tabindex` positivos.
- [ ] **0** `aria-label` que no contenga el texto visible cuando el control tiene texto.
- [ ] **0** controles interactivos con target <44×44 en la matriz de producto.
- [ ] **0** `outline: none` sin reemplazo.
- [ ] `lang="es-MX"`, título único por ruta y `h1` coherente con el título.

### A2.3 Navegación y foco

- [ ] Cada `href` es único; ningún destino duplicado.
- [ ] `aria-current="page"` solo en enlaces reales; en tabs, `aria-selected`.
- [ ] Cambio de ruta: URL, título y foco al `h1`/`main`; Atrás/Adelante/recarga conservan destino.
- [ ] Skip link: Tab → visible; Enter → foco en `main`; sin duplicar; 44 px; contraste.
- [ ] Barra inferior: 4–5 + “Más”; 56–64 px; labels; safe bottom; `aria-current`; “Más” con `aria-expanded`/`aria-controls`.
- [ ] Foco nunca queda bajo topbar/barra; `scroll-padding`/`scroll-margin` medidos.
- [ ] 30 Tabs en un modal no salen; Escape cierra; foco vuelve al disparador; `inert` en el fondo.
- [ ] Sin trampa de foco fuera de modales; sin sorpresas al enfocar.

### A2.4 Foco visible y contraste

- [ ] Anillo de foco ≥3:1 contra fondo adyacente en: canvas, surface, accent, danger, sidebar, ítem activo, hero, botón primario, badge.
- [ ] Foco visible en HC/forced-colors.
- [ ] Ningún `overflow:hidden` de ancestro recorta el anillo.
- [ ] Pares de texto documentados: cuerpo ≥4.5:1; grande ≥3:1; componentes ≥3:1; placeholders ≥4.5:1.
- [ ] `success` solo pago real; `attention` para fiado/pendiente/demo; `danger` para error; nunca color solo.

### A2.5 Responsive, 200 % y móvil

- [ ] 320/390/768/1024/1448 sin scroll horizontal ni texto recortado.
- [ ] 200 % de texto: mismas acciones, sin solapamientos, sin contenido bajo chrome.
- [ ] 320×640: tarea principal visible antes del pliegue o a un scroll corto; nav no consume el primer viewport.
- [ ] Barra inferior con safe bottom; topbar con safe top en standalone; `viewport-fit=cover`.
- [ ] Un solo scroll en móvil; sin dos contenedores anidados; teclado virtual probado en dispositivo real o declarado NOT RUN.
- [ ] Landscape 844×390 sin pérdida de acciones.

### A2.6 Alto contraste

- [ ] `prefers-contrast: more`, `forced-colors: active` y preferencia manual dan el mismo resultado en todas las rutas.
- [ ] Sin `forced-color-adjust: none` en el shell.
- [ ] Colores del sistema en HC; bordes de controles visibles; iconos con texto; imágenes decorativas ocultas; foco visible.
- [ ] Axe normal/HC/forced-colors sin serious/critical; inspección manual y, si es posible, Windows HCM real. No usar axe como certificado.

### A2.7 Hearth/Alder

- [ ] WOFF2 + OFL versionados; hashes; `next/font/local` con `weight: "100 900"`, `style: "normal"`, `display: "swap"`, `adjustFontFallback: "Arial"`.
- [ ] Fallback `Segoe UI`/`system-ui`; sin `font-display: block`; sin glifo `✓`; sin itálica sintética no probada.
- [ ] `document.fonts.check` para 400/600/700; sin 404; sin FOUT que rompa el layout.
- [ ] CLS <0.1 con fuente bloqueada/red lenta; LCP no degradado en checkout.
- [ ] 320/390/200 %/HC sin recorte; Alder ≥15 px en UI esencial; Hearth solo display ≥24 px.
- [ ] Checkout y Caja probados antes de aplicar la fuente globalmente.

### A2.8 Evidencia mínima

- [ ] Capturas 320/390/768/1024/1448, 200 %, HC y forced-colors.
- [ ] JSON de Playwright con: targets, focos, overflow, orden de tab, skip, modal, `aria-current`, títulos.
- [ ] JSON de axe normal/HC; sin serious/critical, con nota de falsos positivos.
- [ ] `npm run verify:fast` y `verify:static` verdes; `latest`/`latest-static` válidos solo si se va a handoff.
- [ ] Revisión independiente de `mc-accesibilidad` y `mc-verificador-final`.
- [ ] Declaración expresa: **lector de pantalla NOT RUN** hasta que se ejecute.

---

## 8. Criterios de aceptación A3 — componentes y estados

> A3 es la puerta de componentes compartidos y estados antes de migrar una pantalla. No se declara una pantalla migrada por tener el shell nuevo.

### A3.1 Button / IconButton

- [ ] Variantes primary/secondary/quiet/destructive; primary 52, secondary/quiet 44; icon button 44/48.
- [ ] Un solo primary por tarea; label verbo + objeto.
- [ ] `:focus-visible` de dos tonos; hover/pressed/disabled visibles.
- [ ] Loading con `aria-busy` y label “Confirmando…”; conserva ancho; no doble envío.
- [ ] Disabled explica por qué con texto cercano o `aria-describedby`; no solo opacidad.
- [ ] Icon-only con `aria-label`; no destructivo icon-only.

### A3.2 PageHeader / Card / MetricCard / CurrencyAmount

- [ ] `PageHeader` renderiza el único `h1`, subtítulo y una acción; no duplica `h1` de la página.
- [ ] Heading order sin saltos; `h2` por sección.
- [ ] `CurrencyAmount` usa `Intl.NumberFormat('es-MX')`, dígitos tabulares y un solo nodo de texto.
- [ ] Diferencias/negativos incluyen “a favor”/“en contra” en texto, no solo signo/color.
- [ ] `privacy="hidden"` oculta el monto también al lector (“Monto oculto”).
- [ ] 200 % sin truncar; sin alturas fijas en texto.

### A3.3 FormField / SearchField

- [ ] Label persistente visible; placeholder nunca es el label.
- [ ] 44 px mínimo; texto 17; `inputMode`/`autocomplete` correctos; dinero decimal.
- [ ] Error inline con `aria-invalid`, `aria-describedby`, `role="alert"` si es nuevo; foco al primer error.
- [ ] Validación al confirmar/salir, no en cada tecla; acepta entrada parcial.
- [ ] Búsqueda con label, limpiar con nombre accesible, resultados anunciados sin robar foco.

### A3.4 Modal / Sheet / “Más”

- [ ] `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; `aria-describedby` si aporta.
- [ ] Foco inicial al título o primer control; trampa; Escape; retorno al disparador; `inert` en el fondo.
- [ ] Un solo modal a la vez; no apilar; backdrop solo si no hay cambios sin guardar.
- [ ] `max-height: 90dvh`; contenido scrollable; header/footer estables; safe bottom.
- [ ] `aria-live` solo para el estado asíncrono, no para todo el contenido.
- [ ] Si “Más” abre sheet: mismos requisitos; si es ruta: `<a>` y foco al `h1`.

### A3.5 PaymentStatus / StatusBadge / TaskRow

- [ ] `verified` solo con pey; `demo_paid` y `pending` no usan el mismo verde de éxito; fiado es deuda.
- [ ] Estado con texto + icono + forma; no solo color.
- [ ] `role="status"`/`aria-live="polite"` solo cuando cambia el estado; no repetir en cada polling.
- [ ] `TaskRow` “hecho” con texto “Hecho” + icono; si es interactivo, checkbox real con label que incluya estado.
- [ ] Target 44; estado activo/hover/focus; 200 %.

### A3.6 EmptyState / StatusBanner / Toast

- [ ] Errores críticos en banner inline persistente, junto a la acción; no solo toast.
- [ ] `role="alert"` para error nuevo; `role="status"` para confirmación; `aria-atomic` si aplica.
- [ ] Toast no tapa CTA, no roba foco, se puede cerrar, dura lo suficiente o se pausa.
- [ ] Empty state explica qué falta y cómo continuar; no inventa datos.
- [ ] Reduced motion respetado.

### A3.7 Contenido y navegación

- [ ] Ningún “Próximamente” solo en `title`; texto visible o `sr-only` + contraste.
- [ ] Ningún destino duplicado; etiqueta = destino real.
- [ ] Demo visible en 320/390/1448 y HC; “Datos simulados”, no solo “DEMO”.
- [ ] Sin chevron/campana/avatar que parezcan controles sin serlo.
- [ ] Una sola ayuda y un solo demo por viewport, mismo nombre accesible.

### A3.8 Regresión de migración

- [ ] Inicio y Caja comparten el mismo shell; no hay dos shells.
- [ ] `p0-venta 66/0`, `p0-fiado 51/0`, `p0-corte 69/0`, `p0-dinero 45/0 + 3 KNOWN`, webhook 40/40 no se degradan (cuando se ejecuten).
- [ ] Checkout público conserva contratos, estados y CLS; no se declara migrado por cambiar la tipografía.
- [ ] Una pantalla legacy no se presenta como migrada.
- [ ] No se tocó lógica financiera ni se relajó idempotencia.

### A3.9 Evidencia

- [ ] Matriz de estados por componente (rest/hover/pressed/focus/disabled/loading/error/empty).
- [ ] Axe normal/HC; sin serious/critical; contraste manual de pares.
- [ ] Teclado: flujo completo, modales, “Más”, formularios, errores.
- [ ] 200 %/HC/320/390/1448; capturas.
- [ ] Revisión independiente; lector de pantalla real **NOT RUN** declarado.

---

## 9. Plan propuesto

### Fase 0 — Decisiones (sin código)

**Dueño:** orquestador + producto + `mc-accesibilidad` como revisor.

1. Aprobar el modelo de navegación y el mapa de destinos (P0-1).
2. Aprobar el dueño único del shell y el plan de extracción de `CajaApp` (P0-2).
3. Aprobar el sistema de foco de dos tonos y la fuente única de tokens (P0-3).
4. Aprobar el alcance de Hearth/Alder y el contrato 44/48.
5. Escribir la decisión en `MIGRACION_INTEGRAL_MERCADO_CERO.md` y `HIG-DESIGN.md`; no dejarla solo en un chat.

**Salida:** acta de decisión de 1 página + mapa de rutas/nav + tokens de foco.

### Fase 1 — A2 Shell

**Dueños:** `mc-sistema-diseno` + `mc-shell-responsive`; revisión `mc-accesibilidad`.

1. Tokens semánticos únicos: color, foco, tipografía, targets, radios, sombras; sin `--inicio-*` locales.
2. `AppShell` con un skip link, banner, nav, main y footer; `PageHeader` con `h1`.
3. Sidebar escritorio y `MobileNav` 4–5 + “Más”; safe areas; `--mc-chrome-*`.
4. Extraer el chrome de `CajaApp` o envolverlo sin duplicar; migrar Inicio primero.
5. Foco de dos tonos; route focus; scroll padding; HC/forced-colors.
6. Hearth/Alder con fallback y preload; feature flag hasta probar checkout.

**Gate:** todos los A2.1–A2.8.

### Fase 2 — A3 Componentes

**Dueños:** `mc-sistema-diseno` + carriles de módulo; revisión `mc-accesibilidad`.

1. Button/IconButton/PageHeader/Card/MetricCard/CurrencyAmount.
2. FormField/SearchField/Modal/EmptyState/StatusBanner/Toast.
3. PaymentStatus/StatusBadge/TaskRow/ProgressIndicator.
4. Matriz de estados y pruebas de teclado/200/HC.
5. Migrar Inicio y después Caja; no tocar contratos financieros.

**Gate:** todos los A3.1–A3.9.

### Fase 3 — Verificación independiente

1. `mc-accesibilidad`: revisión de evidencia, no solo de código.
2. `mc-verificador-final`: gates, capturas, regresión p0, handoff.
3. Declarar por escrito qué no se probó (lector, iOS, HCM real).
4. No emitir certificado WCAG; como máximo “sin fallas conocidas en la matriz X”.

---

## 10. Decisiones abiertas que bloquean A2

| # | Decisión | Opciones | Impacto |
|---|---|---|---|
| D1 | Rutas vs tabs | Rutas reales / tabs con `?tab=` | Semántica, deep links, `aria-current`, Atrás |
| D2 | Destinos | 4+“Más” / 5 fijos | Barra móvil, sidebar, “Más” |
| D3 | “Caja” y “Reportes” | Rutas separadas / retirar Reportes | 2.4.4, navegación honesta |
| D4 | Dueño del shell | `layout.tsx` / página | Duplicación de landmarks |
| D5 | Hearth/Alder | Global / scoped por ruta | Checkout, CLS, regresión |
| D6 | Target | 44/48 / 24 AA | Contrato HIG y pruebas |
| D7 | `/` durante migración | Caja legacy / redirect | Enlaces y PWA |
| D8 | `start_url` | `/inicio` / `/` / nueva entrada | PWA |

No se debe abrir A2 con D1–D4 abiertas. D5–D8 pueden resolverse en paralelo, pero deben estar escritas antes de tocar `layout.tsx` y `manifest.ts`.

---

## 11. Evidencia concreta de la muestra

### Contraste

| Par | Ratio | Lectura |
|---|---:|---|
| `#0e6f5a` sobre `#0f3d36` | **1.98:1** | Foco verde sobre verde: no usar |
| `#0A5B42` sobre `#F3ECE0` | **6.91:1** | Foco sobre canvas: correcto |
| `#0A5B42` sobre `#0A5B42` | **1.0:1** | Invisible |
| `#7b9e92` sobre `#003f31` | **4.07:1** (3.64:1 en el otro extremo del degradado) | “Productos/Proveedores” a 13 px: bajo 4.5 |
| `#4d5851` sobre `#fbf3e7` | **6.74:1** | Texto secundario Inicio: correcto |
| `#b33d24` sobre `#fbf3e7` | **5.28:1** | Kicker: correcto |
| `#c1492e` sobre `#fbe9e6` | **4.2:1** | Token terracota sobre soft: no usar en texto normal |

### Tipografía medida

| Fuente | Bytes | UPM | x-height | Cap | Dígitos | Glifos | `tnum` | Itálica |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Hearth | 26,396 | 1000 | 520 (0.52) | 700 | 639 | 297 | No | No |
| Alder | 26,884 | 1000 | 496 (0.496) | 700 | 535 | 297 | No | No |

- Cobertura: español, `¿¡`, `ñÑ`, `áéíóúü`, `$ % € · — – … °`; **falta `✓`**.
- `document.fonts.check('600 40px Hearth')` = true; `document.fonts.check('400 17px Alder')` = true; `document.fonts.status = loaded`.
- Proof 200 % a 390: `scrollWidth 390`, `innerWidth 390`, 0 textos recortados.

### Navegación móvil de Inicio

| Viewport | Sidebar | Nav | Filas | Contenido | Hero | Pendientes |
|---|---:|---:|---:|---:|---:|---:|
| 390×844 | 204 px | 90 px | 2 | 280 px | 600 px | 802 px |
| 320×640 | 246 px | 132 px | 3 | 322 px | 384 px | 835 px |

### Caja: muestra de targets

- 5 tabs × 390/1448: **0 controles visibles <44 px**; solo el skip link oculto 1×1.
- `axe`: 0 violaciones en Caja/Fiado a 390/1448; 0 en Inicio móvil/desktop; 0 en Inicio HC manual.
- `forced-colors` Caja: 2 nodos `color-contrast` que la inspección computada desmiente (negro/blanco); tratar como falso positivo de herramienta, no como certificado.

### Modal de Ayuda (Chromium)

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` presente.
- Foco inicial en `H2 "Ayuda y ajustes"`; 30 Tabs consecutivos permanecen dentro; Escape cierra; foco vuelve a “Abrir guía”; `app-shell.inert` true durante y false después.

### Skip link (Chromium)

- Primer Tab = “Saltar al contenido”; Enter → `MAIN#inicio-main`; `scrollY 256`; `outline: solid`.
- Correcto en Chromium; no probado en Safari/VoiceOver.

---

## 12. Conclusión

La base actual tiene buenas piezas: el `Sheet` es un patrón de modal correcto, el skip link funciona, Caja ya mide su chrome y sus targets de 44/48 están en la muestra. Pero **la fundación propuesta todavía no puede garantizar WCAG 2.2 AA** porque no hay una decisión de navegación, el shell está duplicado y el foco no es seguro sobre superficies verdes.

**Recomendación:** no implementar A2/A3 todavía. Cerrar D1–D4, escribir el contrato de foco/tokens, y solo entonces construir el shell. A2 debe ser un gate verificable, no una reunión de diseño. A3 debe demostrar estados, formularios, modales y pagos sin arrastrar la deuda de Inicio/Caja.

**No se certifica WCAG 2.2 AA. No se ejecutaron pruebas con lector de pantalla ni con personas. Cualquier afirmación de “accesible” sin esa evidencia es incompleta.**

---

### Anexo A — Archivos inspeccionados

| Archivo | Uso |
|---|---|
| `web/src/app/layout.tsx` | Fuentes, `lang`, viewport, script de preferencias |
| `web/src/app/inicio/page.tsx` | Nav, skip, landmarks, tareas, demo |
| `web/src/app/inicio/inicio.css` | Tokens locales, nav 40, foco, HC, 200 % |
| `web/src/app/globals.css` | `@theme`, foco, chrome, móvil, reduced motion |
| `web/src/app/barrio.css` | Shell Caja, safe areas, overrides HC, targets |
| `web/src/app/checkout.css` | Checkout legacy, foco del resultado |
| `web/src/components/caja-app.tsx` | Shell, tabs, `Sheet`, toasts, topbar |
| `web/src/components/screen-heading.tsx` | `h1` por destino |
| `web/src/components/pending-tasks.tsx` | Estado “hecho” con texto |
| `web/src/app/pay/[id]/checkout-client.tsx` | Checkout, `h1`, live regions |
| `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md` | Rutas, oleadas, decisiones |
| `HIG-DESIGN.md` | Tokens, foco, targets, tabbar, sheet |
| `GOAL-HIG.md` | Criterios 44/48, 200 %, teclado |
| `ACCESIBILIDAD.md` | Contrato MVP y límites |
| `design-references/.../03_CONTRATOS_COMPONENTES.md` | Contratos de componentes |
| `design-references/.../16_navegacion_y_shell.md` | Brief de shell |
| `.font-staging/SOURCE.md` | Licencia, hashes, métricas, fallback |
| `.font-staging/font-proof.png` | Proof visual de Hearth/Alder |

### Anexo B — Lo que no se puede afirmar todavía

- “Cumple WCAG 2.2 AA”: **no**. Solo se revisó una muestra automatizada/manual en Chromium.
- “Funciona con NVDA/TalkBack/VoiceOver”: **no**. NOT RUN.
- “Funciona en iPhone/Android real”: **no**. Solo emulación de viewport.
- “El alto contraste está resuelto”: **no**. Solo emulación; Windows HCM real pendiente.
- “Hearth/Alder están cargadas”: **no**. Están en staging, no en `layout.tsx`.
- “Caja ya no tiene deuda de targets”: **no se puede generalizar**. La muestra de 5 tabs no reproduce 28×28; faltan sheets, errores, checkout y estados.

### Anexo C — Evidencia reproducible (cuando se implemente)

```text
cd web
npm run verify:fast
npm run verify:static
# servidor de producción con BUILD_SHA = HEAD
# Playwright: 320/390/768/1024/1448, 200 %, HC, forced-colors
# axe-core 4.14.0: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa
# capturas + JSON + teclado + modales + targets + foco
```

Este informe no reemplaza esa corrida ni la revisión independiente.
