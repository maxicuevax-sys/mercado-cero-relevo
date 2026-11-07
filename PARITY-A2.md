# A — ronda 2: paridad y gaps reales

6 noviembre 2026. Rama `rehearsal/integracion-ab-20261106`; base `11f5816`.
Entrega local, sin merge ni push. **Paridad exacta: NO certificada.**

## Autoridad y método

Solo se consultó `C:/Users/Public/Documents/MercadoCero-Visual-Sync/references/DEFINITIVE/`:
`MANIFEST.json`, `SCREEN-MATRIX.md`, cuatro pantallas móviles, Inicio desktop
y la hoja de ilustraciones definitiva. Los seis hashes de pantalla A se
contrastaron con el manifiesto: `harness/evidence/exact-parity/a2/manifest-check.json`.

Los PNG 941×1672 se normalizan con Lanczos a **390×693**. Las capturas usan
viewport **390 px CSS**, DPR 1, Chromium, fuentes listas y viewport completo;
no 941 px CSS. La barra de iOS y las esquinas del raster permanecen en la
referencia; la app no dibuja controles de sistema para aparentar paridad.
Los overlays no se alinean, recortan ni compensan. MAE es descriptivo, no un
umbral de aceptación. Esto no prueba Safari/iOS ni un dispositivo físico.

Ilustraciones nuevas: únicamente recortes de arte, sin texto ni controles,
de las referencias definitivas. La interfaz es DOM, formularios y SVG.
No se rasterizaron botones, navegación, cifras ni estados de pago.

## Qué cambió y qué sigue abierto

| Pantalla | Implementado | Residual real |
|---|---|---|
| Inicio móvil | Marca, saludo con propietaria, ilustración de bienvenida, tres KPI incluyendo Meta, hero con registradora, Registrar y acceso a Caja con micrófono, accesos y navegación de A. | Producto, Gasto, Reporte y Gastos **NO VERIFICADOS como módulos**: no hay rutas. Se muestran deshabilitados y con nombre accesible explícito; no abren pantallas ficticias. Micrófono abre la Caja existente; no solicita permiso ni graba desde Inicio. Cifras y porcentaje siguen siendo los datos de la demo. No se inventa +12%. |
| Pendientes | Hoy/Completados, búsqueda, resumen ilustrado, checklist real, creación, completar y reabrir con las API existentes. Los cobros conservan enlaces de pago; una tarea completada no confirma dinero. | La base del candidato tiene cero tareas: el estado nativo de cinco tareas **NO VERIFICADO** en esa base. El vacío se declara, sin sembrar tareas para la captura. El resumen cuenta tareas abiertas; las tareas con fecha se mantienen agrupadas en Hoy/Esta semana/Todos. Los cobros siguen en su bloque, separados de los recordatorios. |
| Corte | Encabezado y navegación móvil restaurados, cuatro estadísticas, saldo ilustrado, conteo visible inicial, Billetes/Monedas, cantidades y subtotales por denominación, incremento/decremento, total, diferencia, revisión y confirmación existentes, historial. | **Geometría completa de una sola pantalla NO alcanzada**: seis denominaciones de billetes, controles de 44 px y campos de revisión requieren scroll. No se ocultan campos ni se afirma «Cuadra» antes de contar. El servidor sigue recalculando y exigiendo confirmación. |
| Metas | Resumen Ahorrado/Metas activas calculado, tarjetas equivalentes para todas las metas guardadas, barras y anillos determinados, Apartar y Nueva meta reales. | En el candidato solo existe Mi primera sombrilla: la segunda tarjeta canónica **NO VERIFICADA en ese estado**. No se creó una meta ficticia ni se usó arte de refrigerador para una sombrilla. Se usa arte de ahorro genérico. |
| Inicio desktop | Se conserva sidebar de 240 px, cuatro KPI, hero/pendientes y sugerencia. Revisado a 1448×1086. | Conservación del shell, no certificación exacta contra el canon desktop. |
| Fiados | Sin cambios de código o estilos específicos. | Comparación antes/después incluida para comprobar preservación. |

Las cifras del canon no son un contrato financiero: en Metas, $3,600 de
resumen no suma $5,760+$2,400; en Corte, contar $1,250 frente a $1,245 no
justifica diferencia cero. Se conservan las sumas y estados de la app.
Los ejemplos demo ya existentes en el bloque Pendientes de Inicio conservan
su aviso; no se convierten en tareas persistidas ni pagos.

## Evidencia

Todo en `harness/evidence/exact-parity/a2/`:

- `before-{inicio,pendientes,corte,metas}-390x693.png`: candidato 4497 real,
  build `11f5816`, antes de escribir código.
- `reference-*-390x693.png`, `before-*-overlay.png`/`*-diff.png` y
  `comparison-before.json`: referencia normalizada y comparación inicial.
- `after.json` y `after-*.png`: desarrollo 4498; incluye 390/320, desktop,
  axe, texto 200%, overlays y diff. Evidencia de desarrollo, no build sellado.
- `isolated-after.json` y `isolated-after-*.png`: producción temporal del gate
  `node scripts/parity-a2-gate.mjs`, si la corrida terminó. La identidad y
  resultados se leen del JSON; no se sustituyen por los de desarrollo.
- `flows.json`: creación/búsqueda/completar/reabrir tarea, segunda meta real
  en SQLite temporal, conteo entre tabs y preview de corte sin guardar.
- `final-validation.json`: resultados finales, SHA, logs y limitaciones.

Las capturas del gate se toman **antes** de sus pruebas de escritura. Estas
usan exclusivamente su SQLite temporal; nunca la base de 4497. Una segunda
meta creada para probar la colección no acredita el estado visual del candidato.

## Validación y límite de entrega

Se ejecutaron guardrails/lint/tipos y build; seguridad diagnosticó **58/58**.
La primera corrida demo-pay quedó **65 PASS / 1 FAIL** por árbol sucio.
B.1 detectó que el nuevo CSS anulaba el reflujo 3+2 al 200%; se corrigió
con una regla de contenedor limitada a A, sin cambiar tests de B.
Los resultados repetidos sobre árbol limpio están en `final-validation.json`.
No se presenta el diagnóstico con árbol sucio como evidencia válida.

La repetición limpia del código de UI `a63cfaa` dio seguridad **58/58**,
demo-pay **66/66**, B.1 **68/68**, runtime A PASS y **9/9** comprobaciones
de interacción; static **5/5** y `verify:evidence -- --static` PASS.
La inspección de esas capturas detectó un desplazamiento del botón Volver
de Corte por una regla de decoración; se corrigió antes del cierre. Los
artefactos finales distinguen esa repetición del HEAD final.

El worktree original conserva los cambios previos de
`quality-reports/oleada-b-estabilizacion/evidencia/oleada-b1-regression.json`
y `quality-reports/definitive-a/`, fuera de los commits A2.
La validación limpia se realiza en `../mercado-cero-a2-verify`, detached en
el commit entregado. Su `latest-static.json` y `verify:evidence -- --static`
son la fuente de identidad; `verify:full` no se ejecuta en este timebox.
No hay GO de handoff público ni autoaprobación de paridad.

## Candidato 4497 y rollback

Se leyó el entorno real del proceso: cwd de este `web/`, modo demo y SQLite
`C:/Users/Public/Documents/MercadoCero-Visual-Sync/rehearsal/demo-11f5816.db`.
Al solicitar detener el PID inspeccionado, este ya no existía. La revisión
automática **rechazó el arranque de 4497** con `blocked by policy`, sin razón
específica adicional. El puerto se comprobó sin listener. **El candidato
4497 no queda actualizado ni verificado después.** No se reintentó el mismo
arranque con otra envoltura. La validación temporal usa otro puerto y otra DB.

Rollback de código: revertir, en orden inverso, los commits A2; después
recompilar/reiniciar `11f5816` para recuperar el candidato previo. No hay
rollback ejecutado ni build anterior preservado como restauración inmediata.
Las lecturas de pantalla no alteraron la SQLite del candidato. No se tocaron
pagos, webhooks, APIs financieras, B/Caja/Ventas/Ayuda/Ajustes ni Fiados.
