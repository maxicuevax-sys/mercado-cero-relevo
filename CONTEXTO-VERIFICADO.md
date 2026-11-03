# Contexto verificado — índice de fuentes

> **Qué es esto:** el contexto y las auditorías se importaron a esta rama para
> que no dependan de worktrees externos. **No se copió app ni código.** Los
> archivos conservan el texto de su commit de origen; este índice dice qué
> sigue vigente y qué es histórico.
>
> **Snapshot actual:** 2 nov 2026, 22:40. Rama `p0/consolidacion`, base
> `fabe7cc` + commit de docs; `master` `a85d903`. La verdad operativa está en
> `RELEVO-VERIFICADO.md` y `HANDOFF-CIERRE.md`; este documento solo navega las
> fuentes.

## 1. Mapa de lo importado

| Origen | Commit | Archivos en esta rama | Qué es |
|---|---|---|---|
| `p0/context-recovery` | `ea1292e` | `context/00-INDEX.md` … `07-GLOSARIO.md`, `context/state.json`, `context/context-recovery-report.md` | Contexto reconstruido desde Git/código/docs. Snapshot de `b7154ca` (21:43), actualizado 21:56. |
| `p0/supervisor` | `ca3f95c` | `SUPERVISION-RELEVO.md`, `CORRECCIONES-HANDOFF.md`, `supervisor-report.md`, `supervision.json` | Auditoría del handoff y del estado de cierre; 49 claims, veredicto NO LISTO. Base `b7154ca`/`master d35c791`. |
| `p0/adversarial` | `3939133` | `AUDITORIA-ADVERSARIA.md`, `adversarial-report.md`, `adversarial.json` | Auditoría adversaria de código/runtime; 2 P0, 5 P1, 7 P2; base `b7154ca`. |
| Esta rama | `fabe7cc` + docs | `fix-adversarial-report.md` | Reporte del fix P0/P1; código en `ac9e5a6`, merge en `2a1f166`. |

> Los commits de origen no son ancestros de esta rama: los archivos se
> importaron con `git checkout <rama> -- <archivo>`, no con merge. No se copió
> `web/` ni ningún otro código de esos worktrees.

## 2. Qué está vigente y qué es histórico

### Vigente (usar como estado actual)

| Archivo | Por qué |
|---|---|
| `RELEVO-VERIFICADO.md` | Página de entrada con SHAs, hechos, pendientes y comandos verificados. |
| `HANDOFF-CIERRE.md` | Handoff operativo reescrito desde cero para `fabe7cc`; incluye P0/P1, E2E y orden de cierre. |
| `consolidation-report.md` | Método, contradicciones resueltas y límites de esta consolidación. |
| `RELEVO/claims.json` | Tabla máquina-legible de claims con estado y evidencia. |
| `GOAL-CIERRE-DEMO.md` | DoD y fases; ya actualizado con `fabe7cc`/`a85d903`, data 85 y preview viva. |
| `demo/STATUS.md` | Estado de demo actualizado; conserva tablas históricas marcadas. |
| `RUNBOOK-DEMO.md` | Operación actualizada; conserva cifras históricas marcadas. |
| `harness/STATE.md` | Corte actual y bloqueos del harness actualizados. |

### Histórico (no citar como estado actual)

| Archivo | Por qué es histórico |
|---|---|
| `context/*` | Snapshot de `b7154ca`/`2a786f1` a las 21:43–21:56. No conoce `ac9e5a6`, `2a1f166` ni `fabe7cc`; sus P0/P1 ya están corregidos y sus SHAs de master/final están viejos. Sigue siendo útil para producto, invariantes, rutas, DB y riesgos. |
| `SUPERVISION-RELEVO.md`, `supervision.json`, `supervisor-report.md` | Auditoría de `b7154ca`/`d35c791`; 23 commits de diferencia, P0 abiertos entonces. Metodología y contradicciones siguen siendo valiosas; los veredictos de estado no. |
| `CORRECCIONES-HANDOFF.md` | Propuestas no aplicadas en su momento; varias ya se aplicaron en este handoff o quedaron obsoletas. No es una lista de pendientes actual. |
| `AUDITORIA-ADVERSARIA.md`, `adversarial.json`, `adversarial-report.md` | Auditoría de `b7154ca`; 5 hallazgos corregidos después. Los P2 abiertos y la metodología siguen vigentes; los P0/P1 hay que leerlos con el fix (`fix-adversarial-report.md` + código actual). |
| `fix-adversarial-report.md` | Reporte del fix; sus conteos y PASS son hipótesis hasta contrastarlos. Ver §3. |

## 3. Claims de las auditorías: qué pasó

### P0/P1 del adversarial (`b7154ca` → `fabe7cc`)

| Hallazgo | Estado actual | Dónde se verificó |
|---|---|---|
| P0-1 reset borra pago pey firmado | **Corregido** | `db.ts:1997-2078`, `reset/route.ts`; E2E 28/28 (build `2a1f166`). |
| P0-2 `/` con `public, s-maxage=60` | **Corregido** | `next.config.ts:187-193`; header `private, no-store` en `:3302`; E2E. |
| P1-1 webhook demo produce `paid` | **Corregido** para el camino probado | `orders.ts:669-687,967-977`, `db.ts:1794-1808`; E2E. |
| P1-2 sin auth de sesión | **Abierto (limitación)** | No hay middleware/sesión; `SECURITY.md`. |
| P1-3 verify acepta PAID sin refs | **Corregido** | `verify/route.ts:212-248`; E2E con mock. |
| P1-4 checkout/success HTTP 200 | **Abierto** | GET a `:3230` y `:3302`: 200; body correcto. |
| P1-5 totales sobre 50/100 filas | **Corregido en honestidad, no paginación completa** | `dashboard.ts`, `db.ts`, UI; E2E con 52/102. |

### Contradicciones de la supervisión que ya no aplican

La supervisión decía `master = d35c791`, final `b7154ca`, 23 commits, build
`e6f3107`, `:3000` caído, preview `397039d`, `latest` ausente y P0 abiertos.
Hoy: `master = a85d903`, final `fabe7cc`, **28 commits**, build conocido
`2a1f166`, `:3000` sigue caído, preview `397039d`, `latest` sigue ausente y
P0 corregidos. **El veredicto "NO LISTO" sigue vigente**, pero por otras
razones: full/evidencia, servidor, túnel/QR, video y P1-4/P1-2.

### Cifras que hay que corregir al citar

- **Data:** 85 checks (58+20+7), no 123 (`HARNESS.md:97`).
- **Security:** 52 checks en el script actual (48 del audit + 4 del fix); el
  audit de `b7154ca` reportó 48.
- **Build:** `e6f3107` y `397039d` son históricos; el build conocido es
  `2a1f166`; la base de código es `fabe7cc` y el HEAD del worktree añade docs.
- **Commits adelante:** 28, no 23/24.
- **Túnel:** `timing...` muerto; `involve...` vivo pero sirve `397039d`.
- **PID 13932:** es el `cloudflared` de `:3000`, no la preview `:3230`.

## 4. Cómo usar estas fuentes sin engañarte

1. Para **operar**: `RELEVO-VERIFICADO.md` → `HANDOFF-CIERRE.md`.
2. Para **entender el producto y el dinero**: `context/02-PRODUCTO.md`,
   `context/03-DECISIONES.md`, `GOAL.md` y `web/src/lib/payment-rules.ts`.
3. Para **saber qué se probó**: `context/05-EVIDENCIA.md` (histórico) y luego
   los artefactos actuales (`harness/evidence/`, `%TEMP%\opencode\...`). Si no
   hay JSON con `gitAtStart.sha`/`buildSha`/`dirty:false`, es **NO VERIFICADO**.
4. Para **los hallazgos**: `AUDITORIA-ADVERSARIA.md` como hipótesis; contrastar
   con `fix-adversarial-report.md` y, sobre todo, con el código actual.
5. Para **el método**: `SUPERVISION-RELEVO.md` y `consolidation-report.md`
   muestran cómo se detectaron afirmaciones falsas/obsoletas.

## 5. Reglas de lectura

- **`VERIFICADO`**: observado en Git, código, test o HTTP de solo lectura.
- **`FALSO`**: la fuente primaria lo contradice.
- **`OBSOLETO`**: fue cierto o describe otro SHA/estado.
- **`NO VERIFICADO`**: solo hay un documento o no se ejecutó.
- Un reporte no es evidencia de sí mismo. Un `PASS` sin JSON/SHA no cuenta
  para el cierre.
- Los archivos importados **no se editan** aquí: si hay una contradicción, se
  resuelve en `RELEVO-VERIFICADO.md`, `HANDOFF-CIERRE.md` o
  `consolidation-report.md`, no reescribiendo la auditoría.
