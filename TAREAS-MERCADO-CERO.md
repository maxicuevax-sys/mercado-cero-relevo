# Mercado Cero Â· tablero de tareas y asignaciÃ³n

> **Corte:** 3 nov 2026 Â· rama `design/mercado-cero-v2` Â· base `a989878`
> **Regla de gobernanza:** el kit es la **referencia maestra**, no una orden de rediseÃ±o masivo. Se integra por mÃ³dulos, con coherencia de producto y sin tocar la lÃ³gica financiera, los datos ni la navegaciÃ³n validada.
> **Alcance congelado:** no se crean pantallas nuevas, no se inventa backend (inventario/proveedores/asistente), no se cambia el modelo de 5 tabs y no se usan cifras de mockups como verdad.
> **Kit verificado:** `python design-references/mercado-cero/07_QA/scripts/verificar_kit.py` â†’ 56 SVG, 86 PNG, 10 agentes, 0 errores.
> **Regla de cierre:** una tarea de UI no se cierra sin `npm run verify:fast`; si toca runtime, `npm run verify:full` + `npm run verify:evidence` contra el HEAD y Ã¡rbol limpio.

## 0. CÃ³mo se usa el kit (acuerdo de trabajo)

1. **Referencia, no calco:** los SVG del kit son reconstrucciones; las ilustraciones exactas del usuario viven en `web/src/assets/brand/transparent/`. No se sustituyen entre sÃ­ sin decisiÃ³n de marca.
2. **Coherencia antes que alcance:** primero que Caja, Fiado, Corte, Meta, Pendientes y Ayuda se sientan del mismo producto; despuÃ©s, cualquier pantalla nueva.
3. **Una tarea dominante por pantalla:** no se convierte el cobro en dashboard ni se llena la operaciÃ³n de ilustraciones.
4. **Cero riesgo financiero:** ninguna ilustraciÃ³n, badge o copy puede insinuar pago verificado, custodia de ahorro o venta nueva donde no la hay.
5. **Oleadas, no nueve escrituras simultÃ¡neas:** `caja-app.tsx` y `barrio.css` son monolitos compartidos; se editan en serie.
6. **MÃ³vil econÃ³mico primero:** 320/360 px, 200%, alto contraste, teclado, sin IA y con conexiÃ³n intermitente.

## 1. Decisiones que bloquean la siguiente oleada

| # | DecisiÃ³n | RecomendaciÃ³n | Responsable |
|---|---|---|---|
| D1 | Modelo de navegaciÃ³n: kit (`Inicio/Vender/Caja/Fiado/MÃ¡s`) vs app (`Caja/Fiado/Corte/Meta/Tareas`) | Mantener los 5 destinos actuales y documentar la desviaciÃ³n; renombrar sÃ³lo si se actualizan todos los E2E. No agregar un sexto tab. | `mc-orquestador` + producto |
| D2 | Familia de arte: SVG reconstruidos del kit vs PNG exactos del usuario | Usar los PNG exactos del usuario en superficies narrativas; los SVG del kit sÃ³lo como referencia/Ã­conos funcionales. Ya implementado. | `mc-sistema-diseno` |
| D3 | Prioridad de inventario/proveedores: `MATRIZ_PANTALLAS.csv` los pone P1/P2; `ORDEN_REAL` los deja al final | P2 y feature con backend, no sÃ³lo UI. | `mc-orquestador` |
| D4 | Fuente de verdad tipogrÃ¡fica: `HIG-DESIGN.md` dice Manrope; `DESIGN-BARRIO.md` Atkinson; kit Inter | Inter + Fraunces (implementado). Actualizar docs obsoletos. | `mc-sistema-diseno` |

## 2. Oleada 0 Â· auditorÃ­a (completada)

| Entrega | Evidencia |
|---|---|
| Inventario de las 16 pantallas del kit y prioridades | `design-references/mercado-cero/04_PANTALLAS/MATRIZ_PANTALLAS.csv`; reporte de subagente |
| AuditorÃ­a del repo y puntos de colisiÃ³n | `web/src/components/caja-app.tsx` (7,700+ lÃ­neas) concentra shell, venta, fiado, corte, meta y ayuda |
| AuditorÃ­a de accesibilidad | 112 hallazgos HIG; 4 gates en rojo: `hig`, `mobile`, `mobile-320`, `contrast` |
| VerificaciÃ³n tÃ©cnica | typecheck, lint, build, contratos y perf PASS; `a989878` |
| Specs Fiado/Corte/Metas/Ayuda/Pendientes | mapeadas contra componentes actuales; bloqueos de backend identificados |

## 3. P0 Â· correcciones inmediatas

> **Estado 3 nov 2026:** P0-01 a P0-11 corregidos y verificados con HIG 5 viewports, mobile 25/25, mobile-320 60/0, contraste 7/7, p0-fiado 51/0, p0-corte 69/0, p0-venta 66/0 y p0-shell 73/0. Quedan P0-12 (documentaciÃ³n de assets) y P0-13 (evidencia full atada al HEAD).

| ID | Tarea | DueÃ±o | Archivos | Criterio | Estado |
|---|---|---|---|---|---|
| P0-01 | Restaurar base de `.index-tab` (display, 48 px, padding, radio, foco) | `mc-shell-responsive` | `web/src/app/barrio.css` | Sidebar usable a 1024/1440 y 200%; HIG sin targets <48 | **Hecho en esta sesiÃ³n** |
| P0-02 | Bordes de controles a 3:1 (`control-border`, no `separator`) | `mc-sistema-diseno` | `barrio.css` | HIG sin bordes <3:1 en chips, qty, pay-line, draft-add | **Hecho en esta sesiÃ³n** |
| P0-03 | Texto mÃ­nimo 12 px (mic-label, draft num, KPI hints) | `mc-sistema-diseno` | `barrio.css`, `caja-app.tsx` | HIG `under12` = 0; mobile 25/25 | **Hecho en esta sesiÃ³n** |
| P0-04 | Chips de ejemplo a 48 px | `mc-shell-responsive` | `barrio.css` | HIG targets <44 = 0 | **Hecho en esta sesiÃ³n** |
| P0-05 | No ocultar â€œEscucharâ€/pending strip a 200% ni 341â€“380 px | `mc-shell-responsive` | `barrio.css` | Reflow sin pÃ©rdida de controles | **Hecho en esta sesiÃ³n** |
| P0-06 | Ayuda: imÃ¡genes fijas y copy con ancho Ãºtil a 200% | `mc-onboarding-ayuda` | `caja-app.tsx` | HIG clipping = 0 en `GuÃ­a` | **Hecho en esta sesiÃ³n** |
| P0-07 | Alto contraste: DEMO, footer sidebar, foco sobre verde | `mc-accesibilidad` | `barrio.css` | axe serious = 0 en 360/1280 HC | **Hecho en esta sesiÃ³n** |
| P0-08 | Ledger sin overflow a 320/200 (`table-layout: fixed`) | `mc-shell-responsive` | `barrio.css` | Firefox/WebKit 320/200 sin scroll horizontal | **Hecho en esta sesiÃ³n** |
| P0-09 | Abono: copy veraz (â€œefectivo sÃ­ entra al corte; digital declaradoâ€) | `mc-fiado-corte` | `caja-app.tsx` | Copy no contradice `cash.ts`; `p0-fiado` y `p0-corte` PASS | **Hecho en esta sesiÃ³n** |
| P0-10 | Meta: bloquear sobreaporte y mostrar â€œMeta alcanzadaâ€ | `mc-modulos-negocio` | `caja-app.tsx` | Nunca `savedCents > targetCents` desde UI; disclaimer sin rendimientos | **Hecho en esta sesiÃ³n** |
| P0-11 | `viewportFit: "cover"` | `mc-shell-responsive` | `layout.tsx` | Safe area iOS declarada | **Hecho en esta sesiÃ³n** |
| P0-12 | Corregir `README.md`/`manifest.json` de assets (rutas reales, `transparent/`, alpha) | `mc-sistema-diseno` | `web/src/assets/brand/**` | Manifiesto coincide con archivos usados | **Pendiente** |
| P0-13 | Reconstruir evidencia desde HEAD limpio | `mc-verificador-final` | `harness/` | `verify:full` + `verify:evidence` PASS; `STATE.md` actualizado | **Pendiente** |

## 3.5 Oleada de coherencia (prioridad real, sin rediseÃ±o masivo)

Objetivo: que todos los mÃ³dulos se sientan parte del mismo producto **sin ampliar alcance**. No hay pantallas nuevas ni backend nuevo.

| ID | Tarea | DueÃ±o | Archivos | Criterio |
|---|---|---|---|---|
| C1 | Unificar estados (pendiente, verificado, parcial, demo, error) con los tokens del kit | `mc-sistema-diseno` | `globals.css`, `barrio.css`, `caja-app.tsx`, `pending-payments.tsx` | Un mismo estado se ve igual en Caja, Fiado, Corte y Pendientes; nunca sÃ³lo color; textos de estado se conservan |
| C2 | Unificar primitivas de tarjeta, botÃ³n, campo y chip | `mc-sistema-diseno` | `barrio.css`, `globals.css` | Radios/espaciado/bordes consistentes; controles a 3:1; sin duplicar 72 selectores; E2E intactos |
| C3 | Coherencia visual de Fiado, Corte, Meta y Pendientes | `mc-shell-responsive` + `mc-modulos-negocio` | `caja-app.tsx`, `pending-tasks.tsx`, `barrio.css` | Mismo encabezado, tarjeta, vacÃ­o y CTA; ninguna ilustraciÃ³n compite con cobrar/cerrar |
| C4 | TipografÃ­a de dinero y jerarquÃ­a | `mc-sistema-diseno` | `barrio.css`, `globals.css` | Cifras en Inter tabular (o excepciÃ³n documentada); una sola cifra dominante por pantalla; sin partir montos |
| C5 | Primer uso sin tutorial nuevo | `mc-onboarding-ayuda` | `caja-app.tsx` (`HelpContent`), microcopy | Una persona nueva entiende â€œventa registrada â‰  cobrado â‰  fiadoâ€ sin abrir ayuda; la ayuda existente sigue disponible |
| C6 | Pasada telÃ©fono econÃ³mico | `mc-accesibilidad` + `mc-shell-responsive` | `barrio.css`, `caja-app.tsx` | 320/360, 200%, alto contraste, reduced motion, teclado, sin blur; HIG/mobile/contrast PASS |
| C7 | Evidencia y decisiÃ³n GO/NO-GO | `mc-verificador-final` | `harness/` | `verify:full` + `verify:evidence` sobre HEAD limpio; `STATE.md` actualizado |

**No hacer en esta oleada:** renombrar tabs, agregar â€œMÃ¡sâ€, crear onboarding de prÃ¡ctica, inventario, proveedores, asistente, roles o tema oscuro. Eso queda en P2 y requiere backend/decisiÃ³n.



| ID | Tarea | DueÃ±o | Archivos | Criterio |
|---|---|---|---|---|
| P1-01 | Reducir duplicaciÃ³n de Caja: un total, un CTA, accesos que hacen lo que dicen | `mc-ventas-pagos` + `mc-shell-responsive` | `caja-app.tsx`, `barrio.css` | En 360Ã—800 se ve un total y un CTA; quick actions con destinos reales |
| P1-02 | Fiado: buscador, Ãºltimo movimiento, agrupaciÃ³n por cliente | `mc-fiado-corte` | `caja-app.tsx` | Sin API nueva; no afirmar â€œno existeâ€ si hay truncamiento |
| P1-03 | Corte: digital verificado/declarado separado del efectivo, fecha visible | `mc-fiado-corte` | `caja-app.tsx` | `expectedCents` sigue sÃ³lo efectivo; `p0-corte` PASS |
| P1-04 | Meta: crear meta cuando no hay ninguna (`POST /api/goals`) | `mc-modulos-negocio` | `caja-app.tsx` | Formulario mÃ­nimo, validaciÃ³n, sin tocar caja |
| P1-05 | Pendientes: filtros Hoy/Semana/Todos con `aria-pressed` | `mc-modulos-negocio` | `pending-tasks.tsx` | Default no oculta tareas sin fecha |
| P1-06 | Preferencia â€œReducir movimientoâ€ persistida | `mc-accesibilidad` | `caja-app.tsx`, `globals.css` | Respeta SO + preferencia; `motion-check` PASS |
| P1-07 | Fiado: usar `libreta.png` en vacÃ­o y retirar `tacos.png` (comida â‰  deuda) | `mc-sistema-diseno` | `caja-app.tsx` | IlustraciÃ³n coherente con el dominio |
| P1-08 | Iconos exactos 13/13 o excepciÃ³n documentada | `mc-sistema-diseno` | `assets/brand`, `caja-app.tsx` | Matriz de uso; no mezclar Lucide sin criterio |
| P1-09 | `mobile-audit.py` y `a11y-contrast.py` alineados a la nueva home | `mc-verificador-final` | `web/scripts` | No esperar textos retirados; medir foco en 1280 HC |
| P1-10 | Actualizar docs de diseÃ±o obsoletos (Manrope/Atkinson) | `mc-sistema-diseno` | `HIG-DESIGN.md`, `DESIGN-BARRIO.md` | Una sola fuente de verdad |

## 4. P1 Â· despuÃ©s de la coherencia

Estas tareas mejoran el producto sin cambiar la navegaciÃ³n ni inventar backend. Se ejecutan sÃ³lo cuando C1â€“C7 estÃ©n cerradas.

| ID | Tarea | DueÃ±o | Archivos | Criterio |
|---|---|---|---|---|
| P1-01 | Fiado: buscador y Ãºltimo movimiento visible | `mc-fiado-corte` | `caja-app.tsx` | Sin API nueva; no afirmar â€œno existeâ€ si hay truncamiento; `p0-fiado` PASS |
| P1-02 | Corte: digital verificado/declarado separado del efectivo | `mc-fiado-corte` | `caja-app.tsx` | `expectedCents` sigue sÃ³lo efectivo; `p0-corte` PASS |
| P1-03 | Meta: crear meta cuando no hay ninguna | `mc-modulos-negocio` | `caja-app.tsx` | Usa `POST /api/goals` existente; no toca caja/fiado |
| P1-04 | Pendientes: filtros Hoy/Semana/Todos | `mc-modulos-negocio` | `pending-tasks.tsx` | `aria-pressed`; no oculta tareas sin fecha por defecto |
| P1-05 | Preferencia â€œReducir movimientoâ€ | `mc-accesibilidad` | `caja-app.tsx`, `globals.css` | Respeta SO + preferencia; `motion-check` PASS |
| P1-06 | Documentar assets reales (`transparent/`, rutas, alpha) | `mc-sistema-diseno` | `web/src/assets/brand/**` | Manifiesto coincide con lo que importa la app |

## 5. P2 Â· backlog con backend

| ID | Tarea | DueÃ±o | Bloqueo |
|---|---|---|---|
| P2-01 | Inventario/productos | `mc-modulos-negocio` | No hay modelo/API; no simular stock |
| P2-02 | Proveedores | `mc-modulos-negocio` | No hay modelo/API ni consentimiento |
| P2-03 | Reportes como pantalla propia | `mc-modulos-negocio` | Hoy vive dentro de Corte; decidir extracciÃ³n |
| P2-04 | Onboarding con venta de prÃ¡ctica aislada | `mc-onboarding-ayuda` | No hay namespace `practice`; no contaminar corte/analytics |
| P2-05 | Asistente opcional | `mc-onboarding-ayuda` | No hay `/api/assistant`; no dar autoridad financiera |
| P2-06 | Tema oscuro probado | `mc-sistema-diseno` + `mc-accesibilidad` | Requiere auditorÃ­a propia, no invertir colores |
| P2-07 | Gobernanza de assets/licencias | `mc-orquestador` | Documento de decisiÃ³n + hashes |

## 6. Propiedad de archivos (anti-colisiÃ³n)

`caja-app.tsx` y `barrio.css` son **monolitos compartidos**. No lanzar dos escrituras simultÃ¡neas sobre ellos.

| Archivo | DueÃ±o temporal | Puede leer |
|---|---|---|
| `web/src/app/barrio.css` | `mc-sistema-diseno` | `mc-shell-responsive`, `mc-accesibilidad` |
| `web/src/components/caja-app.tsx` (shell/home) | `mc-shell-responsive` | resto |
| `web/src/components/caja-app.tsx` (venta/pago) | `mc-ventas-pagos` | resto |
| `web/src/components/caja-app.tsx` (fiado/corte) | `mc-fiado-corte` | resto |
| `web/src/components/caja-app.tsx` (meta/ayuda) | `mc-modulos-negocio` + `mc-onboarding-ayuda` | resto |
| `web/src/components/pending-tasks.tsx` | `mc-modulos-negocio` | verificaciÃ³n |
| `web/src/app/layout.tsx` | `mc-shell-responsive` | sistema |
| `web/src/assets/brand/**` | `mc-sistema-diseno` | todos |
| `web/scripts/`, `harness/` | `mc-verificador-final` | todos |

**Secuencia recomendada:** sistema â†’ shell â†’ ventas/pagos â†’ fiado/corte â†’ mÃ³dulos/ayuda â†’ a11y â†’ verificaciÃ³n. Si dos tareas tocan `caja-app.tsx`, se ejecutan en serie, no en paralelo.

## 7. Comandos de cierre

```bash
cd web
npm run typecheck
npm run lint
npm run build
npm run test:perf-budget
npm run test:contracts
# servidor de producciÃ³n en un puerto libre, nunca 127.0.0.1:3000 (otro worktree)
BASE_URL=http://localhost:3100 python scripts/hig-after-audit.py
BASE_URL=http://localhost:3100 python scripts/mobile-audit.py
BASE_URL=http://localhost:3100 python scripts/mobile-320-e2e.py
BASE_URL=http://localhost:3100 python scripts/a11y-contrast.py
```

> **Nota:** el servidor de `127.0.0.1:3000` pertenece a `mercado-cero-final-closure`; no matarlo ni usarlo como evidencia de esta rama.

## 8. Evidencia de la sesiÃ³n (3 nov 2026)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | `BUILD OK` |
| `npm run test:perf-budget` | `PERF BUDGET OK` Â· JS 200.1/201 KiB Â· CSS 16.6/17 KiB Â· total 281.6/285 KiB |
| `npm run test:contracts` | PASS (seguridad 58/58, datos 63/0, DB guards 20/0, orders 8/0, demoâ†’real 32/0) |
| `python scripts/hig-after-audit.py` | **HIG OK: 5 viewports** (320/360/390/768/1280) |
| `python scripts/mobile-audit.py` | **MOBILE OK: 25/25** |
| `python scripts/mobile-320-e2e.py` | **60 PASS Â· 0 FAIL** |
| `python scripts/a11y-contrast.py` | **CONTRAST OK: 7 PASS Â· 0 FAIL** |
| `python scripts/p0-fiado-e2e.py` | **51 PASS Â· 0 FAIL** |
| `python scripts/p0-corte-e2e.py` | **69 PASS Â· 0 FAIL** |
| `python scripts/p0-venta-e2e.py` | **66 PASS Â· 0 FAIL** |
| `python scripts/p0-shell-e2e.py` | **73 PASS Â· 0 FAIL** |

**Pendiente de cierre:** `npm run verify:full` + `npm run verify:evidence` sobre el commit final, con Ã¡rbol limpio, servidor de este repo (no el de `mercado-cero-final-closure`) y actualizaciÃ³n de `harness/STATE.md`.



