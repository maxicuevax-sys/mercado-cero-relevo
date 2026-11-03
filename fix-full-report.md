# fix-full — de 14/23 a los 9 gates en verde

- **Worktree:** `mercado-cero-fix-full`
- **Rama:** `p0/fix-full`
- **Base:** `b9e36f7` (`b9e36f77da398e718eb5e712d5a4429bfb5c182a`)
- **Commit de código/tests:** `cec7493` (`cec74939766abe25289d7c8987442c87f6992798`)
- **Fecha:** 2 nov 2026
- **Alcance:** no se tocaron otros worktrees, `:3230` ni la preview. `:3000` no se reinició ni se mató. No hubo merge.

## Resultado por gate

Todos los gates se corrieron por separado; el full completo queda para el orquestador.

| Gate | Antes (full `full-final3.log`) | Después | Evidencia / log |
|---|---|---|---|
| `hig` | FAIL · 5 viewports con timeout en `Pago simulado` | **PASS · HIG OK: 5 viewports** | `%TEMP%\opencode\fix-full\hig.log` · `demo/hig-after/audit.json` |
| `motion` | FAIL · timeout esperando `Hoy $` | **PASS · 19 PASS · 0 FAIL** | `%TEMP%\opencode\fix-full\motion.log` · `harness/evidence/motion-check.json` |
| `contrast` | FAIL · timeout esperando `Hoy $` | **PASS · 7 PASS · 0 FAIL** | `%TEMP%\opencode\fix-full\contrast.log` · `harness/evidence/a11y-contrast.json` |
| `mobile-320` | FAIL · esperaba 42, el script da 60 PASS · 0 FAIL | **PASS · 60 PASS · 0 FAIL** | `%TEMP%\opencode\fix-full\mobile-320.log` · `harness/evidence/mobile-320-e2e.json` |
| `rehearsal` | FAIL · 0/3, marcadores viejos | **PASS · 3/3 · `todo en verde: True` · `REHEARSAL OK`** | `%TEMP%\opencode\fix-full\rehearsal.log` · `demo/rehearsal.json` |
| `p0-venta` | FAIL · 511 ms, servidor `eef1eb…` ≠ `b9e36f7…` | **PASS · 66 PASS · 0 FAIL · 0 KNOWN** | `%TEMP%\opencode\fix-full\p0-venta.log` · `harness/evidence/p0-venta-e2e.json` |
| `p0-fiado` | FAIL · timeout en `Registrar abono` de `Cliente Detalle` (`p0-fiado-e2e.py:670`) | **PASS · 51 PASS · 0 FAIL · 0 KNOWN** | `%TEMP%\opencode\fix-full\p0-fiado.log` · `harness/evidence/p0-fiado-e2e.json` |
| `p0-corte` | FAIL · 67 PASS · 2 FAIL | **PASS · 69 PASS · 0 FAIL · 0 KNOWN** | `%TEMP%\opencode\fix-full\p0-corte.log` · `harness/evidence/p0-corte-e2e.json` |
| `p0-integracion` | FAIL · 48 PASS · 3 FAIL | **PASS · 51 PASS · 0 FAIL · 0 KNOWN** | `%TEMP%\opencode\fix-full\p0-integracion.log` · `harness/evidence/p0-integracion-e2e.json` |

Los otros 14 gates (`guard`, `lint`, `types`, `deps`, `truth`, `webhook`, `mobile`, `checkout`, `security`, `data`, `perf`, `p0-dinero`, `tunnel`, `preflight`) ya venían verdes; no se tocaron. `14 + 9 = 23`.

Además:

- `npm ci` — OK.
- `npm run build` — OK (identidad de build generada).
- `npm run verify:fast` — **3/3 gates OK** sobre `cec7493` (`%TEMP%\opencode\fix-full\verify-fast-final.log`).
- `npm run test:harness` — **58/58 tests OK** (`%TEMP%\opencode\fix-full\test-harness.log`).

## Qué era copy viejo y qué era regresión real

### Copy/selector viejo (sin tocar comportamiento)

- `Pago simulado` → `Pago demo (simulado)` en HIG y rehearsal.
- `Hoy $` → `Ventas registradas hoy` en motion, contrast, HIG, mobile-320, p0-fiado y rehearsal.
- `Hay menos de lo esperado` es el copy neutral actual; los dos asserts de p0-corte que buscaban `Falta` se alinearon a ese texto, **conservando** la comprobación del monto de la diferencia (`$50.00` / `$85.00`). No se debilitó el gate.
- `Esperando banco` → `Esperando confirmación` en p0-integracion (copy canónico de la franja).
- La tarjeta de fiado dejó de ser `div.rounded-2xl`; ahora es `.credit-row`. p0-fiado usa ese contenedor y sigue exigiendo el nombre exacto y el botón por rol.
- La actividad dejó de estar en `div.rounded-2xl`; ahora es `.activity-list`.
- El ensayo esperaba `Resultado del cobro` y `Hoy llevas`, ambos copy retirados. Ahora verifica el título real `Pago demo (simulado)`, que el texto diga `No se entrega.` y que la respuesta de la consulta esté en `.transcript-note` (`Ventas registradas hoy` + `Por cobrar de hoy`).

### Regresiones/bugs reales corregidos

1. **HIG móvil 200 % en checkout y success (regresión real).**
   Al entrar el copy canónico `Pago demo (simulado)`, a 320 px y 200 % de texto la palabra `simulado` se partía. Un primer intento con `overflow-wrap: normal` evitó la partición pero hizo que el grid creciera a 332 px (scroll horizontal). La corrección final en `web/src/app/checkout.css`:
   - `font-size: min(1.75rem, 14.5vw)` para que el título quepa a 320 px/200 % sin perder el tamaño normal.
   - `overflow-wrap: normal` para que parta por espacios, nunca a mitad de palabra.
   - Verificado en los 5 viewports: `HIG OK: 5 viewports`, sin overflow ni palabras partidas. La pantalla demo **no ofrece entrega** (`No se entrega.` y botón de cierre demo); además `payment-truth-e2e.py` ya cubre “el resultado demo no ofrece Listo para entregar” y sigue verde.

2. **p0-venta: carrera contra un servidor viejo en `:3211` (bug del wrapper).**
   El puerto estaba ocupado por un `next start` de `mercado-cero-design-final` (PID 36584) que servía el build `eef1eb…`. El wrapper lanzaba el suyo, pero consultaba `/api/health` antes de que el proceso nuevo tomara el puerto y aceptaba el SHA viejo. Ahora `p0-venta-gate.mjs` comprueba el puerto antes de arrancar y, si está ocupado, usa un puerto efímero libre. No se mató el servidor ajeno. Log: `puerto 3211 ocupado… uso el puerto libre 53878`, `buildSha=b9e36f7…`, 66/66.

3. **p0-integracion: carrera del toast al crear un pendiente (bug del test).**
   `wait_for_text("Pagar al proveedor")` coincidía con el toast `Pendiente anotado: Pagar al proveedor.` antes de que se renderizara la fila. Ahora espera el `h2` real dentro de `ul[aria-label='Pendientes abiertos']`. No se cambió la app. También se corrigió el ancestro de actividad (`.activity-list`) y el copy `Esperando confirmación`.

No se modificó lógica de dinero, webhook, demo/real ni auth.

## Conteos actualizados (con justificación)

- **mobile-320: 42 → 60.** El script tiene 10 `check(...)` por ancho, 2 anchos (320/360) y 3 motores = 60. La corrida da `60 PASS · 0 FAIL`; no hay checks duplicados ni debilitados. Docs `HARNESS.md`, `harness/EVALS.md`, `GOAL-CIERRE-DEMO.md` y `MOTION.md` actualizados.
- **p0-venta: 65 → 66.** El script ejecuta 66 checks (61 llamadas estáticas más los checks que corren por escenario). El JSON da `total: 66`, sin nombres duplicados. El 65 de `harness-gate.mjs` y docs estaba viejo. Docs `HARNESS.md`/`harness/EVALS.md` actualizados.

## Qué falta para el full 23/23

1. Recompilar desde el commit final que se vaya a servir (el merge del orquestador) para sellar el `BUILD_SHA` correcto.
2. Reiniciar `:3000` con ese build (no lo hice: estaba prohibido). Ahora mismo `:3000` sigue sirviendo el build de `b9e36f7`; el full fallará por SHA si no se reinicia.
3. Correr `npm run verify:full` y después `npm run verify:evidence`. El full debe dar 23/23 y `gitAtStart.dirty:false`.
4. El servidor viejo de `mercado-cero-design-final` sigue en `:3211`; ya no bloquea porque el wrapper usa puerto libre. No hace falta matarlo, pero si se prefiere un entorno limpio, detenerlo antes del full es seguro (no es `:3000` ni la preview).

## Nota sobre HIG y `:3000`

HIG y rehearsal se validaron contra el build nuevo en un servidor aislado (`:3216`, SQLite temporal) porque el cambio de CSS vive en `checkout.css` y `:3000` no se podía reiniciar. Motion y contrast se corrieron contra `:3000` porque solo dependen de la Caja, que no cambió. El full debe repetir HIG contra el `:3000` recompilado.
