# Oleada B — Shell y rutas de Caja/Ventas

> **Rol:** `mc-shell-responsive` · **Modo:** solo lectura, sin edición de código ni commits.
> **Fecha:** 4 de noviembre de 2026.
> **Rama:** `design/oleada-b-caja-ventas` · **Base declarada:** `26c7741`.
> **Regla:** este documento no declara migrada ninguna pantalla. Es un plan de shell, rutas, navegación y responsive; la lógica financiera sigue congelada.

---

## 0. Resumen de decisiones

1. **`/caja` es captura y cobro** (nueva venta). **`/ventas` es historial/consulta**. `Ventas` deja de significar “Caja”.
2. **`/` sigue siendo la Caja legacy, 200, sin redirección.** No se convierte en alias de `/caja` en Oleada B. `?tab=` sigue funcionando exactamente como hoy.
3. **`/ventas` deja de redirigir** y pasa a ser una página real. Se elimina `web/src/app/ventas/route.ts`.
4. **Se mantienen los 307** de `/fiados`, `/corte`, `/metas` y `/pendientes` hacia `/?tab=…` hasta las oleadas C/D.
5. **Una sola navegación** (`appNav`) para Inicio, Caja y Ventas. Se inserta Caja después de Inicio; se conserva el orden relativo de Oleada A: Fiados, Corte, Metas, Pendientes.
6. **Móvil:** primarios `Inicio · Caja · Ventas · Fiados · Más`; “Más” contiene `Corte · Metas · Pendientes · Ayuda · Ajustes`.
7. **Activo por URL con `activeId` explícito**, no comparando `href` crudo. Un solo `aria-current="page"` por página; si el activo vive en “Más”, el summary lo indica.
8. **`ayuda=1` se conserva con un puente 307** a `/?ayuda=1` mientras la ayuda siga viviendo en el legacy. El hash lo conserva el navegador. Cuando exista un `HelpSheet` compartido, el puente se retira.
9. **Shell móvil como fila del layout, no `position: fixed`**, para que la nav no tape contenido ni el CTA. La barra de cobro de Caja es `sticky` y se apoya encima de la nav.
10. **Caja y Ventas deben responder con `Cache-Control: private, no-store`.** Next ya lo emite para páginas dinámicas con `connection()`; se declara explícito en `next.config.ts` como contrato y defensa en profundidad.

---

## 1. Estado actual verificado

### 1.1 Rutas de partida (`26c7741`, capturadas al inicio de esta lectura)

> El servidor `:3100` puede estar sirviendo ya el WIP de otro carril; la tabla es la **foto de partida** sobre la base declarada, no el estado actual del proceso.

| Ruta | Estado actual | Evidencia |
|---|---|---|
| `/caja` | **404** | `curl -I` → `HTTP/1.1 404 Not Found` |
| `/ventas` | **307** → `/?tab=caja` | `Location: http://localhost:3100/?tab=caja` |
| `/ventas?ayuda=1` | **307** → `/?tab=caja&ayuda=1` | conserva `ayuda=1` |
| `/fiados` | **307** → `/?tab=fiado` | alias de Oleada A |
| `/corte` | **307** → `/?tab=corte` | alias de Oleada A |
| `/metas` | **307** → `/?tab=meta` | alias de Oleada A |
| `/pendientes` | **307** → `/?tab=pendientes` | alias de Oleada A |
| `/` y `/?tab=caja` | **200** legacy | `CajaApp` |
| `/inicio` | **200** | AppShell de Oleada A |
| `/pay/**` | sin shell nuevo | no tocar |

### 1.2 Hechos de código que condicionan el plan

- `/` renderiza `CajaApp` completo (`web/src/components/caja-app.tsx`): shell propio, tabs internos y estado local. **No usa AppShell.**
- Los tabs de `/` se cambian con `selectTab()` y **no escriben la URL**. `?tab=` solo se lee en el render inicial del servidor (`web/src/app/page.tsx`, `HOME_TABS`). Por eso el botón “atrás” sale de `/`, no recorre tabs. Es comportamiento actual; **no se cambia en B**.
- `AppShell` compara `item.href === activeHref` en `Sidebar` y `MobileNav`. Es frágil con query, hash, barra final y subrutas.
- `MobileNav` es `position: fixed` a `bottom: 0` en `components/shell/shell.css`; el relleno inferior solo se aplica a `.inicio-content`, no a `.mc-caja` ni `.mc-ventas`.
- `next.config.ts` declara `privateHeaders` solo para `/` y `/pay/**` (líneas 183–193). En runtime, Next ya emite `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` para páginas dinámicas como `/inicio`; aun así, `/caja` y `/ventas` deben declararlo explícito para que el contrato no dependa del modo de render.
- La navegación de Oleada A tiene 6 destinos: Inicio, Ventas, Fiados, Corte, Metas, Pendientes. No existe Caja.
- El test `web/scripts/oleada-a-smoke.py` **espera `/caja` 404 y `/ventas` 307**; va a fallar por diseño cuando B cambie las rutas.

### 1.3 Medición de la Caja legacy (para comparar el objetivo)

Medición propia con Playwright sobre `/`, viewport inicial, sin scroll:

| Viewport | Total de venta | CTA “Cobrar” | ¿CTA en primer viewport? |
|---|---|---|---|
| 1448×1086 | `y=358–415` | `y=743–799` | Sí |
| 1366×768 | `y=358–415` | `y=771–827` | **No** (3 px abajo) |
| 390×844 | `y=325–366` | `y=854–910` | **No** |
| 320×568 | `y=417–459` | `y=1031–1087` | **No** |
| 390×844, texto `xlarge` (20 px) | `y=382–434` | `y=1015–1071` | **No** |
| 320×568, texto `xlarge` (20 px) | `y=471–523` | `y=1219–1275` | **No** |

No hay scroll horizontal en ninguno de esos casos (`scrollWidth === clientWidth`). El problema no es overflow: es **CTA fuera del primer viewport** en móvil y en 1366×768. La Caja nueva debe corregirlo con la barra de cobro descrita en §5.

**Ojo con “200 %”:** la preferencia `xlarge` de la app es `20px` de raíz (16 → 20, +25 %), **no** es 200 %. El 200 % real es raíz `32px` (o zoom de navegador al 200 %, que reduce el viewport CSS a la mitad). Medido con `html { font-size: 200% }` en la Caja legacy:

| Viewport | Total superior | CTA “Cobrar” | ¿Primer viewport? |
|---|---|---|---|
| 1448×1086, raíz 32 px | oculto por `data-text-zoom` | `y=1056–1106` | **No** (20 px abajo) |
| 1366×768, raíz 32 px | oculto | `y=1092–1142` | **No** |
| 390×844, raíz 32 px | oculto | `y=1133–1182` | **No** |
| 320×568, raíz 32 px | oculto | `y=1367–1416` | **No** |

Tampoco hay scroll horizontal, pero el CTA queda muy lejos. Por eso el plan no puede limitarse a `xlarge`: debe detectar la raíz real (≥24 px) y/o el zoom de navegador.

### 1.4 Cambios sin commitear observados (no editados)

Al momento de esta lectura, `git status` mostraba trabajo en curso de otro carril:

- Modificados: `web/src/components/shell/nav.ts`, `web/src/app/inicio/page.tsx` (CTA “Registrar” → `/caja`), `web/src/app/ventas/route.ts` (borrado).
- Nuevos: `web/src/app/caja/page.tsx`, `web/src/app/ventas/page.tsx`, `web/src/app/ventas/ventas.css`, `web/src/components/caja/*` (`caja-screen.tsx`, `sale-summary.tsx`, `sale-line-items.tsx`, `payment-panel.tsx`, `sale-result.tsx`, `types.ts`, `caja.css`).

**No los modifiqué.** El WIP **cambió mientras se escribía este documento** (por ejemplo, `/ventas` pasó de 50 filas fijas a 25 con `Anterior/Siguiente`). No uses esta lista como estado final: verifica el árbol antes de implementar. El plan fija los criterios que deben cumplirse. A la última comprobación:

- `/caja` y `/ventas` **no aceptan `ayuda=1`**.
- `nav.ts` ya inserta Caja, pero `AppShell` sigue comparando `href` exacto.
- `ventas/page.tsx` mantiene “Cobrado” para cualquier `paidCents > 0`, incluso demo; hay que corregir la verdad del pago.
- La paginación de Ventas ya existe, pero no canonicaliza `page > pageCount`, no valida `page=abc`, no enfoca la lista y usa 25 por página; el plan fija 20, canónica y foco.
- `caja-screen.tsx` es una captura manual; **no tiene voz, verificación de comprobante, pendientes ni ayuda**. No se puede declarar “Caja migrada” con eso.

Al cierre de esta lectura, el WIP ya había añadido `privateHeaders` para `/caja` y `/ventas` en `next.config.ts` y un `web/scripts/oleada-b-smoke.py`; no los evalué ni los tomé como evidencia.

### 1.5 Verificación rápida del WIP servido (no es la base)

Cuando el servidor `:3100` pasó a servir el WIP, medí `/caja` con Playwright. No es evidencia de aceptación; sirve para confirmar que los riesgos de este plan son reales:

| Viewport / modo | CTA “Confirmar” | Paybar | Overflow |
|---|---|---|---|
| 1448×1086 normal | `y=700–756` visible | no existe | no |
| 1366×768 normal | `y=678–734` visible | no existe | no |
| 390×844 normal | `y=1222–1278` **fuera** | no existe | no |
| 320×568 normal | `y=1290–1346` **fuera** | no existe | no |
| 1448×1086 zoom 200 % | `y=1136–1192` **fuera** | no existe | no |
| 390×844 zoom 200 % | `y=2214–2270` **fuera** | no existe | no |
| 320×568 zoom 200 % | `y=2506–2578` **fuera** | no existe | **sí: 363 > 320** |

Además, `document.querySelectorAll('[aria-current="page"]')` devolvía **2** elementos (“Caja” en sidebar y “Caja” en mobile nav); uno está oculto por CSS, pero el criterio de aceptación debe contar **visibles**, no solo nodos del DOM. La Caja nueva no tiene `mc-caja-paybar`: el CTA móvil queda a más de 1000 px del primer viewport. Esto valida §5 y R7/R9.

---

## 2. Navegación propuesta (AppShell)

### 2.1 Destinos, labels y orden

Fuente única: `web/src/components/shell/nav.ts` → `appNav`, `appFoot`, `mobilePrimary`, `mobileMore`. Ninguna página debe declarar su propio array de navegación.

| # | id | Label visible | `href` | `aria-label` | Escritorio | Móvil |
|---|---|---|---|---|---|---|
| 1 | `inicio` | Inicio | `/inicio` | — | 1.º | Primario 1 |
| 2 | `caja` | Caja | `/caja` | `Caja: nueva venta` | 2.º | Primario 2 |
| 3 | `ventas` | Ventas | `/ventas` | `Ventas: historial` | 3.º | Primario 3 |
| 4 | `fiados` | Fiados | `/fiados` | `Fiados: deudas y abonos` | 4.º | Primario 4 |
| 5 | `corte` | Corte | `/corte` | `Corte de caja` | 5.º | Más 1 |
| 6 | `metas` | Metas | `/metas` | `Metas de venta` | 6.º | Más 2 |
| 7 | `pendientes` | Pendientes | `/pendientes` | `Pendientes y tareas` | 7.º | Más 3 |
| — | `ayuda` | Ayuda | `/?ayuda=1` | `Ayuda` | Foot | Más 4 |
| — | `ajustes` | Ajustes | `/?ayuda=1#ajustes` | `Ajustes y accesibilidad` | Foot | Más 5 |

**Decisiones de orden:**

- Se conserva el orden relativo de Oleada A (`Corte`, `Metas`, `Pendientes`). No se reordena Metas/Pendientes en B para no romper memoria muscular ni el smoke de A más de lo necesario.
- **Corte sale del primario móvil** para dejar entrar Caja y Ventas. Sigue a **2 toques** (Más → Corte) y no se oculta. Si producto prefiere Corte directo, la alternativa es `Inicio · Caja · Corte · Más` con Ventas en Más; se descarta porque Ventas es el historial y Caja la captura.
- “Más” no es un destino: es un disclosure nativo (`<details>`), no un `<Link>`.

### 2.2 Activo por URL

Implementación recomendada:

- Añadir `activeId?: string` a `AppShell`; pasar `activeId="caja"`/`"ventas"` desde cada página.
- `Sidebar` y `MobileNav` comparan `item.id === activeId`; si no llega, fallback a `href` normalizado.
- No comparar `href` con `window.location` dentro de un client component: produce desajustes de hidratación y no conoce `?tab=`.

Mapa canónico (también para pruebas y para el helper compartido):

| URL | `activeId` |
|---|---|
| `/inicio` | `inicio` |
| `/caja`, `/caja/` | `caja` |
| `/ventas`, `/ventas/`, `/ventas?page=N` | `ventas` |
| `/ventas/<subruta>` (futuro) | `ventas` (match por prefijo de segmento) |
| `/` y `/?tab=caja` (sin `tab` o `tab=caja`) | `caja` |
| `/?tab=fiado` | `fiados` |
| `/?tab=corte` | `corte` |
| `/?tab=meta` | `metas` |
| `/?tab=pendientes` | `pendientes` |
| `/pay/**` | `null` (checkout público, sin navegación) |
| 404 / ruta desconocida | `null` |

Reglas:

1. **Exactamente un** `aria-current="page"` visible por página.
2. El `aria-current` va en el `<Link>`, nunca en el `<summary>` de “Más”.
3. Si el activo está dentro de “Más”, el link del panel lleva `aria-current="page"` y el summary lleva `data-active-child="true"` y un `aria-label` tipo `Más, incluye la sección actual: Metas`. Visualmente, un punto o barra, no solo color.
4. `/pay/**` no debe renderizar `AppShell` ni `aria-current`.
5. Ruta desconocida: nav usable, sin activo inventado.

### 2.3 “Más”

- `<details>` nativo; `summary` con `<MoreHorizontal>` y label “Más”.
- Panel por encima de la nav: `bottom: calc(100% + 8px)`, `width: min(320px, calc(100vw - 16px))`, `max-height: min(60vh, 420px)`, `overflow-y: auto`, `overscroll-behavior: contain`.
- Cierra con `Escape` y devuelve el foco al `summary` (ya implementado en `mobile-nav.tsx`).
- Cierra con `pointerdown` fuera. Si el pointerdown cae dentro del panel, no cierra.
- Al navegar, el `<details>` debe cerrarse. Hoy el AppShell se remonta por página; si en el futuro se mueve a un layout, añadir `usePathname()` + `open=false`.
- Targets: `summary` 64 px de alto; links 48 px; ancho mínimo 48 px. En 320 px, 5 columnas de 64 px; “Más” cabe sin truncar.

### 2.4 Targets y safe areas

| Elemento | Mínimo | Implementación |
|---|---|---|
| Item de sidebar | 48×48; hoy 52 en 1448 | `min-height: 48px`, `padding-inline: 12px` |
| Item de nav móvil | 64 px de alto | 5 columnas `minmax(0,1fr)`; icono 22, label 0.8125rem |
| Link de “Más” | 48 px de alto | `min-height:48px`, gap 10 |
| CTA principal Caja | 56 px de alto | full width en móvil; label sin truncar |
| Botón de paginación | 48×48 | números y prev/next |
| Safe bottom nav | `env(safe-area-inset-bottom)` | en la fila de nav |
| Safe top topbar | `env(safe-area-inset-top)` | si la PWA corre standalone |
| Panel “Más” | safe area | `bottom` calculado sobre la nav; no tapar el home indicator |

**Cambio de shell recomendado:** en `@media (max-width: 760px)`, hacer que `.inicio-shell` sea `display:flex; flex-direction:column; min-height:100dvh`, `.inicio-main` `flex:1; min-height:0; display:flex; flex-direction:column`, y el `<main>` el área que scrollea. La nav móvil pasa a ser una **fila del layout** (`order: 3`), no `fixed`. Así:

- ningún control queda geométricamente debajo de la nav;
- no hace falta adivinar la altura de la nav con padding;
- el `sticky` de la barra de cobro se apoya naturalmente arriba de la nav;
- el teclado virtual no tapa una barra fija contra el borde del layout.

Si no se puede tocar el shell en B, el fallback es mantener `fixed` y publicar `--mc-mobile-nav-h` medida con `ResizeObserver`; pero entonces hay que aplicar padding y `scroll-padding-bottom` a `.mc-caja`, `.mc-ventas` y `.inicio-content`, no solo a Inicio.

---

## 3. Convivencia `/caja` nueva ↔ `/` legacy y `?tab=`

### 3.1 Mapa de rutas

| URL | Después de B | Shell | Notas |
|---|---|---|---|
| `/caja` | **200** nueva Caja | AppShell | captura, cobro, resultado |
| `/ventas` | **200** nuevo historial | AppShell | paginado, sin redirect |
| `/` | **200** legacy | shell legacy | no se toca |
| `/?tab=caja` | **200** legacy | shell legacy | se preserva |
| `/?tab=fiado` | **200** legacy, tab Fiado | shell legacy | se preserva |
| `/?tab=corte` | **200** legacy, tab Corte | shell legacy | se preserva |
| `/?tab=meta` | **200** legacy, tab Meta | shell legacy | se preserva |
| `/?tab=pendientes` | **200** legacy, tab Tareas | shell legacy | se preserva |
| `/fiados` | **307** → `/?tab=fiado` | legacy | sin cambio |
| `/corte` | **307** → `/?tab=corte` | legacy | sin cambio |
| `/metas` | **307** → `/?tab=meta` | legacy | sin cambio |
| `/pendientes` | **307** → `/?tab=pendientes` | legacy | sin cambio |
| `/pay/**` | **sin cambio** | checkout propio | prohibido envolverlo con AppShell |

### 3.2 Reglas para no duplicar navegación ni crear bucles

1. **Una sola shell por documento.** `/caja` y `/ventas` usan `AppShell`; `/` usa el shell legacy de `CajaApp`. Nunca se anida una dentro de otra.
2. **No hay redirección `/` → `/caja` en B.** Si `/` redirige a `/caja` y `/ventas` redirige a `/`, se forma un ciclo. La ruta legacy se queda como isla de compatibilidad.
3. **No hay redirección `/caja` → `/`** salvo el puente explícito de `ayuda=1` (§4). Un `307` de `/caja` a `/` por defecto volvería a mezclar shells y podría rebotar.
4. **`/ventas` ya no redirige.** Se elimina `web/src/app/ventas/route.ts`; con `page.tsx` en la misma carpeta no pueden coexistir.
5. **La nav nueva no enlaza a `/?tab=…`**, salvo Ayuda/Ajustes, que son el puente temporal al sheet legacy. Caja/Ventas/Fiados/Corte/Metas/Pendientes se enlazan a rutas.
6. **El shell legacy no se modifica para enlazar a `/caja`.** Sus tabs internos siguen siendo botones. Un usuario de `/` llega a la Caja nueva por Inicio, no por un enlace nuevo dentro del monolito.
7. **`/pay/**` queda fuera de cualquier layout de shell.** La implementación por página (no un `app/(app)/layout.tsx`) es la más segura para B.

### 3.3 Sin duplicar destinos

- `Inicio` aparece una vez (sidebar o primario móvil), no en “Más”.
- `Caja`, `Ventas` y `Fiados` están en primario; **no** se repiten en “Más”.
- `Corte`, `Metas`, `Pendientes`, `Ayuda`, `Ajustes` están solo en “Más” en móvil.
- `Sidebar` y `MobileNav` pueden coexistir en el DOM, pero CSS debe ocultar exactamente uno. Prueba a 760/761 px: nunca dos `<nav aria-label="Principal">` visibles.
- El legacy `CajaApp` conserva sus `TABS` internos; es una nav distinta **solo en `/`**. No se comparte con AppShell y no se debe declarar “una sola nav” global mientras `/` siga legacy.

### 3.4 `?tab=` y back/forward en `/`

- **No se añade sincronización URL↔tab en B.** `selectTab()` no debe hacer `pushState` ni `replaceState`. Si se añadiera `pushState`, cada tab crearía una entrada y “atrás” recorrería tabs en vez de salir; si se añadiera `replaceState`, el refresh sería coherente pero el botón atrás seguiría saliendo. Es una decisión de Oleada C.
- Consecuencia aceptada: un tab legacy no es compartible por URL después de hacer clic; solo el `?tab=` inicial. Se documenta y se prueba que el comportamiento actual no cambió.
- Si en C se sincroniza, usar `replaceState` con `?tab=<id>` y conservar `ayuda=1`; nunca `pushState` por tab.

### 3.5 Borradores e idempotencia entre las dos Cajas

- Legacy: `mercado-cero:draft:v1`, `mercado-cero:pending-order:v1`, `mercado-cero:sale-request:v1`.
- Nueva: `mercado-cero:caja-draft:v2`, `mercado-cero:caja-request:v2`.
- **No migrar silenciosamente** el draft v1 al v2. Si el usuario empieza en `/` y sigue en `/caja`, el borrador “desaparece” de su vista. Mitigación mínima: en `/caja`, si existe v1 y no existe v2, mostrar un aviso `role="status"` con enlace “Tienes una venta sin confirmar en la Caja clásica” y no borrar v1. Mitigación completa (C): importar v1 con confirmación explícita y conservar v1 hasta que la venta nueva se confirme.
- **Riesgo de doble venta:** dos pestañas, una en `/` y otra en `/caja`, pueden confirmar la misma venta con `requestId` distintos. El backend idempotencia por `requestId`, no por contenido. No hay lock cruzado. Mitigación B: aviso visible y no auto-importar; mitigación posterior: `BroadcastChannel`/lock de superficie de cobro o dedupe por hash de contenido en servidor (requiere dueño financiero).

---

## 4. Redirects: qué se mantiene, qué cambia y qué se preserva

### 4.1 Matriz

| Ruta | Antes | Después B | Código | Conserva |
|---|---|---|---|---|
| `/caja` | 404 | **200** | — | — |
| `/ventas` | 307 → `/?tab=caja` | **200** | — | — |
| `/ventas?ayuda=1` | 307 → `/?tab=caja&ayuda=1` | **307 → `/?ayuda=1`** (puente) | 307 | `ayuda=1`, hash |
| `/caja?ayuda=1` | 404 | **307 → `/?ayuda=1`** (puente) | 307 | `ayuda=1`, hash |
| `/fiados` | 307 → `/?tab=fiado` | **sin cambio** | 307 | `tab`, `ayuda=1`, hash |
| `/corte` | 307 → `/?tab=corte` | **sin cambio** | 307 | `tab`, `ayuda=1`, hash |
| `/metas` | 307 → `/?tab=meta` | **sin cambio** | 307 | `tab`, `ayuda=1`, hash |
| `/pendientes` | 307 → `/?tab=pendientes` | **sin cambio** | 307 | `tab`, `ayuda=1`, hash |
| `/` y `/?tab=*` | 200 legacy | **sin cambio** | — | `tab`, `ayuda=1`, hash |
| `/pay/**` | sin shell | **sin cambio** | — | — |

**Por qué `ayuda=1` vuelve a `/`:** el sheet “Ayuda y ajustes” sigue dentro de `caja-app.tsx` y no existe `HelpSheet` compartido. Duplicarlo en B sería más riesgo que un puente de una sola redirección. Cuando se extraiga el sheet (C/D), `/caja?ayuda=1` y `/ventas?ayuda=1` deben abrirlo en la misma página y el puente desaparece.

### 4.2 Preservación

- **`tab`:** el helper `tabRedirect(request, tab)` fija el tab destino y descarta `tab` de origen. Mantener la lista `HOME_TABS` (`caja`, `fiado`, `corte`, `meta`, `pendientes`); un `tab` inválido en `/` cae a `caja`. En `/caja` y `/ventas` el parámetro `tab` **no se interpreta**; pertenece a `/` y a los alias. No añadir redirecciones ocultas por `tab` en las rutas nuevas: generan bucles y confunden.
- **`ayuda=1`:** solo el valor exacto `1`. No `true`, no `ayuda`. Se copia al destino en los alias y en el puente de ayuda.
- **Hash:** un `307` cuyo `Location` no incluye fragmento hace que el navegador herede el hash original. Verificado: `/fiados?ayuda=1#ajustes` termina en `/?tab=fiado&ayuda=1#ajustes` y abre el sheet. No hace falta poner el hash en `Location`; si se pone, también funciona, pero el helper actual no lo necesita.
- **Parámetros ajenos:** se descartan (comportamiento actual). Documentarlo para no prometer deep links arbitrarios.
- **Código:** 307, no 308. 308 es cacheable y congelaría aliases temporales.
- **Back/forward:** en un 307 el destino reemplaza la entrada de la ruta alias. Verificado: `/inicio` → `/ventas` (307) → atrás vuelve a `/inicio`, no a `/ventas`. En B, `/ventas` es 200 y será su propia entrada; `/ventas?page=2` debe volver a `page=1` con atrás y reavanzar con forward.

### 4.3 Puente de ayuda: comportamiento esperado

1. `GET /caja?ayuda=1` → `307 Location: /?ayuda=1`.
2. `GET /caja?ayuda=1#ajustes` → `/?ayuda=1#ajustes`; el sheet abre y hace scroll a Ajustes.
3. Atrás vuelve a `/caja`; el draft v2 se restaura con el aviso.
4. `GET /ventas?ayuda=1` → `/?ayuda=1`; atrás vuelve a `/ventas`, página 1 (el número de página se pierde; es aceptable para ayuda).
5. Sin `ayuda=1`, `/caja` y `/ventas` **no redirigen**.

### 4.4 Lo que no se debe hacer

- No redirigir `/` a `/caja` en B.
- No redirigir `/?tab=caja` a `/caja` en B.
- No redirigir `/ventas` a `/?tab=caja` otra vez.
- No añadir un `middleware/proxy` de rutas: `proxy.ts` está congelado y su matcher es `/api/**`; una regla de navegación ahí complica el CSRF y el harness.
- No usar `router.replace` en cada render de Caja/Ventas: rompe atrás/forward.

---

## 5. Layout responsive de `/caja`

### 5.1 Anatomía propuesta

```
AppShell
├─ Sidebar (≥761) / MobileNav (≤760)
├─ TopBar (negocio, DEMO, avatar)
└─ main.mc-caja
   ├─ PageHeader: eyebrow "Caja", h1 "Caja" (o "Nueva venta" con eyebrow "Caja"; el `<title>` debe incluir "Caja")
   ├─ aviso de borrador restaurado (role=status)
   ├─ grid
   │  ├─ columna Conceptos
   │  │  ├─ card "Conceptos" (lista editable)
   │  │  ├─ form "Agregar concepto" (descripción, cantidad, precio, agregar)
   │  │  └─ empty state "Aún no hay conceptos"
   │  └─ columna Cobro
   │     ├─ card "Cobro" (total, métodos, efectivo/fiado, cambio, error)
   │     └─ CTA "Confirmar venta"
   └─ mc-caja-paybar (sticky, solo cuando aplica)
      ├─ Total
      └─ CTA "Cobrar $X" / "Confirmar venta"
```

- El **form de agregar** va antes de la lista en móvil: la primera acción no queda debajo de 20 renglones.
- La lista de conceptos es editable en línea; el total se actualiza en vivo (`aria-live="polite"` en el total, sin anunciar cada tecla de precio; anunciar al confirmar edición o con `aria-atomic`).
- El **CTA nunca se duplica visible**: si la paybar está activa, el CTA de la tarjeta se oculta con `display:none` (no `visibility`), para que no quede un segundo botón en el árbol de accesibilidad.
- `id="confirmar"` en la tarjeta de cobro, con `scroll-margin-top: 16px`, para `/caja#confirmar`.

### 5.2 Breakpoints y composición

| Viewport | Shell | Composición | Total/CTA |
|---|---|---|---|
| **1448×1086** | sidebar 236 | `max-width:1129`, grid 2 columnas `1.35fr / 0.65fr`, gap 20, padding 34 | resumen `sticky top:20`; CTA en tarjeta, visible sin scroll |
| **1366×768** | sidebar 236 | 2 columnas, padding 24; resumen compacto | `max-height:820` activa paybar; CTA visible sin scroll |
| **390×844** | navbar fila 64; una columna | padding 14; cards 18; header compacto; form antes de lista | paybar encima de la nav; total y CTA visibles al cargar |
| **320×568** | navbar fila 64; una columna | padding 10–14; cantidad/precio en 2 columnas `minmax(0,1fr)`; descripción full width | paybar full width; CTA 56; sin scroll horizontal |
| **200 % real** (raíz 32 px o zoom 200) | igual que el viewport efectivo | contenedor `mc-caja` con `container-type:inline-size`; stack a `46em`; tipografías con tope | paybar forzada por `data-text-zoom="large"` (raíz ≥24 px) y/o por ancho; total/CTA alcanzables sin scroll horizontal |

**Regla de la paybar:**

```css
/* Conceptual, no código final */
.mc-caja-paybar { display: none; }

@media (max-width: 980px), (max-height: 820px) {
  .mc-caja-paybar { display: flex; }
  .mc-caja-summary .mc-caja-confirm { display: none; }
}

html[data-text-zoom="large"] .mc-caja-paybar,
html[data-text-size="xlarge"] .mc-caja-paybar { display: flex; }

html[data-text-zoom="large"] .mc-caja-summary .mc-caja-confirm,
html[data-text-size="xlarge"] .mc-caja-summary .mc-caja-confirm { display: none; }
```

- La preferencia `xlarge` (20 px) **no equivale a 200 %**; se incluye como refuerzo, pero el disparador real es `data-text-zoom="large"` (raíz ≥24 px, mismo detector que usa `caja-app.tsx`) o el ancho/zoom efectivo.
- La paybar es `position: sticky; bottom: 0` dentro del área que scrollea. No `fixed`: así queda arriba de la nav (que es fila del layout) y no tapa el home indicator.
- `padding-bottom` del contenido = altura real de la paybar + 16 px. Medir con `ResizeObserver` y publicar `--mc-caja-paybar-h`; no hardcodear 96 px (hoy `caja.css` usa 96 y a 200 % puede quedarse corto).
- En 1448×1086 normal no hay paybar; el CTA de la tarjeta sticky es el único.
- En 1366×768 se activa por `max-height:820`; no dependemos de que el CTA “casi” quepa (hoy queda 3 px abajo).
- En 390/320 se activa por ancho.
- A 200 % real se activa por `data-text-zoom` aunque el viewport sea 1448; el zoom de navegador además reduce el ancho y dispara `max-width`.

### 5.3 Total y CTA: criterios medibles

- Total: `font-size: clamp(2.25rem, 4.5vw, 3.5rem)` con tope en px para 200 %; `font-variant-numeric: tabular-nums`; `overflow-wrap: normal`; el importe `$1,234.50` no se parte.
- CTA: `min-height:56px`, full width en una columna, label completo; `aria-label` incluye el monto (`Confirmar venta: cobrar $90.00`). Nunca usar solo un icono.
- Estado vacío: total `$0.00`, CTA deshabilitado pero **visible**, con texto de apoyo “Agrega un concepto para cobrar”. No esconder el CTA para “limpiar” el diseño.
- Estado con 3 conceptos: el total y el CTA siguen en el primer viewport porque la paybar es sticky; la columna izquierda puede crecer sin empujarlos.
- Estado de error: `role="alert"` dentro de la tarjeta; el foco va al primer campo inválido; la paybar sigue visible.
- Estado guardando: CTA `aria-busy`, label “Registrando…”; no bloquear el scroll; impedir doble click con `saleLockRef`.

### 5.4 200 % y reflow

- Usar **container queries en `em`** dentro de `.mc-caja` (`@container (max-width: 46em)`), no solo `px`. A 200 % la raíz crece y el contenedor lógico se estrecha; un breakpoint en px no reacciona al zoom de texto.
- Evitar columnas fijas tipo `78px 110px 96px 44px` en móvil/200 %. Usar `minmax(0,1fr)` y `auto`; permitir que cantidad/precio bajen a otra fila.
- Topes tipográficos con `min()`/`clamp()` en títulos, totales y labels; nunca `font-size` que crezca sin tope dentro de una tarjeta estrecha.
- `min-width:0` en todos los hijos del grid; `overflow-wrap:anywhere` solo en descripciones/nombres, no en importes.
- `scrollWidth === clientWidth` en `html`, `body` y `main` en 1448/1366/390/320 y 200 %.
- A 200 % real (raíz 32 px), `data-text-zoom="large"` debe activar la paybar y compactar la tarjeta; no confiar solo en `@media` de ancho, porque el texto puede crecer sin cambiar el viewport.
- Reducir o ocultar notas explicativas (`mc-caja-total__note`, `mc-caja-digital-note`) a 200 % para que el CTA quepa; no ocultar el total ni el método seleccionado.

### 5.5 Teclado virtual

- `<meta name="viewport" content="..., interactive-widget=resizes-content">` si Next lo permite en `viewport` (`layout.tsx`). En Android Chrome reduce el layout viewport; en iOS Safari no.
- En `CajaScreen`, escuchar `window.visualViewport` (`resize`/`scroll`) y publicar `--mc-keyboard-inset = max(0, innerHeight - visualViewport.height - visualViewport.offsetTop)`. La paybar usa `bottom: var(--mc-keyboard-inset, 0)`; el `scroll-padding-bottom` del main suma la paybar y el inset.
- `inputMode="decimal"` en efectivo/fiado/precio; `enterKeyHint="done"`; `autoComplete="off"` en cliente; `autoCapitalize="sentences"` en descripción.
- Al enfocar un campo, `scrollIntoView({ block: "center" })`; no `preventScroll` en el campo. Al cerrar el teclado, restaurar el inset a 0.
- Prueba manual iOS/Safari: foco en “Efectivo recibido”, teclado abierto; el total y el CTA deben quedar visibles o alcanzables con un scroll corto, nunca debajo del teclado ni de la nav.
- Prueba automatizada: viewport 390×844, simular altura 400 (o `visualViewport` mock); medir `paybar.getBoundingClientRect().bottom <= visualViewport.height + 1` y `scrollWidth === clientWidth`.

### 5.6 Foco y navegación dentro de Caja

- Al montar `/caja`, el foco inicial es el `<h1>`/`main` (route focus), no un input: evita abrir el teclado al entrar.
- Al agregar un concepto, el foco va al campo descripción del nuevo renglón (ya hay un patrón en `caja-screen.tsx` con `requestAnimationFrame`).
- Al borrar un renglón, el foco va al botón “Agregar concepto” o al siguiente renglón; nunca a `body`.
- Al confirmar, el foco va al `<h2>` del resultado (`tabIndex={-1}`) y se anuncia el estado con `role="status"`/`aria-live="polite"`.
- “Limpiar venta” no usa `window.confirm`; usar confirmación inline (como el legacy) para que sea accesible, testeable y consistente. `window.confirm` bloquea el hilo y no se puede estilizar.
- Los links “Ver ventas” y “Volver a Caja” del resultado no deben apuntar a la misma página (`/caja` → `/caja` es un no-op); “Volver a Caja” debe hacer `resetSale()` o desaparecer.

---

## 6. Layout de `/ventas`

### 6.1 Anatomía

```
AppShell
├─ TopBar
└─ main.mc-ventas
   ├─ PageHeader: eyebrow "Ventas", h1 "Ventas" (o "Historial" con eyebrow "Ventas"; el `<title>` debe incluir "Ventas")
   │  └─ acción primaria "Nueva venta" → /caja
   ├─ resumen "Hoy": Ventas registradas · Cobrado confirmado · Por cobrar
   ├─ lista
   │  ├─ encabezado "Últimas N" + "Mostrando X–Y de Z"
   │  ├─ filas (20 por página)
   │  │  ├─ estado (badge con texto)
   │  │  ├─ Pedido + fecha/hora + método + cliente
   │  │  ├─ conceptos (resumen)
   │  │  ├─ total
   │  │  ├─ cobrado/fiado/pendiente
   │  │  └─ <details> "Ver conceptos"
   │  └─ paginación
   └─ nota de verdad del dinero
```

- **Escritorio:** fila en 2 columnas: contenido principal `minmax(0,1fr)` y bloque de importe `auto`; `details` ocupa todo el ancho. Sin tabla HTML con `overflow-x`.
- **≤900:** fila en una columna; importe a la izquierda; `details` debajo.
- **≤360 / 200 %:** `details` de conceptos en una columna; el badge y el pedido se apilan; no hay anchos fijos.
- **Estados:** vacío, error, demo y “sin resultados de filtro” (si en el futuro hay filtros) son distintos. No mostrar “Aún no hay ventas” cuando falló la lectura.

### 6.2 Paginación

- **Tamaño:** 20 ventas por página. La API permite `limit` hasta 200 y `offset`; la página calcula `offset = (page-1)*20`.
- **URL:** `?page=N`, 1-based. La forma canónica de la primera página es `/ventas` sin parámetro; `/ventas?page=1` responde 200 y muestra lo mismo (no se redirige para no añadir ruido al historial). Los enlaces de paginación no generan `?page=1`.
- **Cálculo:** `total = countOrders()`; `totalPages = max(1, ceil(total/20))`.
- **Inválidos:** `page=0`, `page=abc`, `page` negativo → **307** a `/ventas` (o a la última página si `page > totalPages`), conservando `ayuda=1` si el puente no se aplicó antes. Sin bucles: el destino es canónico.
- **UI:** `nav aria-label="Paginación de ventas"`; `Anterior`/`Siguiente` con `rel="prev"`/`rel="next"`; números con `aria-current="page"`; ventana de 5 páginas con primera/última y elipsis; targets 48×48.
- **Texto:** “Mostrando 21–40 de 87”. Si `total=0`, no se muestra paginación.
- **Historial:** enlaces reales (`<Link href="/ventas?page=2">`), no estado local. Atrás/forward funcionan. Evitar `router.replace` salvo canonicalización de página inválida.
- **Foco:** al cambiar de página, foco al `<h1>` o al encabezado de la lista (`tabIndex={-1}`), con `scrollIntoView` al inicio de la lista; la página no debe quedar a mitad de scroll.
- **Offset:** aceptar que altas concurrentes pueden desplazar filas entre páginas. Para B es suficiente; para C, cursor por `created_at,id`.

### 6.3 Estado vacío, error y demo

| Estado | Qué mostrar | Acción |
|---|---|---|
| **Vacío real** (`total=0`, sin error) | `EmptyState` “Todavía no hay ventas registradas.” + “La primera venta que registres aparecerá aquí.” | CTA “Registrar venta” → `/caja` |
| **Error de lectura** | `role="alert"` “No pudimos leer las ventas.” + “No hay cifras nuevas.” | Botón “Reintentar” (misma URL) y enlace a `/caja`; **no** mostrar vacío |
| **Demo** | Badge DEMO en TopBar y en el resumen; filas demo con estado “Demo (simulado)” | No contar demo como cobrado real; CTA normal |
| **Página fuera de rango** | 307 a la última página; si total=0, 307 a `/ventas` | — |
| **Filtro futuro sin resultados** | “No hay ventas con este filtro.” + “Quitar filtro” | No confundir con vacío real |

### 6.4 Verdad del dinero en cada fila

Hoy el WIP etiqueta “Cobrado” cualquier `paidCents > 0`, incluso un `demo_paid`. Corregir:

- `status === "demo_paid"` o `lastPaymentDemo` → **“Demo (simulado), no es dinero real”**; nunca “Cobrado”.
- `digitalPaidCents > 0` y no demo → “Digital verificado por pey” (solo si el estado lo respalda).
- `paidCents > digitalPaidCents` → “Efectivo registrado”.
- `creditCents > 0` → “Fiado: deuda, no dinero recibido”.
- `due = total - paid - credit > 0` → “Por cobrar”.
- No usar color solo: el badge lleva texto.
- No inventar “Pagado” si el estado es `confirmed` o `payment_pending`.
- `formatActivityDate` para fecha/hora; `shortOrder` para el folio; `CurrencyAmount` para importes.

### 6.5 200 % y 320

- Resumen “Hoy” con `grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr))`; a 320/200 % se apila.
- Filas sin `white-space: nowrap` en conceptos; permitir 2–3 líneas y `details` para el resto.
- Importe total con tope `min(1.5rem, 28px)` en móvil; no partir `$`.
- Paginación: a 320/200 %, mostrar `Anterior · Página X de Y · Siguiente` en vez de 5 números; los números completos quedan en ≥360.
- `padding-bottom` incluye nav + safe area; no usar 72 px fijos.

---

## 7. Riesgos

| # | Riesgo | Evidencia / causa | Mitigación B | Severidad |
|---|---|---|---|---|
| R1 | **Doble cobro entre `/` y `/caja`** | Drafts y `requestId` v1/v2 distintos; dos pestañas pueden confirmar la misma venta | Aviso de venta en la otra Caja; no auto-importar; documentar; evaluar lock/dedupe en C | **Crítica** |
| R2 | **Pérdida de borrador al cambiar de Caja** | `/caja` solo lee `…caja-draft:v2`; `/` usa `…draft:v1` | Banner “Tienes una venta en la Caja clásica” con enlace; no borrar v1; importación explícita en C | Alta |
| R3 | **Paridad funcional de Caja** | Nueva Caja no tiene voz, verificar comprobante, pendientes, ayuda/ajustes, demo reset, actividad | No declarar “Caja migrada”; B = captura manual + cobro; enlace visible a la Caja clásica; plan de paridad | **Crítica de producto** |
| R4 | **Doble nav / salto de shell** | Fiados/Corte/Metas/Pendientes siguen yendo a `/` legacy | Aceptar como isla temporal; no anidar shells; probar que solo una nav es visible; documentar salto | Media |
| R5 | **Bucle de redirects** | Si `/` → `/caja` y `/ventas` → `/` | No redirigir `/`; borrar `ventas/route.ts`; un mapa canónico; probar cadenas máx. 1 salto | **Crítica** |
| R6 | **Activo incorrecto** | `href === activeHref` falla con query/hash/subruta; dos activos posibles | `activeId` explícito; un solo `aria-current`; helper de mapa; tests | Alta |
| R7 | **Nav tapa contenido/CTA** | `MobileNav` fixed; padding solo en `.inicio-content`; `.mc-caja`/`.mc-ventas` con padding propio | Shell flex con nav como fila; o CSS vars + padding/scroll-padding en cada página | **Alta** |
| R8 | **Teclado virtual tapa CTA** | Paybar fija contra bottom; iOS no redimensiona layout | `visualViewport`, `interactive-widget`, sticky en flujo, scroll-margin; prueba manual iOS | Alta |
| R9 | **Overflow a 200 %/320** | Grids fijos 78/110/96/44; chip de total 353 px; stats 3 columnas; labels largos; medido 363 > 320 en 320/200 % | Container queries en `em`, `minmax(0,1fr)`, chip `max-width:100%`, topes, apilar | Alta |
| R10 | **Caché no explícita** | `next.config.ts` solo declara `/` y `/pay/**`; Next ya emite `no-store` en dinámicas, pero el contrato depende del modo de render | Declarar `Cache-Control: private, no-store` para `/caja/:path*` y `/ventas/:path*`; verificar `/inicio` | Media |
| R11 | **Romper `/pay/**`** | Un layout de shell global envolvería checkout | Mantener AppShell por página; si se usa route group, `/pay` fuera; correr checkout 19/19 | **Crítica** |
| R12 | **Tests de Oleada A fallan** | `oleada-a-smoke.py` espera `/caja` 404 y `/ventas` 307 | Nuevo `oleada-b-smoke.py`; actualizar o congelar el A smoke; no mezclar evidencia | Alta |
| R13 | **Pérdida de foco al navegar** | Next no mueve foco; el link clickeado desaparece; paginación deja foco en body | `RouteFocus` en AppShell; foco a h1/main; foco a lista al paginar | Alta |
| R14 | **Back/forward roto** | `replaceState` por tab/render; paginación con estado local | URLs reales; `Link`; `replace` solo para canonicalizar; tests de back/forward | Alta |
| R15 | **Draft pisado entre pestañas** | `localStorage` v2 compartido; última escritura gana | Aviso de otra pestaña; no auto-guardar sobre cambios ajenos; evaluar `BroadcastChannel` | Media |
| R16 | **`window.confirm` bloqueante** | WIP lo usa para limpiar venta | Confirmación inline accesible; mismo patrón que legacy | Media |
| R17 | **CSS duplicado/colisión** | `caja-screen` importa `inicio.css` y `caja.css`; `ventas` importa `inicio.css` | Mantener selectores bajo `.mc-caja`/`.mc-ventas`; no redefinir tokens globales; revisar orden de import | Media |
| R18 | **Error de datos = 500** | `getDashboardData()`/`listOrders()` pueden lanzar; WIP no captura | `try/catch` en page + estado de error honesto; `error.tsx` si aplica | Alta |
| R19 | **Paginación por offset** | Altas concurrentes desplazan filas | Aceptar en B; documentar; cursor en C | Baja |
| R20 | **Breakpoint tablet 760 vs 1024** | AppShell móvil ≤760; Caja legacy ≤1023; a 768 se ve sidebar desktop | Decidir en B/E; probar 760, 761, 768, 1024; no cambiar sin capturas | Media |
| R21 | **Mojibake en copy nuevo** | `app/caja/page.tsx` title muestra “Caja � Mercado Cero”; `ventas/page.tsx` muestra “Todav��a” | Guardar archivos en UTF-8 sin BOM; revisar strings visibles y `<title>`; test de texto exacto | Media |

---

## 8. Plan de archivos

> Los archivos con `M` ya existen; `A` nuevos; `D` a eliminar. No editar `lib/orders.ts`, `lib/cash.ts`, `lib/db.ts`, `lib/payment-*.ts`, `lib/pey*.ts`, `lib/checkout.ts`, `app/api/**` financiero, `app/pay/**` ni `proxy.ts`.

| Archivo | Acción | Contenido |
|---|---|---|
| `web/src/components/shell/nav.ts` | **M** | `appNav` con Caja; labels/aria; `appFoot`; `mobilePrimary` 4; `mobileMore` 3+foot; helper de activo si se usa |
| `web/src/components/shell/app-shell.tsx` | **M** | `activeId`; `RouteFocus`; `TextZoom`; props de nav; sin doble shell |
| `web/src/components/shell/sidebar.tsx` | **M** | activo por `activeId`; targets; `aria-current` |
| `web/src/components/shell/mobile-nav.tsx` | **M** | activo por `activeId`; summary con hijo activo; cierre al navegar; targets |
| `web/src/components/shell/shell.css` | **M** | shell móvil flex; nav como fila; safe areas; panel; ancho; `scroll-padding` |
| `web/src/components/shell/route-focus.tsx` | **A** | foco a `main`/`h1` en cambio de pathname; skip inicial/hash/dialog |
| `web/src/components/shell/text-zoom.tsx` | **A** | detector de raíz ≥24 px → `data-text-zoom="large"` (reutiliza el patrón de `caja-app.tsx`); necesario para la paybar a 200 % real |
| `web/src/app/layout.tsx` | **M** (opcional) | `interactiveWidget: "resizes-content"` si el tipo lo soporta; no tocar fuentes |
| `web/src/app/caja/page.tsx` | **A/M** | server, `connection()`, `instant=false`, metadata, `ayuda=1` → puente, error de datos |
| `web/src/app/caja/loading.tsx` | **A** (opcional) | skeleton de Caja con shell, sin layout shift |
| `web/src/components/caja/caja-screen.tsx` | **M** | `activeId="caja"`; paybar; `visualViewport`; foco; error; sin `window.confirm` |
| `web/src/components/caja/sale-summary.tsx` | **M** | `id="confirmar"`; total; CTA único; paybar; `aria-describedby`; estados |
| `web/src/components/caja/caja.css` | **M** | grid 2→1; paybar; container queries; 200 %; safe area; sin anchos fijos |
| `web/src/app/ventas/page.tsx` | **A/M** | `page`; 20 por página; `countOrders`/`listOrders`; error; demo; `ayuda=1` |
| `web/src/app/ventas/ventas.css` | **M** | filas responsive; paginación; stats auto-fit; safe area; 200 % |
| `web/src/app/ventas/route.ts` | **D** | ya no puede coexistir con `page.tsx` |
| `web/src/app/inicio/page.tsx` | **M** | CTA “Registrar” → `/caja` (ya en árbol); “Ir a ventas” → `/ventas`; sin otros cambios |
| `web/next.config.ts` | **M** | `privateHeaders` para `/caja/:path*`, `/ventas/:path*`, `/inicio` |
| `web/src/app/_redirects/tab.ts` | **M** (mínimo) | conservar helper; comentar hash/ayuda; no cambiar 307 |
| `web/src/lib/pagination.ts` | **M** | `parsePage`/`pageOffset` (o helper equivalente) + tests; no tocar límites existentes |
| `web/scripts/oleada-b-smoke.py` | **A** | matriz de rutas, nav, responsive, foco, ayuda, paginación |
| `web/scripts/oleada-a-smoke.py` | **M o congelar** | actualizar expectativas o marcar histórico; hoy fallará |
| `quality-reports/oleada-b/SHELL_RUTAS.md` | **A** | este documento |

### Orden de implementación sugerido

1. **Shell/nav** (`nav.ts`, `app-shell`, `sidebar`, `mobile-nav`, `shell.css`, `route-focus`). No tocar páginas todavía. Tests de Inicio 1448/390/320.
2. **Rutas** (`/caja/page.tsx`, `/ventas/page.tsx`, borrar `ventas/route.ts`, headers privados). Verificar matriz HTTP y `/pay/**`.
3. **Caja responsive** (`caja-screen`, `sale-summary`, `caja.css`): paybar, total/CTA, teclado, 200 %.
4. **Ventas** (`page.tsx`, `ventas.css`): paginación, vacío/error/demo, verdad del pago.
5. **Foco/back/forward** (`route-focus`, paginación, resultado de Caja).
6. **Pruebas y evidencia** (`oleada-b-smoke.py`, capturas, axe, p0/checkout/webhook).
7. **Revisión independiente**; no declarar migración sin paridad funcional.

---

## 9. Criterios de aceptación

### 9.1 Rutas y redirects

- [ ] `GET /caja` → **200**; HTML con `h1` “Caja” o “Nueva venta” + eyebrow “Caja”, `<title>` con “Caja”, `aria-current="page"` en Caja y sin `?tab=` en la URL.
- [ ] `GET /ventas` → **200**; sin redirect; `aria-current` en Ventas; `/ventas` es la forma canónica de la página 1 y `?page=1` muestra lo mismo sin redirigir.
- [ ] `GET /ventas?page=2` → 200; muestra el rango 21–40; `?page=999` → 307 a la última página; `?page=abc` → 307 a `/ventas`; seguir el redirect da 200 y no hay bucle.
- [ ] `GET /caja?ayuda=1` → 307 `/?ayuda=1`; con `#ajustes`, el hash llega y el sheet abre Ajustes.
- [ ] `GET /ventas?ayuda=1` → 307 `/?ayuda=1`; atrás vuelve a `/ventas`.
- [ ] `GET /fiados?ayuda=1` → 307 `/?tab=fiado&ayuda=1`; ídem Corte/Metas/Pendientes; hash preservado.
- [ ] `GET /` → 200 legacy; `/?tab=caja` → 200 legacy; `/?tab=fiado` → 200 tab Fiado; `?tab=inventado` cae a Caja.
- [ ] `GET /pay/**` → sin AppShell, sin `aria-current`, sin cambios de checkout; checkout 19/19.
- [ ] Cadenas de redirect: máximo **1** salto para aliases y puente de ayuda; 0 para `/caja` y `/ventas` sin `ayuda`.
- [ ] No existe `web/src/app/ventas/route.ts`; `page.tsx` y `route.ts` no conviven.

### 9.2 Navegación

- [ ] Escritorio: exactamente `Inicio, Caja, Ventas, Fiados, Corte, Metas, Pendientes` + `Ayuda, Ajustes`.
- [ ] Móvil: primarios `Inicio, Caja, Ventas, Fiados, Más`; Más = `Corte, Metas, Pendientes, Ayuda, Ajustes`; sin duplicados.
- [ ] Un solo `aria-current="page"` visible en `/inicio`, `/caja`, `/ventas`, `/?tab=*`, 404 y `/pay/**` (en pay: ninguno).
- [ ] En `/caja`, Caja activo; en `/ventas`, Ventas activo; en `/`, el tab correspondiente; en ruta desconocida, ninguno.
- [ ] Si el activo está en Más, el panel link tiene `aria-current` y el summary indica el hijo activo; no hay dos activos.
- [ ] Sidebar y mobile nav nunca visibles a la vez (probar 760 y 761 px).
- [ ] “Más” abre, scrollea si hace falta, cierra con Escape y devuelve foco al summary; click fuera cierra.
- [ ] Targets: sidebar ≥48, primarios ≥64, links Más ≥48, CTA ≥56, paginación ≥48.
- [ ] Labels completos a 320 y 200 %; sin truncar “Pendientes”/“Ajustes”; sin scroll horizontal.
- [ ] `Ayuda`/`Ajustes` llevan al sheet legacy y no marcan un activo falso en la nav nueva.

### 9.3 Caja responsive

- [ ] 1448×1086, normal: total y CTA visibles al cargar, con 0 y 3 conceptos; sin scroll horizontal.
- [ ] 1366×768, normal: total y CTA visibles al cargar (paybar o resumen); sin scroll horizontal.
- [ ] 390×844: paybar con total y CTA visibles al cargar; encima de la nav; sin tapar el home indicator.
- [ ] 320×568: ídem; campos cantidad/precio apilados o en 2 columnas sin recorte; CTA full width.
- [ ] 200 % real (raíz 32 px o zoom de navegador; no basta `xlarge`): total/CTA alcanzables sin scroll horizontal; sin chrome encima; labels completos.
- [ ] Con teclado virtual abierto (390, foco en efectivo), el campo y el CTA son alcanzables; no hay scroll horizontal; la paybar no queda debajo del teclado.
- [ ] `scrollWidth === clientWidth` en `html`, `body` y `main` en los 5 escenarios.
- [ ] El total nunca se parte; `$1,234.50` y montos grandes caben.
- [ ] El CTA deshabilitado sigue visible y tiene texto de apoyo; al agregar concepto se habilita.
- [ ] Error de validación: `role="alert"`, foco al primer campo inválido, sin perder el total.
- [ ] Guardando: `aria-busy`, sin doble submit, sin botón duplicado visible.
- [ ] Resultado: foco al título, estado anunciado, “Volver a Caja” no es un link a la misma URL.
- [ ] `#confirmar` lleva a la tarjeta de cobro con margen de scroll.

### 9.4 Ventas

- [ ] 20 filas por página; “Mostrando 1–20 de N”; sin cargar 50+ al cliente.
- [ ] Anterior/Siguiente deshabilitados en extremos; números con `aria-current`; URL `?page=N`.
- [ ] Atrás/forward entre páginas funciona; al cambiar de página el foco va al encabezado/lista y el scroll no queda a mitad.
- [ ] Vacío real: `EmptyState` con CTA a `/caja`; no se muestra si hubo error.
- [ ] Error: `role="alert"` + Reintentar; no se disfraza de vacío.
- [ ] Demo: badge y filas “Demo (simulado)”; no se etiqueta “Cobrado” a demo.
- [ ] Cada fila muestra fecha, folio, cliente, total, estado y saldo; `details` de conceptos accesible.
- [ ] 320/200 %: filas apiladas, importes completos, paginación compacta; sin scroll horizontal.
- [ ] `/ventas` responde `private, no-store`; no se cachea entre visitantes.
- [ ] “Nueva venta” → `/caja`; el CTA del vacío → `/caja`; no hay enlaces muertos.

### 9.5 Foco, teclado y accesibilidad

- [ ] Skip link primero; Enter enfoca `main`; visible en ambos temas.
- [ ] Al navegar entre rutas, el foco va a `main`/`h1` y se anuncia el cambio (sin robar foco en hash/initial/dialog).
- [ ] Al paginar, el foco no queda en `body`; al cerrar “Más”, vuelve al summary; al cerrar un sheet, vuelve al trigger.
- [ ] Un solo `<main>` por página; un solo `<h1>`; landmarks de nav con label único.
- [ ] `aria-current` solo en el link activo; no en summary.
- [ ] Errores con `role="alert"`; estados con `role="status"`; no solo color.
- [ ] Focus visible en sidebar verde y en fondo claro; contraste ≥3:1 del anillo.
- [ ] `prefers-reduced-motion`: sin barridos/animaciones que impidan leer; el cambio de página no depende de animación.
- [ ] Axe 0 en `/caja` y `/ventas` a 1448 y 390, normal y alto contraste (o deuda documentada con nodo y regla).

### 9.6 Privacidad e integridad

- [ ] `/caja` y `/ventas` responden `Cache-Control` con `private` y `no-store` (Next lo emite por dinámica; se declara explícito); `/inicio` se verifica igual.
- [ ] `/pay/**` conserva sus headers y su contrato.
- [ ] No se envía el dashboard completo a `/ventas` si solo se necesitan 20 filas; el payload RSC se mide.
- [ ] No se toca `lib/orders.ts`, `lib/cash.ts`, `lib/db.ts`, `lib/payment-*.ts`, `lib/pey*.ts`, `lib/checkout.ts`, `app/api/**` financiero ni `app/pay/**`.
- [ ] No se marca `paid` sin webhook; demo sigue `demo_paid`; fiado sigue deuda.
- [ ] No hay doble venta automática entre `/` y `/caja` en la prueba de dos pestañas (o se documenta el riesgo y se muestra el aviso).

### 9.7 Regresión

- [ ] `p0-venta` 66/0, `p0-fiado` 51/0, `p0-corte` 69/0, `p0-dinero` 45/0 + 3 KNOWN, `p0-integración` 51/0.
- [ ] `webhook` 40/40; `checkout` 19/19; `payment-labels`; `security`.
- [ ] `npm run typecheck`, `npm run lint:gate`, `npm run build`, `npm run verify:static` verdes sobre el HEAD de la ola.
- [ ] `/` legacy mantiene `?tab=`, ayuda, draft v1 y todos los flujos; p0-shell sin cambios.
- [ ] `/inicio` conserva CTA “Registrar” funcional y nav de 7 destinos.
- [ ] No hay cambios en `proxy.ts` ni en el matcher de APIs.

---

## 10. Pruebas de rutas y navegación

### 10.1 Matriz HTTP (sin JavaScript)

Ejecutar contra un servidor aislado (no :3000) y guardar JSON:

```powershell
$BASE = "http://localhost:3101"
$routes = @(
  "/caja", "/ventas", "/ventas?page=2", "/ventas?page=999", "/ventas?page=abc",
  "/caja?ayuda=1", "/ventas?ayuda=1",
  "/fiados?ayuda=1", "/corte", "/metas", "/pendientes",
  "/", "/?tab=caja", "/?tab=fiado", "/?tab=corte", "/?tab=meta", "/?tab=pendientes",
  "/inicio", "/pay/inexistente"
)
foreach ($r in $routes) {
  curl.exe -s -o NUL -D - "$BASE$r" |
    Select-String -Pattern '^HTTP/|^[Ll]ocation:|^[Cc]ache-[Cc]ontrol:'
}
```

Comprobaciones:

- `/caja` y `/ventas` sin `ayuda`: 200, sin `Location`, `Cache-Control` privado.
- `/ventas?page=999`: 307 con `Location` canónico; seguir una vez y obtener 200.
- `/fiados?ayuda=1`: 307 con `tab=fiado` y `ayuda=1`; sin `tab` de origen.
- `/caja?ayuda=1`: 307 a `/?ayuda=1`; sin `tab`.
- `/pay/inexistente`: mismo comportamiento que antes de B (no envolver con shell).

### 10.2 Playwright: rutas, foco, back/forward y hash

Crear `web/scripts/oleada-b-smoke.py` (modelo: `oleada-a-smoke.py` + `p0-shell-e2e.py`):

1. **Nav escritorio 1448:** hrefs exactos, un `aria-current`, sidebar visible, mobile nav oculta.
2. **Nav móvil 390/320:** 5 primarios, Más con 5 links, targets, Escape/fuera, activo en Más.
3. **Activo por URL:** visitar `/inicio`, `/caja`, `/ventas`, `/?tab=corte`, `/pay/...` y 404; contar `aria-current="page"` **visibles** (no solo nodos con `display:none`) = 1 o 0.
4. **Back/forward:** `/inicio` → `/caja` → `/ventas` → atrás → `/caja`; `/ventas?page=2` → atrás → `page=1` → forward → `page=2`.
5. **Hash/ayuda:** `/fiados?ayuda=1#ajustes` termina en `/?tab=fiado&ayuda=1#ajustes`, sheet abierto, Ajustes visible; atrás vuelve a `/fiados` (o a la página anterior).
6. **Puente de ayuda:** `/caja?ayuda=1#ajustes` → `/?ayuda=1#ajustes`; atrás vuelve a `/caja`; draft restaurado.
7. **No bucles:** seguir cada redirect con `max_redirects=0`, validar Location; navegar con `page.goto` y comprobar que la URL final es estable tras 1 salto.
8. **Foco:** después de click en nav, `document.activeElement` es `main`/`h1`; después de paginar, el foco no es `body`; después de Escape en Más, es `SUMMARY`.

### 10.3 Playwright: layout de Caja

Para cada viewport `[1448×1086, 1366×768, 390×844, 320×568]` y cada modo de texto `[normal, xlarge (20 px), zoom200 (raíz 32 px con html{font-size:200%})]`:

- Cargar `/caja`.
- Medir `#total`, `[data-testid="caja-confirm"]` (o selector estable), `.mc-caja-paybar`, `.mc-mobile-nav`.
- Agregar 3 conceptos por UI (descripción, cantidad, precio) y volver a medir.
- Comprobar:
  - `document.documentElement.scrollWidth === clientWidth`.
  - `main.scrollWidth === main.clientWidth`.
  - Total y CTA dentro del viewport (`top >= 0 && bottom <= innerHeight`) o paybar sticky visible.
  - CTA no solapa nav (`cta.bottom <= nav.top + 1`).
  - Paybar no tapa el último campo con foco (`scrollIntoView`).
- Simular teclado: viewport 390×400 o `visualViewport` mock; foco en efectivo; medir de nuevo.
- Capturas: `quality-reports/oleada-b/capturas/caja-{viewport}-{text}.png` y `caja-{viewport}-paybar.png`.

### 10.4 Playwright: Ventas

- `/ventas` vacío (reset demo / DB sin ventas): `EmptyState`, CTA `/caja`, sin paginación.
- Sembrar 45 ventas (o usar el dataset de demo): 20/20/5; “Mostrando 1–20 de 45”; página 3 con 5; anterior/siguiente.
- `/ventas?page=999` → última página; `/ventas?page=abc` → `/ventas`.
- Atrás/forward y foco.
- Demo: filas “Demo (simulado)”, no “Cobrado”.
- 390/320/200 %: sin overflow; capturas.
- Error: interceptar/forzar fallo de lectura y comprobar alerta + Reintentar (si la página es server component, probar con un flag de test o un endpoint mock; no inventar datos).

### 10.5 Accesibilidad y manual

- `python web/scripts/a11y-contrast.py` (o `hig-audit.py`) contra :3101 en `/caja`, `/ventas`, normal y `data-contrast=high`.
- `axe` con Playwright en 1448/390/320 y 200 %.
- Teclado real: Tab/Shift+Tab por sidebar, Más, formulario, paybar, paginación; sin trampas.
- Lector: NVDA o TalkBack en `/caja` y `/ventas`; anuncio de página, total, errores, cambio de página. **No certificar WCAG sin lector real.**
- iOS/Safari: teclado virtual, safe area, `100dvh`, sticky paybar.
- Evidencia: `quality-reports/oleada-b/oleada-b-smoke.json`, capturas y logs; no reutilizar `latest.json` de otro SHA.

### 10.6 Gates existentes

- `npm run typecheck`
- `npm run lint:gate`
- `npm run build`
- `npm run verify:static`
- `npm run test:contracts`
- `python scripts/p0-venta-e2e.py`, `p0-fiado-e2e.py`, `p0-corte-e2e.py`, `p0-dinero-e2e.py`, `p0-integracion-e2e.py`
- `python scripts/p0-shell-e2e.py` (legacy `/`; debe seguir verde)
- checkout 19/19, webhook 40/40, security
- `python scripts/oleada-b-smoke.py`

**No** ejecutar `git add .` ni commitear sin autorización.

---

## 11. Decisiones abiertas y deuda

| Tema | Decisión B | Deuda / siguiente |
|---|---|---|
| `/` canónico | Se queda 200 legacy | C/E: decidir redirect a `/caja` o retirar legacy con paridad y pruebas |
| Ayuda/Ajustes | Puente 307 a `/?ayuda=1` | C/D: extraer `HelpSheet` y abrir en la misma página; retirar puente |
| `?tab=` ↔ URL | Sin cambios; tabs legacy no escriben URL | C: `replaceState` si se decide; nunca `pushState` por tab |
| Paridad Caja | B = captura manual + cobro | Voz, verificar, pendientes, demo reset, actividad y ayuda antes de declarar “Caja migrada” |
| Detalle de venta | Sin `/ventas/[id]`; `details` inline | C: detalle/recibo si producto lo pide |
| Paginación | Offset, 20/página | C: cursor `created_at,id` si hay volumen |
| Breakpoint tablet | AppShell móvil ≤760; legacy ≤1023 | E: unificar 760/1024 con capturas 768/1024 |
| `/inicio` privado | Next ya emite `no-store` por dinámica; verificar | Declarar explícito si se quiere contrato en `next.config` |
| `start_url` PWA | `/inicio` sin cambio | E: decidir si Caja debe ser entrada |
| Auth/roles | Ausente; single-user local | Fuera de alcance; documentar |

### Condiciones de NO-GO

- `/` deja de ser 200 o `?tab=` deja de funcionar.
- `/ventas` sigue siendo 307 o existe un bucle de redirects.
- `/pay/**` queda envuelto por AppShell o falla checkout/webhook.
- Hay dos `aria-current` o dos nav visibles en la misma pantalla.
- El total o el CTA quedan fuera del primer viewport en 1448/1366/390/320.
- Hay scroll horizontal en 320 o 200 %.
- `/caja` o `/ventas` no tienen `Cache-Control` privado.
- Se declara “Caja migrada” sin voz/verificar/pendientes/ayuda o sin verificación independiente.

---

## 12. Anexo: evidencia rápida

- Servidor base: `http://localhost:3100`, buildSha `26c7741...`, `/api/health` 200.
- `/caja` 404; `/ventas` 307; alias 307; `/` y `/inicio` 200.
- `/fiados?ayuda=1#ajustes` → `/?tab=fiado&ayuda=1#ajustes`, hash y sheet OK.
- Back después de `/inicio` → `/ventas` (307) vuelve a `/inicio`; el redirect no deja entrada intermedia.
- Click en tab legacy no cambia la URL; back sale de `/` (comportamiento actual, no se toca).
- Medición de CTA legacy: ver §1.3; el objetivo de B es que la Caja nueva no repita esos números.
- Árbol observado con cambios sin commitear: ver §1.4; no se editaron.
