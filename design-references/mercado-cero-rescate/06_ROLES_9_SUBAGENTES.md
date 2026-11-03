# Distribución recomendada / No hacer ediciones en estampida

El kit anterior habilitaba hasta 9 agentes, pero eso no implica paralelismo irrestricto. Para **rescatar Inicio**:

| Orden | Rol | Permiso | Producto | Depende de |
|---|---|---|---|---|
| 0 | Orquestador | Integrar | Matriz rutas/archivos y prioridades | — |
| 1 | Auditor de router/repo | Lectura | Mostrar por qué Inicio se confundió con Caja | — |
| 2 | Verificador visual | Lectura | Baseline antes y criterios GO/NO-GO | — |
| 3 | Sistema de diseño | Edición de tokens *solo tras ownership* | Variables, tipografía, estilos base | 1 |
| 4 | Asset artist | Edición aislada assets | Iconos/ilustraciones fieles en archivos únicos | 1 |
| 5 | Shell/router | ÚNICO integrador de archivos de navegación | Inicio separado de Caja, sidebar, topbar | 1,3 |
| 6 | Dashboard | Edición ÚNICA de Home | 4 KPIs, hero, pendientes, sugerencia | 3,4,5 |
| 7 | QA accesibilidad | Lectura/tests separados | AA, teclado, 200% zoom | 6 |
| 8 | QA financiero | Lectura/tests separados | Veracidad de datos y no regresión | 6 |
| 9 | Verificador final | Lectura | Captura 1448×1086, GO/NO-GO | 7,8 |

El orquestador puede invocar a otros agentes definidos previamente que cumplan estos roles. NO crear nueve escritores en paralelo. Como máximo, trabajo simultáneo en rutas de archivos disjuntas: auditoría y QA de lectura, o assets SVG aparte del componente de layout.

**Integración secuencial**: tokens → shell/ruta → composición Inicio → assets → integración de datos → QA → aprobar.
