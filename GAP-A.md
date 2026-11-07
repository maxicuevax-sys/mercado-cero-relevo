# GAP-A — referencias definitivas

Fecha: 6 noviembre 2026. Base: `e348b2941deeb99b721fbbf05412a866d7ab65a3`.
Rama: `rehearsal/integracion-ab-20261106`. Candidato: `http://127.0.0.1:4497`.
Única fuente visual: `C:/Users/Public/Documents/MercadoCero-Visual-Sync/references/DEFINITIVE/SCREEN-MATRIX.md` y `MANIFEST.json`.
Se verificaron los SHA-256 completos de las seis pantallas de A. No se consultaron referencias viejas, atlas, crops ni memoria.

## Diagnóstico antes del cambio

Capturas de viewport, Chromium, DPR 1, sin escalar, recortar, alinear ni simular la barra del sistema. La dimensión del PNG coincide con la referencia. Los datos de la demo se conservan: no se sembraron ventas, pagos, tareas ni metas para obtener cifras del raster.

| Pantalla / estado / dimensión | Clasificación inicial | Deltas observados |
|---|---|---|
| Inicio lleno, 941×1672 | EXISTE CON DELTAS | Header de negocio horizontal, sin marca protagonista; 4 KPI en vez de 3; hero y pendientes en dos columnas; iconos, tipografía y proporciones menores; sin shortcuts a este ancho. Falta ilustración de bienvenida equivalente y acceso directo de micrófono en el hero. Copys/valores/fecha distintos; no hay base para inventar +12%. |
| Fiados con saldos, 390×693 | YA EXISTE | Comparación completa: error absoluto medio por canal 0/255; idéntico píxel a píxel. No requiere cambio. Los saldos son una muestra ilustrativa, declarada por el control de perfil; no se convierten en deudas reales. |
| Corte del día, 941×1672 | EXISTE CON DELTAS | Sidebar de escritorio de 210 px; título y cuerpo pequeños, resumen en filas y saldo crema; sin shell móvil. FALTAN el conteo visible inicial con billetes ilustrados, tabs Billetes/Monedas y composición de diferencia/acciones de la referencia. La app sí tiene conteo y confirmación, dentro de Realizar corte. No se declara que el corte cuadra sin contar. |
| Metas activas, 941×1672 | EXISTE CON DELTAS | Sidebar de escritorio de 210 px; resumen con 3 indicadores y protagonista + lista secundaria. FALTA composición de dos tarjetas equivalentes con arte específico y anillos. La BD tiene una meta: Mi primera sombrilla, 17%; no Refrigerador/Vacaciones. Las cifras de la referencia además no suman (Ahorrado 3,600 frente a 5,760 + 2,400); no se trasladan a lógica financiera. |
| Pendientes hoy, 941×1672 | EXISTE CON DELTAS | Sidebar de escritorio de 210 px; colecciones y tareas separadas, asistente debajo. FALTAN tabs Hoy/Completados, buscador y resumen ilustrado/listado unificado de 5 pendientes del canon. BD: un cobro pendiente y cero tareas. Cobrar a Juan marcado y a la vez por cobrar en el canon no prueba un pago; no se implementa esa equivalencia. |
| Inicio desktop, 1448×1086 | EXISTE CON DELTAS | Geometría principal ya próxima (sidebar 240 px; KPI y bloques en posiciones correspondientes). H1/merchant/cifras mayores; iconos, marca, ilustraciones de menor fidelidad; navegación distinta; textos funcionales y avisos demo adicionales. Registrar e Ir a ventas conservan destinos existentes; no se inventan Productos/Proveedores/Reportes. |

## Breakpoints reales

Lecturas de estilos computados antes: `quality-reports/definitive-a/evidence/breakpoints-before.json` (35 lecturas, anchos 760/761/767/768/941/1023/1024).

- Inicio oculta sidebar y muestra navegación inferior hasta 1023 px, pero su composición móvil de contenido solo aplica hasta 760 px: a 941 era un híbrido.
- Corte, Metas y Pendientes conservan sidebar desde 761 px. Corte oculta topbar/nav hasta 767.98 px por reglas de ledger. Fiados tiene composición propia hasta 767.98 px.
- Por tanto, **941 px CSS no entraba en la composición móvil definitiva**. El raster 941×1672 no declara DPR ni viewport CSS original: no se asume que equivale a 390 px con DPR alto.
- Los cambios de A se limitan a 761–1023 px; se conservan reglas de teléfono 390/320 y de B. Fiados queda intacto.

## Prioridad de esta entrega

Propuesto en c?digo y revisado en fixture B.1, sin certificar el candidato: P0 del shell de A a 941 y jerarquía de Inicio nativo; resumen/tamaño de Corte y lectura de Metas/Pendientes a ese ancho; ajuste tipográfico pequeño de Inicio desktop. Ningún cambio de contratos, DB, pagos, webhooks ni rutas de B.

Pendiente: los bloques marcados FALTAN arriba, assets de alta fidelidad, copy y estados de datos equivalentes controlados. No son detalles cosméticos cerrados. Paridad completa de Inicio/Corte/Metas/Pendientes: **NO alcanzada**. No hay autoaprobación ni autorización de publicación implícita.

## Cobertura sin canon

Inicio/Corte/Metas/Pendientes 390×693 y todas las pantallas A 320×569: **NO VERIFICADO en paridad exacta**, porque no hay referencia definitiva de esas dimensiones. Se usan sus capturas actuales antes/después solo para probar preservación. Estados vacíos, diálogos, historial y estados de error: **NO VERIFICADO visualmente** sin canon específico. Otros desktop: **NO VERIFICADO**. Chromium no constituye prueba iOS/Safari/dispositivo real.
