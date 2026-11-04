# 09 · Gate de entrada a Fase 2

> **Decisión:** **FASE 2 BLOQUEADA. No se inicia el design system ni la implementación de componentes.**
> Fecha: 3 nov 2026 · Rama `design/mercado-cero-v2` · HEAD `b8f127d`.
> Base: `quality-reports/mercado-cero-intervencion/08_VEREDICTO_INDEPENDIENTE.md` (RECHAZADO).

## Por qué no puede comenzar

La condición de entrada de Fase 2 es que **Inicio de escritorio haya superado los criterios del paquete de rescate visual**. El verificador independiente emitió **RECHAZADO**, no APROBADO.

La estructura de Inicio sí pasa los 12 bloqueantes geométricos:

- `/inicio` es una ruta separada; Inicio está activo.
- `/` sigue siendo Caja.
- 1448×1086.
- 4 KPIs en una fila.
- Hero izquierda, Pendientes derecha, Sugerencia abajo.
- Sin formulario de Caja en Inicio.
- Sin captura completa como fondo.

Pero quedan P0 que impiden el gate:

| P0 | Problema | Evidencia |
|---|---|---|
| P0-1 | Alto contraste roto; foco invisible | `axe` HC 8 serious; `inicio.css:857-874,973-976` |
| P0-2 | Hero opaco y recortado | `hero-registradora.png` 242×272 RGB; borde visible |
| P0-3 | Sugerencia recortada/opaca | `sugerencia-lupita.png` 283×173, 80.8% opaca |
| P0-4 | Árbol sucio y evidencia de otro SHA | `git status`; `latest.json` = `9206ea1` |
| P0-5 | Encoding del manifest PWA | `Mercado Cero Â·...` y BOM |
| P0-6 | Sin skip link / main no enfocable | primer Tab = Inicio |
| P0-7 | “Tamaño del texto” no afecta Inicio | todo en `px` |

Además, el plan correctivo 06 tiene huecos: shell duplicado, destinos Ventas/Caja duplicados, permisos de escritura en agentes con `edit: deny`, y falta cuarentena de evidencia.

## Lo que NO se hizo

- No se creó el design system de Fase 2.
- No se implementaron Button, Card, MetricCard, SectionHeader, Sidebar, MobileNav, PaymentStatus, CurrencyAmount, EmptyState, Modal, FormField, SearchField, TaskRow ni ProgressIndicator.
- No se tocaron tokens globales, pagos, fiado, corte ni módulos de negocio.
- No se instalaron librerías.
- No se alteró `.opencode/`.

## Condición de salida para abrir Fase 2

Secuencia mínima, según `06_PLAN_CORRECTIVO.md`:

1. **0.1** decidir los 3 archivos sucios (`inicio.css`, `page.tsx`, `sidebar-plantas.png`) sin reset/clean.
2. **0.2** corregir encoding de `manifest.ts` y `web/src/app/page.tsx`.
3. **0.3** decidir `start_url` (`/inicio` vs `/`).
4. **1.1–1.4** alto contraste, skip link, escala de texto, targets.
5. **2.1–2.5** hero, sugerencia, papel picado, sidebar y manifiesto de assets.
6. **3.1–3.6** navegación honesta, shell, tipografía/ritmo, KPI, móvil, CSS y URL.
7. **4.1–4.5** tests de `/inicio`, HIG/axe, recaptura desde HEAD limpio, `verify:full` + `verify:evidence`, nuevo veredicto independiente.

**Fase 2 se abre solo cuando 4.5 emita APROBADO.**

## Asignación cuando se abra

| Fase 2 | Dueño | Depende de |
|---|---|---|
| Inventario de componentes/assets | `mc-auditoria-repo` + `mc-onboarding-ayuda` | 4.5 APROBADO |
| Tokens y estados | `mc-sistema-diseno` | inventario |
| Shell/nav/responsive | `mc-shell-responsive` | tokens |
| Componentes reutilizables | `mc-sistema-diseno` + `mc-shell-responsive` | tokens + shell |
| Recursos editoriales | `mc-onboarding-ayuda` | manifiesto aprobado |
| A11y | `mc-accesibilidad` | componentes |
| Verificación | `mc-verificador-final` | implementación |

## Decisión que necesito

No se requiere aprobar cada ajuste menor. Sí necesito dos decisiones antes de ejecutar la remediación:

1. ¿Qué hacemos con los 3 archivos sucios: conservar el fix móvil/transparencia y commitear tras revisión, o revertir sólo el PNG/CSS no aprobado?
2. ¿`start_url` de la PWA debe ser `/inicio` o `/`?

Hasta entonces, **no se inicia Fase 2**.
