# 05 · Hallazgos reales y severidad

> Base: captura real `/inicio` 1448×1086, build `b8f127d`, árbol sucio (3 archivos). Auditorías A–D y verificaciones previas.
> **Lo que sí pasa:** ruta Inicio separada, Inicio activo, Caja en `/`, 4 KPIs en fila, hero a la izquierda, Pendientes a la derecha, Sugerencia debajo, sin formulario de Caja en Inicio, sin captura completa como fondo.
> **Lo que impide GO:** los P0 de assets y alto contraste; los P1 de navegación, tipografía, responsive y proceso.

## P0 — Bloqueantes

| ID | Hallazgo | Evidencia | Archivo / selector |
|---|---|---|---|
| P0-1 | **Alto contraste deja texto invisible y borra el foco.** El sidebar y hero se pintan blancos, pero marca/nav/hero conservan texto claro; foco del sidebar es blanco sobre blanco. `axe` serious, 8 nodos. | Ratios 1.01:1 y 1.25:1; `13-high-contrast-app-focus.png`; `axe` normal 0, HC 8 | `inicio.css:857-874, 973-976`; `.inicio-brand__name`, `.inicio-nav__item`, `.inicio-hero p` |
| P0-2 | **Hero es un recorte opaco con verde ajeno.** Se ve borde superior y derecho; no es una ilustración integrada. | Asset 242×272 RGB; fondo `rgb(2,89,62)`/`rgb(2,75,55)` vs hero `rgb(4,59,49)` | `assets/inicio/hero-registradora.png`; `.inicio-hero__art` |
| P0-3 | **Sugerencia corta tableta/brazo y conserva fondo crema.** 80.8% opaca; borde duro en x=621/y=1021. | Asset 283×173; render 330×201.7 | `assets/inicio/sugerencia-lupita.png`; `.inicio-suggestion__art` |
| P0-4 | **Árbol sucio y evidencia no atada al HEAD.** La única evidencia full es de `9206ea1`, no de `b8f127d`; no hay `latest-static.json`. | `git status`; `harness/evidence/latest.json` | `web/src/app/inicio/*`, `web/src/assets/inicio/sidebar-plantas.png` |
| P0-5 | **Regresión de encoding en manifest PWA.** `Mercado Cero Â· La caja que habla` y BOM. | `web/src/app/manifest.ts:5` | `manifest.ts` |
| P0-6 | **Sin skip link y `<main>` no enfocable.** Primer Tab cae en “Inicio”; no hay bypass. | Primer foco = nav Inicio; `main` sin id/tabIndex | `inicio/page.tsx:156`; `inicio.css` |
| P0-7 | **El ajuste “Tamaño del texto” no hace nada en Inicio.** Todos los tamaños son `px`; la preferencia cambia el root a 20/32 px pero H1/nav/KPI/CTA no cambian. | root 16→20, h1 52→52, nav 17→17, CTA 18→18 | `inicio.css` (px); `globals.css:155-161` |

## P1 — Alta prioridad

| ID | Hallazgo | Evidencia | Archivo / selector |
|---|---|---|---|
| P1-1 | **Navegación engañosa:** “Ventas” y “Caja” apuntan a `/`; “Reportes” abre Corte con tab activo “Corte”; “Productos/Proveedores” son spans no enfocables; “Ajustes” abre la Guía. | Playwright desktop/móvil; auditoría de shell | `inicio/page.tsx:40-50,120-127` |
| P1-2 | **Shell duplicado Inicio/Caja:** sidebar 236 vs 248, topbar 100 vs 65, nav superior vs tab bar inferior, marca distinta. | Medidas DOM 1448/390 | `inicio/page.tsx`, `inicio.css`, `caja-app.tsx` |
| P1-3 | **CTA principal fuera del primer viewport en 390.** CTA en y=985.7; pliegue 844; hero empieza 851.5. | Playwright 390×844 | `.inicio-hero`, `.inicio-hero__cta` |
| P1-4 | **Tipografía más pequeña y laxa:** fecha 20 vs ~24, nav 17 vs ~21, KPI label 18 vs ~21, Pendientes h2 30 vs ~34, filas 18 vs ~21, CTA 18 vs ~22; H1 50 px a la izquierda. | Medidas de sistema visual | `inicio.css` |
| P1-5 | **Jerarquía de Pendientes débil:** sin icono de portapapeles, filas 56 vs ~65, hora 13 vs ~20, `$50.00` gris vs barro. | Comparación visual | `.inicio-pending*`, `.inicio-task*` |
| P1-6 | **Papel/tarjetas demasiado blancos:** `#F9F6EE/#FFFDF7` vs referencia `#FAEFE1/#FBF0E3`; se lee “tarjetas blancas sobre marfil”. | Muestreo de píxeles | `inicio.css:1-12` |
| P1-7 | **Ritmo vertical 11–35 px alto:** KPIs y=248 vs 259; hero/pendientes 474 vs 488; sugerencia 802 vs 814 y +24.7 de alto. | Medidas DOM vs blueprint | `.inicio-kpis`, `.inicio-row`, `.inicio-suggestion` |
| P1-8 | **Sidebar art con halo/motas:** alfa binaria; 31% transparente; banda/verde irregular. | Diff de asset; auditoría de sistema | `sidebar-plantas.png`, `.inicio-sidebar__art` |
| P1-9 | **KPI no soporta montos grandes en 1200/1100/320:** `$1,245.00` desborda a 1200, 1101 y 320. | Medidas de shell | `.inicio-kpi__value` |
| P1-10 | **Target “Ver todos” 70×22 px**, bajo 44/48. | Medición 1448/390/320 | `.inicio-pending__head a` |
| P1-11 | **Configuración de privacidad no documentada para `/inicio`.** El runtime ya responde `private, no-cache, no-store`; falta agregarlo/verificarlo en `privateHeaders` y un test. | Verificación E; `next.config.ts:187-193` | `next.config.ts` (P2 de configuración, no bloqueante activo) |
| P1-12 | **Sin tests de `/inicio` ni de `?tab=`**; el HIG actual solo prueba `/` y espera H1 Caja. | `hig-after-audit.py:705-706`; scripts | `web/scripts`, `web/src/app/inicio` |
| P1-13 | **Manifest `start_url: "/inicio"`** cambia la entrada PWA sin aprobación de producto. | `manifest.ts:9` | `manifest.ts` |
| P1-14 | **Sidebar 1448×700 / zoom intermedio recorta Ajustes** (`overflow:hidden`); a 390/200% se recorta el hero. | `18-short`, `19-zoom`, `16-css195` | `.inicio-sidebar`, `.inicio-content` |

## P2 — Refinamiento

- “DEMO” 11 px y 4.51:1; “Productos/Proveedores” 4.42:1; “Datos demo” 4.56:1.
- Campana/chevron decorativos con apariencia de control.
- Checkboxes de Pendientes son `span` decorativos, sin estado programático.
- Landmarks: `<aside aria-label="Navegación principal">` contiene el nav; KPI `<article>` sin nombre.
- `Ayuda` y `Ajustes` van al mismo `?ayuda=1`; dos botones “Cerrar” en el diálogo.
- CSS duplicado: dos bloques `@media (max-width:760px)` y overrides finales; `:root` de ruta.
- `manifest.json` de assets declara dimensiones que no coinciden con los PNG.
- Falta icono de portapapeles y divisor en Pendientes; sugerencia con párrafo extra.
- `?tab=` no se sincroniza al cambiar de tab (solo inicializa).

## Diferencias válidas (no tratar como defecto)

- Los importes no son los del mockup: $190/$0/$120/17% son datos reales demo.
- Las 3 tareas de Pendientes son fixtures **etiquetadas**; no se persisten.
- No se agregó “Confirmar pago” manual.
- El sidebar muestra Productos/Proveedores como no disponibles en vez de inventar rutas.
- La Sugerencia es informativa, no una recomendación de producto falsa.
- No se usó la captura como fondo; los motivos son recortes separados.

## Conclusión

**12/12 bloqueantes estructurales del checklist 04 pasan.** Pero **NO-GO** por P0-1…P0-7 y los P1 de navegación, responsive, tipografía y proceso. La base de layout es rescatable; no se debe declarar paridad.
