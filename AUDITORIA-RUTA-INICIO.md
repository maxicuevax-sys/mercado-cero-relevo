# Fase 0 — auditoría de ruta y componentes

> **Fecha:** 3 nov 2026 · **Rama:** `design/mercado-cero-v2` · **HEAD:** `d49b649`
> **Alcance:** sólo diagnóstico. No se modificó lógica contable ni pagos.

## 1. Rutas reales antes del rescate

| Ruta | Qué renderiza | Default |
|---|---|---|
| `/` | `web/src/app/page.tsx` → `CajaApp` | tab `caja` (formulario de venta) |
| `/pay/[id]` | checkout público | — |
| `/pay/[id]/success` | resultado público | — |
| `/inicio` | **no existía** | — |

No había una pantalla `Inicio`. El sidebar mostraba `Caja` como primer destino y seleccionado. El dashboard vivía dentro de `CajaBook`, en la columna derecha, después del formulario de venta. Por eso la comparación anterior era inválida: referencia `Inicio` contra app `Caja`.

## 2. Archivos que controlan cada capa

| Capa | Archivo |
|---|---|
| Router de la app | `web/src/app/page.tsx` |
| Shell, sidebar, topbar, tabs | `web/src/components/caja-app.tsx` (`AppSidebar`, `TopBar`, `MobileTabBar`, `TABS`) |
| Contenido Caja | `CajaApp` → `CajaPanel` + `CajaBook` |
| Estilos del shell/app | `web/src/app/globals.css`, `web/src/app/barrio.css` |
| Nuevo Inicio | `web/src/app/inicio/page.tsx`, `web/src/app/inicio/inicio.css` |
| Datos | `getDashboardData()`, `listGoals()`, `listTasks()` (server) |

## 3. Capturas base

| Captura | Ruta |
|---|---|
| Inicio referencia 1448×1086 | `design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png` |
| Inicio app 1448×1086 | `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\rescate-inicio\inicio-1448x1086.png` |
| Caja app (separada) | `http://localhost:3100/` |

## 4. Riesgos identificados

- **No existía ruta Inicio.** Crear un tab dentro de `CajaApp` habría seguido mezclando dashboard y venta. Se decidió una ruta real `/inicio` y dejar `/` como Caja.
- **Shell duplicado:** `Inicio` necesita sidebar/topbar propios. Se implementaron en `inicio/page.tsx` con CSS aislado (`inicio.css`) para no alterar `/`.
- **Datos reales:** los KPIs salen de `getDashboardData()` y `listGoals()`; no se copiaron importes del mockup. El fixture demo se etiqueta `Datos demo`.
- **Pendientes:** `listTasks()` devuelve el modelo real. Si no hay tareas y el modo es demo, se muestran tres **fixtures etiquetadas** (“Ejemplos demo; no son tareas reales”); no se persisten. El importe `$50.00` de la fixture es el único literal monetario.
- **Sugerencia:** no hay motor de recomendación. Se muestra una tarjeta informativa honesta con CTA a Ventas, no una recomendación de producto falsa.
- **Assets:** las ilustraciones del hero/sugerencia/sidebar/paper picado son recortes exactos de la referencia canónica, no la captura completa. Faltan versiones editables de producción; se documenta en `web/src/assets/inicio/README.md`.
- **Tests existentes:** `/` conserva su default `caja`; no se renombraron tabs ni ids. La nueva ruta no debe romper los E2E de Caja.
- **Backup:** árbol limpio antes del rescate; rama `design/mercado-cero-v2`; commits previos intactos.

## 5. Decisión de arquitectura

```
/inicio   → dashboard de negocio (nuevo, sidebar con Inicio activo)
/         → Caja / venta (se conserva)
/?tab=fiado|corte|meta|pendientes → destinos existentes desde el sidebar de Inicio
```

Se agregó `initialTab` a `CajaApp` y lectura de `searchParams.tab` en `page.tsx`. No se tocó el modelo de datos, pagos, webhooks ni cálculos.

## 6. Criterio de aceptación de esta fase

- [x] `/inicio` existe y muestra `Inicio` seleccionado.
- [x] 4 KPIs en una fila a 1448×1086.
- [x] Hero `Nueva venta` a la izquierda.
- [x] `Pendientes` a la derecha, mismo nivel vertical.
- [x] `Sugerencia` a lo ancho debajo.
- [x] No hay formulario de Caja en Inicio.
- [x] Captura a 1448×1086 con fuentes cargadas.
- [x] Caja sigue disponible en `/`.
- [ ] QA visual final y checklist 0–10 (siguiente paso).
