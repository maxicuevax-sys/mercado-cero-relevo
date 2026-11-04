# 03 — Shell y navegación · Oleada B

> **Rol:** `mc-shell-responsive` (revisión adversarial, solo lectura)  
> **Repo:** `mercado-cero`  
> **HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`  
> **Servidor:** `http://localhost:3100` · `buildSha=4130e71…` (health verificado)  
> **Fecha:** 2026-11-04  
> **Declaración:** no edité producto, no hice commits, no reseteé la base. Sí creé ventas y borradores demo por la UI para recorrer el flujo. Otros auditores incrementaron el dataset durante la sesión (15 → 107 pedidos); las cifras de paginación son una foto, no una medida estable.  
> **Evidencia:** `quality-reports/oleada-b-review/EVIDENCIAS/shell-*` (índice en §10).

---

## 0. Veredicto

**NO-GO para declarar el shell migrado ni para dar por aprobado el gate responsive/200 % de Oleada B.**

- **P0 de routing/shell: ninguno.** No hay bucles de redirect, `/pay/**` no recibe el shell nuevo, hay un solo shell **visible** por documento, `aria-current` visible es correcto y el skip link funciona.
- **P0 de producto: 1.** Dos Cajas con borradores y `requestId` independientes; la misma venta puede registrarse dos veces sin un aviso contextual. B lo documenta en `ENTREGA_OLEADA_B.md` §11.1, pero la UI no lo mitiga.
- **P1: 5.** 200 % roto con contenido; CTA fuera del primer viewport en 1366×768 y 768×1024; desborde del pager en `/ventas` a 320 + 200 %; foco de ruta en `BODY`; destinos legacy presentados como migrados con cambio de modelo de nav.
- **P2: 9. P3: 5.**
- El **camino feliz 1448×1086 y 390×844 normal** funciona: `/inicio → /caja → venta → /ventas → regreso`, atrás/adelante, recarga, `?tab=`, `ayuda=1`, hash y borrador v2.
- Lo que bloquea la declaración: **200 % real**, **1366×768 / 768×1024 con 3 conceptos**, **foco de ruta**, **pager a 320/200 %**, **destinos legacy** y **doble Caja/draft**.

| Severidad | Nº | ¿Bloquea “shell migrado”? |
|---|---:|---|
| P0 producto | 1 | Sí, o requiere aceptación explícita de riesgo financiero |
| P1 | 5 | Sí |
| P2 | 9 | No por sí solos; deben quedar como deuda con dueño |
| P3 | 5 | No |

---

## 1. Método y alcance

- **HTTP real** sin JS: matriz de 30 rutas, códigos, `Location`, `Cache-Control` (`shell-http-matrix.json/.txt`).
- **Playwright Chromium** contra el build servido: recorrido completo, nav escritorio/móvil, back/forward, recarga, hash, borradores, 404, `/pay/**`, viewports 1448/1366/768/390/320, zoom 200 % y texto 200 % (raíz 32 px).
- **125 comprobaciones automáticas** en `shell-audit.json`. El resumen bruto contiene 17 marcas `FAIL`: **12 son artefactos de medición** y **5 son fallos reales** (`D12.4`, `D12.5`, `D14.6`, `D15.4`, `M7.3`); `D15.4` tiene además la comprobación mal escrita, pero el hallazgo de fondo —no hay aviso de v1— es real. Los artefactos se explican en §9.
- Sondeos corregidos y aislados en `shell-probes2.json`, `shell-probes3.json`, `shell-cta-scrolltop.json`, `shell-caja-desktop-text200.json`, `shell-text200-geometry.json`, `shell-text200-navlabels.json`, `shell-state.json` y `shell-duplicate-dom.json`.
- No se usó el reset demo. Las ventas “Auditoria shell”, “Probe volver”, etc. son datos demo creados por la UI; no se limpiaron.

---

## 2. Matriz de rutas y redirects (task 1)

| Ruta | Status | `Location` / resultado | Shell final | Veredicto |
|---|---:|---|---|---|
| `/inicio` | 200 | — | nuevo | OK |
| `/caja` | 200 | — | nuevo | OK |
| `/ventas` | 200 | — | nuevo | OK |
| `/ventas?page=2` | 200 | — | nuevo | OK; 25 filas |
| `/ventas?page=999` | 200 | — | nuevo | **P2**: muestra la última página bajo URL inválida; no canonicaliza |
| `/ventas?page=abc` | 200 | — | nuevo | **P2**: muestra página 1 bajo URL inválida |
| `/ventas?page=0` | 200 | — | nuevo | **P2**: ídem |
| `/ventas?ayuda=1` | 200 | — | nuevo | **P2**: ignora `ayuda=1`; el contrato pedía 307 a `/?ayuda=1` |
| `/caja?ayuda=1` | 200 | — | nuevo | **P2**: ignora `ayuda=1`; no abre el sheet |
| `/fiados` | 307 | `/?tab=fiado` | legacy | OK como alias; **P1** de discontinuidad |
| `/corte` | 307 | `/?tab=corte` | legacy | ídem |
| `/metas` | 307 | `/?tab=meta` | legacy | ídem |
| `/pendientes` | 307 | `/?tab=pendientes` | legacy | ídem |
| `/fiados?ayuda=1` | 307 | `/?tab=fiado&ayuda=1` | legacy | OK |
| `/corte?ayuda=1#ajustes` | 307 | `/?tab=corte&ayuda=1` | legacy | Hash preservado por el navegador; sheet abre |
| `/` y `/?tab=*` | 200 | — | legacy | OK; `tab` inválido cae a Caja |
| `/pay/<id>` | 200 | — | pay | OK; sin shell de tienda |
| `/pay/inexistente` | **200** | — | pay | **P2**: UI de “no encontrado” con status 200 |
| `/ruta-inexistente` | 404 | — | ninguno | **P2**: 404 por defecto de Next, en inglés y sin nav |

**Lo que pasa:**

- `/caja`, `/ventas`, `/inicio` y `/` responden `Cache-Control: private, no-store, max-age=0, must-revalidate`; `/pay/**` conserva `private, no-store`.
- No hay bucles: los alias hacen **un solo 307**; `/caja` y `/ventas` no redirigen; `/` sigue siendo 200 legacy.
- `?tab=caja|fiado|corte|meta|pendientes` abre el tab correcto; `?tab=inventado` cae a Caja. En `/caja?tab=…` y `/ventas?tab=…` el parámetro se ignora y no redirige (200), como estaba previsto.
- `/?ayuda=1` abre “Ayuda y ajustes”; `/?ayuda=1#ajustes` deja `#ajustes` visible (`top=152`, `bottom=576` a 1448×1086); `/fiados?ayuda=1#ajustes` termina en `/?tab=fiado&ayuda=1#ajustes` con el sheet abierto.
- Atrás/adelante de rutas nuevas funciona: `/inicio → /caja → /ventas`, atrás vuelve a `/caja`, adelante a `/ventas`. El 307 de alias no deja entrada intermedia: atrás desde legacy vuelve a `/ventas`; adelante regresa a `/?tab=fiado`.
- Recargar `/ventas` y `/ventas?page=2` conserva página y filas.
- Un borrador v2 se recupera tras recargar, tras ir a Ventas y volver, y tras abrir Ayuda y volver (`$8.00` y `$9.00` medidos).

**Lo que no:**

- `?page=999|abc|0` no redirige ni canoniza: la URL miente sobre la página mostrada. B lo tenía como P3; aquí es **P2** porque afecta deep links y el botón atrás.
- El puente `ayuda=1` de `/caja` y `/ventas` no existe. El `SHELL_RUTAS.md` de B lo exigía como 307; la implementación lo ignora.
- `/ventas` usa **25 por página**, no 20 (`ventas/page.tsx:38-50`). B lo declara en su entrega; el contrato de shell decía 20.
- `/pay/inexistente` devuelve 200 (la página llama `notFound()`, pero el status observado es 200). Es previo a B y no envuelve shell; se documenta como P2.

---

## 3. Hallazgos

### P0-1 — Dos Cajas, dos borradores y dos `requestId`: la misma venta puede registrarse dos veces sin aviso contextual

**Evidencia:** `shell-draft-v1-v2-caja-mobile-clean.png`, `shell-draft-v1-restored-legacy-mobile-clean.png`, `shell-probes2.json`.

**Reproducción:**

1. En el mismo origen se inyecta un borrador v1 con `Quesadilla ×2 × $35 = $70` y fecha actual.
2. Se abre `/caja` y se agrega exactamente la misma línea (`Quesadilla ×2 × $35`). La pantalla muestra **$70.00** y el banner “Recuperamos una venta sin confirmar” **solo del v2**; no hay ninguna mención al v1.
3. `localStorage` conserva a la vez `mercado-cero:draft:v1` y `mercado-cero:caja-draft:v2`.
4. Se abre `/`: la Caja legacy restaura el v1 con “Recuperé tu venta de las 11:14 a.m. … $70.00”.

El shape inyectado es exactamente el que escribe la Caja legacy (`readStoredDraft`/`StoredDraft`); que la propia legacy lo restaure valida que es un estado real, no un objeto inventado por el test.

**Código:**

- v2: `web/src/components/caja/caja-screen.tsx:32-34` (`caja-draft:v2`, `caja-request:v2`, `caja-pending:v2`).
- v1: `web/src/components/caja-app.tsx:110-116` (`draft:v1`, `sale-request:v1`, `pending-order:v1`).
- `CajaScreen` solo lee `DRAFT_KEY` v2 (`caja-screen.tsx:94`); no busca `draft:v1`.
- El backend idempotencia por `requestId` + `requestHash`, no por contenido (`web/src/lib/orders.ts:57-88, 213-226`); los dos borradores generan `requestId` distintos y no hay lock entre pestañas.
- La única mitigación visible es la nota fija al pie: “los borradores de cada pantalla son independientes” (`caja-screen.tsx`, footnote). No aparece un aviso **cuando existe** un v1.

**Impacto:** dos borradores de la misma venta pueden confirmarse en `/` y `/caja` y producir dos pedidos. No es duplicación automática: requiere que la persona confirme en ambas pantallas, pero no recibe ninguna señal de que la otra existe. Es un riesgo de dinero, no solo de UX.

**Recomendación:** si existe v1 y no v2, mostrar un `role="status"` con “Tienes una venta sin confirmar en la Caja clásica” y acciones “Importar” / “Descartar” / “Seguir aquí”; no borrar v1. Añadir lock `BroadcastChannel` o dedupe por hash de contenido en servidor. B ya lo reconoce como pendiente; la UI no lo cumple.

> **Nota de severidad:** si el producto acepta formalmente el riesgo documentado y prohíbe usar ambas Cajas a la vez, puede bajar a P1. Hoy la nav y la footnote no impiden el doble registro.

---

### P1-1 — 200 % de texto rompe el layout: solapamientos, valores recortados y CTA fuera de pantalla

**Evidencia:** `shell-caja-1366-text200-three.png`, `shell-caja-1448-text200-three.png`, `shell-caja-390-text200-item-clean.png`, `shell-caja-desktop-text200.json`, `shell-text200-geometry.json`, `shell-text200-navlabels.json`.

El gate de B (“200 % sin overflow”) mide `scrollWidth === clientWidth`. Eso pasa en Caja, pero **no detecta solapamiento ni recorte**. Con raíz de 32 px y contenido real:

| Viewport | Medición | Resultado |
|---|---|---|
| 1366×768, 3 conceptos | CTA `y=1437.5`, `bottom=1493.5`; total `y=614.4` | CTA fuera de pantalla; cabecera “CANTIDAD PRECIO” solapada; marca “Mercado Cero” recortada por el sidebar |
| 1448×1086, 3 conceptos | CTA `y=1395.2`, `bottom=1451.2`; total `y=615.6` | CTA fuera; mismos solapamientos de tabla/marca |
| 390×844, 1 concepto | paybar total `right=187.7` vs CTA `left=179` → **8.7 px de solape**; input precio `clientW=76` vs `scrollW=152`; “Cantidad” `y=664.5` vs “Precio” `y=626.9 h=75.4` | Total tapado por el botón; precio no se puede leer completo; labels de cantidad/precio se pisan |
| 320×640, 1 concepto | paybar total `right=184.1` vs CTA `left=143.8` → **40.3 px de solape**; input precio `clientW=116` vs `scrollW=152`; nav “Ventas” 80 px en celda de 64, “Fiados” 73.9 px en 64 | Total tapado; precio recortado; labels de nav se desbordan y se tocan |

Capturas: en 1366/1448 se ve la tabla con “CANTIDADPRECIO” encimado y la marca del sidebar cortada; en 390/320 se ve el paybar con “$2,469.0…” detrás de “Revisar cobro” y los labels de la línea encimados.

**Causa:** el grid de línea sigue usando columnas fijas en px (`caja.css:130`, `caja.css:936`), el paybar no permite wrap/stack y el topbar/nav no tienen un modo de 200 %. `data-text-zoom`/container queries no se implementaron en el shell nuevo.

**Recomendación:** contenedor `container-type: inline-size` y stack a `em`; en 200 % apilar descripción/cantidad/precio/importe; paybar en dos filas o columna; topbar con nombre truncado y `min-width:0`; nav con labels que no desborden la celda (o solo iconos + label accesible). El test debe comprobar **rectángulos disjuntos**, no solo `scrollWidth`.

---

### P1-2 — CTA “Confirmar venta” fuera del primer viewport en 1366×768 con 3 conceptos y en 768×1024; hueco 761–980 sin paybar

**Evidencia:** `shell-cta-scrolltop.json`, `shell-cta-scrolltop-1366x768.png`, `shell-cta-scrolltop-768x1024.png`, `shell-cta-scrolltop-1024x768.png`, `shell-761-cliff.json`.

Con `scrollTo(0,0)` y 3 conceptos:

| Viewport | CTA | Paybar visible | Veredicto |
|---|---|---|---|
| 1448×1086 | `y=797.6–853.6` | no | Visible; pasa |
| 1366×768 | `y=775.9–831.9` | no | **Fuera del viewport (768)** |
| 1024×768 | `y=768.1–824.1` | no | **0.1 px fuera**; falla por margen |
| 768×1024 | `y=1383.6–1439.6` | no | **Muy fuera**; incluso vacío `y=1122` |
| 390×844 | CTA real `y=1763`; paybar `y=715–780` | sí (con líneas) | El paybar muestra “Revisar cobro”, no confirma |

**Causa:** `caja.css:841` apila a una columna en `max-width:980px`, pero el paybar solo se activa en `max-width:760px` (`caja.css:859`). En la banda **761–980** hay una columna y **no hay paybar**. A 1366×768 no aplica ninguno de los dos; el CTA queda debajo del fold.

**Frontera 760/761 (medida):** a 760×900 la sidebar está oculta y la mobile nav visible; a 761×900 aparece una sidebar de **210 px**, desaparece la mobile nav y el CSS del paybar ya no aplica; el CTA queda en `y=1122`. Es un acantilado de 1 px de ancho (`shell-761-cliff.json`).

**Impacto:** en un portátil de 1366×768 —el viewport de demo— la acción principal no se ve al cargar con 3 conceptos. El usuario tiene que descubrir que debe hacer scroll. El `SHELL_RUTAS.md` lo exigía visible con 0 y 3 conceptos.

**Recomendación:** activar paybar por `max-height:820px` o `max-width:980px`, o mantener dos columnas hasta 760; medir el CTA con 3 conceptos en 1366×768 y 768×1024. A 390/320, decidir si el paybar debe confirmar directamente (“Cobrar $X”) en vez de “Revisar cobro”; hoy la acción real está ~1.000 px más abajo.

---

### P1-3 — `/ventas` a 320 + 200 % desborda 17 px por el pager

**Evidencia:** `shell-overflow-ventas-320-text200-clean.png`, `shell-probes2.json`.

- `html.scrollWidth = 337`, `clientWidth = 320`; `body.scrollWidth = 337`.
- Único culpable: el enlace **“Siguiente”** del pager, `left=168.3`, `right=337`, `width=168.8`.
- A 100 % no hay overflow; el fallo aparece al combinar 320 + texto 200 %.
- El pager usa `min-height:44px` (`ventas.css:249-260`), por debajo del target 48 del contrato; no tiene números ni `aria-current`, solo Anterior/Siguiente.

**Recomendación:** a 320/200 %, apilar o permitir wrap del pager (“Anterior” / “Página X de Y” / “Siguiente”), `min-height:48px`, y probar con texto 200 %. Añadir `aria-current="page"` y página actual textual si se mantiene el paginador numérico.

---

### P1-4 — Foco de ruta en `BODY`; paginación sin foco/scroll al encabezado; sin anuncio de ruta

**Evidencia:** `shell-audit.json`, `shell-probes2.json`, `keyboard-focus.json`.

- Click o `Enter` sobre un link de la nav: `document.activeElement` es **`BODY`**, tanto al ir a `/caja` como a `/ventas`; también al volver con atrás/adelante (salvo el resultado de Caja, que recupera su H2).
- Paginar con “Siguiente”: el foco queda en el **`A` “Siguiente”**, `scrollY=0`; no va al `<h1>` ni al encabezado de la lista.
- Atrás desde la página 2: `scrollY=3766`, foco en el enlace; la página reaparece a mitad del historial, no al inicio de la lista.
- No hay región `role="status"`/`aria-live` que anuncie el cambio de ruta.
- **Sí pasan:** skip link (primer Tab → “Saltar al contenido”; Enter → `inicio-main`), foco al resultado (`H2 mc-caja-result-title`), foco al cerrar “Más” (`SUMMARY`), foco al agregar/quitar conceptos.

**Causa:** `AppShell` no tiene `RouteFocus`; solo marca `<main tabIndex={-1}>`. Next no mueve el foco por sí solo.

**Impacto:** usuarios de teclado y lector de pantalla pierden el contexto tras cada navegación; el requisito 9.5 de `SHELL_RUTAS.md` y R13 no se cumplen. B lo tenía como P2; aquí lo subo a **P1** porque ocurre en **todas** las rutas y es un criterio explícito de aceptación.

**Recomendación:** componente `RouteFocus` que enfoque `main`/`h1` al cambiar `pathname` (sin robar foco en hash, primer render o diálogo), `scrollTo(0,0)`, y `aria-live` para anunciar la ruta. En paginación, enfocar el heading de la lista y hacer scroll al inicio.

---

### P1-5 — La nav nueva promete Fiados/Corte/Metas/Pendientes migrados, pero aterriza en el shell legacy; el modelo de nav cambia a 768 y en móvil

**Evidencia:** `shell-768-inicio.png`, `shell-768-legacy-corte.png`, `shell-mobile-390-legacy-corte.png`, `shell-desktop-legacy-fiado-via-nav.png`, `shell-http-matrix.json`.

- `/fiados`, `/corte`, `/metas`, `/pendientes` responden **307** a `/?tab=…` y terminan en `.app-shell` legacy.
- A **1448**: sidebar nueva (Mercado Cero) → sidebar legacy; labels cambian `Fiados → Fiado`, `Metas → Meta`.
- A **768**: la shell nueva muestra **sidebar lateral**; la legacy muestra **tab bar inferior** (`lg:hidden`), porque el legacy corta en 1024 y la nueva en 760. Es un cambio de modelo de navegación, no solo de piel.
- A **390**: la nav nueva es `Inicio / Caja / Ventas / Fiados / Más`; la legacy es `Caja / Fiado / Corte / Meta / Tareas`. Cambian destinos, labels y orden.
- La nav nueva **no marca** estos cuatro destinos como legacy/clásicos; el usuario solo lo descubre al aterrizar. B lo declara en la entrega y lo planifica para C/D, pero la interfaz no lo dice.

**Impacto:** el usuario cree que está en la misma aplicación y de repente cambia el chrome, el vocabulario y la Caja (la legacy tiene la suya). Es la discontinuidad que el task 2 pedía documentar. No es una regresión de código, pero **sí impide afirmar que la nav “migró” esos destinos**.

**Recomendación:** en B, marcar esos ítems como “Caja clásica”/“legacy” (icono o sufijo) o moverlos a un grupo “Clásica”; en C, migrarlos al AppShell. Unificar breakpoint 760 vs 1024 con capturas 768/1024.

---

### P2-1 — `ayuda=1` no funciona en `/caja` ni `/ventas`; la nav de Ayuda abandona la página actual

- `GET /caja?ayuda=1` → **200**, `Caja` normal, `dialogs=[]`.
- `GET /ventas?ayuda=1` → **200**, `Ventas` normal, `dialogs=[]`.
- El contrato de `SHELL_RUTAS.md` §4.1 pedía **307** a `/?ayuda=1`; el puente no está implementado.
- Sí funciona el camino de la nav: `Ayuda` → `/?ayuda=1` abre el sheet; `Ajustes` → `/?ayuda=1#ajustes` abre y posiciona; volver restaura el draft v2 ($9.00).
- **Pero** desde `/ventas`, `Ayuda` navega a `/?ayuda=1` legacy; tras cerrar el sheet (botón “Cerrar”) el usuario queda en la **Caja legacy** (`h1=Caja`), no vuelve a Ventas. Atrás sí restaura `/ventas`, pero cerrar no (`shell-help-close.json`).
- **Impacto:** deep links de ayuda desde Caja/Ventas no abren ayuda; y la ayuda de la nav cambia de shell/pantalla. P2.

### P2-2 — Paginación: 25/página, URL no canónica y pager de 44 px

- 25 filas por página (medido: 25/25/…/7 con 107 pedidos). El contrato decía 20.
- `?page=999` muestra la última página (5 de 5) con URL 999; `?page=abc` y `?page=0` muestran página 1 con URL inválida. No hay 307 ni `replaceState`.
- El pager solo tiene “Anterior/Siguiente”, `min-height:44px`, sin números ni `aria-current`.
- Back/forward entre páginas funciona (URL y filas correctas), pero foco/scroll no (§P1-4).
- **Impacto:** deep links y QA se vuelven ambiguos; target por debajo de 48. P2.

### P2-3 — 404 por defecto, en inglés y sin shell/nav

- `/ruta-inexistente` → **404** correcto, pero el body es `404 This page could not be found.` (Next por defecto), sin AppShell, sin nav, sin `aria-current`.
- **Impacto:** callejón sin salida y cambio de idioma. P2; no hay `app/not-found.tsx` propio.

### P2-4 — `/pay/inexistente` responde 200

- Status **200**, body “Extraviado / Cobro no disponible / No encontramos este cobro”; `.pay-shell=1`, sin shell nuevo/legacy, `aria-current=0`.
- No envuelve shell (correcto), pero el status debería ser 404. Es previo a B; P2.

### P2-5 — “Volver a Caja” del resultado es un no-op

- En el resultado, el link `href="/caja"` no cambia de estado: tras click, URL `/caja`, `h1` sigue “Venta registrada”, `.mc-caja-result` sigue visible y el body sigue “Venta cobrada”.
- “Nueva venta” sí resetea. **Impacto:** el usuario cree que vuelve a una Caja limpia y sigue en el resultado. P2 (B lo tenía como P3; la etiqueta engaña).

### P2-6 — Los tabs legacy no escriben la URL: recargar pierde el tab

- `/?tab=fiado` → click “Corte” → URL sigue `?tab=fiado`, h1 “Corte de caja”.
- Recargar → vuelve a “Fiado” (el `?tab=fiado` original).
- `/` → click “Fiado” → URL sigue `/`; recargar → “Caja”.
- Atrás desde `/` sale de la página, no recorre tabs.
- Es la decisión aceptada de B (no `pushState`), pero es pérdida de estado visible. P2; documentar o sincronizar con `replaceState` en C.

### P2-7 — Caja vacía en móvil: total y CTA fuera del primer viewport y sin paybar

- 390×844: total `y=904.8`, CTA `y=1220`; no hay paybar (solo se renderiza con `lines.length > 0`).
- 320×640: total `y=926.6`, CTA `y=1256.7`; ídem.
- Con 1+ conceptos sí aparece el paybar (`y=715–780` / `511–576`) y el total es visible; el CTA real sigue abajo.
- **Impacto:** el estado vacío no muestra el total $0.00 ni el CTA deshabilitado en el primer viewport, contra el criterio 9.3. P2.

### P2-8 — Safe area superior ausente y teclado virtual no gestionado

- `layout.tsx` declara `viewportFit: "cover"`; el shell nuevo no tiene `padding-top: env(safe-area-inset-top)`. El legacy sí lo tiene (`barrio.css:2033`). En PWA standalone con notch, el topbar puede quedar debajo de la barra de estado.
- Abajo sí hay `env(safe-area-inset-bottom)` en `shell.css:100`, `caja.css:869/875`, `ventas.css:277`; en Chromium `env` resuelve 0, no se pudo validar en iOS.
- No hay `visualViewport` ni `interactive-widget=resizes-content` en la Caja nueva; el paybar es `fixed`. Con teclado iOS podría quedar debajo. **No probado en dispositivo real**; riesgo P2, no fallo confirmado.

### P2-9 — “Ver todos” de Inicio apunta al legacy

- `/inicio` “Ver todos” → `/?tab=pendientes` (legacy), mientras la nav usa `/pendientes` (que también redirige al legacy). Dos formas de llegar al mismo sitio, una de ellas salta el alias.
- **Impacto:** inconsistencia de deep links; se suma a P1-5. P2.

### P3

- **P3-1** Solo “Corte” tiene `aria-label` en `nav.ts`; faltan “Caja: nueva venta”, “Ventas: historial”, “Fiados: deudas y abonos” que el contrato listaba. El texto visible sigue siendo accesible.
- **P3-2** No existe `id="confirmar"`; el ancla real es `#mc-caja-payment-summary`. `/caja#confirmar` no tiene target (`:target=null`).
- **P3-3** “Más” no implementa `data-active-child` ni `aria-label` de “incluye la sección actual”. No es observable hoy porque sus 3 destinos de negocio son legacy; queda como deuda para C.
- **P3-4** Next conserva árboles previos ocultos (`display:none`): tras navegación suave hay 2–3 `<main>`, 2–3 `<h1>` y 2–4 `aria-current` en el DOM; **visible sigue siendo 1**. Los conteos por nodo (no por visibilidad) dan falsos positivos; no es un doble shell visible.
- **P3-5** Paybar y nav se tocan/solapan 1 px en normal y 200 % (`bottom=780`, `nav.y=779` a 390); el copy “Caja clásica” convive con “Caja” nueva sin una señal de cuál es cuál en la nav.

---

## 4. Navegación, `aria-current`, skip link, “Más” y foco

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `aria-current` visible en `/inicio` | 1 (`Inicio`) | `shell-state.json` |
| `aria-current` visible en `/caja` | 1 (`Caja`) | ídem |
| `aria-current` visible en `/ventas` y `?page=2` | 1 (`Ventas`) | ídem |
| `aria-current` visible en `/?tab=*` | 1 (botón legacy del tab) | `shell-state.json`, `shell-audit.json` |
| `aria-current` en `/pay/**` | 0 | `shell-probes2.json` |
| `aria-current` en 404 | 0 | `shell-state.json` |
| Un solo shell **visible** | nuevo en `/inicio`,`/caja`,`/ventas`; legacy en `/?tab=*`; pay en `/pay`; ninguno en 404 | `shell-audit.json` |
| Sidebar vs mobile nav | mutuamente excluyentes a 1448/768/390/320 | `shell-audit.json` |
| Skip link | primer Tab “Saltar al contenido”; Enter enfoca `inicio-main` | `shell-skip-link-focus-1448.png` |
| “Más” abre | panel 304×266 a 320; 5 links de 48 px; dentro del viewport | `shell-more-320-normal.png` |
| “Más” Escape | cierra y devuelve foco al `SUMMARY` | `shell-probes.json` |
| “Más” click fuera | cierra | `shell-probes.json` |
| Targets | sidebar 52; mobile 64; links Más 48; CTA 56; **pager 44** | `shell-probes3.json`, `ventas.css:249` |
| Foco tras nav | **BODY** | `shell-probes2.json` |
| Foco tras paginar | **A “Siguiente”**, scroll 0 | `shell-probes2.json` |
| Foco al resultado | H2 correcto | `keyboard-focus.json` |
| Foco al cerrar “Más” | SUMMARY correcto | `shell-probes.json` |

**Lectura:** la parte estática de a11y (landmarks, activo, skip, targets principales, Escape) está bien. El fallo es **foco de ruta** y **foco/scroll de paginación**, más el 200 %.

Todos los enlaces de la nav se clickearon: **7 de escritorio** y **5 de “Más”**; ninguno da 404. Los 4 destinos de negocio (`/fiados`, `/corte`, `/metas`, `/pendientes`) terminan en `/?tab=…` legacy; Ayuda/Ajustes abren el sheet legacy (`shell-nav-clicks.json`).

### 4.1 Reproducciones Playwright mínimas

| Caso | Resultado observado |
|---|---|
| `/inicio → /caja → /ventas → atrás → /caja → adelante → /ventas` | URLs correctas; el estado del resultado de Caja se conserva; el foco queda en `BODY` en cada transición (salvo el H2 del resultado) |
| Recarga de `/ventas` y `/ventas?page=2` | 200; página y filas se conservan (25 por página) |
| `/?tab=fiado → click “Corte” → recarga` | URL sigue `/?tab=fiado`; la recarga vuelve a Fiado, no a Corte |
| `/fiados?ayuda=1#ajustes` | 307 → `/?tab=fiado&ayuda=1#ajustes`; sheet abierto; `#ajustes` visible |
| Móvil 390: abrir “Más”, Escape, click fuera, navegar a Corte | Abre/cierra; Escape devuelve foco al summary; Corte termina en legacy con bottom tab bar |
| `?page=999`, `?page=abc`, `?page=0` | 200; muestran última/página 1 pero la URL no se canonicaliza |
| `/pay/<id>` y `/pay/inexistente` | Sin shell de tienda; el válido 200; el inexistente 200 con UI de no encontrado |
| 320 + texto 200 % en `/caja` y `/ventas` | Caja sin `scrollWidth` overflow pero con solapamientos; Ventas con overflow 337/320 |

---

## 5. Responsive y 200 % (task 3)

### 5.1 Viewports normales

| Viewport | Overflow | Nav | CTA/total primer viewport | Veredicto |
|---|---|---|---|---|
| 1448×1086 | No | sidebar | CTA 797–853 (3 conceptos) | Pasa |
| 1366×768 | No | sidebar | CTA 776–832 (**>768**) | **P1-2** |
| 1024×768 | No | sidebar | CTA 768.1 (**0.1 px fuera**) | P2 |
| 768×1024 | No | sidebar nueva | CTA 1383 con 3; 1122 vacío | **P1-2** |
| 761×900 | No | sidebar 210 px, sin mobile nav | CTA 1122 vacío; sin paybar | **P1-2** (acantilado 760/761) |
| 390×844 | No | mobile 5 slots | paybar 715–780 con líneas; vacío CTA 1220 | Normal pasa; vacío P2-7 |
| 320×640 | No | mobile 5 slots | paybar 511–576 con líneas; vacío CTA 1257 | Normal pasa; vacío P2-7 |

- En 390/320 normal, el contenido inferior no queda tapado: footnote de Caja `bottom=676 < navTop=779` (390); nota de Ventas `bottom=748 < 779`; padding `168px`/`96px` + safe.
- El paybar queda **encima** de la nav (`bottom=780`, `nav.y=779`), con 1 px de contacto.
- A 768 la Caja sigue en **una columna** (≤980) pero **sin paybar** (≤760): el hueco 761–980 es el problema.
- A 768 el shell nuevo usa sidebar; el legacy usa tab bar inferior (P1-5).

### 5.2 200 %

| Escenario | Resultado |
|---|---|
| 1448×1086 texto 200 %, 3 conceptos | `scrollWidth=1448`, sin overflow aparente, pero CTA `y=1395` fuera y cabecera de tabla solapada; marca del sidebar recortada |
| 1366×768 texto 200 %, 3 conceptos | CTA `y=1437`; cabecera “CANTIDADPRECIO” encimada; CTA fuera |
| 390×844 texto 200 %, 1 concepto | paybar total/CTA solapados 8.7 px; precio `76/152`; labels de cantidad/precio encimados; “Ventas” 80 px en celda 78 |
| 320×640 texto 200 %, 1 concepto | paybar solapado 40.3 px; precio `116/152`; “Ventas” 80/64 y “Fiados” 73.9/64; labels encimados |
| 320×640 texto 200 %, `/ventas` | `scrollWidth=337 > 320` por “Siguiente” (168.8 px) |
| 724×543 (zoom 200 % de 1448×1086) | Sin overflow; mobile nav; pasa el reflow básico |

**Conclusión:** el zoom de navegador (que reduce el viewport CSS) pasa; el **texto 200 % real** no. El gate de B midió solo `scrollWidth` y estado vacío; no detectó solapamientos ni recortes. Es el hallazgo P1 más importante de esta auditoría.

---

## 6. Legacy: discontinuidad de la nav (task 2)

- `/fiados`, `/corte`, `/metas`, `/pendientes`: **307** a `/?tab=…`; shell `.app-shell`, no `.inicio-shell`.
- A **1448**: sidebar legacy; el label `Fiados` pasa a `Fiado`, `Metas` a `Meta`; la “Caja” del sidebar legacy es la Caja vieja, no `/caja`.
- A **768**: shell nueva = sidebar de 210 px; legacy = tab bar inferior (`Caja / Fiado / Corte / Meta / Tareas`). Capturas `shell-768-inicio.png` vs `shell-768-legacy-corte.png`.
- A **390**: nav nueva = `Inicio / Caja / Ventas / Fiados / Más`; legacy = `Caja / Fiado / Corte / Meta / Tareas`. Captura `shell-mobile-390-legacy-corte.png`.
- `aria-current` del legacy funciona (1 visible, en un `<button>`), pero el vocabulario y el chrome cambian.
- La nav nueva **no señala** que esos 4 destinos son legacy; solo el pie de Caja menciona “Caja clásica” para la Caja, no para Fiados/Corte/Metas/Pendientes.
- Es una discontinuidad **conocida y aceptada** en el plan B (C/D), no una regresión; pero invalida cualquier afirmación de “nav migrada” y explica el salto visual en 768/móvil.

---

## 7. `/pay/**` (task 4)

- `/pay/ord_fa01042011bb4bfe94a8` → **200**, `.pay-shell=1`, `.inicio-shell=0`, `.app-shell=0`, `nav visible=0`, `aria-current=0`, `mainCount=1`. **No recibe shell nuevo.**
- `/pay/inexistente` → **200** con UI de “Cobro no disponible”; `.pay-shell=1`, sin shell de tienda, sin nav, sin `aria-current`. El shell está bien; el status es P2-4.
- `Cache-Control: private, no-store, max-age=0, must-revalidate` en `/pay/**`; se conserva.
- No hay `AppShell` global ni layout de grupo que envuelva checkout; la implementación por página se respeta.
- El botón “Volver” del checkout apunta a `/` (Caja legacy). No es un fallo de shell público, pero refuerza la discontinuidad de dos Cajas.

---

## 8. Lo que sí pasa (no perderlo)

1. **Rutas:** `/caja` 200, `/ventas` 200, `/inicio` 200, `/` 200; aliases 307 de un salto; sin bucles; `/pay` sin shell.
2. **Cache:** `/caja`, `/ventas`, `/inicio`, `/` y `/pay` con `private, no-store`.
3. **Nav:** 7 destinos + Ayuda/Ajustes; hrefs correctos; sin duplicados visibles; sidebar y mobile nunca visibles a la vez; `aria-current` visible = 1.
4. **Skip link** y foco al `main`; foco al resultado; foco al cerrar “Más”; targets principales 52/64/48/56.
5. **Móvil normal 390/320:** sin overflow; paybar con total y “Revisar cobro” encima de la nav; contenido inferior no tapado; panel “Más” 304×266 con links de 48.
6. **Flujo:** venta en efectivo, resultado, “Ver ventas”, atrás/adelante y recarga funcionan; el borrador v2 se recupera tras recarga, navegación y ayuda.
7. **Ayuda legacy:** `/?ayuda=1` y `#ajustes` abren el sheet; alias con `ayuda=1` y hash llegan bien.
8. **Sin errores de página** en Playwright (`pageErrors=[]`); el único console error fue el 404 esperado de la prueba de ruta inexistente.
9. **Copy/títulos:** `/inicio`, `/caja` y `/ventas` no tienen `U+FFFD` en el body ni en `<title>` (`replacementChars=0`); el mojibake que aparecía en la lectura de consola era codificación de terminal, no del HTML.

---

## 9. Artefactos de medición (para no confundir el JSON bruto)

`shell-audit.json` tiene 17 `FAIL` brutos. Estos **no** son 17 bugs:

- `D6.2`: esperaba `BODY` tras atrás, pero el foco vuelve al H2 del resultado; es correcto.
- `D8.999`: esperaba página 1; con 107 pedidos la última es 5; el clamp es correcto (el bug real es la URL no canónica).
- `D9.2`, `M5.1`: `newShell` y `legacy` existen a la vez en el DOM, pero el nuevo está `display:none`; **un solo shell visible**.
- `D9.5`, `M5.2`: el `aria-current` visible es 1 (el botón legacy); correcto.
- `D10.*`: buscaba `aria-selected`; el legacy usa `aria-current`. Correcto.
- `D15.2`: el body truncado a 4000 caracteres no incluía el nombre del ítem; el banner y `$50` sí estaban.
- `D15.4`: la expresión lógica estaba mal escrita; el hallazgo real (no hay aviso de v1) se documenta con `shell-probes2.json`.
- `M1.3`: contaba links del panel cerrado dentro del mismo `<nav>`; los primarios reales son 4 + “Más”.
- `M7.3`: **sí es real** (overflow 337/320); quedó como P1-3.

Los conteos finales de §0 salen de los sondeos corregidos, no del bruto.

---

## 10. Evidencia

**Matrices y JSON**

- `shell-http-matrix.json` / `shell-http-matrix.txt` — 30 rutas, status, `Location`, cache.
- `shell-audit.json`, `shell-audit-summary.json` — 125 comprobaciones; bruto con artefactos explicados.
- `shell-probes.json`, `shell-probes2.json`, `shell-probes3.json` — sondeos corregidos de foco, CTA, overflow, drafts, ayuda, 404/pay.
- `shell-cta-scrolltop.json` — CTA/total con `scrollTo(0,0)` en 6 viewports, 0 y 3 conceptos.
- `shell-761-cliff.json` — frontera 760/761: mobile nav/paybar vs sidebar 210 px y CTA a 1122.
- `shell-caja-desktop-text200.json` — 1366/1448 texto 200 % con 3 conceptos.
- `shell-text200-geometry.json`, `shell-text200-navlabels.json` — solapamientos de paybar, labels e inputs a 390/320.
- `shell-state.json` — tabs legacy, recarga, `?page=2`, `aria-current`, draft tras Ventas.
- `shell-nav-clicks.json` — los 7 destinos de escritorio y los 5 de “Más” clickeados; ninguno 404; 4 legacy.
- `shell-help-close.json` — Ayuda desde `/ventas` deja `/?ayuda=1` legacy tras cerrar el sheet.
- `shell-duplicate-dom.json` — árboles ocultos de Next (`display:none`), 2 `<main>`/3 `<h1>` en DOM.
- `shell-findings.json` — resumen máquina-legible P0/P1/P2/P3.
- `shell-audit-script.py`, `shell-probes2-script.py`, `shell-http-matrix-script.py`, `shell-cta-script.py` — reproducibilidad.

**Capturas clave**

- `shell-cta-scrolltop-1366x768.png` — CTA ausente a 1366×768 con 3 conceptos.
- `shell-cta-scrolltop-768x1024.png` — CTA muy abajo a 768.
- `shell-caja-1366-text200-three.png` — 200 % desktop: cabecera encimada y CTA fuera.
- `shell-caja-390-text200-item-clean.png` / `shell-caja-320-text200-*` — 200 % móvil: paybar solapado, precio recortado, labels encimados.
- `shell-overflow-ventas-320-text200-clean.png` — pager 337/320.
- `shell-768-inicio.png` vs `shell-768-legacy-corte.png` — cambio sidebar → tab bar.
- `shell-mobile-390-legacy-corte.png` — bottom nav legacy.
- `shell-draft-v1-v2-caja-mobile-clean.png` / `shell-draft-v1-restored-legacy-mobile-clean.png` — dos borradores de $70.
- `shell-desktop-404.png` — 404 por defecto.
- `shell-pay-shell-absent.png` / `shell-pay-missing.png` — pay sin shell; faltante 200.
- `shell-volver-a-caja-noop.png` — resultado que no vuelve.
- `shell-more-320-normal.png` / `shell-more-320-text200.png` — “Más” normal y 200 %.
- `shell-skip-link-focus-1448.png` — skip link visible.

---

## 11. Límites de esta auditoría

- **Dataset concurrente:** otros auditores crearon pedidos durante la sesión (15 → 107). Las cifras de filas/página son una foto; el comportamiento 25/página y no canónico se reprodujo en varios momentos.
- **Solo Chromium headless** (Playwright). No Firefox/WebKit.
- **Sin iOS/Safari, VoiceOver/NVDA/TalkBack, teclado virtual real, HCM real.** Las safe areas se verificaron en CSS, no en dispositivo; `env()` resuelve 0 en Chromium.
- **Sin pey real / QR real / webhook real.** `/pay` se probó con un pedido demo y con id inexistente.
- **No se probó lector de pantalla** ni se certifica WCAG.
- **No se probó doble pestaña real** con confirmación en ambas Cajas; el riesgo P0 se documenta por código + drafts + `requestId` separados. La reproducción visual de los dos borradores sí es real.
- **Datos demo:** se crearon ventas “Auditoria shell” y “Probe volver” por la UI; no se limpiaron. No se tocó producto ni se hizo commit.

---

## 12. Recomendación de gate

**Para declarar el shell de Oleada B migrado: NO-GO.**

**Para avanzar a Oleada C:** sí, solo si el dueño del producto acepta explícitamente:
1. el riesgo P0-1 con un aviso contextual y un lock/plan de retiro de la Caja legacy;
2. los 5 P1 como deuda con dueño y fecha, no como “pasa”;
3. que la nav no se rotule como “migrada” para Fiados/Corte/Metas/Pendientes.

**Antes de re-declarar el gate, exigiría:**

- 200 % **texto** con 3 conceptos y contenido en 1448/1366/390/320, midiendo **solapamiento de rectángulos**, no solo `scrollWidth`; CTA y total en el primer viewport.
- 1366×768 y 768×1024 con 3 conceptos: CTA visible; paybar activo en 761–980 o dos columnas hasta 760.
- `/ventas` 320/200 %: sin overflow y pager apilado, targets ≥48.
- Foco de ruta a `main`/`h1` y foco/scroll al encabezado de la lista al paginar.
- Aviso de v1 en `/caja`, o lock cross-tab/dedupe por contenido.
- `ayuda=1` en `/caja`/`/ventas` (307 o sheet en la misma página) y canonicalización de `?page=`.
- 404 propio en español con shell/nav y `/pay/inexistente` 404.
- Safe-area top y prueba real iOS/teclado, o waiver explícito.

**Conclusión:** el shell nuevo es una base funcional y bien encaminada en el camino feliz, pero **no está listo para declarar migración ni para aprobar el gate responsive/200 %**. La evidencia no sostiene “200 % sin overflow” como sinónimo de “200 % usable”.
