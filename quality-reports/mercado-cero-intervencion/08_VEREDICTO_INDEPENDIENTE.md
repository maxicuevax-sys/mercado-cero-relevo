# 08 · Veredicto independiente

> **Rol:** `mc-verificador-final` independiente (subagente `ses_e5cab6598ffed0DbBU6VBY0iRj`).
> **Regla:** el implementador no declara su propio trabajo. Este documento resume el veredicto del subagente; el volcado original se conserva en `08_VEREDICTO_INDEPENDIENTE_RAW.md`.
> **HEAD verificado:** `b8f127d85985fd519a0010128a1f42bf5346e24e`.
> **Alcance:** informes 01–07, `/inicio` y `/`, captura 1448×1086 y comparación visual.

## Veredicto global

**RECHAZADO.**

La ruta `/inicio` existe, está separada de Caja y la composición estructural de la referencia se logró: Inicio activo, 4 KPIs en fila, hero a la izquierda, Pendientes a la derecha y Sugerencia a lo ancho. **Eso no equivale a paridad ni a GO.** Siguen abiertos P0 de accesibilidad y assets, una regresión de encoding, el árbol sucio y evidencia full de otro SHA.

## Veredicto por criterio

| Criterio | Veredicto | Base |
|---|---|---|
| Captura es `/inicio`, no Caja; Inicio activo | **APROBADO** | 1448×1086; H1 “¡Buen día, Lupita!”; `aria-current` en Inicio; `/` con H1 Caja |
| 4 KPIs en fila, hero izquierda, Pendientes derecha, Sugerencia abajo | **APROBADO (estructura/geometría)** | KPIs x=266/559/851/1144, y=248; hero x=266/y=474; Pendientes x=833/y=474; Sugerencia x=266/y=802 |
| Assets, alto contraste, skip link, escala de texto, targets y 390 | **RECHAZADO** | P0-1, P0-2, P0-3, P0-6, P0-7; “Ver todos” 70×22; CTA móvil y=985.7; recortes 1448×700 y 195×422 |
| Git limpio y evidencia del SHA correcto | **RECHAZADO** | 3 archivos sucios; `latest.json` de `9206ea1`; `verify:evidence` falla 4 chequeos; no hay `latest-static.json` |
| Plan correctivo suficiente | **RECHAZADO** | No cubre shell duplicado; 3.1 conserva duplicidad Ventas/Caja; permisos `edit: deny`; falta cuarentena de evidencia |
| No se declaró GO sin pruebas | **APROBADO** | 01–07 dicen NO-GO / pendiente; no hay “APROBADO” |
| Hallazgos P0/P1 reales | **APROBADO con corrección** | P0-1…P0-7 reales; P1-11 no es riesgo activo (`/inicio` ya responde `no-store`); `vacÃ­o` está en `web/src/app/page.tsx`, no en `inicio/page.tsx` |
| Caja funcional y gates completos | **NO VERIFICADO** | No se ejecutaron venta/fiado/corte/pagos ni full |

## Bloqueantes que impiden GO

1. **Alto contraste roto.** `axe` HC: 8 nodos `color-contrast` serious; marca 1.01:1, nav/hero 1.25:1, foco blanco sobre blanco. `inicio.css:857-874,973-976`.
2. **Assets P0.** Hero 242×272 RGB 100% opaco, con verde/crema ajenos al hero; Sugerencia 283×173 RGBA 80.8% opaca, corta tableta/brazo y deja rectángulo crema.
3. **Skip link y escala de texto.** Primer Tab cae en Inicio; `<main>` sin `id/tabIndex`; “Grande/Muy grande” no cambia H1/nav/KPI/CTA porque todo está en `px`.
4. **Árbol sucio + evidencia inválida.** `latest.json` de `9206ea1`; `verify:evidence` falla SHA, árbol, hashes `mobile` y `gatesOk`; captura de worktree sucio.
5. **Encoding PWA.** `/manifest.webmanifest` sirve `Mercado Cero Â· La caja que habla` (U+00C2 + U+00B7); BOM en `manifest.ts` y `page.tsx`.
6. **Responsive.** CTA móvil bajo el pliegue; Ajustes recortado a 1448×700; recorte a 195×422; KPI de 5 cifras desborda a 1200/1101/320.
7. **Plan insuficiente.** No hay tarea de shell duplicado; “Ventas”/“Caja” siguen a `/`; tests/artefactos asignados a agentes con `edit: deny`; falta cuarentena de evidencia.

## Lo que se acepta

- Ruta `/inicio` separada y Caja en `/`.
- Inicio activo y sin formulario de Caja.
- Estructura/geometría de las cuatro zonas.
- 4 KPIs en una fila y orden correcto.
- Hero/Pendientes al mismo nivel; Sugerencia debajo.
- Datos reales demo y fixtures etiquetadas; no se usaron importes del mockup.
- No se usó la captura como fondo; los motivos son recortes separados.
- El plan 06 es una base correcta, pero insuficiente.

## Límites del veredicto

- No se ejecutó `verify:full` ni pruebas de venta/fiado/corte/pagos.
- Los sessionID históricos no son verificables como ejecuciones `mc-*`; ver `03_TRAZABILIDAD_SUBAGENTES.md`.
- El veredicto se basa en la captura del worktree sucio y en las auditorías A–D; no sustituye evidencia full.

## Siguiente paso

No reanudar implementación hasta que el orquestador:

1. congele/decida los 3 archivos sucios y corrija encoding;
2. aplique los P0 de assets y alto contraste;
3. añada skip link y escala de texto;
4. resuelva shell/navegación y 390/1448×700;
5. agregue `/inicio` a HIG/axe y smoke/E2E;
6. reconstruya y recapture desde HEAD limpio;
7. ejecute `verify:full` + `verify:evidence` y obtenga un nuevo veredicto independiente.

**No hay GO.**
