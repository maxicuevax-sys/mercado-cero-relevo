# PARITY-A — evidencia y límites

**Entrega parcial, sin autoaprobación visual.** El código del shell y de A está propuesto y compilado; su render posterior no pudo verificarse. Faltan bloques sustanciales enumerados en [GAP-A.md](GAP-A.md).

## Fuente y captura

Solo `C:/Users/Public/Documents/MercadoCero-Visual-Sync/references/DEFINITIVE/`.
Manifiesto verificado por SHA-256 de seis pantallas. No se usaron atlas, crops, memoria ni referencias anteriores.

Antes real: servidor 4497 con `/api/health.buildSha = e348b2941deeb99b721fbbf05412a866d7ab65a3`. Chromium, viewport nativo, DPR 1, fuentes listas y network idle, screenshot del viewport completo (no fullPage). La tabla no compensa ni recorta la barra del dispositivo que está incluida en algunos cánones.

| Pantalla | Captura antes | Overlay antes | Diff antes | Error medio canal /255 |
|---|---|---|---|---:|
| Inicio 941×1672 | [PNG](quality-reports/definitive-a/evidence/before-inicio-941x1672.png) | [50%](quality-reports/definitive-a/evidence/before-overlay-inicio-941x1672.png) | [Diff](quality-reports/definitive-a/evidence/before-diff-inicio-941x1672.png) | 50.910 |
| Fiados 390×693 | [PNG](quality-reports/definitive-a/evidence/before-fiados-390x693.png) | [50%](quality-reports/definitive-a/evidence/before-overlay-fiados-390x693.png) | [Diff](quality-reports/definitive-a/evidence/before-diff-fiados-390x693.png) | **0.000** |
| Corte 941×1672 | [PNG](quality-reports/definitive-a/evidence/before-corte-941x1672.png) | [50%](quality-reports/definitive-a/evidence/before-overlay-corte-941x1672.png) | [Diff](quality-reports/definitive-a/evidence/before-diff-corte-941x1672.png) | 80.098 |
| Metas 941×1672 | [PNG](quality-reports/definitive-a/evidence/before-metas-941x1672.png) | [50%](quality-reports/definitive-a/evidence/before-overlay-metas-941x1672.png) | [Diff](quality-reports/definitive-a/evidence/before-diff-metas-941x1672.png) | 74.302 |
| Pendientes 941×1672 | [PNG](quality-reports/definitive-a/evidence/before-pendientes-941x1672.png) | [50%](quality-reports/definitive-a/evidence/before-overlay-pendientes-941x1672.png) | [Diff](quality-reports/definitive-a/evidence/before-diff-pendientes-941x1672.png) | 74.200 |
| Inicio 1448×1086 | [PNG](quality-reports/definitive-a/evidence/before-inicio-1448x1086.png) | [50%](quality-reports/definitive-a/evidence/before-overlay-inicio-1448x1086.png) | [Diff](quality-reports/definitive-a/evidence/before-diff-inicio-1448x1086.png) | 20.726 |

El error es una descripción del raster completo, no un umbral de aprobación; mezcla geometría, contenido, assets y chrome del dispositivo. Fiados antes es idéntico píxel a píxel. Las otras cinco referencias y sus capturas antes fueron inspeccionadas visualmente a dimensión nativa.

Datos: [before.json](quality-reports/definitive-a/evidence/before.json), [breakpoints-before.json](quality-reports/definitive-a/evidence/breakpoints-before.json), [comparisons.json](quality-reports/definitive-a/evidence/comparisons.json). Los PNG se conservan localmente; la política existente del repo excluye `quality-reports/**/*.png` de Git.

## Después: NO VERIFICADO

No hay capturas después, overlays después ni prueba visual de preservación a 390/320. No se sustituyen con imágenes emuladas, CSS inyectado ni capturas de otro puerto. `comparisons.json` marca expresamente cada after ausente como NO VERIFICADO.

La revisión automática rechazó el comando compuesto para reiniciar 4497 (`blocked by policy`). Al reducirlo a acciones individuales, aceptó detener exclusivamente PID 29048, cuya línea de comando se verificó como `next start -H 127.0.0.1 -p 4497`, y rechazó el arranque aislado, también sin motivo específico adicional. **4497 quedó detenido.** No se detuvo, reinició, consultó por HTTP ni reconstruyó 4496.

La causa de aislar el build fue comprobada por `psutil.Process(...).cwd()`: ambos procesos usaban el mismo `web/`. Todos los builds de esta entrega se hicieron en `C:/Users/Public/Documents/MercadoCero-Visual-Sync/candidate-a/web`, en un worktree detached del commit de A, con dependencias copiadas (sin junction final). El build original usado por 4496 se conservó.

Una copia SQLite por backup desde conexión `mode=ro` de `rehearsal/demo-7682b78.db` quedó en `candidate-a/web/data/definitive-a.db`. No se sembraron cifras ni se tocaron registros del origen. El candidato aislado está preparado con esa base, pero no está sirviendo.

## Cambios acotados

- `web/src/components/shell/app-shell.tsx`: clase de scope para Inicio/Corte/Metas/Pendientes; las rutas de B y Fiados no reciben ese scope.
- `web/src/components/shell/definitive-a.css`: móvil 761–1023 px para A, marca/header/nav, Inicio de una columna con 3 KPI y shortcuts, resumen de Corte y tamaños de Metas/Pendientes. Inicio desktop: tres ajustes tipográficos y color del CTA. No se introduce barra de estado falsa.
- `web/src/app/inicio/page.tsx`: imagen decorativa existente de Lupita, visible únicamente en ese rango. El asset representa a Lupita con tablet; no equivale al asset del canon de bienvenida.
- Scripts reproducibles de captura y diff desde `web/`. No extraen assets de referencias ni alteran estados financieros.

Las reglas visuales nuevas no aplican a 390/320; esto es evidencia de alcance del código, **no prueba renderizada de no regresión**. Las capturas antes de las cinco rutas en 390×693 y 320×569 están conservadas. No hay canon exacto para esas dimensiones salvo Fiados 390×693.

## Gates

El build y los tres contratos solicitados se ejecutaron en el worktree aislado limpio de los commits de runtime indicados en los logs. Seguridad/demo-pay: `bcaa0b1`; primera correcci?n B.1: `00c9698`; cambios tipogr?ficos posteriores: `fd658df`. Los contratos levantan servidores temporales propios, con bases temporales; no usan 4496/4497.

- Seguridad: **58/58 PASS**.
- Demo-pay: **66 PASS / 0 FAIL**, en ?rbol limpio.
- B.1 inicial: **67 PASS / 1 FAIL** (Inicio 768, scrollWidth 774). El offset fijo de la ilustraci?n exced?a en 6.25 px el padding escalado; corregido a la misma unidad relativa.
- B.1 tras correcci?n: **68 PASS / 0 FAIL** en `00c9698`.
- Contratos finales sobre `82b69f4`: seguridad **58/58**, demo-pay **66/66**, B.1 **68/68**, todos sin fallos. Build, `verify:static` **5/5** y verificador est?tico **PASS** en ese HEAD limpio. Los cambios siguientes son documentales, sin diferencias de c?digo de producto.
- Gates finales y build: logs en el worktree aislado; `harness/evidence/latest-static.json` identifica el HEAD exacto validado. Ning?n resultado anterior se presenta como evidencia formal de un SHA posterior.

La primera corrida `verify:fast` tuvo 3/3 puertas verdes pero fue inválida por árbol sucio y cambio de SHA durante la ejecución. Una corrida posterior `verify:static` 5/5 pasó en el worktree limpio sobre `a22271a`; no se usa como certificado del HEAD final. El `verify:static` y `verify:evidence -- --static` del HEAD documental final se conservan en el worktree aislado. No se ejecutó full: no se declara runtime/QR/pey real/iOS verificado.

El árbol original conserva el JSON B.1 que ya estaba modificado al inicio, fuera de todos los commits de A. Por eso no se declara cierre formal del harness en ese árbol. La evidencia estática final solo puede comprobarse desde el worktree aislado limpio con el mismo HEAD.

## Continuación reproducible

Después de restablecer 4497 desde el build aislado con `DEMO_MODE=true`, `DATABASE_PATH=C:/Users/Public/Documents/MercadoCero-Visual-Sync/candidate-a/web/data/definitive-a.db`, `DATABASE_BACKUP_DIR=.../candidate-a/web/data/backups` y `APP_URL=http://127.0.0.1:4497`, ejecutar desde el `web/` original:

```powershell
$env:CAPTURE_PHASE='after'
python scripts/definitive-a-capture.py
python scripts/definitive-a-compare.py
```

Inspeccionar cada after y overlay. Exigir igualdad antes/después en los 9 casos pequeños de A conservados; Fiados tiene su comparación exacta adicional contra el canon. Luego verificar el comportamiento de Más, navegación, conteo/confirmación y diálogos sin registrar pagos o cierres en la base compartida. No convertir un PASS funcional en aceptación visual.

## Rollback y entrega

Commits locales únicamente; sin merge, push ni despliegue público. Base preservada: `e348b29`. Revertir los commits de A revierte su código; no se ejecutó rollback. Para recuperar el candidato previo en 4497, el build original continúa disponible en el `web/` original y la SQLite origen está intacta. Esa restauración de servicio no se pudo ejecutar por el rechazo de arranque descrito arriba.

## Fixture B.1: evidencia renderizada adicional

Se capturaron las seis dimensiones nativas y los diez casos de tel?fono durante el servidor temporal de `test:b1-regression`, con Chromium/DPR 1. Nombre `fixture-after-*`, base URL 3390, SQLite temporal, con el gate ejecutando sus operaciones de prueba. No es la base del candidato y los datos pueden cambiar entre capturas. No se deducen pagos ni saldos de sus im?genes.

Metadatos: [fixture-after.json](quality-reports/definitive-a/evidence/fixture-after.json). Comparaci?n descriptiva: [comparisons-fixture-after.json](quality-reports/definitive-a/evidence/comparisons-fixture-after.json). Cada pantalla nativa tiene `fixture-after-overlay-<ruta>-<ancho>x<alto>.png` y `fixture-after-diff-...png` junto a su captura. El default de comparaci?n de 4497 contin?a marcando after ausente como NO VERIFICADO.

La inspecci?n del primer fixture confirm?: sidebar oculto y nav m?vil en las cuatro rutas A a 941; tres KPI y hero de una columna en Inicio; dos columnas de resumen y saldo verde en Corte. Encontr? cifra de resumen Metas partida y rayos de marca en otra l?nea: corregidos en `fd658df` antes de la verificaci?n final. El resto de faltantes del GAP permanece abierto. La lectura inicial del visor sugiri? incorrectamente un header vac?o en Pendientes. Se descart?: el PNG contiene 9,051 p?xeles claros en la regi?n del header, igual que Metas; la captura independiente y el hit-test muestran la marca y acciones. La prueba de posici?n/z-index no corrigi? ning?n fallo real y no se incorpor? al c?digo. Diagn?stico conservado en `pending-header-stack.json` y `diagnostic-pending-before.png`; la captura con CSS inyectado es solo diagn?stico, no evidencia de paridad.

## Balance final de alcance

- Fiados 390?693 antes: igualdad exacta con el canon; no se modific? su implementaci?n.
- Inicio/Corte/Metas/Pendientes 941: shell m?vil comprobado en fixture Chromium, sin overflow. Inicio desktop: ajustes tipogr?ficos comprobados en fixture. Las seis capturas nativas finales fueron inspeccionadas; hay diferencias sustanciales de assets, copy y composici?n respecto del canon, descritas en GAP-A. No hay paridad total aprobada.
- Se inspeccionaron las vistas de tel?fono del fixture. La comparaci?n conserva valores exactos de error por caso; los datos cambiantes de los contratos impiden afirmar igualdad general del estado.
- 4497 sigue detenido por el rechazo de arranque. La validaci?n despu?s con su copia SQLite, y por tanto la paridad del candidato solicitado, contin?a NO VERIFICADA. 4496 se preserv?.
- Informes y c?digo en commits locales; artefactos regenerables bajo `quality-reports/definitive-a/evidence/` permanecen locales. El manifiesto `ARTIFACTS.json` registra hashes y tama?os para comprobaci?n de archivos entregados.
