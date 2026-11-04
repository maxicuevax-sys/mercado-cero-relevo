# Auditoría de repositorio — Cierre Fase 1 (Inicio)

**Rol:** `mc-auditoria-repo` · **Modo:** solo lectura (sin ediciones de código, sin commits)
**Fecha de reauditoría:** 2026-11-03 20:09 (-06:00)
**Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
**Rama:** `design/mercado-cero-v2` · **HEAD:** `b8f127d85985fd519a0010128a1f42bf5346e24e`
**Servidor auditado:** `http://localhost:3100` · `/api/health` → `{"ok":true,"buildSha":"b8f127d85985fd519a0010128a1f42bf5346e24e","node":"v25.7.0"}`
**Build actual:** `web/.next/BUILD_SHA` = `b8f127d…`, `builtAt 2026-11-04T01:54:06.249Z` (19:54 local)
**Referencia:** `design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png`

**Regla cumplida:** no edité código ni hice commits. El único archivo que escribí es este informe.

---

## 0. Veredicto ejecutivo

| Dimensión | Veredicto |
|---|---|
| Código y alcance | **APROBADO CON LIMITACIONES** |
| Visual / accesibilidad de Inicio | **APROBADO CON LIMITACIONES** (coherente y usable; **no** es paridad con la referencia) |
| Proceso, build y evidencia | **RECHAZADO** |
| **Cierre técnico de la fase** | **RECHAZADO — NO GO** |

**Lo que mejoró desde la auditoría anterior**

- `inicio-preferences.tsx` fue **eliminado**; la preferencia vuelve a una sola fuente: el script inline de `layout.tsx:66`.
- `icons/sol.svg` fue **eliminado**; no quedan assets nuevos sin uso.
- El KPI ya **no desborda** con `$1,245.00` en 1448/1366/1281/1280/1200/1101/390/320 ni con `xlarge`. Lo verifiqué de forma independiente contra el build actual: **0 overflow**.
- El breakpoint 2×2 entra en **≤1340 px** y vuelve a 4 columnas en 1341; la transición no desborda.
- El checkmark usa `content: "\2713"` (`inicio.css:650`), sin mojibake.
- `manifest.json` y `README.md` de assets fueron actualizados; ya describen `brand-shop-cream.svg`, `logo-simbolo.svg` e `icons/`, y ya no afirman que los PNG “no reemplazan un asset de producción”.
- `?ayuda=1` ya **no produce error de hidratación**: verifiqué la carga con Playwright y la consola quedó sin errores/warnings.
- `inicio.css` tiene 1,479 líneas; el diff contra HEAD toca 1,172 líneas (+814/−358).

**Lo que impide el GO**

- **Árbol sucio**: 10 archivos modificados + 3 rutas de assets nuevos (17 archivos) + `quality-reports/` completo (209 archivos, 26.2 MB).
- **La evidencia de handoff no corresponde al HEAD**: `harness/evidence/latest.json` sigue siendo de `9206ea1` (`p0/final-closure`); no existe `latest-static.json`.
- **`npm run verify:evidence` sigue fallando 4 chequeos**: SHA, árbol actual, hashes de artefactos `mobile` y `gatesOk` recalculado.
- **El único gate actual es `fast`** (`2026-11-04T02-00-42-297Z-fast.json`): 3/3 gates verdes, pero `ok:false` por árbol sucio. No hay `static` ni `full`.
- **Los p0 no son todos del build actual**: p0-venta se corrió a las 01:47Z y el build es de 01:54Z; p0-fiado/corte/dinero son de 00:29–00:31Z, antes de los cambios finales de `caja-app.tsx` (01:44Z) y `inicio.css`/`layout.tsx` (01:52Z).
- **El `webhook 40/40` sigue sin JSON de corrida contra `b8f127d`.** El 40/40 almacenado es de `9206ea1`/`3c596b`.
- **Regresión nueva detectada:** el arreglo de hidratación de `caja-app.tsx` (abrir el sheet en un efecto post-montaje) hizo que `/?ayuda=1#ajustes` **ya no desplace el sheet hasta “Ajustes”** en móvil ni en 1448×700. La sección queda parcialmente fuera del viewport (`top=617`, `bottom=1126` a 390×844; `top=638`, `bottom=1295` a 320×640; `scrollTop=0`).
- **`layout.tsx` deja `data-contrast="high"` pegado** si el modo `forced-colors` del sistema se desactiva después de cargar `/inicio`; no hay listener ni limpieza. Es un efecto colateral menor, no financiero.
- **`quality-reports/` no está en `.gitignore`**: aunque se commitee el código, el árbol seguirá sucio.

---

## 1. Estado Git y alcance

### 1.1 `git status --short`

```text
 M web/src/app/inicio/inicio.css
 M web/src/app/inicio/page.tsx
 M web/src/app/layout.tsx
 M web/src/app/manifest.ts
 M web/src/assets/inicio/README.md
 M web/src/assets/inicio/hero-registradora.png
 M web/src/assets/inicio/manifest.json
 M web/src/assets/inicio/sidebar-plantas.png
 M web/src/assets/inicio/sugerencia-lupita.png
 M web/src/components/caja-app.tsx
?? quality-reports/
?? web/src/assets/inicio/brand-shop-cream.svg
?? web/src/assets/inicio/icons/
?? web/src/assets/inicio/logo-simbolo.svg
```

`git status --short --untracked-files=all` devuelve **236 líneas**: 17 archivos de assets nuevos de código + 209 archivos de `quality-reports/`. Ya **no** aparecen `inicio-preferences.tsx` ni `icons/sol.svg`.

### 1.2 `git diff --stat` / `--numstat`

| Archivo | Cambio | Líneas |
|---|---|---:|
| `web/src/app/inicio/inicio.css` | modificado | +814 / −358 |
| `web/src/app/inicio/page.tsx` | modificado | +208 / −106 |
| `web/src/app/layout.tsx` | modificado | +1 / −1 |
| `web/src/app/manifest.ts` | modificado | +1 / −1 |
| `web/src/assets/inicio/README.md` | modificado | +19 / −1 |
| `web/src/assets/inicio/hero-registradora.png` | modificado (binario) | 82,654 → 71,709 B |
| `web/src/assets/inicio/manifest.json` | modificado | +46 / −36 |
| `web/src/assets/inicio/sidebar-plantas.png` | modificado (binario) | 103,371 → 105,069 B |
| `web/src/assets/inicio/sugerencia-lupita.png` | modificado (binario) | 67,025 → 93,610 B |
| `web/src/components/caja-app.tsx` | modificado | +9 / −4 |

Total: **10 archivos tracked, +1098 / −507**. `git diff --check` no reporta errores de whitespace; solo avisos de Git sobre LF→CRLF en `page.tsx`, `README.md` y `manifest.json`.

### 1.3 Archivos nuevos (untracked)

Código/activos que **deben** entrar en el commit o el build del HEAD quedará roto:

```text
web/src/assets/inicio/brand-shop-cream.svg
web/src/assets/inicio/logo-simbolo.svg
web/src/assets/inicio/icons/ajustes.svg
web/src/assets/inicio/icons/ayuda.svg
web/src/assets/inicio/icons/caja.svg
web/src/assets/inicio/icons/campana.svg
web/src/assets/inicio/icons/compras.svg
web/src/assets/inicio/icons/fiado.svg
web/src/assets/inicio/icons/inicio.svg
web/src/assets/inicio/icons/inventario.svg
web/src/assets/inicio/icons/metas.svg
web/src/assets/inicio/icons/monedas.svg
web/src/assets/inicio/icons/pendientes.svg
web/src/assets/inicio/icons/proveedores.svg
web/src/assets/inicio/icons/reportes.svg
web/src/assets/inicio/icons/sol-bienvenida.svg
web/src/assets/inicio/icons/ventas.svg
```

- **17 archivos** nuevos de código/assets, en 3 rutas untracked.
- `quality-reports/` es untracked completo: **209 archivos, 26.2 MB**; `14_EVIDENCIAS/` aporta 190 archivos / 18.8 MB y `CIERRE_FASE_1/` 7 archivos / 5.0 MB.
- `CIERRE_FASE_1/` contiene este informe, tres auditorías paralelas (`AUDITORIA_SISTEMA_VISUAL.md`, `AUDITORIA_ACCESIBILIDAD.md`, `AUDITORIA_RESPONSIVE.md`) y las 3 imágenes de comparación. Las tres auditorías paralelas son de 18:54–19:06 y **preceden** a los cambios finales de 19:44–19:52; no son evidencia del estado final.

> **Riesgo de handoff:** si se commitean solo los 10 archivos modificados y se olvida `brand-shop-cream.svg`, `logo-simbolo.svg` o `icons/`, `page.tsx` importará archivos inexistentes en el commit.

### 1.4 Alcance real del cambio

`git diff --name-status` solo muestra los 10 archivos de §1.2. No hay cambios en:

- `web/src/lib/` (órdenes, fiado, pagos, metas, auth, DB).
- `web/src/app/api/` (webhooks, verify, checkout, demo).
- `web/src/app/pay/` ni `web/src/app/checkout/`.
- Variables de entorno, `.env.local`, `next.config.ts` ni `middleware`.

El cambio es **presentación / rutas / encoding / assets / ancla de ayuda**, más dos ajustes de comportamiento no financieros: el script de preferencias de `layout.tsx` y la apertura post-montaje del sheet de ayuda. No hay lógica de dinero.

---

## 2. Detalle de los cambios funcionales

### 2.1 `web/src/components/caja-app.tsx` — 13 líneas, sin lógica financiera

Diff completo relevante:

- `caja-app.tsx:683`: `const [helpOpen, setHelpOpen] = useState(false);` (antes `useState(initialHelpOpen)`).
- `caja-app.tsx:936-940`: en el efecto de montaje, `if (initialHelpOpen) setHelpOpen(true);` con comentario de que el portal del Sheet no existe en SSR. La dependencia del efecto incluye `initialHelpOpen`.
- `caja-app.tsx:2955`: título del sheet `"Guía"` → `"Ayuda y ajustes"`.
- `caja-app.tsx:7999`: bloque de Accesibilidad recibe `id="ajustes"` + `scroll-mt-4`.

No hay cambios en handlers de venta, fiado, corte, pagos, webhooks, DB ni auth. El cambio de hidratación funciona: `/?ayuda=1` abre el diálogo y la consola quedó **sin errores ni warnings** en mi prueba con Playwright; cerrarlo y esperar 1.5 s lo deja cerrado (`dialogs=0`).

**Regresión detectada:** al abrir el sheet después del montaje, el hash `#ajustes` ya no produce scroll dentro del sheet. Medido contra el build actual:

| Caso | `#ajustes` top / bottom | ¿En viewport? | `scrollTop` del sheet |
|---|---:|---|---:|
| 1448×1086 | 434 / 885 | Sí | 0 |
| 1448×700 | 415 / 866 | **No** (alto 700) | 0 |
| 390×844 | 617 / 1126 | **No** (alto 844) | 0 |
| 320×640 | 638 / 1295 | **No** (alto 640) | 0 |

`navegacion/resumen.json` marca “Ajustes abre Ayuda y ajustes” como PASS, pero **solo cuenta que exista el diálogo**, no que el destino `#ajustes` quede visible. La regresión queda oculta por ese check.

### 2.2 `web/src/app/layout.tsx` — 1 línea

`layout.tsx:66` añade al script inline:

```js
if (window.matchMedia && window.matchMedia('(forced-colors: active)').matches && location.pathname === '/inicio')
  r.dataset.contrast = 'high';
```

- Verificado: con `forced-colors: active`, `/inicio` arranca con `data-contrast="high"` (`matchMedia=true`).
- **No hay limpieza:** si luego se desactiva `forced-colors`, el atributo sigue en `high` (`mq=false`, `data-contrast=high`) hasta recargar o hasta que monte Caja. Es un efecto colateral P2/P3, no financiero.
- Solo se ejecuta en la carga inicial del documento para el pathname exacto `/inicio`; en navegación cliente a `/inicio` no se vuelve a ejecutar. El bloque `@media (forced-colors: active)` de `inicio.css` sigue siendo el fallback real.
- No rompe la hidratación: el `<html>` tiene `suppressHydrationWarning` y no vi errores de consola.

### 2.3 `web/src/app/inicio/page.tsx` — presentación, rutas y a11y

- Elimina los íconos Lucide de navegación y usa `MaskIcon` con SVG del kit (`page.tsx:70-87`).
- Añade skip link (`:117`) y `<main id="inicio-main" tabIndex={-1}>` (`:221`).
- Añade `aria-label` a la marca y al nav; `aria-current` en Inicio.
- Reemplaza la tienda PNG por `brand-shop-cream.svg` en sidebar y `logo-simbolo.svg` en topbar.
- Añade badges `Ejemplo` a las tareas fixture (`:329`) y nota demo (`:341-344`).
- No hay lógica financiera: solo `getDashboardData`, `listGoals`, `listTasks`, `formatMxn`, `formatLongDate`.

**Cambio de rutas que sigue alterando comportamiento:**

| Ítem visible | `href` actual | Línea | Efecto verificado |
|---|---|---:|---|
| Ventas | `/?tab=caja` | `page.tsx:52` | Abre pestaña Caja; correcto para “ventas”. |
| Fiados | `/?tab=fiado` | `:53` | Abre Fiado; correcto. |
| Caja | `/?tab=corte` | `:57` | **Abre Corte, no la pestaña Caja.** |
| Reportes | `/?tab=corte` | `:63` | Misma ruta que Caja. |

Prueba real de clic: “Caja y corte” → `http://localhost:3100/?tab=corte`, `h1 = "Caja"`, pestaña activa `"Corte"`; “Ventas” → `/?tab=caja`, activa `"Caja"`. El `aria-label` “Caja y corte” mitiga lectores de pantalla, pero para una persona que ve “Caja” el destino sigue siendo Corte y “Caja”/“Reportes” duplican destino. **Confirmar con producto**; no es lógica de dinero.

### 2.4 `web/src/app/inicio/inicio.css` — layout, tema y accesibilidad

- Reescritura visual de `/inicio`: sidebar 236, topbar 100, contenido 1129, 4 KPI, hero/pending/sugerencia.
- KPI: `clamp(1.75rem, 2.3vw + 0.7rem, 2.625rem)` (`inicio.css:459-468`) y breakpoint 2×2 en `@media (max-width:1340px)` (`:818-823`).
- Checkmark: `content: "\2713"` (`:650`), sin mojibake.
- Alto contraste `data-contrast="high"` (`:1309`) y `@media (forced-colors: active)` (`:1475`).
- Define sus propios tokens `--inicio-*`; no importa tokens globales de Caja.

### 2.5 `web/src/app/manifest.ts` y assets

- `manifest.ts:5` mantiene el fix de encoding `Mercado Cero · La caja que habla` (U+00B7). Persiste el BOM `EF BB BF` al inicio de `manifest.ts` y `page.tsx`; es preexistente y no fue corregido.
- `README.md` y `manifest.json` de assets fueron reescritos; ver §3.

---

## 3. Archivos nuevos, assets, manifiesto y KPI

### 3.1 `inicio-preferences.tsx` e `icons/sol.svg`: resueltos

- `web/src/app/inicio/inicio-preferences.tsx` **ya no existe**; `page.tsx` no lo importa. La preferencia se aplica solo desde `layout.tsx:66`.
- `web/src/assets/inicio/icons/sol.svg` **ya no existe**; `icons/` tiene 15 SVG, todos usados por `page.tsx` (14 íconos de navegación/KPI + `sol-bienvenida`).
- No hay referencias residuales a `InicioPreferences` ni `sol.svg`.

### 3.2 Los SVG del kit siguen copiados correctamente

Comparé SHA-256 contra `design-references/mercado-cero/02_ASSETS/`:

- Los **15 SVG** de `web/src/assets/inicio/icons/` son **byte-idénticos** a su fuente: 14 de `02_ASSETS/icons/` (ajustes, ayuda, caja, campana, compras, fiado, inicio, inventario, metas, monedas, pendientes, proveedores, reportes, ventas) y `sol-bienvenida.svg` de `02_ASSETS/illustraciones/sol-bienvenida.svg`.
- `logo-simbolo.svg` es **byte-idéntico** a `02_ASSETS/brand/logo-simbolo.svg`.
- `brand-shop-cream.svg` **no tiene contraparte** en las carpetas revisadas del kit (`brand/`, `icons/`, `illustraciones/`). Es una variante propia; el README la describe, pero no tiene nota de licencia ni autoría.

No hay U+FFFD en TS/CSS/SVG/README/manifest: los acentos son UTF-8 válidos (por ejemplo `logo-simbolo.svg` usa U+00ED para “í”; `manifest.ts` usa U+00B7). La consola de Windows muestra un glifo roto por code page, no porque el archivo esté corrupto.

### 3.3 `manifest.json` / `README.md`: coherentes en lo esencial, con una precisión pendiente

Estado actual:

- `manifest.json` declara 7 ítems: los 4 PNG, `brand-shop-cream.svg`, `logo-simbolo.svg` e `icons/`, con `mode` y notas.
- `README.md` describe cutouts, alfa, sidebar RGB, papel transparente, SVGs e `icons/`; ya no dice que no reemplazan assets de producción.
- Ya no se lista `sol.svg`; `icons/` es una entrada genérica.

**Precisión pendiente:** el `note` sigue diciendo “Recortes exactos” y los `crop` de hero/sugerencia no coinciden con el alto final:

| Asset | `crop` (x1,y1,x2,y2) | Tamaño del crop | PNG final |
|---|---:|---:|---:|
| hero | 280,512,532,790 | 252×278 | **252×247** |
| sugerencia | 270,825,605,1025 | 335×200 | **335×194** |
| sidebar | 0,790,236,1086 | 236×296 | 236×296 |
| papel | 960,100,1448,202 | 488×102 | 488×102 |

La diferencia es compatible con haber recortado filas transparentes del cutout, pero el manifiesto no lo dice; “recortes exactos” debería ser “crop fuente + recorte final”. No es bloqueante, pero es documentación imprecisa.

### 3.4 KPI: el bug de montos grandes quedó resuelto

`audit_amounts.py` (evidencia de 19:40–19:41) y mi re-medición independiente contra el build actual (19:54) coinciden:

| Viewport | Columnas | `$1,245.00` scroll/client | Overflow |
|---|---:|---:|---:|
| 1448×1086 | 4 | 227 / 227 | No |
| 1366×768 | 4 | 215 / 215 | No |
| 1341×900 | 4 | 209 / 209 | No |
| 1340×900 | 2 | 490 / 490 | No |
| 1281×900 | 2 | 461 / 461 | No |
| 1280×900 | 2 | 460 / 460 | No |
| 1200×900 | 2 | 420 / 420 | No |
| 1101×900 | 2 | 371 / 371 | No |
| 390×844 | 2 | 156 / 156 | No |
| 320×640 | 2 | 126 / 126 | No |
| 390×844 `xlarge` | 2 | 156 / 156 | No |
| 1448×1086 `xlarge` | 4 | 227 / 227 | No |

El breakpoint es limpio: 4 columnas a 1341, 2 columnas a 1340. El P1-9 anterior queda **cerrado** en el código actual.

> `montos/resumen.json` fue capturado a las 19:41, antes de la última modificación de `inicio.css` (19:52); mi prueba independiente confirma que el resultado sigue vigente con el CSS final.

### 3.5 Licencias / procedencia

- `design-references/mercado-cero/09_GOBERNANZA/02_ASSETS_Y_LICENCIAS.md:3-5` dice que los SVG se crearon para el kit, **sin licencia pública** y sin aclarar el registro de la marca “Mercado Cero”.
- No hay archivo `LICENSE` para los assets dentro de `web/src/assets/inicio/`.
- Los PNG nuevos derivan de la referencia canónica; no hay nota de autoría, herramienta ni permiso de uso más allá del README.
- Esto no rompe el build, pero sigue siendo una limitación de procedencia.

---

## 4. Build, typecheck, lint y gates

### 4.1 Comandos ejecutados en esta reauditoría

| Comando | Resultado | Nota |
|---|---|---|
| `npm run verify:fast` (desde `web/`) | **3/3 gates verdes; overall `ok:false`** | Corrida actual `harness/evidence/runs/2026-11-04T02-00-42-297Z-fast.json`. |
| `npm run verify:evidence` | **FAIL, 4 chequeos** | Ver §4.3. |
| `npx tsc --noEmit` / `npx eslint` aislados | **No re-ejecutados por separado** | `verify:fast` ejecutó `lint` y `types` con PASS; el build actual es de 19:54 y la corrida fast de 20:00, posterior. |
| `npm run build` | **No re-ejecutado** | Para no pisar `.next/` del servidor vivo. Evidencia: `.next/BUILD_SHA` y `/api/health`. |

### 4.2 `verify:fast` actual (build actual)

Archivo: `harness/evidence/runs/2026-11-04T02-00-42-297Z-fast.json`.

```text
mode=fast  ok=false  gatesOk=true  evidenceValid=false  complete=true
gitAtStart=b8f127d…  dirty=true  gitAtEnd=b8f127d…  dirty=true
serverBuildSha=b8f127d…  buildMatches=true  shaStable=true  buildBound=true
gates: guard OK / lint OK / types OK
reasons:
- árbol sucio al inicio (gitAtStart.dirty=true): commitea antes de generar evidencia
- el árbol quedó sucio antes de escribir la evidencia (gitAtEnd.dirty=true)
```

No es un gate de handoff: `fast` solo prueba guardrails + lint + tipos y no incluye build, runtime, HIG, p0 ni webhook.

### 4.3 `npm run verify:evidence` (salida actual)

```text
EVIDENCIA full - 9206ea1 - HEAD b8f127d - build 9206ea1
FAIL  gitAtStart.sha === HEAD - 9206ea10… vs b8f127d…
FAIL  árbol actual limpio (ignorando generados) - dirty=true
FAIL  cada gate ok/exitCode/reason/expected/artefactos válidos
      mobile: demo/mobile-audit.json: sha256 no coincide
      mobile: demo/mobile-360-cobro.png: sha256 no coincide
      mobile: demo/mobile-360-cobro.png: tamaño 174581 != 172550
      mobile: demo/mobile-360-corte.png: sha256 no coincide
      mobile: demo/mobile-360-corte.png: tamaño 183252 != 129629
      mobile: demo/mobile-360-fold.png: sha256 no coincide
      mobile: demo/mobile-360-fold.png: tamaño 222223 != 171312
      mobile: demo/mobile-360-full.png: sha256 no coincide
FAIL  gatesOk coincide con los gates y no está manipulado - declarado=true recalculado=false

EVIDENCIA INVÁLIDA: 4 chequeo(s) fallaron.
```

`latest.json` es `mode:"full"`, `ok:true`, pero:

- `gitAtStart.sha = 9206ea10…` (`p0/final-closure`), no `b8f127d…`.
- `serverBuildSha = 9206ea10…`.
- Sus artefactos `mobile` ya no coinciden con los archivos en disco: **el latest tampoco es íntegro para su propio SHA**.
- No existe `harness/evidence/latest-static.json`.

### 4.4 Identidad del build

- `web/.next/BUILD_SHA`: `{"sha":"b8f127d85985fd519a0010128a1f42bf5346e24e","builtAt":"2026-11-04T01:54:06.249Z"}`.
- `/api/health`: `ok:true`, `buildSha:b8f127d…`, `node:v25.7.0`, uptime coherente con el arranque posterior al build.
- `/inicio`: `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
- El build es posterior a los cambios de `page.tsx` (19:11), `caja-app.tsx` (19:44), `layout.tsx` (19:52) e `inicio.css` (19:52). **Sí corresponde al código actual**, aunque fue generado desde un árbol sucio y no hay log de `npm run build` en la fase.

---

## 5. Tests de regresión

| Suite | Archivo | Resultado | SHA / dirty | `baseUrl` | Timestamp | ¿Build actual? |
|---|---|---|---:|---|---|---|---|
| p0-venta | `harness/evidence/p0-venta-e2e.json` | **66 / 0 / 0 / 66** | `b8f127d…` / `dirty:true` | `127.0.0.1:3311` | 01:47:21–01:48:22Z | **No**: ~6 min antes del build (01:54:06Z); sin `buildSha`. |
| p0-fiado | `harness/evidence/p0-fiado-e2e.json` | **51 / 0 / 0 / 51** | `b8f127d…` / `dirty:true` | `localhost:3101` | 00:29:09–00:29:45Z | **No**: antes de los cambios finales de Caja/CSS/layout. |
| p0-corte | `harness/evidence/p0-corte-e2e.json` | **69 / 0 / 0 / 69** | `b8f127d…` / `dirty:true` | `localhost:3101` | 00:30:01–00:31:01Z | **No**: antes de los cambios finales. |
| p0-dinero | `harness/evidence/p0-dinero-e2e.json` | **45 / 0 / 3 known / 48** | `b8f127d…` / `dirty:true` | `localhost:3213` | 00:31:47–00:31:55Z | **No**: antes de los cambios finales. |
| p0-integración | `harness/evidence/p0-integracion-e2e.json` | **51 / 0 / 0 / 51** | `3c596ba…` / `dirty:false` | `127.0.0.1:3212` | anterior | **No**: otro commit limpio; no es de este HEAD. |

Los **conteos son correctos** y coinciden con lo declarado, pero **no todos los JSON son del build actual**. La afirmación “p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-dinero 45/0 + 3 KNOWN” es válida como **regresión histórica reciente**, no como evidencia de cierre del build `b8f127d` actual.

### 5.1 Los 3 KNOWN de p0-dinero

`p0-dinero-e2e.json` los registra con `ok:null` (no son passes):

1. **P1-4: payload real de pey no verificable sin portal.** El contrato y `/api/verify` usan payload sintético documentado; falta validar la forma real con pey.
2. **P1: reconciliación de red no ejecutada.** `reconcile.ts` filtra por fecha y excluye demo; no se llamó a pey real.
3. **Contrato de conteo posterior al cierre.** El backend exige `previewFingerprint` y responde 409 `totals_changed`; la UI debe reemplazar el conteo guardado por el vigente.

### 5.2 Webhook 40/40: sin JSON de esta fase

- No existe un JSON de `webhook-gate.mjs` con 40/40 contra `b8f127d`.
- `p0-dinero-e2e.json` solo cubre **7** checks de webhook (monto distinto 409, reintento idempotente, 404, `demo_paid` una sola vez).
- El `40/40` de `harness/evidence/latest.json` corresponde a `9206ea1`; el de `runs/2026-11-03T18-28-41-191Z-full.json`, a `3c596ba`.
- `context/05-EVIDENCIA.md:129` ya lo documenta: “Webhook 40/40 … Script con 40 checks; sin JSON de corrida | **NV** para HEAD”.
- **No se debe presentar “webhook 40/40” como evidencia de `b8f127d`.**

### 5.3 Limitaciones de los p0

- Todos los JSON de `b8f127d` tienen `dirty:true`.
- `p0-venta`/`p0-fiado`/`p0-corte` no registran `buildSha` del servidor; registran el commit de git y el comando de build.
- `p0-venta`/`p0-fiado`/`p0-corte` usan puertos que no son los canónicos del HARNESS (3311/3101 vs 3211/3212), por lo que parecen corridas manuales.
- `p0-dinero` sí usa 3213 (canónico), pero también está `dirty:true` y no registra `buildSha`.

**Uso correcto:** “regresión funcional reciente sobre el árbol de trabajo”, **no** “evidencia de cierre limpia”.

---

## 6. TODO, FIXME, mocks y botones sin comportamiento

- **No hay `TODO`, `FIXME`, `HACK` ni `XXX`** en los archivos modificados/nuevos de la app (`page.tsx`, `inicio.css`, `layout.tsx`, `manifest.ts`, `caja-app.tsx`).
- **Fixtures demo:** las 3 tareas (`page.tsx:108-110`) siguen siendo fixtures, pero ahora están etiquetadas con `Ejemplo` (`:329`) y con la nota “Ejemplos demo; no son tareas reales. Se administran en Tareas.” (`:341-344`). Esto mejora la verdad demo; no es un mock nuevo.
- **No hay botones nuevos sin comportamiento.** La página no tiene `<button>`; los CTA son `<Link>` con `href` real. La campana y el chevron son decorativos (`aria-hidden`) y preexistentes; no son controles nuevos.
- **Productos/Proveedores** siguen como `<span aria-disabled="true">` con `title="Próximamente"`; es un placeholder preexistente.
- `inicio-preferences.tsx` y `icons/sol.svg` ya fueron eliminados; no hay duplicados muertos en el código nuevo.

---

## 7. CSS, accesibilidad y regresiones

### 7.1 Lo que sigue en `inicio.css`

Analicé el CSS actual (1,479 líneas) con PostCSS y con el CSSOM real.

- **No hay selectores duplicados en el mismo contexto** (misma regla + mismo `@media`).
- **Sí hay 3 bloques `@media (max-width: 760px)`**:
  - `inicio.css:848-1206` — bloque principal móvil.
  - `inicio.css:1208-1217` — reordena el grid para `data-text-size="xlarge"`.
  - `inicio.css:1469-1473` — padding del hero en alto contraste.
  Los tres son válidos, pero mantener tres bloques de la misma query complica el override.
- **Regla sin efecto propio:** `inicio.css:804-812` (`@media (min-width:1101px) and (max-width:1400px) .inicio-hero { grid-template-columns: 269px minmax(0,1fr); }`) repite la base de `inicio.css:493-505`. PostCSS la marca como “todas sus props ya están en la base”.
- **Variable muerta:** `--inicio-border` se define en `inicio.css:13` y se redefine en `inicio.css:1318`, pero **nunca se usa**. Todos los bordes usan `--inicio-border-soft`.
- **Override contradictorio:** `.inicio-content:focus-visible` define `outline-offset: -3px` en `inicio.css:342-345`, pero `.inicio-shell :focus-visible` define `outline-offset: 2px` en `inicio.css:779-782` con la misma especificidad y aparece después. El valor real medido es **2px**; el `-3px` es código muerto.
- **Declaraciones redundantes** (mismo selector/propiedad/valor que la base, dentro de un `@media`):
  - `inicio.css:835` `width: calc(100% - 48px)` (ya en `:335`).
  - `inicio.css:851` `font-size: 1rem` (ya en `:23`).
  - `inicio.css:897` `gap: 2px` (ya en `:119`).
  - `inicio.css:996` `display: grid` (ya en `:325`).
  - `inicio.css:1027` `line-height: 1.02` (ya en `:378`).
  - `inicio.css:1131` `min-height: 48px` (ya en `:606`).
  - `inicio.css:1181` `align-self: end` (ya en `:721`).

No hay clases `.inicio-*` sin uso. El checkmark está corregido (`content: "\2713"`, `inicio.css:650`).

### 7.2 KPI: resuelto

Ver §3.4. El P1-9 anterior queda cerrado: 0 overflow en 12 combinaciones, incluido `$1,245.00` y `xlarge`, y breakpoint 2×2 limpio en ≤1340.

### 7.3 Regresión del ancla “Ajustes”

Ver §2.1. El fix de hidratación eliminó el error de consola, pero el sheet se abre después del montaje y el hash `#ajustes` ya no desplaza al bloque de accesibilidad. A 390×844, 320×640 y 1448×700 el bloque no queda completamente en viewport y `scrollTop=0`; a 320 solo se ven ~2 px del bloque. Es un defecto de comportamiento, no de dinero.

### 7.4 `forced-colors` en `layout.tsx`

Ver §2.2. Funciona en la carga inicial de `/inicio`, pero no limpia `data-contrast` al desactivar `forced-colors`; es un efecto colateral P2/P3.

### 7.5 Axe y variantes

- `/inicio` normal, móvil y alto contraste: **0 violaciones**, 36 passes, **1 incomplete de `color-contrast`** (7 nodos del sidebar) porque axe no puede resolver el fondo con gradiente; no es una violación, pero **no equivale a contraste verificado automáticamente**.
- `/` y `/?tab=…` en desktop: **1 violación serious por ruta**, `label-content-name-mismatch`, nodo `.brand-lockup` (`<a class="brand-lockup" href="/inicio" aria-label="Ir a Inicio">`). Es **idéntica en `antes-baseline/axe/caja-desktop-1448x1086.json`**, así que es **preexistente**, no la introdujo esta fase. En móvil esas rutas dan 0.
- Las 10 variantes (`variantes/summary.json`) dan **0 overflow, 0 violaciones axe, 0 pageErrors**; pero fueron capturadas a las 19:49–19:50, antes de la última edición de `inicio.css` (19:52). No cubren 1341/1340, 1101/1200 ni `forced-colors`; el nuevo `montos/` sí cubre 1101/1200/1281/1280/xlarge.
- La frase correcta es “**axe 0 en Inicio**”, no “axe 0 en todo el producto”. La deuda de Caja debe seguir su propio carril.

### 7.6 Objetivos táctiles móviles

Los ítems de nav móvil usan `min-height: 40px` (`inicio.css:903` y `:924`), por debajo del estándar interno de 48 px que sí cumplen “Ver todos” y el CTA. WCAG 2.2 AA pide 24 px como mínimo, así que no es una violación axe; es una inconsistencia HIG.

---

## 8. ¿La evidencia cumple `AGENTS.md` / `HARNESS.md`?

**No.**

`AGENTS.md:26` exige:

> No declares listo sin `harness/evidence/latest.json` (full) o `latest-static.json` (static) con `ok:true`, `gitAtStart.sha` igual al commit de código entregado, `gitAtStart.dirty:false` y `npm run verify:evidence` PASS.

`HARNESS.md:202-206` repite: `verify:static` 5/5 sobre árbol limpio, `verify:full` 23/23, `verify:evidence` PASS, `latest` con `ok:true` y `mode` real, sin secretos. `HARNESS.md:61` agrega que el dirty incluye untracked y que “si el árbol está sucio, los gates pueden correr para diagnóstico, pero el resultado queda `ok:false` y no es evidencia válida”. `HARNESS.md:139` fija el flujo: commit → build → gates sobre árbol limpio → `verify:evidence`.

Estado actual:

| Requisito | Estado |
|---|---|
| `latest.json` o `latest-static.json` con `ok:true` | `latest.json` de `9206ea1`, no de `b8f127d`; no hay `latest-static.json`. |
| `gitAtStart.sha === HEAD` | **No**: `9206ea1` vs `b8f127d`. |
| `gitAtStart.dirty === false` | **No**: `dirty:true` en `latest` y en el fast de `b8f127d`. |
| `verify:evidence` PASS | **No**: 4 FAIL (SHA, árbol, artefactos mobile, `gatesOk`). |
| `verify:static` 5/5 | **No ejecutado** en esta fase. |
| `verify:full` 23/23 | **No ejecutado** en esta fase. |
| p0 del build actual | **No**: p0-venta es ~6 min anterior al build; fiado/corte/dinero son anteriores a los cambios finales. |
| Webhook 40/40 con JSON | **No**: no hay JSON de esta fase. |
| Evidencia de `/inicio` integrada al harness | **No**: los scripts de `14_EVIDENCIAS` son one-off; `web/scripts` no tiene `/inicio` ni `?tab` tests. |
| Evidencia atribuible a build/SHA | **Parcial**: `metricas`, `axe` y `navegacion` son de 19:55–19:56 (post-build); `montos` es de 19:41 y `variantes` de 19:49–19:50 (pre-CSS final); ningún JSON registra `buildSha` o commit. La comparación `CIERRE_FASE_1/comparacion-1448.png` es de 19:57 y tiene rótulo de build, pero es una anotación de imagen, no evidencia de gate. |

### 8.1 Frescura de la evidencia de `14_EVIDENCIAS/`

| Evidencia | Timestamp | ¿Post-build 19:54? | Lectura |
|---|---:|---|---|
| `metricas/`, `axe/`, `navegacion/` | 19:55–19:56 | Sí | Válida para el build actual. |
| `montos/` | 19:40–19:41 | **No** | Pre-CSS final; mi re-medición independiente confirma 0 overflow. |
| `variantes/` | 19:49–19:50 | **No** | Pre-CSS final; no cubre 1341/1340 ni el checkmark final. |
| `CIERRE_FASE_1/comparacion-*.png` | 19:57 | Sí | Comparación visual final. |
| `AUDITORIA_SISTEMA_VISUAL.md` | 18:54 | **No** | Pre-cambios finales; su veredicto visual no es del estado final. |
| `AUDITORIA_ACCESIBILIDAD.md` | 19:05 | **No** | Pre-cambios finales. |
| `AUDITORIA_RESPONSIVE.md` | 19:06 | **No** | Pre-cambios finales. |

### 8.2 Qué falta para handoff

1. **Decidir `quality-reports/`**: o se commitea (26.2 MB, 209 archivos) o se agrega a `.gitignore`. Sin esa decisión, `gitAtStart.dirty` nunca será `false`.
2. **`git add` de los 17 archivos nuevos de código/assets** (§1.3) y de los 10 modificados; commit.
3. **`git status --short` vacío** y `git rev-parse HEAD` nuevo.
4. **Build desde el HEAD limpio**: `cd web && npm run build`; reiniciar el servidor; `/api/health` debe devolver el nuevo SHA.
5. **`npm run verify:static`** (5/5) y, si se quiere cierre completo, **`npm run verify:full`** (23/23). Debe quedar `latest-static.json` o `latest.json` con `ok:true` y `dirty:false`.
6. **`npm run verify:evidence` PASS** contra el HEAD entregado.
7. **Re-correr los p0 por los gates canónicos** (p0-venta 3211, p0-fiado/corte 3212, p0-dinero 3213) y, si se va a afirmar, **webhook 40/40 con JSON**. Todos deben quedar `dirty:false`.
8. **Añadir `/inicio` y `?tab=` a HIG/axe/mobile** en `web/scripts`, no solo en `quality-reports/14_EVIDENCIAS/`.
9. **Añadir a la evidencia** 1341/1340, 1101/1200, `xlarge` + montos de 4–5 cifras y `forced-colors`; y re-capturar `montos`/`variantes` después del CSS final.
10. **Corregir la regresión del ancla `#ajustes`** (scroll manual al bloque después de abrir el sheet, o abrir el sheet de forma compatible con SSR/hash) y añadir un check que compruebe `#ajustes` en viewport, no solo que el diálogo exista.
11. **Actualizar `harness/STATE.md`** con `npm run harness:report` y escribir el reporte de fase.
12. **Resolver procedencia/licencia** de los PNG nuevos y precisar el `crop` de hero/sugerencia en `manifest.json`.

> Las auditorías paralelas de `CIERRE_FASE_1/` (visual, accesibilidad, responsive) son de 18:54–19:06 y no cubren los cambios finales de 19:44–19:52. No deben usarse como evidencia del estado final.

---

## 9. Riesgos de regresión y archivos que no deben tocarse

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Commit incompleto (olvidar `brand-shop-cream.svg`, `logo-simbolo.svg` o `icons/`) | Alta | Alto | `git add` explícito de §1.3; build desde el commit. |
| `quality-reports/` untracked impide árbol limpio | Cierto | Alto | Commit o `.gitignore`; decisión del orquestador. |
| Ancla `#ajustes` no desplaza a la sección en móvil/700 | Alta | Medio | Scroll manual post-apertura o abrir el sheet de forma compatible con el hash; test de viewport. |
| “Caja” abre Corte y “Reportes” duplica destino | Media | Medio | Confirmar con producto; renombrar a “Corte” o apuntar Caja a `?tab=caja`. |
| `data-contrast=high` persiste al desactivar `forced-colors` | Media | Bajo | Listener `change` o limpiar el atributo cuando no haya preferencia explícita. |
| CSS muerto/duplicado (`--inicio-border`, `.inicio-hero` 805, 3×760) | Alta | Bajo | Limpieza dirigida; no cambia comportamiento. |
| `manifest.json` “recortes exactos” no coincide con alto final de hero/sugerencia | Media | Bajo | Documentar crop fuente + recorte final. |
| p0 no corresponden al build actual | Alta | Medio | Re-correr gates canónicos desde el commit limpio. |
| Webhook 40/40 sin JSON | Alta | Medio | Ejecutar `webhook-gate` y guardar artefacto. |
| Shell Inicio/Caja duplicado (236/100 vs 248/65) | Alta | Medio | Deuda preexistente; no unificar en esta fase sin plan. |
| `/inicio` sin tests integrados en HIG/axe/mobile | Alta | Medio | Añadir a `web/scripts`; no depender de scripts one-off. |
| Assets nuevos sin licencia/procedencia clara | Media | Medio | Documentar autoría/permiso. |
| `manifest.start_url="/inicio"` cambia entrada PWA | Media | Medio | Decisión de producto; no cambiar sin aprobación. |
| Regresión financiera por tocar `caja-app.tsx` | Baja | Alto | Solo se tocó apertura de ayuda/título/id; cualquier cambio adicional exige p0 + webhook. |

**Archivos que no deben tocarse sin contexto**

- `web/src/lib/orders.ts`, `web/src/app/api/webhooks/pey/route.ts`, `web/src/lib/pey-events.ts` — invariantes de dinero/webhook.
- `GOAL.md` — contrato.
- `.env.local` — secretos, no versionado.
- `demo/` generado — se regenera con scripts; el QR y el video son entregables.
- `SWARM/` — puede ser trabajo del orquestador; leer antes de modificar.
- `web/src/components/caja-app.tsx` — UI financiera grande; el diff actual es no financiero, pero no conviene ampliarlo sin p0/webhook.

---

## 10. Veredicto

| Dimensión | Veredicto | Base |
|---|---|---|
| **Código / alcance** | **APROBADO CON LIMITACIONES** | Sin lógica financiera; typecheck/lint PASS; KPI resuelto; preferencias y `sol.svg` eliminados; checkmark corregido; manifiesto/README actualizados. Limitaciones: regresión del ancla `#ajustes`, `data-contrast` sin limpieza, nav Caja/Reportes, CSS muerto y precisión del manifiesto. |
| **Visual / a11y de Inicio** | **APROBADO CON LIMITACIONES** | Estructura y geometría cercanas; axe 0 en Inicio normal/HC/móvil; skip link, foco y escala de texto funcionan; KPI 0 overflow. No re-hice una comparación pixel-perfect: el informe visual previo (pre-cambios finales) mantiene P1 de marca/tipografía. No es paridad. |
| **Proceso / evidencia** | **RECHAZADO** | Árbol sucio; `latest.json` de `9206ea1`; `verify:evidence` 4 FAIL; sin `latest-static`; p0 no actuales; webhook 40/40 sin JSON; evidencia one-off sin SHA/timestamp; `quality-reports` untracked. |
| **Cierre técnico de la fase** | **RECHAZADO — NO GO** | No se puede declarar GO con árbol sucio ni con evidencia que no corresponde al HEAD (`AGENTS.md:26`, `HARNESS.md:61/202-206`). |

**Para pasar a APROBADO** hacen falta, como mínimo: commit completo, árbol limpio, build desde ese commit, `verify:static`/`verify:full` verdes, `verify:evidence` PASS, p0 canónicos limpios y el 40/40 del webhook con JSON si se va a afirmar. En código, corregir el scroll de `#ajustes`, decidir la semántica de “Caja”/“Reportes” y limpiar el CSS muerto.

**No hay GO en este estado.**
