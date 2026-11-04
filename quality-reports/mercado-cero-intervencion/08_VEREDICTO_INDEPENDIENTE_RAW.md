# 08 · Veredicto independiente

> **Rol:** `mc-verificador-final` (verificación independiente).
> **Fecha:** 3 nov 2026.
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`.
> **HEAD verificado:** `b8f127d85985fd519a0010128a1f42bf5346e24e` (`design/mercado-cero-v2`).
> **Alcance:** informes `01`–`07`, app en `http://localhost:3100/inicio` y `/`, captura `rescate-inicio/inicio-1448x1086.png`, referencia canónica `00_REFERENCIA_CANONICA_INICIO_1448x1086.png` y comparación `04_COMPARACION_VISUAL.png`.
> **Regla cumplida:** no edité código ni hice commits. Este archivo es el único que escribí.

## 1. Veredicto global

**RECHAZADO.**

La ruta `/inicio` existe, está separada de Caja y la composición estructural de la referencia está lograda. Pero **no hay base para GO, merge ni handoff**: siguen abiertos P0 de accesibilidad (alto contraste, skip link, escala de texto), P0 de assets (hero y sugerencia), una regresión de encoding en el manifest, y el árbol está sucio con una evidencia full que pertenece a otro SHA y que además no pasa `verify:evidence` (4 fallos, no solo el SHA). El plan correctivo es una buena base, pero **no es suficiente tal como está escrito**.

## 2. Veredicto por criterio

| # | Criterio | Veredicto | Base |
|---|---|---|---|
| 1 | La captura es `/inicio`, no Caja; Inicio activo; Caja en `/`. | **APROBADO** | Captura 1448×1086 con Inicio activo; `/inicio` responde 200, H1 “¡Buen día, Lupita!”, `aria-current="page"` en Inicio, 0 formularios/0 inputs. `/` responde con H1 “Caja”, tab Caja activa y 1 input. |
| 2 | 1448×1086, 4 KPIs en fila, hero izquierda, Pendientes derecha, Sugerencia abajo. | **APROBADO (solo estructura/geometría)** | 4 KPIs en y=248 (x=266, 559, 851, 1144); hero x=266/y=474; Pendientes x=833/y=474; Sugerencia x=266/y=802, debajo del row. No implica paridad visual. |
| 3 | Assets, alto contraste, skip link, escala de texto, targets y responsive 390. | **RECHAZADO** | P0-1, P0-2, P0-3, P0-6, P0-7 reales; “Ver todos” 70×22; CTA móvil en y=985.7 con pliegue 844; recortes a 1448×700 y 195×422. Ver §3. |
| 4 | Estado git/evidencia; árbol limpio y evidencia del SHA correcto. | **RECHAZADO** | 3 archivos modificados + `?? quality-reports/`; `latest.json` es de `9206ea1`/`p0/final-closure`/`127.0.0.1:3000`; `verify:evidence` falla SHA, árbol, hashes de artefactos y `gatesOk`. No hay `latest-static.json`. |
| 5a | El plan correctivo es suficiente. | **RECHAZADO** | No hay tarea para P1-2 (shell duplicado); 3.1 conserva “Ventas” y “Caja” ambos a `/` (P1-1 sin resolver); 4.1/4.2/4.3 asignan escritura de tests/artefactos a agentes con `edit: deny`; no hay tarea de integridad/cuarentena de evidencia; falta 1448×700 y URL/back-forward. Ver §6. |
| 5b | No se declaró GO sin pruebas. | **APROBADO** | `05`, `07`, `03` y `06` dicen explícitamente NO-GO / verificación pendiente. No encontré un “APROBADO” ni un “GO” en los informes. |
| 6 | Los hallazgos P0/P1 son reales. | **APROBADO (veracidad), con una corrección** | P0-1…P0-7 reales; P1-1…P1-10 y P1-12…P1-14 reales. **P1-11 no se sostiene como riesgo activo**: `/inicio` ya responde `private, no-cache, no-store, max-age=0, must-revalidate`; queda la omisión de configuración como P2. P1-4 tiene un error menor: H1=52 px, no 50. |
| 7 | Caja funcional, gates completos y trazabilidad histórica. | **NO VERIFICADO** | No ejecuté venta/fiado/corte/pagos; `verify:full` no se corrió por mí; los sessionID históricos no son verificables. No se usa para aprobar. |
| — | **Global** | **RECHAZADO** | 12/12 estructural no equivale a paridad ni a GO. |

## 3. Bloqueantes que impiden GO

### B1 · Alto contraste roto (P0-1, real)
`axe` en modo alto contraste devuelve **8 nodos `color-contrast` serious**: marca 1.01:1, seis ítems del nav y el párrafo del hero 1.25:1. El sidebar y el hero se pintan blancos, pero conservan texto claro; el foco del sidebar queda **blanco `#fffdf7` sobre blanco `#fff`**. Archivos: `web/src/app/inicio/inicio.css:857-874, 973-976`. No es un falso positivo: el modo normal sí pasa `axe` (0 violaciones), pero el modo de alto contraste que la app ofrece está roto.

### B2 · Assets P0 pegados/recortados (P0-2 y P0-3, reales)
- **Hero:** `hero-registradora.png` es **242×272 RGB, 100% opaca**, con esquina superior izquierda crema `(241,237,227)`, verdes `(1,86,58)`/`(2,89,61)` frente al hero `#043b31`. En la captura se ve el borde/seam del recorte. No es una ilustración integrada.
- **Sugerencia:** `sugerencia-lupita.png` es **283×173 RGBA, 80.8% opaca / 19.2% transparente**, con esquinas crema `(253,232,203)`; en la captura se ve el rectángulo y el corte de tableta/brazo.
- `04_COMPARACION_VISUAL.png` confirma el seam del hero y el bloque crema de la sugerencia. Es un fallo de paridad visual del objetivo principal, no solo “detalle”.

### B3 · Accesibilidad de teclado y escala (P0-6 y P0-7, reales)
- **No hay skip link:** 0 enlaces “Saltar al contenido”; el primer Tab cae en “Inicio”. `<main>` tiene `id=""`, no tiene atributo `tabindex`; `main.focus()` deja el foco en `BODY`. Caja sí tiene skip link, así que es una regresión de Inicio.
- **“Tamaño del texto” no hace nada en Inicio:** con `data-text-size="xlarge"` la raíz pasa de 16 a 20 px, pero H1 sigue en 52 px, nav 17, KPI 42, CTA 18 y Pendientes h2 30. Todo el CSS de Inicio está en `px`.
- **Target “Ver todos”:** 70×22 px, por debajo de 44/48. El CTA del hero sí mide 48 en móvil; el nav 44.

### B4 · Árbol sucio y evidencia inválida (P0-4, real; más grave de lo reportado)
- `git status`: 3 archivos modificados (`inicio.css`, `inicio/page.tsx`, `sidebar-plantas.png`) y `?? quality-reports/`. El informe 01 dice “Untracked no ignorados: 0”; eso no coincide con el estado actual. El producto sigue sucio igual, pero el snapshot está incompleto.
- `harness/evidence/latest.json`: `ok=true`, `mode=full`, SHA `9206ea1`, branch `p0/final-closure`, `baseUrl=http://127.0.0.1:3000`; no es de `b8f127d` ni de este servidor.
- `npm run verify:evidence` falla **4 chequeos**: SHA distinto, árbol sucio, hashes de artefactos `mobile` distintos y `gatesOk` recalculado en `false`. Es decir, la evidencia tampoco es íntegra para `9206ea1`.
- No existe `latest-static.json`. `git diff --check` sigue reportando `web/src/app/inicio/page.tsx:263: new blank line at EOF`.
- La captura es de las 15:16:54; el build es de las 15:16:20 y `/api/health` devuelve `b8f127d`. Es evidencia del **worktree sucio**, no de un HEAD limpio.

### B5 · Regresión de encoding en el manifest (P0-5, real)
`/manifest.webmanifest` sirve `"Mercado Cero Â· La caja que habla"`: la cadena contiene U+00C2 + U+00B7 (bytes `C3 82 C2 B7`), no el `·` correcto (U+00B7, bytes `C2 B7`). `manifest.ts` y `page.tsx` tienen BOM `EF BB BF`. El diff de `b8f127d` muestra que la regresión y el cambio `start_url: "/"` → `"/inicio"` se introdujeron en ese commit.

Corrección de atribución: el comentario `vacÃ­o` está en **`web/src/app/page.tsx:7`** (Caja), no en `web/src/app/inicio/page.tsx`. El informe 02 lo atribuye a `inicio/page.tsx`; el plan 0.2 debe nombrar el archivo correcto. `inicio/page.tsx` tiene BOM, pero no contiene `vacÃ­o`.

### B6 · Responsive y robustez P1 que también bloquean aceptación
- **390:** no hay overflow horizontal (`scrollWidth=390`), pero el hero empieza en y=851.5 y el CTA en y=985.7, con pliegue 844. La acción “Nueva venta” no está en el primer viewport, contra el criterio móvil del blueprint.
- **1448×700:** “Ajustes” queda en y=673.6–727.6 y el sidebar tiene `scrollHeight=1026` con `overflow:hidden`; se recorta.
- **195×422 (equivalente a 200%):** se recortan Ajustes, el H1 y el CTA del hero (el CTA llega a x=297 en un viewport de 195).
- **KPI con `$1,245.00`:** a 1200 px el texto mide 200 y su caja 171; a 1101, 200 vs 146; a 320, 133 vs 111. Desborda la tarjeta. A 1448 sí cabe.

### B7 · El plan correctivo no es suficiente tal como está
- **P1-2 sin tarea:** el shell sigue duplicado (Inicio sidebar 236/topbar 100; Caja 248/65; en móvil Inicio usa nav superior y Caja tab bar inferior). El informe 07 pide “unificar o documentar deuda”; el 06 no lo incluye.
- **P1-1 sin resolver:** 3.1 dice “Ventas → `/`, Caja → `/`”, que es exactamente la duplicación que el hallazgo denuncia. “Cada label hace lo que promete” no se cumple si ambos abren Caja.
- **Permisos:** 4.1 (escribir smoke/E2E en `web/scripts`) se asigna a `mc-verificador-final`, que tiene `edit: deny` y “solo lectura y pruebas”; 1.1/1.2/1.4/4.2 se asignan a `mc-accesibilidad`, también `edit: deny`, sin conceder propiedad temporal explícita.
- **Evidencia:** 4.4 manda repetir `verify:*`, pero no manda cuarentenar/eliminar el `latest.json` inválido ni investigar por qué los hashes de artefactos no coinciden. Repetir sin arreglar la integridad puede volver a fallar.
- **Cobertura:** 3.4 no incluye 1448×700; 4.1 no prueba sincronización de URL/back-forward; 3.2 cubre P1-5 solo de forma genérica (no menciona portapapeles, alto de fila, hora 13 px ni `$50.00` gris).
- **Atribución:** 0.2 debe decir `web/src/app/page.tsx` (Caja) para `vacÃ­o`, no `inicio/page.tsx`.

## 4. Verificación de hallazgos P0/P1

### P0

| ID | ¿Real? | Comprobación independiente |
|---|---|---|
| P0-1 | **Sí** | `axe` HC: 8 nodos serious; 1.01:1 marca, 1.25:1 nav/hero; foco `#fffdf7` sobre `#fff`. |
| P0-2 | **Sí** | Hero 242×272 RGB 100% opaco; borde crema y verde distinto de `#043b31`; seam visible en captura/comparación. |
| P0-3 | **Sí** | Sugerencia 283×173 RGBA 80.8% opaca; esquinas crema; corte de tableta/brazo y borde duro en captura. |
| P0-4 | **Sí, y más grave** | Árbol sucio; `latest.json` de `9206ea1`; `verify:evidence` falla 4; no hay static. |
| P0-5 | **Sí** | Manifest sirve `Â·` (U+00C2 U+00B7 / bytes `C3 82 C2 B7`), BOM en manifest/page; introducido en `b8f127d`. |
| P0-6 | **Sí** | 0 skip links; primer Tab = Inicio; `main` sin id/tabindex; foco programático queda en BODY. |
| P0-7 | **Sí** | Root 16→20; H1 52, nav 17, KPI 42, CTA 18 sin cambios. |

### P1

| ID | ¿Real? | Comprobación independiente |
|---|---|---|
| P1-1 | **Sí** | “Ventas” y “Caja” ambos `href="/"`; “Reportes” `/?tab=corte` activa Corte; Productos/Proveedores son `span`; Ajustes va a `/?ayuda=1`. |
| P1-2 | **Sí** | Inicio 236/100 vs Caja 248/65; Inicio nav superior vs Caja tab bar inferior en móvil. |
| P1-3 | **Sí** | 390×844: hero y=851.5; CTA y=985.7, h=48, bottom=1033.7 > 844. |
| P1-4 | **Sí, con matiz** | H1 52 (el informe dice 50), nav 17, KPI label 18, Pendientes h2 30, filas 18, CTA 18; la dirección “más pequeño” es real. |
| P1-5 | **Sí** | Filas 56 px, hora 13 px, `$50.00` `#515b54`; sin icono de portapapeles. |
| P1-6 | **Sí** | KPI `#fffdf7`, shell `#f9f6ee`; referencia ~`#fef3e5` en la muestra; se lee más blanco. |
| P1-7 | **Sí** | App 248/474/802 vs blueprint 259/488/814; sugerencia 236 vs 211 (+25). |
| P1-8 | **Sí en el artefacto** | Sidebar 31.2% transparente, alfa binaria (`uniqueAlpha=2`); el “halo” es visual y no lo medí como ratio. |
| P1-9 | **Sí** | `$1,245.00`: 1200 → 200/171; 1101 → 200/146; 320 → 133/111; a 1448 cabe. |
| P1-10 | **Sí** | “Ver todos” 70×22. |
| P1-11 | **No como riesgo activo** | `/inicio` responde `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. La omisión en `next.config.ts:187-193` es real, pero el riesgo “puede no ser no-store” no se confirma; bajar a P2/defensa en profundidad. |
| P1-12 | **Sí** | No hay `/inicio` exacto en `web/scripts`; `hig-after-audit.py:705-706` abre `/` y espera H1 “Caja”. |
| P1-13 | **Sí (proceso)** | `manifest.start_url = "/inicio"`; cambiado en `b8f127d`; no encontré aprobación de producto escrita. |
| P1-14 | **Sí** | 1448×700: Ajustes bottom 727.6 > 700; 195×422: recortes de nav/hero/CTA; sidebar `scrollH=1026` con `overflow:hidden`. |

## 5. Qué se acepta y qué no

### Se acepta

- **Identidad de ruta:** `/inicio` no es Caja; Inicio está activo; Caja sigue en `/` con H1 “Caja”, tab activa, input y skip link.
- **Estructura 1448×1086:** 4 KPIs en una fila, hero a la izquierda, Pendientes a la derecha, Sugerencia debajo; las comprobaciones estructurales del checklist 04 se sostienen. La continuidad funcional de Caja no se ejercitó (ver límites).
- **Ausencia de formulario de Caja en Inicio:** 0 forms/0 inputs; no se duplicó la operación de venta.
- **Assets separados:** no se usó la captura completa como fondo; los motivos son imágenes separadas (aunque dos estén mal recortadas).
- **Datos y fixtures:** los KPIs salen de `getDashboardData`/`listGoals`; los pendientes fixture están etiquetados “Ejemplos demo; no son tareas reales”; no hay pagos inventados.
- **Accesibilidad normal:** `axe` 0 violaciones a 1448 y 390; no hay overflow horizontal a 1448/390/320.
- **Honestidad del cierre:** los informes no declaran GO; dicen NO-GO y dejan la verificación E pendiente. Eso es correcto y no se penaliza como falso GO.
- **Base del plan:** el orden freeze/encoding → a11y → assets → composición → tests es razonable, y la regla de no tocar pagos/webhooks/DB es correcta.

### No se acepta

- **GO, merge o handoff.** El estado es WIP.
- **“Paridad visual conseguida”.** El hero y la sugerencia son recortes visibles; la tipografía/ritmo/papel tampoco coinciden.
- **Alto contraste, skip link, escala de texto y targets.** P0-1/P0-6/P0-7/P1-10 están abiertos.
- **Responsive 390 como aceptable.** No hay overflow, pero la acción principal no está en el primer viewport; a 1448×700 y 195×422 hay recortes.
- **Manifest con `Â·`/BOM.** Es una regresión introducida en el commit de rescate.
- **Árbol sucio y evidencia de otro SHA.** `latest.json` no es de `b8f127d`; además no es íntegro.
- **El plan 06 como plan de cierre.** Es un borrador útil, no suficiente: P1-2 sin tarea, P1-1 parcialmente repetido, permisos incompatibles, integridad de evidencia ausente.
- **P1-11 como exposición de datos activa.** No se confirmó; el header real es `no-store`.
- **La atribución de `vacÃ­o` a `inicio/page.tsx`.** Está en `web/src/app/page.tsx:7`.
- **“Caja sigue funcionando” en sentido funcional completo.** Solo verifiqué ruta/H1/tab/input/skip link; no ejecuté venta, fiado, corte ni pagos sobre este HEAD.

## 6. Evaluación del plan correctivo (06)

**Cobertura buena:** P0-1 (1.1), P0-2 (2.1), P0-3 (2.2), P0-4 (0.1 + 4.3/4.4), P0-5 (0.2), P0-6 (1.2), P0-7 (1.3); P1-1 (3.1 parcial), P1-3 (3.4), P1-4/P1-5/P1-6/P1-7 (3.2/3.5), P1-8 (2.4), P1-9 (3.3), P1-10 (1.4), P1-11 (0.4), P1-12 (4.1/4.2), P1-13 (0.3), P1-14 (3.4 parcial).

**Gaps que impiden considerarlo suficiente:**

1. **P1-2 no tiene tarea.** No se decide unificar el shell ni documentar la deuda; el riesgo de divergencia sigue.
2. **P1-1 no se corrige del todo.** 3.1 mantiene “Ventas” y “Caja” ambos a `/`; falta decidir destinos distintos, renombrar o retirar uno.
3. **Permisos:** `mc-verificador-final` y `mc-accesibilidad` son `edit: deny`; 4.1/4.2/4.3 les asignan escritura de tests/artefactos sin conceder propiedad temporal. Hay que reasignar o autorizar explícitamente.
4. **Integridad de evidencia:** no se ordena cuarentenar el `latest.json` inválido ni investigar los hashes `mobile`; 4.4 solo repite la corrida.
5. **Cobertura de P1-14:** 3.4 no incluye 1448×700; 4.1 no incluye URL/back-forward; 3.2 no detalla P1-5.
6. **Atribución:** 0.2 debe nombrar `web/src/app/page.tsx` para `vacÃ­o`, no `inicio/page.tsx`.

**Conclusión del plan:** dirección correcta, insuficiente como plan de cierre. Debe revisarse antes de ejecutarlo; no autoriza GO.

## 7. Evidencia usada y límites

### Evidencia usada

- **Informes:** `01_ESTADO_GIT.md`, `02_ACCIONES_REALIZADAS.md`, `03_TRAZABILIDAD_SUBAGENTES.md`, `05_HALLAZGOS.md`, `06_PLAN_CORRECTIVO.md`, `07_REGRESIONES.md`; `04_COMPARACION_VISUAL.png`.
- **Git:** `rev-parse`, `status --short`, `diff --stat`, `diff --check`, `log`, `show HEAD`, `rev-list --left-right --count master...HEAD`, `remote -v`, `stash list`.
- **Evidencia:** `harness/evidence/latest.json` y `npm run verify:evidence` (solo lectura), que devolvió 4 fallos.
- **Runtime:** `GET /api/health` → `b8f127d`; `GET /inicio` → 200; `GET /manifest.webmanifest`; headers `Cache-Control`; `GET /` para Caja.
- **Navegador:** Chromium/Playwright a 1448×1086, 390×844, 1448×700, 195×422, 1200/1101/320; `axe-core` normal y alto contraste; medición DOM de rectángulos, fuentes, colores, foco, targets, overflow.
- **Imágenes:** captura 1448×1086, referencia 1448×1086, `04_COMPARACION_VISUAL.png` 2956×1176; análisis PIL de tamaño, alfa y colores de borde de los PNG de `web/src/assets/inicio`.
- **Configuración:** `web/next.config.ts:187-193`; `.opencode/agents/mc-verificador-final.md` y `mc-accesibilidad.md` (permisos).

### Límites / NO VERIFICADO

- **No ejecuté `verify:fast`, `verify:static` ni `verify:full`**: el árbol está sucio y esas corridas pueden escribir evidencia; el informe 07 ya las declara NO EJECUTADAS. Solo corrí `verify:evidence`, que es lectura y falló.
- **No ejecuté venta, fiado, corte, checkout ni pagos** sobre este HEAD; “Caja en `/`” es verificación estructural, no funcional.
- **No hice prueba manual con lector de pantalla**; `axe` es automático y no sustituye una prueba con NVDA/VoiceOver.
- **El zoom 200% se probó como viewport CSS 195×422**, equivalente práctico; no cambié el zoom real del navegador.
- **P1-7** usa las medidas del blueprint (259/488/814), no una medición pixel a pixel de la referencia; la comparación visual respalda la dirección.
- **P1-8**: la alfa binaria y el 31.2% son medibles; la severidad del “halo” es visual y no la cuantifiqué como ratio.
- **P1-13**: no encontré aprobación escrita de producto para `start_url=/inicio`; si existe fuera del repo, no la pude ver.
- **Trazabilidad de subagentes**: no puedo verificar los sessionID ni las corridas históricas; los propios informes admiten que los perfiles `mc-*` no se expusieron y se usaron `general`/`explore`. No me apoyé en esas afirmaciones para el veredicto.
- **Encoding de consola:** la consola de Windows mostró `�` en títulos con acentos; eso es un artefacto de terminal, no del HTML (la captura y el fuente muestran “¡Buen día!” correctamente). El `Â·` del manifest sí es real y lo verifiqué por code points.
- **Caja funcional**: solo cargué `/`; no hay evidencia de este HEAD para venta/fiado/corte/pagos.

## 8. Recomendación de siguiente paso (no implementar)

1. **No mergear ni declarar GO.** Mantener `design/mercado-cero-v2` como WIP.
2. **Congelar y ordenar:** decidir el destino de los 3 archivos sucios, corregir encoding (`manifest.ts` y `web/src/app/page.tsx`), eliminar BOM/`vacÃ­o`, y dejar `git diff --check` limpio. No usar `reset --hard` ni `clean`.
3. **Cuarentenar la evidencia inválida:** retirar/aislar `harness/evidence/latest.json`, investigar los hashes de artefactos `mobile` y `gatesOk`, y no reutilizar artefactos mutados. Generar evidencia nueva solo desde un HEAD limpio.
4. **Cerrar P0:** alto contraste y foco, skip link + `<main>` enfocable, escala real en `rem`, hero/sugerencia limpios, encoding del manifest.
5. **Cerrar P1 de aceptación:** navegación honesta (resolver Ventas vs Caja), decisión de shell duplicado, CTA móvil en primer viewport, `clamp` de KPI, “Ver todos” ≥44, scroll/recorte a 700/200%, tests de `/inicio`, `?tab`, `?ayuda`, URL/back-forward y regresión de Caja.
6. **Revisar el plan 06** con las correcciones de §6 antes de ejecutarlo; asignar escritura a agentes con permiso o conceder propiedad temporal explícita.
7. **Decisión de producto:** aprobar o revertir `start_url=/inicio`; añadir `/inicio` a `privateHeaders` como defensa en profundidad o dejar un test que asegure el `no-store` actual.
8. **Verificación final:** build/restart desde HEAD limpio, `verify:fast`, `verify:static`, `verify:full`, `verify:evidence`, HIG/axe de `/inicio` (1448, 390, 320, 200%, HC, skip, targets), captura 1448×1086 desde ese build y una nueva verificación independiente. Sin eso, el veredicto sigue siendo **RECHAZADO**.
