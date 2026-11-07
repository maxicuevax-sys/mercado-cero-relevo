# 07 · Regresiones y verificaciones

> **Regla:** una prueba no ejecutada no está verde. Este documento separa lo ejecutado, lo no ejecutado y lo que no puede afirmarse.

## Ejecutado

| Comprobación | Resultado | Evidencia | Alcance |
|---|---|---|---|
| `npx tsc --noEmit --incremental false` | **PASS** | Auditoría A, exit 0 | Tipos de la rama/worktree |
| `npx eslint src/components/caja-app.tsx src/app/page.tsx src/app/inicio/page.tsx src/app/manifest.ts --no-cache` | **PASS** | Auditoría A, exit 0 | Lint dirigido |
| `npm run build` (worktree actual) | **PASS** | Build OK en sesión; `/api/health` b8f127d | Build de producción, árbol sucio |
| `/inicio` responde 200 | **PASS** | Playwright 1448/390 | Ruta nueva |
| `Inicio` activo | **PASS** | `aria-current="page"`; pill crema | Sidebar de Inicio |
| `/` sigue siendo Caja | **PASS** | H1 Caja; tab Caja activa | Caja preservada |
| `/?tab=fiado|corte|meta|pendientes` | **PASS inicial** | Deep links iniciales | Solo al montar; no back/forward |
| Caja → Inicio por marca/topbar | **PASS** | Playwright desktop/móvil | Navegación de regreso |
| `/inicio` sin formulario de Caja | **PASS** | 0 forms, 0 inputs | No duplica Caja |
| 4 KPIs en una fila a 1448 | **PASS** | 275×202 ×4; y=248 | Estructura |
| Hero a la izquierda / Pendientes derecha | **PASS** | x=266/833; y=474 | Estructura |
| Sugerencia a lo ancho debajo | **PASS** | 1152×236; y=802 | Estructura |
| Sin overflow horizontal 1448/390/320 | **PASS** | scrollWidth == innerWidth | Con datos actuales |
| Axe normal `/inicio` 1448/724/390/320 | **PASS** | 0 violaciones | No cubre modo HC ni texto escalado |
| Axe alto contraste `/inicio` | **FAIL** | 8 nodos `color-contrast` serious | P0-1 |
| Tipo de letra con preferencia “Grande/Muy grande” | **FAIL** | H1/nav/KPI/CTA no cambian | P0-7 |

## No ejecutado / NO VERIFICADO

| Comprobación | Estado | Motivo / riesgo |
|---|---|---|
| `npm run verify:fast` sobre el árbol actual | **NO EJECUTADO** | Última corrida fast fue antes del rescate; no vale para este HEAD sucio |
| `npm run verify:static` | **NO EJECUTADO** | Sin build/evidencia de este árbol |
| `npm run verify:full` | **NO EJECUTADO** | Requiere servidor/DB y árbol limpio; no se ejecutó |
| `npm run verify:evidence` | **NO VERIFICADO** | `latest.json` es de `9206ea1`; no corresponde |
| HIG `/` (5 viewports) sobre este HEAD | **NO EJECUTADO** | Los E2E solo abren `/` sin query; no cubren `/inicio` ni `?tab` |
| Mobile 360/320 `/` sobre este HEAD | **NO EJECUTADO** | Cambió `page.tsx`/`CajaApp`/manifest |
| P0 venta/fiado/corte/dinero | **NO EJECUTADO** | No se tocaron lib/api, pero no hay evidencia de este HEAD |
| Checkout público | **NO EJECUTADO** | No se tocó `pay/[id]` en esta fase; sin regresión probada |
| Tests de `/inicio` | **NO EXISTEN** | No hay smoke/E2E; el gate HIG no visita `/inicio` |
| Tests de `manifest.start_url` | **NO EXISTEN** | Cambio de producto sin test |
| Cache-Control `/inicio` | **NO VERIFICADO** | `/inicio` no está en `privateHeaders`; puede no ser `no-store` |
| Encoding de `manifest.ts`/`page.tsx` | **FAIL** | `Â·`/BOM y `vacÃ­o`; corregir antes de commit |
| Alto contraste con foco | **FAIL** | Foco blanco sobre sidebar blanco |
| 390/200% | **FAIL parcial** | `overflow:hidden` recorta 22 nodos; “Ajustes”/CTA fuera |
| 1448×700 y zoom intermedio | **FAIL** | “Ajustes” recortado por `height:100dvh; overflow:hidden` |
| URL como fuente de verdad (`?tab`) | **NO VERIFICADO** | `selectTab` no actualiza URL; refresh/back no reflejan tab actual |

## Riesgos de regresión priorizados

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cambio de `page.tsx`/`initialTab` rompe default Caja | Baja | Alto | Smoke `/` y `/?tab`; tests existentes |
| `manifest.start_url` cambia entrada PWA | Media | Medio | Decisión de producto + test |
| `/inicio` sin `no-store` expone datos | Media | Alto | Añadir a `privateHeaders` o verificar runtime |
| Shell duplicado diverge de Caja | Alta | Medio | Unificar shell o documentar deuda |
| Assets opacos/cortados degradan la percepción | Alta | Alto | Cutouts limpios y comparación 1:1 |
| HC y foco invisibles | Alta | Alto | Tokens HC + axe específico |
| Texto no escala | Alta | Alto | `rem`/escala + prueba |
| KPI grande desborda a 320/1200 | Media | Medio | `clamp`/tests de montos |
| Navegación engañosa | Alta | Medio | Destinos honestos o deshabilitar con etiqueta |
| Árbol sucio invalida cualquier GO | Cierto | Alto | Commit/parche explícito y evidencia |

## Evidencia visual

- `quality-reports/mercado-cero-intervencion/04_COMPARACION_VISUAL.png`
- Captura app: `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\rescate-inicio\inicio-1448x1086.png`
- Referencia: `design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png`
- A11y: `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-a11y-inicio\`
- Paridad: `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\parity-mobile\` y `parity-desktop\`

## Conclusión

**No hay evidencia suficiente para declarar GO.** La estructura de Inicio pasa; el cierre no, por P0 de alto contraste, assets, encoding, árbol sucio y ausencia de gates de `/inicio`. No se debe mergear ni declarar “paridad conseguida” con este estado.
