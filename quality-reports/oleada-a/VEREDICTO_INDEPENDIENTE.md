# Veredicto independiente — Oleada A (fundación)

> **Rol:** `mc-verificador-final` (independiente). **Modo:** auditoría de solo lectura. No se implementó, no se corrigió producto, no se hizo commit y no se lanzaron migraciones.
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
> **Rama:** `design/oleada-a-fundacion`
> **HEAD:** `62c3fed6874bc500db16b4a9260fb62cf9626453`
> **Árbol:** **SUCIO** con los cambios de Oleada A sin commit.
> **Servidor:** `http://localhost:3100` · `/api/health` → `buildSha: 62c3fed...`, `ok:true`.
> **Fecha del veredicto:** 4 de noviembre de 2026.
> **Alcance:** contraste de la implementación con `AUDITORIA_REPO.md`, `AUDITORIA_DISENO.md`, `AUDITORIA_SHELL.md` y `AUDITORIA_ACCESIBILIDAD.md`; rutas, shell, fuentes, evidencia y contratos financieros.

> **Actualización — 2.ª pasada (4 nov 2026):** los P1-01, P1-02 y P1-03 de este informe fueron corregidos y re-auditados. El veredicto vigente está en **§13–§14**; las secciones §0–§12 se conservan como primera pasada.
>
> **Veredicto vigente (resumen):** sin P0/P1 abiertos; **Oleada A aprobada para Oleada B**; **handoff público NO-GO**; commit acotado **autorizado** con la corrección documental de `ENTREGA_OLEADA_A.md` y sin declarar handoff.

---

## 0. Resumen ejecutivo

La Oleada A **existe y es una base real**, no un reporte cosmético: el shell nuevo renderiza Inicio con un solo `main`, un solo skip link, una sola navegación visible por breakpoint, navegación por enlaces reales y Hearth/Alder cargadas y verificadas. Los contratos financieros no se tocaron y los P0 de dominio siguen verdes en el árbol sucio.

Pero **no es un cierre limpio**. Hay dos incumplimientos medibles de aceptación:

1. Los alias `/ventas`, `/fiados`, `/corte`, `/metas` y `/pendientes` **no devuelven HTTP 307**: devuelven **200** y el redirect ocurre en el cliente (`NEXT_REDIRECT` en el payload RSC). Sin JavaScript la página queda vacía y el fragmento `#ajustes` se pierde.
2. Hay targets de navegación por debajo de 48 px: **46 px** en la sidebar a 1366×768 y **44×44** en el logo de topbar a 390/320.

Además, `harness/STATE.md` sigue diciendo “Oleada A no iniciada” y nombra una rama/SHA anteriores. El HIG 5/5 disponible en `demo/hig-after/audit.json` es del gate de **Caja**, no del shell nuevo de Inicio; las variantes 10/10 sí son de Inicio, pero no miden targets.

**Veredicto global:** **APROBADA CON LIMITACIONES PARA CONTINUAR A OLEADA B**, con corrección obligatoria de los P1 antes de declarar Oleada A cerrada. **Handoff público: NO-GO.** No se autoriza un commit de cierre/handoff; sí un commit acotado de checkpoint si se documentan los P1 abiertos.

---

## 1. Método y evidencia usada

### 1.1 Lectura

- `quality-reports/oleada-a/AUDITORIA_REPO.md`
- `quality-reports/oleada-a/AUDITORIA_DISENO.md`
- `quality-reports/oleada-a/AUDITORIA_SHELL.md`
- `quality-reports/oleada-a/AUDITORIA_ACCESIBILIDAD.md`
- `git status --short`, `git diff --stat`, `git diff` y archivos untracked.
- `AGENTS.md` y `web/AGENTS.md`.

### 1.2 Runtime

- Playwright/Chromium headless contra `localhost:3100`, en `/inicio` a **1448×1086, 1366×768, 390×844, 320×640 y 724×543**, normal y `data-contrast="high"`.
- Conteo de `main`, skip links, `nav` visibles, `h1`, `aria-current`, targets, overflow, foco, fuentes y recursos de red.
- Navegación real por `/`, `/?tab=*`, alias y `/pay/**`.
- `curl.exe` con `--max-redirs 0` para el status HTTP real.
- `web/scripts/oleada-a-smoke.py` re-ejecutado con salida en temp: **33 PASS · 0 FAIL**.
- `npm run verify:fast`: **3/3 gates PASS** (guard, lint, types), aunque el runner marca `ok:false` por árbol sucio.

### 1.3 Evidencia existente revisada

- `harness/evidence/p0-venta-e2e.json` → 66/0.
- `harness/evidence/p0-fiado-e2e.json` → 51/0.
- `harness/evidence/p0-corte-e2e.json` → 69/0.
- `harness/evidence/p0-integracion-e2e.json` → 51/0.
- `harness/evidence/p0-dinero-e2e.json` → 45/0 + 3 KNOWN.
- Webhook 40/40 y checkout 19/19.
- `harness/evidence/runs/2026-11-04T06-39-02-354Z-partial.json` → 6/6 gates verdes, `ok:false` por partial + dirty.
- `harness/evidence/runs/2026-11-04T04-37-25-913Z-full.json` → 21/23; fallan `tunnel` y `preflight`.
- `demo/hig-after/audit.json` → 5/5 viewports, `failures: []`, `code.dirty:true`.
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/variantes/summary.json` → 10 variantes de Inicio, axe 0, sin overflow.
- `quality-reports/mercado-cero-final/14_EVIDENCIAS/metricas/summary.json` → 12 combinaciones ruta/viewport, axe 0, sin overflow.

> **Límite de método:** no se ejecutaron gates que escriban evidencia nueva sobre el árbol (salvo `verify:fast`, que se borró del repo tras leer su salida). No se hizo commit, merge, migración ni cambio de datos.

---

## 2. Rutas: el contrato de alias no es 307

### 2.1 Matriz real

| Ruta | Status HTTP real | `Location` | Resultado con JS | Resultado sin JS | Esperado |
|---|---:|---|---|---|---|
| `/inicio` | **200** | — | Inicio | Inicio completo | 200 |
| `/ventas` | **200** | vacío | `/?tab=caja` | **body vacío, 0 h1** | **307 → `/?tab=caja`** |
| `/fiados` | **200** | vacío | `/?tab=fiado` | **body vacío, 0 h1** | **307 → `/?tab=fiado`** |
| `/corte` | **200** | vacío | `/?tab=corte` | **body vacío, 0 h1** | **307 → `/?tab=corte`** |
| `/metas` | **200** | vacío | `/?tab=meta` | **body vacío, 0 h1** | **307 → `/?tab=meta`** |
| `/pendientes` | **200** | vacío | `/?tab=pendientes` | **body vacío, 0 h1** | **307 → `/?tab=pendientes`** |
| `/caja` | **404** | — | 404 | 404 | 404 honesto |
| `/` | **200** | — | Caja legacy | Caja legacy | intacto |
| `/?tab=caja` | **200** | — | Caja | Caja | intacto |
| `/?tab=fiado` | **200** | — | Fiado | Fiado | intacto |
| `/?tab=corte` | **200** | — | Corte de caja | Corte | intacto |
| `/?tab=meta` | **200** | — | Meta | Meta | intacto |
| `/?tab=pendientes` | **200** | — | Pendientes | Pendientes | intacto |
| `/?tab=foo` | **200** | — | Caja silenciosa | Caja | sin cambio |
| `/pay/{id}` | **200** | — | Checkout sin shell | Checkout sin shell | intacto |
| `/pay/{id}/success` | **200** | — | Éxito sin shell | Éxito sin shell | intacto |

### 2.2 Comprobación del alias

`curl.exe -s -D - --max-redirs 0 http://localhost:3100/ventas` devuelve:

- `HTTP/1.1 200 OK`
- sin cabecera `Location`
- `x-nextjs-postponed: 1`
- en el payload RSC: `NEXT_REDIRECT;replace;/?tab=caja;307;`

Es decir: **el 307 está representado dentro del payload de React**, no en la respuesta HTTP. El navegador con JS lo ejecuta y la URL final es correcta; un cliente sin JS, un crawler o un `curl -L` no obtiene redirección.

También se comprobó:

- `/ventas?ayuda=1` → `/?tab=caja&ayuda=1` y abre la hoja de ayuda (correcto con JS).
- `/corte?ayuda=1#ajustes` → `/?tab=corte&ayuda=1` **sin `#ajustes`**; la hoja abre, pero el ancla se pierde.
- `/fiados?tab=corte` → `/?tab=fiado` (descarta el `tab` ajeno, correcto).
- `/ventas?utm=x` → `/?tab=caja` (descarta parámetros arbitrarios, correcto).

**Consecuencia:** el requisito explícito “307 al tab correcto” **no se cumple a nivel HTTP**. Es un P1 de contrato de rutas; no toca dinero ni estado, pero rompe la promesa de alias redirect-only y la experiencia sin JS.

---

## 3. Shell: lo que sí está bien y lo que no

### 3.1 Invariantes de DOM (medidos)

| Viewport | `main` | skip links | `nav` visibles | `h1` visibles | `aria-current` visibles | overflow horizontal | targets < 48 |
|---|---:|---:|---:|---:|---:|---|---|
| 1448×1086 | 1 | 1 | 1 | 1 | 1 (`<a>`) | no | 0 |
| 1366×768 | 1 | 1 | 1 | 1 | 1 (`<a>`) | no | **8 enlaces de 46 px** |
| 390×844 | 1 | 1 | 1 | 1 | 1 (`<a>`) | no | **logo topbar 44×44** |
| 320×640 | 1 | 1 | 1 | 1 | 1 (`<a>`) | no | **logo topbar 44×44** |
| 724×543 | 1 | 1 | 1 | 1 | 1 (`<a>`) | no | logo topbar 44×44 (misma regla móvil) |

- En 1448 el sidebar mide 236 px y el topbar 100 px; en 1366 el sidebar 236 y el topbar 84; en móvil el topbar 64 y la nav inferior 65 (64 + borde).
- El `main` empieza en y=100/84/64/64/64. No hay scroll horizontal ni elementos visibles fuera del viewport.
- El skip link es el primer focusable, mide 48 px y enfoca `main#inicio-main` (smoke).
- Hay **dos** `aria-current="page"` en el DOM (sidebar + mobile nav), pero **solo uno visible** por breakpoint. No es un fallo de accesibilidad; es una duplicación de markup que la evidencia debe filtrar.
- La nav móvil tiene **5 accesos** (Inicio, Ventas, Fiados, Corte, Más) con 64 px de alto; el panel “Más” tiene 4 enlaces de 48 px y abre hacia arriba sin desbordar a 320.
- `Escape` cierra “Más” y devuelve el foco al `summary`; se verificó.
- En el shell nuevo, `aria-current="page"` está solo en `<a>` reales. En Caja legacy sigue en `<button>` (`web/src/components/caja-app.tsx:7425,7571`), deuda conocida de `AUDITORIA_ACCESIBILIDAD.md` P1-3 que esta ola no tocó. Si el criterio se lee de forma global, Caja sigue incumpliendo; el shell nuevo sí cumple.

### 3.2 Destinos

- Sidebar: `/inicio`, `/ventas`, `/fiados`, `/corte`, `/metas`, `/pendientes`, `/?ayuda=1`, `/?ayuda=1#ajustes`. **8 hrefs únicos, sin duplicados.**
- Móvil: 4 primarios + 4 en “Más”; no hay solapamiento entre primarios y panel.
- No se enlaza `/caja`, `/productos`, `/proveedores`, `/reportes` ni rutas vacías.
- `/caja` responde 404 del framework; es honesto, aunque no tiene página “en construcción” ni navegación propia.

**Pero** los CTAs de contenido de Inicio siguen apuntando a `/`:

- `web/src/app/inicio/page.tsx:166` — “Registrar” → `/`.
- `web/src/app/inicio/page.tsx:224` — “Ir a ventas” → `/`.
- La nav “Ventas” → `/ventas` (`web/src/components/shell/nav.ts:26`).

Ambos terminan en Caja, pero con URLs y etiquetas distintas. Es deuda de consistencia (P2), no un enlace muerto.

### 3.3 El shell es de Inicio, no un shell realmente compartido

`AppShell` está bien extraído como composición, pero su DOM y CSS siguen acoplados a Inicio:

- `web/src/components/shell/app-shell.tsx:37-44` usa `inicio-shell`, `inicio-main`, `inicio-content`.
- `web/src/components/shell/sidebar.tsx:20-22` usa `inicio-sidebar`, `inicio-nav`.
- `web/src/components/shell/shell.css:83-104` añade la nav móvil; el layout de escritorio (`.inicio-shell`, `.inicio-sidebar`, `.inicio-main`) sigue en `inicio.css`.
- `AppShell` solo se importa desde `web/src/app/inicio/page.tsx:19,64`. Caja (`caja-app.tsx`) sigue con su chrome legacy.
- `PageHeader` (`web/src/components/shell/page-header.tsx`) **no se usa en ninguna ruta**; es andamiaje.
- El breakpoint del shell nuevo es 760 px; Caja usa 1023.98 px. A 768 px Inicio muestra sidebar y Caja muestra tab bar.

Por tanto: **hay un componente de shell compartido en intención, pero todavía no es un shell compartido en uso ni en CSS.** Es la base correcta para A4, no la migración de Caja.

---

## 4. Hearth / Alder

### 4.1 Archivos, licencias y hashes

En `web/src/assets/fonts/` existen:

| Archivo | Bytes | SHA-256 | Estado |
|---|---:|---|---|
| `Hearth[wght].woff2` | 26,396 | `B885DEA71502BC246DFD68EDBEE1FB7CF11A6E3E091669A1410376133AE2E470` | coincide con README/auditoría |
| `Alder[wght].woff2` | 26,884 | `B0C178C8C48CA5B064E734591ABAB6157889AA7C9D84B5AE7D4647594C5A0B3C` | coincide |
| `Hearth-OFL.txt` | 4,232 | `74DE89B0BFAD86F8A42127E77E8B36349F06842992BFEA40416D1EBD09C8AB3D` | coincide |
| `Alder-OFL.txt` | 4,231 | `F756480765D3065CF84BB8F5AD42AB404C12A047A3B4182B5F28CF45A2E3B8DD` | coincide |

Los archivos están untracked; **si se commitea la ola deben añadirse explícitamente** (no `git add .`), o el build de CI no tendrá fuentes.

### 4.2 Carga y tokens

`web/src/app/layout.tsx:10-32` usa `next/font/local` con:

- `Hearth[wght].woff2` → `--font-hearth`, `weight: "100 900"`, `display: "swap"`, `preload: true`, fallback Georgia/Times, `adjustFontFallback: "Times New Roman"`.
- `Alder[wght].woff2` → `--font-alder`, `weight: "100 900"`, `display: "swap"`, `preload: true`, fallback Segoe UI/Arial, `adjustFontFallback: "Arial"`.

`web/src/app/globals.css:35-37` define:

```css
--font-sans: var(--font-alder), "Alder", "Segoe UI", ...;
--font-display: var(--font-hearth), "Hearth", Georgia, serif;
```

Y `web/src/app/globals.css:55-56` deja alias de compatibilidad `--font-fraunces: var(--font-hearth)` y `--font-inter: var(--font-alder)`, que es lo que permite que `inicio.css` siga usando los nombres viejos sin romperse.

Runtime verificado:

- `document.fonts.check('600 52px Hearth')` → `true`.
- `document.fonts.check('400 18px Alder')` → `true`.
- `document.fonts.check('600 18px Alder')` → `true`.
- `document.fonts.check('700 17px Alder')` → `true`.
- `document.fonts.status` → `loaded`.
- H1 computado: `hearth, "hearth Fallback", Georgia...`.
- Body computado: `alder, "alder Fallback", "Segoe UI"...`.
- El sello `DEMO` es visible a 1448/390/320.

### 4.3 Hallazgo de rendimiento: descarga duplicada

Con la red en frío, la misma página hace **cuatro** peticiones WOFF2:

- `Alder%5Bwght%5D...woff2` (preload) — 26,884 B.
- `Hearth%5Bwght%5D...woff2` (preload) — 26,396 B.
- `Alder[wght]...woff2` (CSS `@font-face`) — 26,884 B.
- `Hearth[wght]...woff2` (CSS `@font-face`) — 26,396 B.

Total ≈ **107 KB** por carga, no los ~53 KB previstos. La causa es el nombre con corchetes: el preload usa `%5B` y el CSS usa `[`, y el navegador los trata como URLs distintas. La auditoría de diseño ya lo había advertido (`AUDITORIA_DISENO.md:709`). No rompe la carga, pero afecta a móvil y al checkout público porque ambas fuentes se precargan globalmente.

### 4.4 Evidencia HIG/axe y su alcance real

- `demo/hig-after/audit.json`: **5/5 viewports, `failures: []`, `code.dirty:true`**. Pero el script arranca en `/` (Caja) y comprueba la tab bar de Caja; **no evalúa el shell nuevo de Inicio**.
- Las **10 variantes de Inicio** (`variantes/summary.json`) sí son del código nuevo: 1448, 1366, 390, 320, 724, texto grande, texto muy grande, alto contraste; axe 0 y sin overflow en todas.
- Las **12 combinaciones** de `metricas/summary.json` (Inicio + tabs de Caja, desktop/mobile) tienen axe 0 y sin overflow.
- Nuestro Playwright propio volvió a dar axe 0 en Inicio normal y `data-contrast="high"` a 1448/1366/390/320/724, con 0 violaciones y `incomplete` 1–2 (no violaciones).

**Conclusión:** Hearth/Alder están integradas y cargan correctamente. El HIG 5/5 no cubre los targets del shell nuevo; por eso no detectó los 46/44 px.

---

## 5. Evidencia existente: qué se confirmó y qué no

| Afirmación | Verificación | Resultado |
|---|---|---|
| `oleada-a-smoke.py` 33/0 | Re-ejecutado con `OLEADA_A_OUT` en temp | **33 PASS · 0 FAIL** |
| Su JSON existe | No había JSON versionado; el script lo escribe en `demo/oleada-a/` (ignorado) | **No versionado**; reproducido en temp |
| HIG 5/5 | `demo/hig-after/audit.json`, `failures: []`, dirty true | **Sí, pero es Caja, no Inicio** |
| Variantes 10/10 | `variantes/summary.json`, 10 entradas, axe 0 | **Sí** |
| axe 0 Inicio normal/HC | `axe/inicio-*.json` + Playwright propio | **Sí, 0 violaciones**; `incomplete` 1–2 |
| p0-venta 66/0 | JSON `summary` | **Sí**, `dirty:true` |
| p0-fiado 51/0 | JSON `summary` | **Sí**, `dirty:true` |
| p0-corte 69/0 | JSON `summary` | **Sí**, `dirty:true` |
| p0-integración 51/0 | JSON `totals` | **Sí**, `dirty:true` |
| p0-dinero 45/0 + 3 KNOWN | JSON `summary` | **Sí**, `dirty:true` |
| Webhook 40/40 | `outputTail` del partial | **Sí** |
| Checkout 19/19 | `outputTail` del partial | **Sí** |
| Full 21/23 por tunnel/preflight | Run `2026-11-04T04-37-25-913Z-full.json` | **Sí**, en HEAD limpio `62c3fed` |
| Partial 6/6 verde | Run `2026-11-04T06-39-02-354Z-partial.json` | **Sí**, pero `ok:false` por partial + dirty |
| Static 5/5 | `latest-static.json` | **Sí, pero del HEAD limpio previo a la ola** (`04:35`), no del árbol actual |
| `latest.json` full vigente | `latest.json` | **No**: es de `9206ea1`, no de HEAD |
| Rutas alias 307 | `curl`/Playwright | **No: 200 + redirect cliente** |

### 5.1 Qué significa “dirty:true”

Todos los P0 y el HIG actual declaran `dirty:true`. Eso es correcto y honesto: la evidencia se generó sobre el árbol con los cambios de Oleada A, no sobre un commit limpio. Pero **no sirve para `verify:evidence` ni para handoff**; el handoff exige árbol limpio y SHA/build coincidentes.

`/api/health` devuelve `62c3fed` porque el build se selló con el SHA de HEAD, pero el build incluye código sucio no identificable por ese SHA. El marcador fiable es `gitAtStart.dirty:true`, no el `buildSha` solo.

### 5.2 `verify:fast` actual

Ejecutado sobre el árbol sucio:

- `guard` PASS.
- `lint` PASS.
- `types` PASS.
- Runner: **`ok:false`** por `gitAtStart.dirty=true` y `gitAtEnd.dirty=true`.

No se ejecutó `verify:static` sobre el árbol actual porque implica un `next build` que reescribiría `.next` del servidor vivo; el build existente sí compiló las rutas nuevas. No se ejecutó `verify:full` sobre el árbol actual.

---

## 6. Contraste con las auditorías

| Recomendación | Implementado | Estado |
|---|---|---|
| Hearth/Alder con OFL, hashes, `next/font/local`, fallback | Sí, verificado | **Cumple** |
| No reemplazar `--font-sans`/`--font-display` en el primer commit; canary | Se reemplazaron globalmente; aliases legacy | **Desviación** (mitigada por p0/HIG/axe) |
| Renombrar WOFF2 sin corchetes | Se conservaron `Hearth[wght].woff2` / `Alder[wght].woff2` | **No cumple**; causa descarga duplicada |
| Shell A2 solo Inicio, sin tocar Caja | Sí; `caja-app.tsx` intacto | **Cumple** |
| Shell con namespace propio `.mc-*` | Desktop sigue con `.inicio-*`; solo la nav móvil usa `.mc-*` | **Parcial** |
| Sidebar 248 / topbar 64 unificados | 236 / 100 (1448); 236 / 84 (1366) | **No cumple** el objetivo de geometría |
| Nav móvil 5 slots, targets 48 | 5 slots, 64 px; topbar 44 y sidebar 46 en 1366 | **Parcial** |
| “Más” como dialog con foco atrapado | `<details>/<summary>` nativo, sin trampa (disclosure, no modal) | **Desviación aceptable**, pero no es el patrón recomendado |
| No activar `/caja` | 404 | **Cumple** |
| Alias redirect-only 307 | 200 + redirect cliente | **No cumple** |
| No tocar `orders/cash/goals/tasks/db/payment*/checkout/api/pay` | Verificado | **Cumple** |
| Tokens únicos / convergencia de paleta | No se hizo; `--inicio-*`, `barrio.css` y `checkout.css` siguen | **Pendiente** (era A3, no el corte actual) |
| Foco de dos tonos (P0-3 accesibilidad) | No se implementó; overrides por página | **Pendiente** |
| Quitar `forced-color-adjust:none` | Sigue en `.inicio-shell` | **Pendiente** |
| HIG con Inicio | HIG 5/5 es de Caja; variantes de Inicio no miden targets | **Cobertura incompleta** |

La ola implementó una porción más estrecha que el “A1 completo” de la auditoría de diseño: fuentes + shell de Inicio + primitivas. La convergencia de tokens, la limpieza de `barrio.css`, el foco sistémico y HCM real quedan para A3/B. Eso es defendible si el alcance se declara así; no lo es si se presenta como “sistema de diseño terminado”.

---

## 7. Veredicto por los 9 criterios de cierre

| # | Criterio | Veredicto | Evidencia |
|---:|---|---|---|
| 1 | Hearth + Alder integradas y verificadas | **PASS** | WOFF2/OFL en `web/src/assets/fonts/`, hashes correctos; `next/font/local`; `--font-hearth`/`--font-alder`; `document.fonts.check` 400/600/700 true; H1/cuerpo con familias correctas; 10/10 variantes y axe 0. P2: descarga duplicada por corchetes y preload global. |
| 2 | Shell responsive compartido | **PASS CON LIMITACIONES** | `AppShell`/Sidebar/MobileNav/SkipLink existen y funcionan en Inicio: 1 main, 1 skip, 1 nav visible, 1 h1, sin overflow en 1448/1366/390/320/724. Limitación: solo Inicio lo usa; Caja sigue legacy; CSS acoplado a `.inicio-*`; geometría 236/100; breakpoint 760 vs 1023; `PageHeader` sin uso. |
| 3 | Navegación existente funciona | **FAIL** (contrato de alias) | `/` y todos los `?tab=` responden 200 con H1 correcto y Caja intacta; `/pay/**` sin shell. Pero `/ventas`…`/pendientes` devuelven **200, no 307**, sin `Location`; sin JS quedan vacías; `#ajustes` se pierde. La navegación con JS sí funciona; el contrato HTTP no. |
| 4 | Contratos financieros intactos | **PASS** | Sin cambios en `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `api/**`, `pay/**`; `caja-app.tsx` y `app/page.tsx` intactos. P0 venta/fiado/corte/integración/dinero, webhook y checkout verdes. |
| 5 | Extracción modular con pruebas | **PASS CON LIMITACIONES** | `CurrencyAmount`, `SectionHeader`, `ProgressIndicator`, `EmptyState`, `MaskIcon` se usan en Inicio; shell dividido en 9 archivos; smoke 33/0, axe 0, HIG/variantes. Limitación: no hay unit tests de los componentes nuevos; `PageHeader` no se usa; la cobertura es E2E, no unitaria. |
| 6 | Sin regresiones P0/P1 | **PASS CON LIMITACIONES** | P0 66/0, 51/0, 69/0, 51/0, 45/0+3 KNOWN; webhook 40/40; checkout 19/19. Limitación: esos runs son `dirty:true`; no hay `verify:full` ni `verify:static` válidos sobre el árbol actual. El target de 46/44 es un P1 nuevo, no una regresión funcional. |
| 7 | Capturas corresponden al código evaluado | **PASS CON LIMITACIONES** | Capturas de `14_EVIDENCIAS` a 06:36–06:41, servidor build 06:32, contenido con nav nueva y Hearth; HIG/p0 `dirty:true`. Limitación: `buildSha` no identifica el árbol sucio; `latest.json` es de `9206ea1` y `latest-static` es del HEAD limpio previo; `metricas/summary.json` cuenta 2 `aria-current` (incluye la nav oculta). |
| 8 | Verificador independiente aprueba | **PASS CON LIMITACIONES** | Este informe. No certifica handoff; aprueba la base para B con P1 abiertos. |
| 9 | Handoff público pendiente documentado | **PASS CON LIMITACIONES** | `harness/STATE.md:20` dice **NO-GO** y menciona tunnel/preflight; pero `:9` sigue con rama `design/mercado-cero-v2` y `:21` dice “**Oleada A no iniciada**”, lo que ya es falso. Documenta el NO-GO, no el estado actual. |

**Resumen:** 2 PASS, 6 PASS CON LIMITACIONES, 1 FAIL (alias 307). No hay P0 de producto.

---

## 8. Hallazgos

### P0

**Ninguno de producto.** No se encontró pérdida de dinero, doble cobro, cambio de verdad demo/pey, mutación de contratos financieros ni regresión de los P0. El fallo de rutas es de presentación/compatibilidad, no financiero.

### P1

#### P1-01 — Los alias devuelven 200, no 307; sin JS quedan vacíos

**Archivos:**
- `web/src/app/ventas/page.tsx:3` (`export const instant = false`) y `:11` (`redirect(...)`)
- `web/src/app/fiados/page.tsx:3,11`
- `web/src/app/corte/page.tsx:3,11`
- `web/src/app/metas/page.tsx:3,11`
- `web/src/app/pendientes/page.tsx:3,11`

**Evidencia:**
- `curl --max-redirs 0` → `200`, sin `Location`.
- Payload RSC → `NEXT_REDIRECT;replace;/?tab=caja;307;`.
- `java_script_enabled=False` → body vacío, 0 `h1` en los 5 alias.
- `/corte?ayuda=1#ajustes` → pierde `#ajustes`.

**Impacto:** enlaces externos/crawlers/clientes sin JS no obtienen la pantalla; el requisito de alias redirect-only no se cumple. Con JS la UX es correcta. **No afecta dinero ni estado.**

**Condición de cierre:** servir un redirect HTTP real (307) o aceptar formalmente el redirect cliente con fallback sin JS y conservación de `ayuda`/hash. Mientras no se decida, el criterio 3 queda FAIL.

#### P1-02 — Targets de navegación por debajo de 48 px

**Archivos:**
- `web/src/app/inicio/inicio.css:1205-1207` → `.inicio-nav__item { min-height: 46px; }` a 1366×768.
- `web/src/app/inicio/inicio.css:884-887` → `.inicio-topbar__icon { width:44px; height:44px; }` a ≤760.

**Medición:**
- 1366×768: los 6 enlaces de sidebar y Ayuda/Ajustes miden **208×46**.
- 390×844 y 320×640: el enlace del logo del topbar mide **44×44**.
- Móvil nav: 64 px; “Más”: 64; enlaces del panel: 48. Correctos.
- 1448: sidebar 52; sin targets <48.

**Impacto:** incumple el contrato explícito “targets ≥48” y el objetivo 48 del shell; no es un fallo de WCAG 2.5.8 (mínimo 24), pero sí del HIG interno y de la aceptación de la ola.

**Cobertura:** el HIG 5/5 no lo detecta porque evalúa Caja; las variantes de Inicio no miden targets. Es un falso verde de alcance.

#### P1-03 — `harness/STATE.md` está desactualizado y contradice la ola

**Archivo:** `harness/STATE.md:9,20-21`.

- `:9` dice rama `design/mercado-cero-v2` (la rama real es `design/oleada-a-fundacion`).
- `:21` dice “**Oleada A no iniciada**” y “Hearth/Alder pendientes de incorporar”.
- `:20` sí documenta el handoff **NO-GO**.

**Impacto:** es el handoff vivo para agentes; un lector puede creer que la ola no existe o que las fuentes no están. El NO-GO está documentado, pero el estado actual no. Es un P1 documental, no de producto; debe corregirse antes de commit/handoff.

### P2

#### P2-01 — El shell está acoplado a Inicio y Caja sigue fuera

- `web/src/components/shell/app-shell.tsx:37-44` usa `inicio-shell`, `inicio-main`, `inicio-content`.
- `web/src/components/shell/sidebar.tsx:20-22` usa `inicio-sidebar`, `inicio-nav`.
- `web/src/components/shell/shell.css:83-104` solo cubre la nav móvil; el resto del CSS está en `inicio.css`.
- `AppShell` solo se importa en `web/src/app/inicio/page.tsx:19,64`; Caja conserva `.app-shell`.
- `PageHeader` no se usa en ninguna ruta.
- Breakpoint 760 (Inicio) vs 1023.98 (Caja).

**Impacto:** el siguiente paso (Caja con el mismo shell) requerirá otra migración de CSS/DOM. No es un fallo de la ola, pero “shell compartido” debe leerse como “shell de Inicio extraído”.

#### P2-02 — Descarga duplicada de fuentes por nombres con corchetes

- `web/src/app/layout.tsx:11,25` referencia `Hearth[wght].woff2` / `Alder[wght].woff2`.
- Red en frío: 4 respuestas WOFF2 (preload `%5B` + CSS `[`), ~107 KB.
- Ambas se precargan globalmente; el checkout público también las paga.
- `AUDITORIA_DISENO.md:709` ya recomendaba renombrar a `hearth-variable.woff2` / `alder-variable.woff2`.

**Impacto:** rendimiento móvil/checkout; no funcional. Considerar `preload:false` para Hearth, como recomendaba la auditoría de accesibilidad.

#### P2-03 — CTAs de Inicio y nav usan destinos distintos para “Ventas”

- `web/src/app/inicio/page.tsx:166` “Registrar” → `/`.
- `web/src/app/inicio/page.tsx:224` “Ir a ventas” → `/`.
- `web/src/components/shell/nav.ts:26` “Ventas” → `/ventas`.

Ambos terminan en Caja, pero la URL y la etiqueta no son consistentes. Además, `/corte?ayuda=1#ajustes` pierde el hash (P1-01). Es deuda de contrato de navegación, no un enlace muerto.

#### P2-04 — Accesibilidad: 13 px en nav móvil y HCM incompleto

- `web/src/components/shell/shell.css:118` → labels primarios de la nav móvil a `0.8125rem` (13 px) con Alder. La auditoría de accesibilidad P1-1 pedía 15–16 px para UI esencial; HIG solo falla por debajo de 12.
- `web/src/app/inicio/inicio.css:1398-1401` mantiene `forced-color-adjust: none` en `.inicio-shell`; el shell nuevo hereda esa regla.
- `web/src/app/layout.tsx:73` activa el alto contraste automático de `forced-colors` solo si `location.pathname === '/inicio'`; los alias que caen en `/` no lo activan.
- La nav `.mc-mobile-nav` no tiene overrides propios de `data-contrast="high"`; a 390 el fondo activo medido sigue siendo verde claro (`rgb(230,245,238)`), no blanco/negro.
- `web/src/app/globals.css:114` conserva `font-feature-settings: "ss01" on, "cv11" on` (features de Inter) y no se añadió `font-synthesis: none`, contra la recomendación de diseño.

**Impacto:** riesgo de legibilidad y de HCM; no se observó una violación axe en la matriz probada. **HCM real y lector real no se probaron.**

#### P2-05 — Higiene de evidencia

- `harness/evidence/latest.json` sigue siendo de `9206ea1` (full 23/23 viejo), no de HEAD.
- `latest-static.json` es de `62c3fed` limpio a las 04:35, antes de la ola.
- El JSON del smoke **no está versionado**; el script lo escribe en `demo/oleada-a/` (ignorado). Se reprodujo 33/0, pero no queda artefacto en el repo.
- `quality-reports/.../metricas/summary.json` cuenta `active: ["Inicio","Inicio"]` porque incluye la nav oculta; no es un fallo de producto, pero la evidencia debe filtrar visibilidad.
- El HIG 5/5 es de Caja, no de Inicio; no cubre el shell nuevo.
- Los JSON de `quality-reports` fueron regenerados y `audit_capture.py` tiene un cambio de tooling (`window.scrollTo(0,0)`); deben ir en un commit de evidencia separado, no mezclados con el producto.

#### P2-06 — `?tab=foo` y normalización de alias

`/?tab=foo` sigue respondiendo 200 y cae en Caja en silencio; `?tab=metas`/`?tab=fiados` no se normalizan. La auditoría de shell lo recomendaba; es deuda preexistente, no una regresión de esta ola.

#### P2-07 — `/caja` es un 404 de framework

`/caja` responde 404 (correcto y honesto), pero sin página “en construcción” ni enlaces de recuperación. Aceptable para A; considerar una página propia en B.

---

## 9. Confirmación: archivos financieros no tocados

Verificado con `git status --porcelain`, `git diff --name-only` y `git ls-files --others`:

| Archivo / zona | Estado |
|---|---|
| `web/src/lib/orders.ts` | **sin cambios** |
| `web/src/lib/cash.ts` | **sin cambios** |
| `web/src/lib/goals.ts` | **sin cambios** |
| `web/src/lib/tasks.ts` | **sin cambios** |
| `web/src/lib/db.ts` | **sin cambios** |
| `web/src/lib/payment-rules.ts` | **sin cambios** |
| `web/src/lib/payment-labels.ts` | **sin cambios** |
| `web/src/lib/pey-events.ts` | **sin cambios** |
| `web/src/lib/checkout.ts` | **sin cambios** |
| `web/src/app/api/**` | **sin cambios ni archivos nuevos** |
| `web/src/app/pay/**` | **sin cambios ni archivos nuevos** |
| `web/src/components/caja-app.tsx` | **sin cambios** |
| `web/src/app/page.tsx` | **sin cambios** |

Los únicos archivos de producto modificados son `web/src/app/globals.css`, `web/src/app/inicio/inicio.css`, `web/src/app/inicio/page.tsx` y `web/src/app/layout.tsx`, más los nuevos `components/shell/**`, `components/ui/**`, `app/{ventas,fiados,corte,metas,pendientes}/page.tsx` y `assets/fonts/**`. El cambio de fuentes afecta visualmente a Caja/checkout, pero no cambia su lógica ni sus contratos.

Los P0 de dominio se ejecutaron sobre árbol sucio con servidores aislados y siguen verdes; no se lanzaron migraciones ni se modificó la base del servidor local.

---

## 10. Qué NO se probó

- **Lector de pantalla real:** NVDA, JAWS, TalkBack, VoiceOver, Orca. Solo Chromium headless + axe.
- **iOS/Safari real**, Chrome Android, teclado virtual, safe areas, notch, landscape 844×390.
- **Windows High Contrast Mode real**; solo emulación `forced-colors` y `data-contrast="high"`. El `forced-color-adjust:none` sigue en el código.
- **PWA instalada/offline**, manifest/`start_url`, service worker, almacenamiento offline.
- **Túnel público / quick tunnel / preflight**; el túnel citado está caído. No se re-ejecutó el gate público.
- **Zoom nativo de Chrome al 200%**; se usó viewport 724×543 como equivalente.
- **`verify:full` y `verify:static` sobre el árbol actual**; el full 21/23 es de HEAD limpio y el static 5/5 es previo a la ola. El `verify:fast` actual dio 3/3 pero `ok:false` por dirty.
- **Regresión visual de checkout/Caja con Hearth/Alder**: hay axe/p0/HIG de Caja y checkout funcional 19/19, pero no una comparación visual 1:1 de todas las pantallas.
- **Estados largos/vacíos/error** del shell nuevo más allá del fixture demo y los estados que cubren los P0.
- **Unit tests de los componentes nuevos**; solo E2E/smoke/axe.
- **Commit, merge, despliegue o migración**: no ejecutados.

---

## 11. Condiciones para aprobar Oleada A y autorización de commit

### 11.1 Condiciones de cierre

1. **Corregir P1-01:** que `/ventas`, `/fiados`, `/corte`, `/metas` y `/pendientes` devuelvan **307 HTTP real** (o decisión escrita que acepte el redirect cliente y añada fallback sin JS); conservar `ayuda=1`, `#ajustes` y descartar `tab` ajeno.
2. **Corregir P1-02:** subir a **≥48 px** los enlaces de sidebar a 1366×768 y el logo de topbar a 390/320; volver a medir targets en Inicio, no solo en Caja.
3. **Corregir P1-03:** actualizar `harness/STATE.md` a rama/HEAD/estado reales, manteniendo **NO-GO** de handoff.
4. **Evidencia limpia:** commit acotado, árbol limpio, `verify:fast`, `verify:static`, `verify:full` y `verify:evidence`; si `tunnel`/`preflight` siguen fallando por entorno, documentar 21/23 y **no** declarar GO.
5. **Fuentes:** renombrar los WOFF2 sin corchetes o eliminar la doble descarga; decidir preload de Hearth; medir checkout.
6. **Deuda declarada:** tokens `--inicio-*`/`barrio.css`, foco de dos tonos, `forced-color-adjust:none`, 13 px en nav móvil y Caja legacy quedan abiertos y deben figurar en el handoff de B.

### 11.2 ¿Autorizo el commit de la ola?

**No como commit de cierre/handoff.** El árbol actual no cumple el contrato de alias 307 ni el de targets, y `STATE.md` está desactualizado. Commitearlo como “Oleada A cerrada” sería prematuro.

**Sí autorizaría un commit acotado de checkpoint WIP** para preservar el trabajo y permitir una corrida limpia, con estas condiciones:

- mensaje explícito de “fundación / checkpoint, no handoff”;
- P1-01 y P1-02 registrados como abiertos, no como resueltos;
- `STATE.md` actualizado o, como mínimo, una nota que impida leer “Oleada A no iniciada”;
- producto, fuentes, smoke y evidencia en commits separados; no `git add .`;
- sin declarar GO público ni actualizar `latest.json` como si fuera válido.

No ejecuté el commit.

---

## 12. Veredicto final

| Pregunta | Veredicto |
|---|---|
| ¿Oleada A lista para pasar a Oleada B? | **Sí, con limitaciones y fix-forward obligatorio.** La base es real, los contratos financieros están intactos y los P0 están verdes. No está “cerrada limpia”: P1-01 (alias 200), P1-02 (targets 46/44) y P1-03 (STATE) deben corregirse antes de declarar cierre. |
| ¿Aprobada para handoff público? | **NO-GO.** `latest.json` es de `9206ea1`; el full de HEAD es 21/23 por `tunnel`/`preflight`; el árbol está sucio; no hay `verify:evidence` PASS; el túnel público está caído. |
| ¿Se puede declarar “pantalla migrada”? | **No.** Inicio es A1 (fundación aplicada), no A2. Caja, Fiado, Corte, Meta, Pendientes y checkout siguen legacy. |
| ¿Se puede declarar “sistema de diseño terminado”? | **No.** Hearth/Alder están integradas, pero la convergencia de tokens, el foco sistémico y HCM real siguen abiertos. |

**Lectura final:** la Oleada A entregó una fundación útil y segura, no un release. El siguiente paso correcto es corregir los dos P1 medibles, actualizar el estado y correr la evidencia limpia; después, Oleada B puede comenzar con el shell nuevo como base y Caja como migración separada. El handoff público sigue **NO-GO** y no debe declararse GO con la evidencia actual.

---

## Apéndice — artefactos de esta verificación

- Playwright propio: `%TEMP%\opencode\oleada-a-audit\audit.json` y capturas `inicio-*.png`.
- Smoke re-ejecutado: `%TEMP%\opencode\oleada-a-audit\oleada-a-smoke.json` (33/0).
- Medición de targets: `%TEMP%\opencode\targets_all.py` (salida en consola; 1366: 208×46; 390/320: 44×44).
- `curl` de rutas: status real 200 sin `Location`; `/caja` 404.
- `npm run verify:fast`: 3/3 PASS, `ok:false` por dirty; run eliminado del repo para no dejar artefactos.
- No se modificó código de producto, no se hizo commit y no se lanzaron migraciones.

---

## 13. Re-auditoría de fixes (2.ª pasada)

> **Modo:** solo lectura. No se editó producto, no se hizo commit y no se lanzaron migraciones.
> **Cuándo:** 4 de noviembre de 2026, contra el servidor `http://localhost:3100` y el árbol sucio de `design/oleada-a-fundacion` (HEAD `62c3fed`).

### 13.1 P1-01 — Alias HTTP 307: **CERRADO**

Los `page.tsx` de los alias fueron sustituidos por `route.ts` con el helper `web/src/app/_redirects/tab.ts`, que devuelve `NextResponse.redirect(destination, 307)`.

| Petición cruda (sin seguir redirect) | Status | `Location` |
|---|---:|---|
| `/ventas` | **307** | `/?tab=caja` |
| `/fiados` | **307** | `/?tab=fiado` |
| `/corte` | **307** | `/?tab=corte` |
| `/metas` | **307** | `/?tab=meta` |
| `/pendientes` | **307** | `/?tab=pendientes` |
| `/ventas?ayuda=1` | **307** | `/?tab=caja&ayuda=1` |
| `/ventas?tab=corte&utm=x` | **307** | `/?tab=caja` (descarta ajenos) |
| `/corte?ayuda=1` | **307** | `/?tab=corte&ayuda=1` |
| `/metas?ayuda=0` | **307** | `/?tab=meta` (no propaga ayuda=0) |
| `/pendientes?foo=bar` | **307** | `/?tab=pendientes` |
| `/caja` | **404** | — |

Además:

- **Navegador real:** `/ventas?ayuda=1#ajustes` termina en `http://localhost:3100/?tab=caja&ayuda=1#ajustes`; la hoja de ayuda abre (`dialog=1`) y `#ajustes` existe. El hash se conserva.
- **Sin JavaScript:** `/ventas` sigue el 307 y renderiza Caja (`h1: Caja`, body completo). Ya no queda una página vacía.
- **No hay `page.tsx`** en los cinco alias; solo `route.ts`.
- **No se rompió `/` ni `?tab=`:** `/`, `/?tab=caja`, `/?tab=fiado`, `/?tab=corte`, `/?tab=meta`, `/?tab=pendientes` y `/?tab=foo` siguen 200 con sus H1 correctos; `/pay/**` sigue sin shell nuevo.

**Resultado:** el contrato de alias 307, `ayuda=1`, descarte de query ajena y conservación del hash **queda verificado**. P1-01 cerrado.

### 13.2 P1-02 — Targets >=48: **CERRADO**

Medición propia con Playwright, contando todos los `a`, `button` y `summary` visibles:

| Viewport | Targets <48 | Topbar logo | Sidebar | Nav móvil | Overflow |
|---|---|---:|---:|---:|---|
| 1448×1086 | **0** | 50×50 | 52 px | oculta | no |
| 1366×768 | **0** | 50×50 | **48 px** | oculta | no |
| 390×844 | **0** | **48×48** | oculta | 64 px; panel 48 | no |
| 320×640 | **0** | **48×48** | oculta | 64 px; panel 48 | no |

También se mantienen: 1 `main`, 1 skip link, 1 `nav` visible, 1 `h1` visible, 1 `aria-current` visible y `scrollWidth === clientWidth` en los cuatro viewports. No hay texto recortado en topbar/nav.

**Resultado:** P1-02 cerrado. La corrección está en `web/src/app/inicio/inicio.css:1205-1207` (sidebar 48) y `:884-887` (topbar 48 en móvil).

### 13.3 P1-03 — STATE / migración: **CERRADO** (P2 documental resuelto)

`harness/STATE.md` y `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md` ahora declaran:

- rama `design/oleada-a-fundacion` y HEAD `62c3fed...`;
- árbol sucio y commit pendiente de autorización;
- alias 307 y `/caja` 404;
- Hearth/Alder con archivos renombrados y sin descarga duplicada;
- HIG 5/5, variantes 10/10, axe 0, P0 66/51/69/51/45+3, webhook 40/40, checkout 19/19;
- handoff público **NO-GO** y `verify:static` formal no ejecutado.

La afirmación “smoke 34/34” se re-ejecutó y es correcta. “Sin descargas duplicadas” también: la red devuelve **2** WOFF2 (`Alder_Variable` y `Hearth_Variable`), no 4. “HIG 5/5” es cierto, pero sigue siendo el HIG de **Caja**, no del shell de Inicio; conviene aclararlo en el STATE (P2, no contradice el dato).

**P2 documental resuelto:** `harness/STATE.md:26` referencia `quality-reports/oleada-a/ENTREGA_OLEADA_A.md`, que ahora **existe** (8,238 B). Su contenido es consistente con este veredicto: declara Oleada A aprobada para B, handoff público **NO-GO**, alias 307, HIG 5/5 como gate de Caja, smoke 34/34 y commit acotado autorizado sin autorización de producto. La referencia queda cerrada.

### 13.4 P2 de la primera pasada

| P2 | Estado | Evidencia |
|---|---|---|
| Fuentes duplicadas por corchetes | **CERRADO** | Renombradas a `Hearth-Variable.woff2` / `Alder-Variable.woff2`; 2 requests de fuente; hashes SHA-256 intactos. |
| CTAs “Registrar” / “Ir a ventas” a `/` | **CERRADO** | `web/src/app/inicio/page.tsx:166,224` ahora usan `/ventas`; la nav también. |
| `forced-color-adjust: none` | **CERRADO** | `getComputedStyle(.inicio-shell).forcedColorAdjust === "auto"`; se retiró la regla. |
| HIG 5/5 no cubre Inicio | **ABIERTO (P2)** | El HIG disponible sigue siendo de Caja; las variantes 10/10 de Inicio no miden targets. |
| 13 px Alder en nav móvil | **ABIERTO (P2)** | `web/src/components/shell/shell.css:118`; no se tocó. |
| Shell acoplado a `.inicio-*`; Caja legacy | **ABIERTO (P2, esperado para B)** | `app-shell.tsx:37-44`; solo Inicio consume `AppShell`. |
| `ENTREGA_OLEADA_A.md` ausente | **CERRADO** | Existe (8,238 B); `harness/STATE.md:26` resuelto y contenido consistente con el veredicto. |
| `?tab=foo` silencioso / token debt / HC automático atado a `/inicio` | **ABIERTO (P2)** | Sin cambio en esta pasada. |

### 13.5 Regresiones y gates

- **Smoke:** `web/scripts/oleada-a-smoke.py` → **34 PASS · 0 FAIL** (incluye el nuevo check de 307 y `ayuda=1`).
- **Caja:** `/` y todos los `?tab=` siguen 200, con `h1` correcto, 1 `main`, shell legacy y sin shell nuevo. `/pay/{id}` y `/success` siguen 200, 1 `main`, 0 `nav`, sin shell nuevo.
- **`verify:fast`:** guard, lint y types **3/3 PASS**; el runner marca `ok:false` por árbol sucio. No se ejecutó `verify:static`/`verify:full` sobre el árbol actual.
- **Capturas/HIG/P0 no regenerados:** esta pasada es puntual; no se re-capturaron las 10 variantes ni se re-ejecutaron HIG/P0. Los fixes de target son de 4 px y no cambian la matriz de overflow; Caja/checkout se verificaron con Playwright y no se tocó ningún archivo financiero.
- **Contratos financieros:** sin cambios en `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `api/**`, `pay/**`, `caja-app.tsx` ni `app/page.tsx`. No se re-ejecutaron los P0 en esta pasada porque ningún archivo financiero fue tocado; la evidencia P0 anterior sigue siendo la referencia y el smoke de Caja/checkout no mostró regresión.

### 13.6 Veredicto de la re-auditoría

- **P0 abiertos:** **ninguno**.
- **P1 abiertos:** **ninguno de los tres de la primera pasada**. P1-01, P1-02 y P1-03 están cerrados; el P2 documental de `ENTREGA_OLEADA_A.md` también quedó cerrado.
- **P2 abiertos:** los listados en §13.4, más la deuda estructural de shell/tokens/HC y la ambigüedad del alcance del HIG. No bloquean el paso a B, pero deben quedar en el handoff.
- **Regresiones:** no se observaron en Inicio, Caja ni checkout.

---

## 14. Veredicto actualizado

| Pregunta | Veredicto actualizado |
|---|---|
| ¿Quedan P0/P1 abiertos? | **No.** Los tres P1 de la primera pasada están corregidos y re-verificados. Quedan P2 estructurales documentados; el P2 documental de `ENTREGA_OLEADA_A.md` quedó cerrado. |
| ¿Oleada A lista para pasar a Oleada B (sin handoff público)? | **Sí.** La fundación es real, los alias son 307 reales, los targets cumplen 48, las fuentes ya no se duplican, los CTAs son consistentes y el smoke 34/34 pasa. Caja y checkout no se tocaron. |
| ¿Handoff público? | **NO-GO.** Sigue vigente: `latest.json` es de `9206ea1`; el full de HEAD es 21/23 por `tunnel`/`preflight`; árbol sucio; no hay `verify:evidence` PASS; túnel público caído. |
| ¿Autorizarías el commit acotado de Oleada A? | **Sí, como commit acotado de Oleada A, sin handoff.** Sin condiciones documentales pendientes: `ENTREGA_OLEADA_A.md` existe y es consistente. Mantener la aclaración de que el HIG 5/5 es de Caja, separar producto/fuentes/evidencia y ejecutar `verify:static`/`verify:full` después del commit; no actualizar `latest.json` como GO. No ejecuté el commit. |

**Lectura final:** la Oleada A pasa de “aprobada con limitaciones” a **aprobada para Oleada B**, con P2 documentados y sin handoff público. La referencia documental a `ENTREGA_OLEADA_A.md` quedó verificada y cerrada; no hay P0/P1 de producto abiertos.
