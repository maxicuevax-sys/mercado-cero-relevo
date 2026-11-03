# Mercado Cero · tablero de tareas y asignación

> **Corte:** 3 nov 2026 · rama `design/mercado-cero-v2` · base `a989878`
> **Regla de gobernanza:** el kit es la **referencia maestra**, no una orden de rediseño masivo. Se integra por módulos, con coherencia de producto y sin tocar la lógica financiera, los datos ni la navegación validada.
> **Alcance congelado:** no se crean pantallas nuevas, no se inventa backend (inventario/proveedores/asistente), no se cambia el modelo de 5 tabs y no se usan cifras de mockups como verdad.
> **Kit verificado:** `python design-references/mercado-cero/07_QA/scripts/verificar_kit.py` → 56 SVG, 86 PNG, 10 agentes, 0 errores.
> **Regla de cierre:** una tarea de UI no se cierra sin `npm run verify:fast`; si toca runtime, `npm run verify:full` + `npm run verify:evidence` contra el HEAD y árbol limpio.

## 0. Cómo se usa el kit (acuerdo de trabajo)

1. **Referencia, no calco:** los SVG del kit son reconstrucciones; las ilustraciones exactas del usuario viven en `web/src/assets/brand/transparent/`. No se sustituyen entre sí sin decisión de marca.
2. **Coherencia antes que alcance:** primero que Caja, Fiado, Corte, Meta, Pendientes y Ayuda se sientan del mismo producto; después, cualquier pantalla nueva.
3. **Una tarea dominante por pantalla:** no se convierte el cobro en dashboard ni se llena la operación de ilustraciones.
4. **Cero riesgo financiero:** ninguna ilustración, badge o copy puede insinuar pago verificado, custodia de ahorro o venta nueva donde no la hay.
5. **Oleadas, no nueve escrituras simultáneas:** `caja-app.tsx` y `barrio.css` son monolitos compartidos; se editan en serie.
6. **Móvil económico primero:** 320/360 px, 200%, alto contraste, teclado, sin IA y con conexión intermitente.

## 1. Decisiones que bloquean la siguiente oleada

| # | Decisión | Recomendación | Responsable |
|---|---|---|---|
| D1 | Modelo de navegación: kit (`Inicio/Vender/Caja/Fiado/Más`) vs app (`Caja/Fiado/Corte/Meta/Tareas`) | Mantener los 5 destinos actuales y documentar la desviación; renombrar sólo si se actualizan todos los E2E. No agregar un sexto tab. | `mc-orquestador` + producto |
| D2 | Familia de arte: SVG reconstruidos del kit vs PNG exactos del usuario | Usar los PNG exactos del usuario en superficies narrativas; los SVG del kit sólo como referencia/íconos funcionales. Ya implementado. | `mc-sistema-diseno` |
| D3 | Prioridad de inventario/proveedores: `MATRIZ_PANTALLAS.csv` los pone P1/P2; `ORDEN_REAL` los deja al final | P2 y feature con backend, no sólo UI. | `mc-orquestador` |
| D4 | Fuente de verdad tipográfica: `HIG-DESIGN.md` dice Manrope; `DESIGN-BARRIO.md` Atkinson; kit Inter | Inter + Fraunces (implementado). Actualizar docs obsoletos. | `mc-sistema-diseno` |

## 2. Oleada 0 · auditoría (completada)

| Entrega | Evidencia |
|---|---|
| Inventario de las 16 pantallas del kit y prioridades | `design-references/mercado-cero/04_PANTALLAS/MATRIZ_PANTALLAS.csv`; reporte de subagente |
| Auditoría del repo y puntos de colisión | `web/src/components/caja-app.tsx` (7,700+ líneas) concentra shell, venta, fiado, corte, meta y ayuda |
| Auditoría de accesibilidad | 112 hallazgos HIG; 4 gates en rojo: `hig`, `mobile`, `mobile-320`, `contrast` |
| Verificación técnica | typecheck, lint, build, contratos y perf PASS; `a989878` |
| Specs Fiado/Corte/Metas/Ayuda/Pendientes | mapeadas contra componentes actuales; bloqueos de backend identificados |

## 3. P0 · correcciones inmediatas

> **Estado 3 nov 2026:** P0-01 a P0-11 corregidos y verificados con HIG 5 viewports, mobile 25/25, mobile-320 60/0, contraste 7/7, p0-fiado 51/0, p0-corte 69/0, p0-venta 66/0 y p0-shell 73/0. Quedan P0-12 (documentación de assets) y P0-13 (evidencia full atada al HEAD).

| ID | Tarea | Dueño | Archivos | Criterio | Estado |
|---|---|---|---|---|---|
| P0-01 | Restaurar base de `.index-tab` (display, 48 px, padding, radio, foco) | `mc-shell-responsive` | `web/src/app/barrio.css` | Sidebar usable a 1024/1440 y 200%; HIG sin targets <48 | **Hecho en esta sesión** |
| P0-02 | Bordes de controles a 3:1 (`control-border`, no `separator`) | `mc-sistema-diseno` | `barrio.css` | HIG sin bordes <3:1 en chips, qty, pay-line, draft-add | **Hecho en esta sesión** |
| P0-03 | Texto mínimo 12 px (mic-label, draft num, KPI hints) | `mc-sistema-diseno` | `barrio.css`, `caja-app.tsx` | HIG `under12` = 0; mobile 25/25 | **Hecho en esta sesión** |
| P0-04 | Chips de ejemplo a 48 px | `mc-shell-responsive` | `barrio.css` | HIG targets <44 = 0 | **Hecho en esta sesión** |
| P0-05 | No ocultar “Escuchar”/pending strip a 200% ni 341–380 px | `mc-shell-responsive` | `barrio.css` | Reflow sin pérdida de controles | **Hecho en esta sesión** |
| P0-06 | Ayuda: imágenes fijas y copy con ancho útil a 200% | `mc-onboarding-ayuda` | `caja-app.tsx` | HIG clipping = 0 en `Guía` | **Hecho en esta sesión** |
| P0-07 | Alto contraste: DEMO, footer sidebar, foco sobre verde | `mc-accesibilidad` | `barrio.css` | axe serious = 0 en 360/1280 HC | **Hecho en esta sesión** |
| P0-08 | Ledger sin overflow a 320/200 (`table-layout: fixed`) | `mc-shell-responsive` | `barrio.css` | Firefox/WebKit 320/200 sin scroll horizontal | **Hecho en esta sesión** |
| P0-09 | Abono: copy veraz (“efectivo sí entra al corte; digital declarado”) | `mc-fiado-corte` | `caja-app.tsx` | Copy no contradice `cash.ts`; `p0-fiado` y `p0-corte` PASS | **Hecho en esta sesión** |
| P0-10 | Meta: bloquear sobreaporte y mostrar “Meta alcanzada” | `mc-modulos-negocio` | `caja-app.tsx` | Nunca `savedCents > targetCents` desde UI; disclaimer sin rendimientos | **Hecho en esta sesión** |
| P0-11 | `viewportFit: "cover"` | `mc-shell-responsive` | `layout.tsx` | Safe area iOS declarada | **Hecho en esta sesión** |
| P0-12 | Corregir `README.md`/`manifest.json` de assets (rutas reales, `transparent/`, alpha) | `mc-sistema-diseno` | `web/src/assets/brand/**` | Manifiesto coincide con archivos usados | **Pendiente** |
| P0-13 | Reconstruir evidencia desde HEAD limpio | `mc-verificador-final` | `harness/` | `verify:full` + `verify:evidence` PASS; `STATE.md` actualizado | **Pendiente** |

## 3.5 Oleada de coherencia (prioridad real, sin rediseño masivo)

Objetivo: que todos los módulos se sientan parte del mismo producto **sin ampliar alcance**. No hay pantallas nuevas ni backend nuevo.

> **Estado:** C1 (estados), C3 (ilustraciones por dominio), C4 (tipografía de dinero), C5 (primer uso) y C6 (teléfono económico) cerrados; C2 (primitivas) parcial: se limpiaron clases muertas y se unificaron estados, pero la extracción completa de primitivas queda como deuda. C7 parcial: `verify:full --skip=tunnel,preflight` ejecutó **21/21 gates en verde** sobre `3c596ba`, incluido p0-integracion 51/0 tras corregir la codificación de `pending-payments.tsx`. Sólo quedan `tunnel` y `preflight`, bloqueados por el `APP_URL` muerto; no se pueden declarar sin un túnel vivo.

| ID | Tarea | Dueño | Archivos | Criterio |
|---|---|---|---|---|
| C1 | Unificar estados (pendiente, verificado, parcial, demo, error) con los tokens del kit | `mc-sistema-diseno` | `globals.css`, `barrio.css`, `caja-app.tsx`, `pending-payments.tsx` | Un mismo estado se ve igual en Caja, Fiado, Corte y Pendientes; nunca sólo color; textos de estado se conservan |
| C2 | Unificar primitivas de tarjeta, botón, campo y chip | `mc-sistema-diseno` | `barrio.css`, `globals.css` | Radios/espaciado/bordes consistentes; controles a 3:1; sin duplicar 72 selectores; E2E intactos |
| C3 | Coherencia visual de Fiado, Corte, Meta y Pendientes | `mc-shell-responsive` + `mc-modulos-negocio` | `caja-app.tsx`, `pending-tasks.tsx`, `barrio.css` | Mismo encabezado, tarjeta, vacío y CTA; ninguna ilustración compite con cobrar/cerrar |
| C4 | Tipografía de dinero y jerarquía | `mc-sistema-diseno` | `barrio.css`, `globals.css` | Cifras en Inter tabular (o excepción documentada); una sola cifra dominante por pantalla; sin partir montos |
| C5 | Primer uso sin tutorial nuevo | `mc-onboarding-ayuda` | `caja-app.tsx` (`HelpContent`), microcopy | Una persona nueva entiende “venta registrada ≠ cobrado ≠ fiado” sin abrir ayuda; la ayuda existente sigue disponible |
| C6 | Pasada teléfono económico | `mc-accesibilidad` + `mc-shell-responsive` | `barrio.css`, `caja-app.tsx` | 320/360, 200%, alto contraste, reduced motion, teclado, sin blur; HIG/mobile/contrast PASS |
| C7 | Evidencia y decisión GO/NO-GO | `mc-verificador-final` | `harness/` | `verify:full` + `verify:evidence` sobre HEAD limpio; `STATE.md` actualizado |

**No hacer en esta oleada:** renombrar tabs, agregar “Más”, crear onboarding de práctica, inventario, proveedores, asistente, roles o tema oscuro. Eso queda en P2 y requiere backend/decisión.



| ID | Tarea | Dueño | Archivos | Criterio |
|---|---|---|---|---|
| P1-01 | Reducir duplicación de Caja: un total, un CTA, accesos que hacen lo que dicen | `mc-ventas-pagos` + `mc-shell-responsive` | `caja-app.tsx`, `barrio.css` | En 360×800 se ve un total y un CTA; quick actions con destinos reales |
| P1-02 | Fiado: buscador, último movimiento, agrupación por cliente | `mc-fiado-corte` | `caja-app.tsx` | Sin API nueva; no afirmar “no existe” si hay truncamiento |
| P1-03 | Corte: digital verificado/declarado separado del efectivo, fecha visible | `mc-fiado-corte` | `caja-app.tsx` | `expectedCents` sigue sólo efectivo; `p0-corte` PASS |
| P1-04 | Meta: crear meta cuando no hay ninguna (`POST /api/goals`) | `mc-modulos-negocio` | `caja-app.tsx` | Formulario mínimo, validación, sin tocar caja |
| P1-05 | Pendientes: filtros Hoy/Semana/Todos con `aria-pressed` | `mc-modulos-negocio` | `pending-tasks.tsx` | Default no oculta tareas sin fecha |
| P1-06 | Preferencia “Reducir movimiento” persistida | `mc-accesibilidad` | `caja-app.tsx`, `globals.css` | Respeta SO + preferencia; `motion-check` PASS |
| P1-07 | Fiado: usar `libreta.png` en vacío y retirar `tacos.png` (comida ≠ deuda) | `mc-sistema-diseno` | `caja-app.tsx` | Ilustración coherente con el dominio |
| P1-08 | Iconos exactos 13/13 o excepción documentada | `mc-sistema-diseno` | `assets/brand`, `caja-app.tsx` | Matriz de uso; no mezclar Lucide sin criterio |
| P1-09 | `mobile-audit.py` y `a11y-contrast.py` alineados a la nueva home | `mc-verificador-final` | `web/scripts` | No esperar textos retirados; medir foco en 1280 HC |
| P1-10 | Actualizar docs de diseño obsoletos (Manrope/Atkinson) | `mc-sistema-diseno` | `HIG-DESIGN.md`, `DESIGN-BARRIO.md` | Una sola fuente de verdad |

## 4. P1 · después de la coherencia

Estas tareas mejoran el producto sin cambiar la navegación ni inventar backend. Se ejecutan sólo cuando C1–C7 estén cerradas.

| ID | Tarea | Dueño | Archivos | Criterio |
|---|---|---|---|---|
| P1-01 | Fiado: buscador y último movimiento visible | `mc-fiado-corte` | `caja-app.tsx` | Sin API nueva; no afirmar “no existe” si hay truncamiento; `p0-fiado` PASS |
| P1-02 | Corte: digital verificado/declarado separado del efectivo | `mc-fiado-corte` | `caja-app.tsx` | `expectedCents` sigue sólo efectivo; `p0-corte` PASS |
| P1-03 | Meta: crear meta cuando no hay ninguna | `mc-modulos-negocio` | `caja-app.tsx` | Usa `POST /api/goals` existente; no toca caja/fiado |
| P1-04 | Pendientes: filtros Hoy/Semana/Todos | `mc-modulos-negocio` | `pending-tasks.tsx` | `aria-pressed`; no oculta tareas sin fecha por defecto |
| P1-05 | Preferencia “Reducir movimiento” | `mc-accesibilidad` | `caja-app.tsx`, `globals.css` | Respeta SO + preferencia; `motion-check` PASS |
| P1-06 | Documentar assets reales (`transparent/`, rutas, alpha) | `mc-sistema-diseno` | `web/src/assets/brand/**` | Manifiesto coincide con lo que importa la app |

## 5. P2 · backlog con backend

| ID | Tarea | Dueño | Bloqueo |
|---|---|---|---|
| P2-01 | Inventario/productos | `mc-modulos-negocio` | No hay modelo/API; no simular stock |
| P2-02 | Proveedores | `mc-modulos-negocio` | No hay modelo/API ni consentimiento |
| P2-03 | Reportes como pantalla propia | `mc-modulos-negocio` | Hoy vive dentro de Corte; decidir extracción |
| P2-04 | Onboarding con venta de práctica aislada | `mc-onboarding-ayuda` | No hay namespace `practice`; no contaminar corte/analytics |
| P2-05 | Asistente opcional | `mc-onboarding-ayuda` | No hay `/api/assistant`; no dar autoridad financiera |
| P2-06 | Tema oscuro probado | `mc-sistema-diseno` + `mc-accesibilidad` | Requiere auditoría propia, no invertir colores |
| P2-07 | Gobernanza de assets/licencias | `mc-orquestador` | Documento de decisión + hashes |

## 6. Propiedad de archivos (anti-colisión)

`caja-app.tsx` y `barrio.css` son **monolitos compartidos**. No lanzar dos escrituras simultáneas sobre ellos.

| Archivo | Dueño temporal | Puede leer |
|---|---|---|
| `web/src/app/barrio.css` | `mc-sistema-diseno` | `mc-shell-responsive`, `mc-accesibilidad` |
| `web/src/components/caja-app.tsx` (shell/home) | `mc-shell-responsive` | resto |
| `web/src/components/caja-app.tsx` (venta/pago) | `mc-ventas-pagos` | resto |
| `web/src/components/caja-app.tsx` (fiado/corte) | `mc-fiado-corte` | resto |
| `web/src/components/caja-app.tsx` (meta/ayuda) | `mc-modulos-negocio` + `mc-onboarding-ayuda` | resto |
| `web/src/components/pending-tasks.tsx` | `mc-modulos-negocio` | verificación |
| `web/src/app/layout.tsx` | `mc-shell-responsive` | sistema |
| `web/src/assets/brand/**` | `mc-sistema-diseno` | todos |
| `web/scripts/`, `harness/` | `mc-verificador-final` | todos |

**Secuencia recomendada:** sistema → shell → ventas/pagos → fiado/corte → módulos/ayuda → a11y → verificación. Si dos tareas tocan `caja-app.tsx`, se ejecutan en serie, no en paralelo.

## 7. Comandos de cierre

```bash
cd web
npm run typecheck
npm run lint
npm run build
npm run test:perf-budget
npm run test:contracts
# servidor de producción en un puerto libre, nunca 127.0.0.1:3000 (otro worktree)
BASE_URL=http://localhost:3100 python scripts/hig-after-audit.py
BASE_URL=http://localhost:3100 python scripts/mobile-audit.py
BASE_URL=http://localhost:3100 python scripts/mobile-320-e2e.py
BASE_URL=http://localhost:3100 python scripts/a11y-contrast.py
```

> **Nota:** el servidor de `127.0.0.1:3000` pertenece a `mercado-cero-final-closure`; no matarlo ni usarlo como evidencia de esta rama.

## 8. Evidencia de la sesión (3 nov 2026)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | `BUILD OK` |
| `npm run test:perf-budget` | `PERF BUDGET OK` · JS 200.1/201 KiB · CSS 16.6/17 KiB · total 281.6/285 KiB |
| `npm run test:contracts` | PASS (seguridad 58/58, datos 63/0, DB guards 20/0, orders 8/0, demo→real 32/0) |
| `python scripts/hig-after-audit.py` | **HIG OK: 5 viewports** (320/360/390/768/1280) |
| `python scripts/mobile-audit.py` | **MOBILE OK: 25/25** |
| `python scripts/mobile-320-e2e.py` | **60 PASS · 0 FAIL** |
| `python scripts/a11y-contrast.py` | **CONTRAST OK: 7 PASS · 0 FAIL** |
| `python scripts/p0-fiado-e2e.py` | **51 PASS · 0 FAIL** |
| `python scripts/p0-corte-e2e.py` | **69 PASS · 0 FAIL** |
| `python scripts/p0-venta-e2e.py` | **66 PASS · 0 FAIL** |
| `python scripts/p0-shell-e2e.py` | **73 PASS · 0 FAIL** |
| `npm run verify:full -- --skip=tunnel,preflight` | **21/21 gates ejecutados en verde** (sólo faltan tunnel y preflight por `APP_URL` muerto) |

**Pendiente de cierre:** `npm run verify:full` + `npm run verify:evidence` sobre el commit final, con árbol limpio, servidor de este repo (no el de `mercado-cero-final-closure`) y actualización de `harness/STATE.md`.

