# Veredicto independiente — Cierre Fase 1 (Inicio)

> **Rol:** `mc-verificador-final` independiente.
> **Modo:** solo lectura. No edité código, no hice commits, no limpié el árbol, no moví archivos. El único archivo que escribí es este veredicto.
> **Fecha de verificación:** 2026-11-03 20:55 (-06:00, America/Mexico_City).
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
> **Rama:** `design/mercado-cero-v2` · **HEAD:** `b8f127d85985fd519a0010128a1f42bf5346e24e`
> **Árbol:** sucio (10 archivos modificados + 17 assets nuevos + `quality-reports/` untracked).
> **Servidor:** `http://localhost:3100` · `/api/health` → `ok:true`, `buildSha b8f127d…`; arranque ≈20:24:27.
> **Build servido:** `web/.next/BUILD_SHA` → `b8f127d…`, `builtAt 2026-11-04T02:23:49.308Z` (20:23:49 local).
> **Referencia canónica:** `design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png` (1448×1086).

---

## 0. Veredicto global

> ## **Fase 1 (producto, visual/funcional/demo): APROBADO CON LIMITACIONES.**
> ## **Handoff / merge: RECHAZADO — NO GO.**

**Para el cierre técnico/handoff, el veredicto único es RECHAZADO.** La aprobación con limitaciones aplica solo a la demo de Fase 1, no al cierre ni al merge.

**Lectura corta:** los P0/P1 **de producto** del veredicto anterior están cerrados y no encontré P0/P1 nuevos de producto. Quedan P2/P3 de fidelidad, navegación y accesibilidad. Pero el **P0-4 de proceso** —árbol sucio y evidencia que no corresponde al HEAD— sigue abierto; por eso no hay cierre técnico ni merge.

**Conteo operativo:** P0/P1 de producto = **0**; P0 de proceso = **1** (P0-4); P2 = **12**; P3 = **12**. Es un conteo propio y agrupado; las auditorías previas usan otro conjunto. La lista está en §8.

| Ámbito | Veredicto |
|---|---|
| Visual / composición | **APROBADO CON LIMITACIONES** |
| Responsive / navegación | **APROBADO CON LIMITACIONES** |
| Accesibilidad automática | **APROBADO CON LIMITACIONES** |
| Certificación WCAG | **NO EMITIDA** — lector de pantalla real **NOT RUN** |
| Integridad financiera | **APROBADO** |
| Pruebas / regresión | **APROBADO CON LIMITACIONES** |
| Evidencia / handoff | **RECHAZADO** |

---

## 1. Punto 1 — la captura 1448×1086 es `/inicio`, no Caja

**Resultado: PASS.**

Evidencia primaria: `quality-reports/mercado-cero-final/14_EVIDENCIAS/metricas/inicio-desktop-1448x1086.json` (20:25:32) y `.../capturas/inicio-desktop-1448x1086-viewport.png` (20:25:30).

| Comprobación | Medición real |
|---|---|
| `route` / `path` | `inicio` / `/inicio` |
| `h1` | “¡Buen día, Lupita!” |
| `aria-current` | `["Inicio"]` |
| 4 KPI en fila | `x=260, 547, 834, 1120`; todos `y=260`, `269×200` |
| Hero izquierda | `x=260, y=492, 538×304` |
| Pendientes derecha | `x=816, y=492, 573×304` |
| Sugerencia abajo | `x=260, y=816, 1129×211` |
| Formulario de Caja | `hasForm=0`; no es la pantalla de Caja |

La captura muestra el dashboard de Inicio con “Nueva venta”, “Pendientes” y “Sugerencia”; Caja (`/`) tiene otro shell y otro contenido. **No hay ambigüedad:** es `/inicio`.

---

## 2. Punto 2 — cierre de los P0/P1 del veredicto anterior

> **Nota de frescura:** los cuatro informes de auditoría tienen mtime 20:09–20:20, pero los últimos cambios de código son de **20:21:27–20:22:22** y el build es de **20:23:49**. Por eso las conclusiones de esos informes sobre foco, `#ajustes` y captura HC quedaron **superadas**; las áreas afectadas se re-verificaron aquí.

| Defecto anterior | Estado | Evidencia |
|---|---|---|
| **P0-1 Alto contraste roto** | **RESUELTO** | `capturas/inicio-desktop-1448x1086-hc-viewport.png` (20:25:32) es HC real: 130,616 B frente a 579,786 B de la normal, negro/blanco, arte oculto. `data-contrast=high` y `forced-colors` startup dan axe **0 violaciones** en 1448/390/320. Al desactivar forced-colors, `data-contrast` pasa de `high` a `null`. |
| **P0-2 Assets hero/sugerencia opacos o cortados** | **RESUELTO el P0** | `hero-registradora.png` 252×247 **RGBA, 52.2 % transparente**; `sugerencia-lupita.png` 335×194 **RGBA, 43.7 % transparente**. Captura: registradora completa y Lupita/tableta completas, sin rectángulo opaco. Queda P2 de encuadre: el arte de sugerencia termina 9 px antes del borde de la tarjeta. |
| **P0-3 Skip link / `<main>`** | **RESUELTO** | Primer `Tab` = `A.inicio-skip` “Saltar al contenido”, 172.8×48 en `(12,10)`; `Enter` → `MAIN#inicio-main`, `hash=#inicio-main`; siguiente `Tab` = “Registrar”. Reproducido de forma independiente. |
| **P0-3 Escala de texto** | **RESUELTO** | Con `xlarge`: root 20 px, H1 65, nav 22.5, KPI 47.3, CTA 25; `scrollWidth===clientWidth` en 1448/390/320. A 320×640 xlarge el CTA queda en `y=625–673` (parcialmente bajo 640), pero **no recortado** y alcanzable con scroll. |
| **P0-5 Encoding PWA** | **RESUELTO** | `/manifest.webmanifest` sirve `Mercado Cero · La caja que habla` con bytes `\xc2\xb7` correctos. Persiste el BOM en `manifest.ts` (P3 de higiene, no afecta la respuesta). |
| **P0-6 CTA móvil bajo el pliegue** | **RESUELTO** | 390×844: 133.2×48 en `y=711.7–759.7`; 320×640: 133.2×48 en `y=492.9–540.9`. Ambos dentro del viewport inicial. |
| **P0-6 Reflow 200 %** | **RESUELTO** | 724×543: `scrollWidth 724/724`, 0 overflow horizontal; CTA `y=705` requiere scroll vertical, pero no está recortado. `variantes/zoom-200-724x543.png`. |
| **P0-6 “Ajustes” recortado por abajo** | **RESUELTO** | `outlineBottom` = 695/763/1081 frente a 700/768/1086 en 1448×700, 1366×768 y 1448×1086 HC. El `padding-bottom:10px` del sidebar y el nuevo color de foco lo corrigieron. |
| **P0-6 KPI 5 cifras desborda** | **RESUELTO con margen frágil** | `$1,245.00`: 0 overflow en 1448/1200/320/320 xlarge; `$12,345.00` a 320 xlarge deja **1 px** al borde de la tarjeta (no recorta, no genera scroll). Es aceptable, pero sin holgura. |
| **Targets P0 (“Ver todos” 70×22 / CTA)** | **RESUELTO en lo P0; queda P2** | “Ver todos” 81×48 en 390/320 y 90×48 en 1448; CTA 133×48 móvil y 220×60 escritorio. La **nav móvil sigue en 40 px** (<44/48), defecto P2 nuevo/actual, no el mismo P0. |
| **P0-4 Árbol sucio + evidencia inválida** | **NO RESUELTO** | `git status` sucio; `latest.json` de `9206ea1`; `verify:evidence` falla 4 chequeos; no hay `latest-static.json`; no hay `static/full` sobre `b8f127d`; p0 con `dirty:true`. Ver §6. |
| **P0-7 Plan correctivo insuficiente** | **NO VERIFICADO / N/A** | No es un defecto de producto y no se re-evaluó el plan en esta pasada. |

**Conclusión:** no queda ningún P0/P1 **de producto** abierto. El P0-4 es de **proceso/evidencia** y es el que impide el cierre.

---

## 3. Punto 3 — axe normal y alto contraste en 1448/390/320

Reproducción independiente con Playwright/Chromium 156 y axe-core 4.14, etiquetas `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`.

| Caso | 1448×1086 | 390×844 | 320×640 |
|---|---:|---:|---:|
| Normal | **0 violaciones** · 7 incomplete | **0** · 7 incomplete | **0** · 8 incomplete |
| `data-contrast=high` | **0** · 0 incomplete | **0** · 0 incomplete | **0** · 1 incomplete |
| `forced-colors: active` (startup) | **0** · 0 incomplete | **0** · 0 incomplete | **0** · 1 incomplete |

- Los `incomplete` son de `color-contrast` por el gradiente del sidebar y, a 320, por `.inicio-topbar__name` “parcialmente oscurecido”. No son violaciones. Medición manual del topbar a 320 HC: **negro `#000` sobre blanco `#fff` = 21:1**; el resto de textos principales está entre 6.7:1 y 21:1.
- `forced-colors` startup aplica `data-contrast=high` + `forced-color-adjust:none`; al desactivar forced-colors, el listener de `layout.tsx` limpia el atributo (`high → null`). Ya no queda pegado.
- **Axe no evalúa la apariencia del anillo de foco.** Se midió aparte: nav activa en normal, outline crema `#fffdf7` sobre sidebar `#064b3e–#003f31` = **9.91–11.76:1**; en HC, outline maíz `#f2c768` sobre negro = **13.14:1**. Ya no es verde sobre verde.
- **No es certificación WCAG.** Lector de pantalla real **NOT RUN**; Windows High Contrast real **NOT RUN** (solo emulación); Firefox/Safari **NOT RUN**.

Evidencia de repo: `14_EVIDENCIAS/axe/inicio-desktop-1448x1086.json`, `...-hc.json`, `inicio-mobile-390x844.json`; la pasada 320 y forced-colors es independiente (fuera del repo, en `%TEMP%\opencode\mc-final-verify\results.json`).

---

## 4. Punto 4 — navegación

| Control | Resultado | Evidencia |
|---|---|---|
| Inicio activo | **PASS** | `aria-current="page"` solo en Inicio; `active=["Inicio"]` |
| CTA “Registrar” | **PASS** | `href="/"` → `/`, `h1` “Caja” |
| Marca vuelve a Inicio | **PASS** | `/inicio` → `/inicio` |
| Deep link Fiado | **PASS** | `/?tab=fiado`; pestaña/panel Fiado |
| Deep link Corte | **PASS** | `/?tab=corte`; pestaña/panel Corte |
| Deep link Meta | **PASS** | `/?tab=meta`; panel Meta |
| Deep link Pendientes | **PASS** | `/?tab=pendientes`; panel Pendientes |
| `?ayuda=1#ajustes` | **PASS** | 1 diálogo, foco en `H2 “Ayuda y ajustes”`, `hash=#ajustes`, **0 pageerrors/console errors**; `#ajustes` top = 152/133/183/162 en 1448×1086, 1448×700, 390×844, 320×640. A 320 el bloque mide 657 px y su bottom (819) excede 640, pero **el top sí queda visible** y el sheet scrollea. La regresión anterior (top=638, scrollTop=0) está corregida por el `scrollIntoView` post-montaje de `caja-app.tsx`. |
| “Ver todos” 48 px | **PASS** | 81×48 en 390/320; 90×48 en 1448 |
| CTA visible a 390/320 | **PASS** | 133.2×48 en `y=711.7` y `y=492.9` |
| Marca de Caja vuelve a Inicio | **PASS** | `/` → `/inicio` |

### 4.1 Defecto semántico que sigue abierto

| Ítem visible | `href` | Destino real | Severidad |
|---|---|---|---|
| Ventas | `/?tab=caja` | Caja | — |
| Caja | `/?tab=corte` | **Corte** | **P2** |
| Reportes | `/?tab=corte` | **Corte** (mismo destino que Caja) | **P2** |

**Decisión: P2, no P1.** No hay enlace muerto ni flujo bloqueado: Caja se alcanza por “Ventas”, por “Registrar” y por `/`; el usuario que pulsa “Caja” aterriza en Corte y puede volver. Es un problema de **semántica/IA** (el `aria-label` “Caja y corte” y “Reportes del día, dentro de Corte” mitigan a lectores de pantalla, pero no a quien ve la etiqueta). Debe decidirse con producto antes de merge: renombrar “Caja” a “Corte”, apuntar “Caja” a `/?tab=caja`, o dar a Reportes una URL/hash propia.

**Otros hallazgos de navegación:**
- “Ver todos” lleva a `/?tab=pendientes`, que está vacío (“Aún no hay pendientes”) mientras Inicio muestra 3 fixtures “Ejemplo”. **P3** de consistencia de estado.
- “Productos” y “Proveedores” son `<span aria-disabled="true">` con `title="Próximamente"`; no son enfocables y el AX tree no anuncia “Próximamente”. **P2** de descubribilidad; el contraste calculado es **3.64–4.07:1** por `opacity:0.56`.
- `?ayuda=1` (Ayuda) también ejecuta el scroll a `#ajustes` porque el efecto no distingue hash. La hoja abre en el bloque de accesibilidad, no en la introducción. **P3** de comportamiento; no es financiero.
- “Ayuda” y “Ajustes” comparten la misma hoja; es aceptable como superficie única, pero no son destinos independientes. **P3**.

---

## 5. Punto 5 — integridad financiera, pagos, webhooks, DB y auth

**Resultado: APROBADO.** No hay cambios en lógica financiera.

`git diff --name-status` solo muestra:

```text
web/src/app/inicio/inicio.css
web/src/app/inicio/page.tsx
web/src/app/layout.tsx
web/src/app/manifest.ts
web/src/assets/inicio/README.md
web/src/assets/inicio/hero-registradora.png
web/src/assets/inicio/manifest.json
web/src/assets/inicio/sidebar-plantas.png
web/src/assets/inicio/sugerencia-lupita.png
web/src/components/caja-app.tsx
```

No hay cambios en `web/src/lib/` (orders, pagos, fiado, metas), `web/src/app/api/` (webhook, verify, checkout, demo), `web/src/app/pay/`, `web/src/app/checkout/`, middleware, `.env.local`, `next.config.ts` ni auth.

| Archivo | Cambio | Clasificación |
|---|---|---|
| `caja-app.tsx` (+15/−4) | `helpOpen` inicia en `false`; se abre post-montaje; scroll a `#ajustes`; título “Ayuda y ajustes”; `id="ajustes"` | **Presentación / hidratación / ayuda**. No toca handlers de venta, fiado, corte, pagos, DB ni auth. |
| `layout.tsx` (+1/−1) | Script inline de preferencias + `forced-colors` con listener y limpieza | **Presentación / accesibilidad**. |
| `manifest.ts` (+1/−1) | Corrige `Mercado Cero Â· …` → `Mercado Cero · …` | **Encoding**. |
| `page.tsx` (+208/−106) | Iconos, marca, skip link, `main`, aria, badges “Ejemplo”, navegación | **Presentación / a11y / rutas**. |
| `inicio.css` (+815/−358) | Layout, tema, HC, responsive | **Presentación**. |
| Assets | PNG/SVG de Inicio | **Assets**. |

**Verificación funcional:** p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-dinero 45/0 + 3 KNOWN; webhook **40/40** reproducido de forma independiente contra el build `b8f127d` en servidor aislado 3193. No hay señal de regresión financiera.

**Matiz:** los p0 son del árbol de trabajo (`dirty:true`), no de un commit limpio, y no registran `buildSha`. Sirven como regresión funcional reciente, no como evidencia de cierre.

---

## 6. Punto 6 — pruebas, build y evidencia

### 6.1 Identidad del build

| Comprobación | Resultado |
|---|---|
| `web/.next/BUILD_SHA` | `b8f127d…`, `builtAt 2026-11-04T02:23:49.308Z` (20:23:49 local) |
| `/api/health` | `ok:true`, `buildSha b8f127d…`, uptime coherente con arranque 20:24:27 |
| Cambios finales de código | `inicio.css` 20:22:22; `layout.tsx` 20:21:47; `caja-app.tsx` 20:21:27 |
| Capturas | 20:25:30–20:27:54, **posteriores** al build |
| Comparación | 20:28:16, rótulo “build b8f127d + cambios de trabajo” |
| Tests | 20:29:50–20:33:16, **posteriores** al build |

**El build servido sí corresponde al árbol de trabajo actual.** No es un build de un commit limpio.

### 6.2 Gates y suites

| Gate / suite | Resultado | Timestamp | SHA / dirty | ¿Evidencia de cierre? |
|---|---|---|---:|---|---|
| `verify:fast` | **3/3 gates verdes** (guard, lint, types); `ok:false` por árbol sucio | 02:34:59–02:35:25Z | `b8f127d` / `dirty:true` | **No**: solo diagnóstico |
| p0-venta | **66 pass / 0 fail / 0 known / 66** | 02:29:50–02:30:52Z | `b8f127d` / `dirty:true` | **No**: puerto 3311, sin `buildSha` |
| p0-fiado | **51 / 0 / 0 / 51** | 02:31:16–02:31:48Z | `b8f127d` / `dirty:true` | **No**: puerto 3101, sin `buildSha` |
| p0-corte | **69 / 0 / 0 / 69** | 02:32:07–02:32:49Z | `b8f127d` / `dirty:true` | **No**: puerto 3101, sin `buildSha` |
| p0-dinero | **45 pass / 0 fail / 3 known / 48** | 02:33:09–02:33:16Z | `b8f127d` / `dirty:true` | **No**: puerto 3213, sin `buildSha` |
| Webhook | **40/40** | archivo 20:33:38; re-ejecutado por mí | `b8f127d` | **Parcial**: transcripción, no JSON de gate |
| `latest.json` | `ok:true` pero de **`9206ea1`** (`p0/final-closure`) | 09:27:26 | `9206ea1` / dirty false | **Rechazado** |
| `latest-static.json` | **NO EXISTE** | — | — | **No** |
| `verify:evidence` | **FAIL, 4 chequeos** | ejecutado en esta pasada | HEAD `b8f127d` | **No** |

`verify:evidence` falla exactamente en:

1. `gitAtStart.sha === HEAD` → `9206ea1` vs `b8f127d`.
2. Árbol actual limpio → `dirty=true`.
3. Artefactos de `mobile` → hashes/tamaños no coinciden (`mobile-360-*.png`).
4. `gatesOk` declarado `true` vs recalculado `false`.

### 6.3 Frescura de la evidencia

- `14_EVIDENCIAS/capturas`, `metricas`, `axe`, `variantes`, `montos`, `tests` y `webhook-40-40.txt` son de 20:25–20:35, **posteriores** al build de 20:23:49.
- `navegacion/resumen.json` es de 19:56:45, **anterior** a los fixes de 20:21–20:22; no documenta el `#ajustes` corregido. Lo re-verifiqué aparte.
- Los cuatro informes de auditoría (20:09–20:20) son **anteriores** a los fixes finales y al build; sus secciones F3/F4 y la regresión de `#ajustes` están superadas. No deben citarse como estado final sin esta salvedad.
- `quality-reports/` está **untracked**: 217 archivos, 25.6 MB; no está en `.gitignore`.
- `harness/STATE.md` sigue con mtime 09:27; no se actualizó al estado final.

### 6.4 Conclusión de pruebas

**Los conteos declarados son correctos y las suites pasan.** La afirmación “p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-dinero 45/0 + 3 KNOWN, webhook 40/40” es válida como **regresión funcional reciente sobre el árbol actual**, no como **evidencia de cierre limpia**. `latest.json` de `9206ea1` **no** se acepta como evidencia de `b8f127d`.

---

## 7. Punto 7 — árbol, handoff y separación de planos

### 7.1 Fase 1 visual/funcional

**APROBADO CON LIMITACIONES.** La pantalla cumple la estructura de la referencia, no tiene P0/P1 de producto, es usable en 1448/1366/390/320, no tiene overflow horizontal, el CTA normal es visible y las suites funcionales pasan.

### 7.2 Handoff / merge

**RECHAZADO — NO GO.** Bloqueadores duros:

1. **Árbol sucio:** 10 modificados + 17 assets nuevos + `quality-reports/` untracked (244 líneas de `git status --porcelain --untracked-files=all`).
2. **Commit incompleto potencial:** `page.tsx` importa `brand-shop-cream.svg`, `logo-simbolo.svg` e `icons/`; si se commitean solo los 10 tracked, el build del commit queda roto.
3. **`latest.json` de otro SHA:** `9206ea1`, no `b8f127d`; no hay `latest-static.json`.
4. **`verify:evidence` FAIL (4):** SHA, árbol, artefactos mobile, `gatesOk`.
5. **Sin `static` ni `full` sobre `b8f127d`:** solo `fast`, y con `ok:false` por dirty.
6. **p0 con `dirty:true`, sin `buildSha`, puertos no canónicos** (3311/3101 vs 3211/3212): regresión reciente, no evidencia de cierre.
7. **Webhook sin JSON de gate:** hay transcripción 40/40 y la re-ejecuté, pero no hay artefacto JSON integrado al harness.
8. **`quality-reports/` sin decisión:** commit (25.6 MB) o `.gitignore`; sin eso el árbol nunca quedará limpio.
9. **`harness/STATE.md` sin actualizar** al estado final.

**No hay GO de merge/handoff en este estado.**

---

## 8. Punto 8 — diferencias visuales pendientes

### P2 — visibles, de fidelidad o a11y; no bloquean la demo

| ID | Hallazgo | Evidencia |
|---|---|---|
| **P2-1** | Nav móvil de **40 px** de alto; criterio pedido ≥44/48. WCAG 2.5.8 AA pide 24, así que no es violación axe, pero incumple HIG/criterio interno. | 390/320: 67.6–96 × 40; `inicio.css:904,925` |
| **P2-2** | “Caja” y “Reportes” apuntan a `/?tab=corte`; “Ventas” abre Caja. Semántica invertida/duplicada. | `page.tsx:57,63`; clic real `nav2.json` |
| **P2-3** | “Productos/Proveedores” al 56 %: **3.64–4.07:1**; “Próximamente” solo en `title`, no en AX tree; no enfocables. Podrían quedar exentos como “componentes inactivos” de 1.4.3, pero la descubribilidad sigue fallando. | Cálculo de contraste; `extra.json`; `page.tsx:151-162` |
| **P2-4** | Estado “hecho” de “Cobrar a Juan” solo visual; el check es `aria-hidden` y el AX tree no anuncia “hecho”. | `extra.json`; `page.tsx:323-330` |
| **P2-5** | Marca: mark visible ≈56×53 vs 86×58; wordmark 150×64 vs 154×79; rayos 21 px a la derecha/12 px arriba; separador extra. | `AUDITORIA_SISTEMA_VISUAL.md`; captura; SVG 128 con padding |
| **P2-6** | Topbar: icono visible ≈36×33 vs 46×45; nombre 249 vs 324; dirección más corta. | Captura; auditoría visual |
| **P2-7** | Nav a la izquierda: icono x=26/label x=61 vs 36/93; pill 208×52 vs ≈216×56. | Auditoría visual; CSS nav |
| **P2-8** | Contenido 1129 vs 1156; borde derecho 1389 vs 1424; margen 59 vs 24; **papel picado no sangra** (visible 950..1388 vs 985..1447). | Métricas; `inicio.css:336`; captura |
| **P2-9** | KPI 3 “Por cobrar” en rosa y con checklist; referencia maíz y otro icono. KPI 3/4 comparten rosa. | `inicio.css:449-457`; captura |
| **P2-10** | Tipografía de apoyo pequeña: nota KPI 14 px (12 móvil), badge 11 px (10 móvil), fixture 13 px (12 móvil), cuerpo sugerencia 17 px; tareas 19 vs ~24. | `inicio.css:470,667,694,748` |
| **P2-11** | Arte de sugerencia con **9 px de franja crema** antes del borde inferior. | Medición: card bottom 1027.39, art bottom 1018.39 |
| **P2-12** | `@media ≤1340` no solo pone KPI 2×2: apila hero/pending y reduce sidebar. A 1280×800 el CTA queda en `y=793.8–853.8` (mayormente bajo el fold); a 1340×900 `y=837–897`. A 1366 el CTA está en `y=593–653`. | Medición 1341/1340/1280/1366; `inicio.css:819-846` |

### P3 — pulido, contenido o higiene

| ID | Hallazgo | Evidencia |
|---|---|---|
| **P3-1** | CTA hero 220×60 vs ≈251×70; suficiente, no idéntico. | Métricas; captura |
| **P3-2** | CTA sugerencia 200×56 desktop vs ≈224×64; móvil 126.8×48 (el mínimo 200×56 no es global). | Medición 390/320; CSS |
| **P3-3** | Copy de sugerencia distinto: “Tu negocio, en orden.” / “Ir a ventas” vs “Agrega un producto nuevo.” / “Agregar”. Decisión de producto, no error. | Comparación |
| **P3-4** | 1366×768: hero 280 vs pending 301; no igualados. | Medición |
| **P3-5** | KPI 2×2 con filas desiguales (196/200; 196/199). | Auditoría visual |
| **P3-6** | A 320 el nombre del topbar ocupa dos líneas y el chevron cuelga; sin overflow. | Captura 320 |
| **P3-7** | CSS con duplicados/muertos: `--inicio-border`, `.inicio-hero` repetido, tres bloques 760, override de foco `-3px` inefectivo, HC con colores hardcodeados. | `inicio.css`; auditoría repo |
| **P3-8** | `manifest.json` dice “recortes exactos” pero el crop de hero/sugerencia no coincide con el alto final (252×278 vs 252×247; 335×200 vs 335×194). | `AUDITORIA_REPO.md` |
| **P3-9** | BOM `EF BB BF` al inicio de `manifest.ts` y `page.tsx`; no rompe la respuesta, pero es higiene. | `manifest.ts` bytes |
| **P3-10** | “Ver todos” lleva a Pendientes vacío mientras Inicio muestra 3 fixtures “Ejemplo”. | `navegacion/resumen.json`; clic real |
| **P3-11** | `?ayuda=1` (Ayuda) también se desplaza a `#ajustes`; la introducción de ayuda queda fuera de vista. | Medición 390: `scrollTop 434`, `#ajustes top 183` |
| **P3-12** | `forced-color-adjust:none` conserva la paleta propia e ignora la paleta forzada personalizada del SO. Legible, pero decisión de producto. | `inicio.css:1476`; auditoría a11y |

**Ninguno de estos P2/P3 bloquea una demo a 1448×1086 o 1366×768.** Los P2 de accesibilidad (P2-1, P2-3, P2-4) sí deben entrar en el plan de cierre, no dejarse “para Fase 3”.

---

## 9. Punto 9 — “Caja”/“Reportes” a `/?tab=corte`

**Decisión: P2.** No es P1.

Razones:

- No hay enlace muerto: `/?tab=corte` responde y muestra Corte.
- El flujo principal de venta no depende de ese ítem: “Registrar” y “Ventas” llevan a Caja.
- El `aria-label` “Caja y corte” reconoce la agrupación; “Reportes del día, dentro de Corte” reconoce que Reportes vive dentro de Corte.
- El defecto es de **etiqueta/IA**: quien ve “Caja” espera Caja, no Corte; y “Caja”/“Reportes” duplican destino. Es confuso y debe decidirse con producto, pero no rompe la demo ni el flujo financiero.
- Si el guion de demo pulsa “Caja” esperando la pestaña Caja, es un riesgo de demo; se mitiga usando “Registrar”/“Ventas” o corrigiendo el mapeo antes.

---

## 10. Punto 10 — lector de pantalla real

**NOT RUN.** No certifico WCAG.

- NVDA / Narrator / TalkBack / VoiceOver: **no ejecutados**.
- Windows High Contrast real: **no ejecutado** (solo emulación de `forced-colors` en Chromium).
- Firefox / Safari: **no ejecutados**.
- Lo verificado es el árbol de accesibilidad de Chromium, axe y mediciones de foco/contraste; **no sustituye** una prueba con lector real.

La afirmación máxima defendible es: **“axe 0 violaciones en Inicio normal/HC/forced-colors; sin certificación WCAG ni prueba con lector de pantalla.”**

---

## 11. Qué bloquea un GO de demo

**No hay bloqueo P0/P1 de producto.** La demo es viable en **1448×1086** o **1366×768** con estas condiciones:

1. Usar “Registrar” o “Ventas” para llegar a Caja; no prometer que “Caja” abre la pestaña Caja (P2-2).
2. No hacer la demo a 1280×800 sin scroll: el CTA del hero queda en `y≈794` (P2-12). A 1366×768 está visible.
3. No demostrar lector de pantalla ni certificar WCAG; no está probado.
4. Si se muestra móvil, 390/320 normales están bien; a 320 xlarge el CTA requiere scroll.
5. Declarar los P2/P3 como deuda conocida; no decir “paridad pixel-perfect”.

Si la demo exige 1280×800, navegación “Caja” fiel o accesibilidad certificada, **no está lista**.

---

## 12. Qué bloquea un merge/handoff

**El proceso, no el producto.** Bloqueadores duros:

1. Commit completo de los 10 modificados **y** los 17 assets nuevos (`brand-shop-cream.svg`, `logo-simbolo.svg`, `icons/`), o el build del commit se rompe.
2. Decidir `quality-reports/`: commit (217 archivos/25.6 MB) o `.gitignore`; sin eso `gitAtStart.dirty` nunca será `false`.
3. Árbol limpio y `git status` vacío.
4. Build desde el HEAD limpio; reiniciar; `/api/health` debe devolver el SHA nuevo.
5. `npm run verify:static` (5/5) y, para cierre completo, `npm run verify:full` (23/23), con `latest-static.json`/`latest.json` `ok:true`, `dirty:false`.
6. `npm run verify:evidence` **PASS** contra el HEAD entregado.
7. p0 por gates canónicos (3211/3212/3213) y `dirty:false`, con `buildSha` verificable.
8. Webhook 40/40 con artefacto JSON de la corrida (la transcripción y mi re-ejecución no bastan para el harness).
9. `harness/STATE.md` actualizado y reporte de fase.

Los P2 no son, por sí solos, un gate de merge; pero P2-1/P2-3/P2-4 son deuda de accesibilidad que debería aceptarse por escrito o corregirse antes de cerrar.

---

## 13. Qué queda para Fase 2 / Fase 3

### Fase 2 — fidelidad y accesibilidad de producto

- Marca: proporciones de tinta, wordmark, rayos y separador (P2-5).
- Topbar: icono visible, nombre y dirección (P2-6).
- Nav: indentación, tamaño de pill, iconos (P2-7).
- Composición: ancho 1129→~1156, margen derecho 24, papel picado con sangrado al viewport (P2-8).
- KPI 3: maíz + icono distinto; separar semántica de “Por cobrar”/“Pendientes” (P2-9).
- Tipografía de apoyo: notas ≥14, badges ≥12, tareas ~22–24, cuerpo sugerencia ~20–24 (P2-10).
- Sugerencia: eliminar la franja de 9 px, decidir copy/CTA (P2-11, P3-2/P3-3).
- Responsive: separar el 2×2 de KPI del apilado total a 1340; recuperar CTA en 1280×800; igualar hero/pending a 1366 (P2-12, P3-4).
- Navegación: decidir Caja/Reportes/Ventas; “Ver todos” con contenido o etiqueta de ejemplo (P2-2, P3-10).
- A11y: nav móvil ≥44/48 (P2-1); contraste y “Próximamente” en Productos/Proveedores (P2-3); anunciar “hecho” (P2-4); lector real NVDA + TalkBack/VoiceOver; Windows HC real; Firefox/Safari.

### Fase 3 — higiene y plataforma

- Limpiar CSS muerto/duplicado (P3-7).
- Precisar `crop` del manifiesto y procedencia/licencia de assets (P3-8).
- Eliminar BOM (P3-9).
- Integrar `/inicio` y `?tab=` en los scripts de HIG/axe/mobile del harness, no solo en evidencia one-off.
- Unificar shell Inicio/Caja o documentar la deuda.
- Revisar `manifest.start_url="/inicio"` y la decisión PWA.
- Revisar el trade-off de `forced-color-adjust:none` (P3-12).

---

## 14. Recomendación de siguiente paso (sin implementar)

1. **No hacer merge todavía.** Congelar el código y hacer un commit completo de los 10 modificados + 17 assets nuevos; decidir `quality-reports/` (commit o `.gitignore`).
2. **Reconstruir desde el HEAD limpio**, reiniciar el servidor y confirmar `/api/health` con el SHA nuevo.
3. **Correr `verify:static` y `verify:full`** sobre árbol limpio; luego `verify:evidence`; guardar `latest-static.json`/`latest.json` con `ok:true` y `dirty:false`.
4. **Re-correr los p0 por los gates canónicos** (3211/3212/3213), con `buildSha` y `dirty:false`; generar el **JSON del webhook 40/40**; actualizar `harness/STATE.md`.
5. **Antes del merge, cerrar o aceptar por escrito** los P2 de accesibilidad (nav 40, Productos/Proveedores, estado “hecho”) y decidir la semántica Caja/Reportes.
6. **La demo de Fase 1 puede hacerse ya** en 1448×1086/1366×768, con el guion anterior y declarando los P2; no afirmar paridad pixel-perfect ni WCAG.
7. **Refrescar las auditorías** de `CIERRE_FASE_1` o añadir una nota de que son pre-fixes 20:21–20:22; hoy no describen el estado final en foco, `#ajustes` y HC.

---

## 15. Fuentes y límites

### Fuentes leídas

- `quality-reports/mercado-cero-final/CIERRE_FASE_1/AUDITORIA_SISTEMA_VISUAL.md` (mtime 20:18:50)
- `.../AUDITORIA_RESPONSIVE.md` (20:20:07)
- `.../AUDITORIA_ACCESIBILIDAD.md` (20:15:41)
- `.../AUDITORIA_REPO.md` (20:09:49)
- `quality-reports/mercado-cero-intervencion/08_VEREDICTO_INDEPENDIENTE.md`
- `14_EVIDENCIAS/capturas/`, `variantes/`, `montos/`, `navegacion/`, `axe/`, `metricas/`, `tests/`
- `14_EVIDENCIAS/webhook-40-40.txt`, `verify-fast.txt`
- `CIERRE_FASE_1/comparacion-1448.png`, `overlay-1448.png`, `diff-1448.png`
- `harness/evidence/latest.json`, `harness/evidence/runs/2026-11-04T02-34-59-105Z-fast.json`
- `web/.next/BUILD_SHA`, `/api/health`, `git status`, `git diff`
- Reproducción propia: `%TEMP%\opencode\mc-final-verify\` (`results.json`, `nav2.json`, `skip.json`, `extra.json`, `amounts.py`, `amounts5.py`, `verify.py`, `help*.py`).

### Límites

- **No** ejecuté `verify:full`, `verify:static` ni `npm run build` (para no pisar `.next/` del servidor vivo; usé `BUILD_SHA` + `/api/health` + capturas posteriores).
- **No** ejecuté un lector de pantalla real ni Windows High Contrast real.
- **No** probé Firefox/Safari; todo lo propio es Chromium/Playwright.
- **No** forcé datos reales de listas largas/vacío/importes extremos; usé inyección DOM y la evidencia de `montos`.
- **No** re-ejecuté los p0; verifiqué sus JSON, conteos, timestamps, SHA y que las copias en `14_EVIDENCIAS` son idénticas a `harness/evidence`.
- **No** re-ejecuté el build; sí re-ejecuté el webhook 40/40 de forma independiente.
- **No** hice commit, no limpié el árbol, no edité código.

**Veredicto final:** Fase 1 visual/funcional/demo **APROBADO CON LIMITACIONES**; handoff/merge **RECHAZADO — NO GO**; certificación WCAG **NO EMITIDA**.
