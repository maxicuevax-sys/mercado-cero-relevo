# 06 Â· Plan correctivo mÃ­nimo

> **Estado:** plan Ãºnicamente. No se aplicÃ³ ningÃºn cambio de cÃ³digo despuÃ©s de la intervenciÃ³n.
> **Regla:** una tarea por archivo/propietario; no reescribir CSS global; no tocar pagos, webhooks, DB ni auth.

## Fase 0 â€” Congelar y ordenar (antes de tocar UI)

| ID | Tarea | DueÃ±o | Archivo | Criterio |
|---|---|---|---|---|
| 0.1 | Decidir el destino de los 3 archivos sucios (`inicio.css`, `page.tsx`, `sidebar-plantas.png`). No mezclar con fixes nuevos. | Orquestador | Git | Diff revisado; commit o parche explÃ­cito, sin reset/clean |
| 0.2 | Corregir encoding de `manifest.ts` (`Ã‚Â·`, BOM) y comentario `vacÃƒÂ­o` de `page.tsx`. | `mc-sistema-diseno` | `manifest.ts`, `page.tsx` | `Â·`/`vacÃ­o` correctos; sin BOM; `git diff --check` limpio |
| 0.3 | Confirmar con producto si `start_url` debe ser `/inicio` o `/`. | Orquestador | `manifest.ts` | DecisiÃ³n escrita; si no hay aprobaciÃ³n, volver a `/` |
| 0.4 | AÃ±adir `/inicio` a `privateHeaders` o demostrar que Next emite `no-store`. | `mc-shell-responsive` | `next.config.ts` | Respuesta `Cache-Control: private, no-store` en `/inicio` |

## Fase 1 â€” P0 de accesibilidad

| ID | Tarea | DueÃ±o | Archivo | Criterio |
|---|---|---|---|---|
| 1.1 | Arreglar alto contraste: no pintar sidebar/hero de blanco con texto claro; forzar tokens correctos y foco visible. | `mc-accesibilidad` con propiedad temporal (o orquestador aplica su parche) | `inicio.css` | `axe` HC 0 serious; foco â‰¥3:1; captura HC |
| 1.2 | AÃ±adir skip link y `<main id="inicio-main" tabIndex={-1}>`. | `mc-accesibilidad` con propiedad temporal (o orquestador aplica su parche) | `inicio/page.tsx`, `inicio.css` | Primer Tab = â€œSaltar al contenidoâ€; foco al main |
| 1.3 | Convertir tipografÃ­a de `inicio.css` a `rem`/escala real; probar large/xlarge. | `mc-sistema-diseno` | `inicio.css` | H1/nav/KPI/CTA cambian con la preferencia; sin overflow |
| 1.4 | Subir â€œVer todosâ€ y targets mÃ³viles a 44/48. | `mc-accesibilidad` con propiedad temporal (o orquestador aplica su parche) | `inicio.css` | `under48 = 0`; â€œVer todosâ€ â‰¥44 |

## Fase 2 â€” Assets (P0 visual)

| ID | Tarea | DueÃ±o | Archivo | Criterio |
|---|---|---|---|---|
| 2.1 | Producir un hero limpio: registradora completa, sin botÃ³n blanco, sin verde ajeno. | `mc-sistema-diseno` | `assets/inicio/hero-registradora.png` | Asset RGBA o fondo idÃ©ntico al hero; sin borde; verificado a 255 px |
| 2.2 | Producir sugerencia limpia: Lupita/tableta completa, sin fondo crema rectangular. | `mc-sistema-diseno` | `assets/inicio/sugerencia-lupita.png` | Cutout estable; sin corte de tableta/brazo; integrada sobre card |
| 2.3 | Ajustar papel picado a tamaÃ±o nativo y anclaje superior-derecha. | `mc-sistema-diseno` | `papel-picado.png`, `inicio.css` | Banderas xâ‰ˆ985..1447, yâ‰ˆ100..202 |
| 2.4 | Limpiar alfa del sidebar (halo/motas) o volver al crop con fondo del mismo verde. | `mc-sistema-diseno` | `sidebar-plantas.png` | Sin banda/halo; fondo = sidebar |
| 2.5 | Actualizar `manifest.json`/`README` con dimensiones y cutouts reales. | `mc-sistema-diseno` | `assets/inicio/*` | Manifest = archivos; sin contradicciÃ³n de fondo/alpha |

## Fase 3 â€” ComposiciÃ³n y navegaciÃ³n (P1)

| ID | Tarea | DueÃ±o | Archivo | Criterio |
|---|---|---|---|---|
| 3.1 | Corregir destinos: `Ventas` â†’ `/` (venta); `Caja` â†’ `/?tab=corte` **renombrado â€œCaja y corteâ€** o eliminar duplicado; `Reportes` â†’ `/?tab=corte` solo si se etiqueta â€œReportesâ€ y el tab activo se explica; Productos/Proveedores/Ajustes deben ser honestos. | `mc-shell-responsive` | `inicio/page.tsx` | Cada label hace lo que promete; tab activo coincide o la etiqueta se renombra |
| 3.1b | Resolver shell duplicado Inicio/Caja: reutilizar `AppSidebar`/`TopBar` o documentar deuda con una sola fuente de navegaciÃ³n. | `mc-shell-responsive` | `inicio/page.tsx`, `caja-app.tsx` | Un solo patrÃ³n de marca/nav; sin divergencia 236/248 y 100/65 |
| 3.2 | Alinear tipografÃ­a/ritmo: saludo, KPIs, Pendientes, CTAs, papel/tarjetas; portapapeles, filas, hora e importe barro. | `mc-sistema-diseno` | `inicio.css` | Medidas del blueprint; sin sobrecargar |
| 3.3 | Corregir KPI para montos grandes (1200/1100/320) sin desbordar. | `mc-shell-responsive` | `inicio.css` | `$1,245.00` cabe o reduce con `clamp`; sin cruzar gap |
| 3.4 | Resolver mÃ³vil: CTA visible, nav sin scroll oculto, hero sin solape, sidebar con scroll; incluir 1448Ã—700. | `mc-shell-responsive` | `inicio.css`, `inicio/page.tsx` | 390Ã—844 CTA en primer viewport; 195Ã—422 sin recorte; 1448Ã—700 con Ajustes visible |
| 3.5 | Consolidar CSS duplicado y tokens de ruta (`--inicio-*`) en un solo bloque. | `mc-sistema-diseno` | `inicio.css` | Una regla por selector; sin overrides finales frÃ¡giles |
| 3.6 | Sincronizar URL al cambiar de tab o documentar que `?tab` es solo entrada inicial; probar back/forward. | `mc-shell-responsive` | `page.tsx`, `caja-app.tsx` | URL y tab visible coinciden o lÃ­mite documentado |

## Fase 4 â€” Pruebas y evidencia

| ID | Tarea | DueÃ±o | Archivo | Criterio |
|---|---|---|---|---|
| 4.1 | AÃ±adir smoke/E2E de `/inicio`, `/?tab=...`, `?ayuda=1`, `manifest.start_url`. | `mc-verificador-final` (solo lectura; orquestador escribe el test) | `web/scripts` | `/inicio` 200, Inicio activo, Caja en `/`; deep links |
| 4.2 | AÃ±adir `/inicio` a HIG/axe (1448, 390, 320, 200%, HC, skip link, targets). | `mc-accesibilidad` con propiedad temporal (o orquestador escribe el test) | `web/scripts` | Gate `/inicio` PASS o lista de fallos explÃ­cita |
| 4.3 | Rebuild/restart desde HEAD limpio; recapturar 1448Ã—1086; comparar de nuevo. | `mc-verificador-final` (solo lectura; orquestador ejecuta) | `quality-reports` | Captura = HEAD; `04_COMPARACION_VISUAL.png` actualizada |
| 4.4 | `verify:fast`, `verify:static`, `verify:full`, `verify:evidence` sobre Ã¡rbol limpio. | `mc-verificador-final` (solo lectura; orquestador ejecuta) | `harness/` | `ok:true`, SHA = HEAD, `dirty:false` |
| 4.5 | Veredicto independiente final. | `mc-verificador-final` (solo lectura; escribe únicamente el veredicto) | `08_VEREDICTO_INDEPENDIENTE.md` | APROBADO/RECHAZADO por criterio, no por color |

## Orden de dependencias

```text
0.1 encoding/estado limpio
  â””â”€ 1.1â€“1.4 a11y
       â””â”€ 2.1â€“2.5 assets
            â””â”€ 3.1â€“3.5 composiciÃ³n/navegaciÃ³n
                 â””â”€ 4.1â€“4.4 tests/evidencia
                      â””â”€ 4.5 GO/NO-GO
```

## No hacer en esta fase

- No tocar `web/src/lib/**`, `web/src/app/api/**`, `proxy.ts`, `.env*`.
- No cambiar la mÃ¡quina de estados de pagos, fiado, corte o metas.
- No introducir datos mockup como reales.
- No agregar productos/proveedores/asistente/onboarding sin backend/decisiÃ³n.
- No usar la captura completa como fondo ni pegar el hero como screenshot de UI.
- No declarar GO sin verificaciÃ³n E y sin evidencia de harness.
