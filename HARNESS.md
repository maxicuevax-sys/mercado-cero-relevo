# HARNESS — Mercado Cero

> **Qué es:** la capa que hace que un agente trabaje con el contexto correcto, se detenga en las puertas correctas y deje evidencia verificable.
> **Qué no es:** otro framework, otro benchmark ajeno o una excusa para añadir módulos al producto.
>
> Aplicado a partir de **Awesome Harness Engineering** (`walkinglabs/awesome-harness-engineering`), seleccionando las prácticas que sí mueven la aguja en este repo: contexto enrutado, instrucciones repo-local, gates deterministas, evals, observabilidad y autonomía segura.

---

## 1 · Mapa de contexto: qué leer según la tarea

| Si la tarea toca… | Lee primero | Gate mínimo |
|---|---|---|
| Dinero, webhook, `paid`, demo | `GOAL.md`, `AGENTS.md`, `web/src/lib/pey-events.ts` | `verify:full` (webhook + truth) |
| Interfaz, accesibilidad, HIG | `GOAL-HIG.md`, `HIG-DESIGN.md`, `ACCESIBILIDAD.md` | `verify:full` (HIG) |
| Carga cognitiva, acompañamiento, pendientes | `GOAL-ACOMPANAMIENTO.md` | `verify:full` + pruebas humanas |
| Demo, video, QR, túnel | `RUNBOOK-DEMO.md`, `demo/STATUS.md` | `verify:full` + `preflight` |
| Swarm, carriles, worktrees | `SWARM/README.md`, `harness/templates/LANE-REPORT.md` | `verify:fast` antes del reporte |
| Cambio pequeño de texto o estilo | `AGENTS.md`, este archivo | `verify:fast` |
| Antes de decir “listo” | `harness/STATE.md`, `harness/EVALS.md` | `verify:full` y `latest.json` |

**Regla:** no leas todo el repo por reflejo. Lee el contrato de la tarea y el estado actual; luego abre los archivos que el gate o el error señalan.

---

## 2 · Los comandos

Desde `web/`:

```bash
npm run verify:fast      # 3 gates: guard + lint + types
npm run verify:static    # 5 gates: fast + deps + build
npm run verify:full      # 14 gates: runtime + guard/lint/types/deps
npm run verify:full -- --with-film   # 15 gates (film es opcional)
npm run verify:list      # catálogo y composición de cada modo
npm run verify:evidence  # valida latest.json contra el HEAD actual
npm run test:harness     # tests del propio gate (44)
```

**Qué corre en cada modo:**

- `fast` = `guard`, `lint`, `types`.
- `static` = `fast` + `deps` + `build`.
- `full` = `guard`, `lint`, `types`, `deps` + los 10 runtime (`truth`, `webhook`, `mobile`, `checkout`, `hig`, `motion`, `contrast`, `rehearsal`, `tunnel`, `preflight`). **`build` no está en `full`**: es un gate de modo `build` y se valida con `verify:static`. `film` es opcional y solo entra con `--with-film`.

`verify:full` requiere el servidor de producción en `http://localhost:3000` y el túnel vivo. Si el túnel no está disponible, `--skip=tunnel` ejecuta lo local pero **no** produce `ok: true`: un gate crítico saltado no está verde y no cuenta como demo lista para QR público.

Para una sola puerta:

```bash
npm run verify:full -- --only=truth,webhook
npm run verify:full -- --with-film
```

`--only` produce `mode: "partial"` y **nunca** `ok: true`; sirve para depurar, no para handoff. La evidencia se escribe en `harness/evidence/latest.json` y en `harness/evidence/runs/<timestamp>-<mode>.json` (los runs y `latest.json` son artefactos locales; `latest.json` es el handoff y no se versiona).

**Regla de árbol limpio:** el gate exige `gitAtStart.dirty=false` (incluye untracked, `--untracked-files=all`) y que `gitAtEnd.sha` sea igual al SHA inicial. Si el árbol está sucio, los gates pueden correr para diagnóstico, pero el resultado queda `ok: false` y no es evidencia válida. Commitea primero.

---

## 3 · Gates y qué prueba cada uno

| Gate | Prueba | Mutación | Tiempo |
|---|---|---|---|
| `guard` | Sin secretos trackeados, `.env.local` ignorado, verdad demo/pey en el código | No | < 1 s |
| `lint` | ESLint sin errores; marcador `eslint` + exit code | No | ~5 s |
| `types` | `next typegen` + `tsc --noEmit`; imprime `TYPES OK` | No | ~10 s |
| `deps` | `npm audit --omit=dev --audit-level=high`; 0 high/critical | No | ~3 s |
| `build` | Build de producción Next.js; **solo en `--static`** | `.next/` | ~45 s |
| `truth` | Un `transactionId` demo responde `verified:false` | Reset demo | ~1 s |
| `webhook` | Firma, replay, monto, orden, timestamp, QR; 27/27 | Reset demo | ~3 s |
| `mobile` | Flujo completo a 360 px; 25/25 | Reset demo | ~10 s |
| `checkout` | Checkout público a 360 px; 15/15 | Crea y paga orden | ~10 s |
| `hig` | HIG/WCAG 2.2 AA, 48 px, 200%, 360/390/768/1280 | Reset/recorre | ~60 s |
| `motion` | Duraciones, scroll trigger, reduced-motion; `15 PASS · 0 FAIL` | Recorre hojas/tabs | ~8 s |
| `contrast` | Alto contraste: axe, foco visible y 360 px; `0 FAIL` | Recorre | ~4 s |
| `rehearsal` | Guion completo 3 corridas; 15 pasos por corrida | Reset/recorre | ~15 s |
| `tunnel` | Camino público por Cloudflare; 8/8 | Reset/paga | ~20 s |
| `preflight` | Servidor, túnel, datos, QR y respaldos; 18/18 | Reset demo | ~5 s |
| `film` | 8 beats + contact sheet + motion sheet; opcional | Reset/recorre | ~15 s |

**Aritmética del catálogo (para que no se contradiga):** hay **16 gates** en total. `fast` ejecuta 3, `static` ejecuta 5 y `full` ejecuta **14** por defecto (sin `build`, sin `film`). Con `--with-film`, `full` ejecuta 15. Las menciones históricas a “13/13” o “13/15” corresponden al catálogo anterior a `deps`; ya no describen el gate actual. `motion-check.py` son **15 comprobaciones** (`15 PASS · 0 FAIL`), no 14.

El detalle de cada eval, incluyendo las que son **solo humanas**, está en `harness/EVALS.md`.

---

## 4 · Evidencia y handoff

`harness/evidence/latest.json` contiene:

- `gitAtStart` y `gitAtEnd`: `sha`, `branch`, `dirty`. `dirty` incluye untracked.
- `mode` (`fast`/`static`/`full`/`partial`), `requestedMode`, `partial`, `baseUrl`, `startedAt`, `finishedAt`, `durationMs`.
- `expectedGates[]`, `criticalGates[]`, `skipped[]`, `notRun[]` y `notRunReasons{}`.
- `gates[]`: id, comando, `ok`, `exitCode`, duración, `expected`, `expectedBasis`, `expectedMatched`, `reason` y cola de salida redactada.
- `complete`, `gatesOk`, `evidenceValid`, `cleanStart`, `cleanEnd`, `shaStable`, `missing`, `criticalMissing`, `reasons`.
- `resets[]`: cuándo se reinició la demo.
- `ok` global.

**Reglas de honestidad del `ok`:**

1. Se ejecutaron **todos** los gates del modo (o todos los de `--only`, pero entonces `mode: "partial"` y `ok: false`).
2. Todos los gates tienen `ok: true`.
3. Cada `expected` no nulo aparece en la salida (`expectedMatched: true`). Un exit 0 con un marcador ausente es `FAIL`.
4. No hay `skipped` ni `notRun` de gates críticos.
5. `gitAtStart.dirty === false`, `gitAtEnd.sha === gitAtStart.sha` y `gitAtEnd.dirty === false`.
6. `latest.json` es de este HEAD: `npm run verify:evidence` compara `gitAtStart.sha` con `git rev-parse HEAD`.

**Sobre el SHA y el archivo de evidencia:** `latest.json` **no se versiona** (está en `.gitignore`). Se escribe al final de la corrida sobre el HEAD actual; por eso su `gitAtStart.sha` se puede comparar con `git rev-parse HEAD` sin quedar obsoleto en un commit posterior. Si se commiteara, el HEAD cambiaría y el archivo pasaría a atestiguar el commit anterior; `verify:evidence` lo rechazaría. El flujo correcto es: commitear código y docs → correr el gate sobre el árbol limpio → ejecutar `verify:evidence` contra ese HEAD → dejar `latest.json` como artefacto local de handoff. `runs/` también es local/ignorado.

**Ceguera de artefactos:** en un `full`, `verify:evidence` cruza `harness/evidence/motion-check.json` y `harness/evidence/a11y-contrast.json` contra el mismo SHA y exige `code.dirty:false`. Si el carril a11y cambia esos scripts, debe dejar el registro de commit/dirty coherente. `demo/hig-after/audit.json` está ignorado por git; si no existe, se reporta como warning, no como verde.

`harness/STATE.md` es el handoff vivo: qué está verde, qué falta, qué está bloqueado y cuál es la siguiente acción. Se actualiza al cerrar una tarea; no se reconstruye de memoria.

---

## 5 · Guardrails

- `web/scripts/harness-guard.mjs` falla si `.env.local` o un `.env` real está trackeado, si hay un secreto con pinta de real en archivos versionados, o si la ruta demo/pey perdió sus invariantes.
- `web/scripts/check-deps.mjs` falla si `npm audit --omit=dev --audit-level=high` encuentra vulnerabilidades `high` o `critical` en dependencias de producción. Los `moderate`/`low` se reportan pero no bloquean este gate.
- El gate **no** inicia ni reinicia el servidor por su cuenta. El runtime es un recurso compartido; el agente lo arranca explícitamente y el gate solo verifica.
- El gate **sí** reinicia los datos de demo antes de `truth` y `preflight` para que la evidencia sea reproducible.
- Ningún gate toca el pago real. El pago de $0.01, la cuenta pey, el webhook secret, el merge a `master` y el deploy son **puertas humanas**.

---

## 6 · Autonomía segura

| Acción | ¿Agente solo? |
|---|---|
| Leer, medir, proponer, correr gates | Sí |
| Editar código y docs en una rama/worktree | Sí, con gate |
| Reiniciar demo (`POST /api/demo/reset`) | Sí, es reversible |
| Crear un cobro demo | Sí, marcado `demo_paid` |
| Confirmar un pago real | **No** |
| Crear cuenta pey / tocar API keys | **No** |
| Merge a `master` | **No**; lo hace el orquestador con revisión |
| Deploy final | **No** |
| Declarar accesibilidad completa sin dispositivo/lector real | **No** |

El criterio no es “cuánto puede hacer el agente”, sino **cuánto puede hacer sin que nadie tenga que reconstruir la verdad después**.

---

## 7 · Cómo añadir un gate

1. Añade el comando a `web/scripts/harness-gate.mjs` con `id`, `name`, `mode` (`static`, `runtime` o `build`), `timeout`, `expected`, `expectedBasis` y `optional` si aplica. Si el comando es silencioso en verde, envuélvelo para que imprima un marcador real; no pongas un `expected` decorativo.
2. Añade la fila a `harness/EVALS.md` con lo que prueba y lo que **no** prueba.
3. Hazlo determinista: reset de demo si muta, timeout, salida sin secretos, exit code real y marcador verificable.
4. Añade o actualiza un test en `web/scripts/*.test.mjs` y corre `npm run test:harness`.
5. Si el gate es visual, guarda el artefacto y una nota; no conviertas una captura en prueba de negocio.
6. Corre `verify:static`, luego `verify:full` en el servidor/túnel correctos, y actualiza `harness/STATE.md` con el SHA real.

**No añadas `build` a `full`:** el build vive en `static` porque muta `.next/` y no necesita el runtime. `film` es opcional y solo se pide con `--with-film`.

---

## 8 · Protocolo de fallo

1. **Detente.** No “arregles” bajando el estándar, saltando un test o cambiando el umbral.
2. Lee la cola de salida y el artifact del gate.
3. Identifica la causa raíz; si es de producto, corrige producto; si es del gate, corrige el gate.
4. Vuelve a correr el gate afectado y luego `verify:full`.
5. Si el fallo es humano (banco, teléfono, persona), regístralo en `harness/STATE.md`; no lo maquilles.

---

## 9 · Definición de “listo”

- `npm run test:harness` en verde (tests del gate, no de la app).
- `verify:static` en verde sobre un árbol limpio: **5/5** (`guard`, `lint`, `types`, `deps`, `build`).
- `verify:full` en verde: **14/14** por defecto o **15/15** con `--with-film`. Si algún gate no aplica, se justifica en `STATE.md`; un `--skip` de un gate crítico deja `ok:false` y no cuenta.
- `npm run verify:evidence` PASS contra el HEAD entregado: `gitAtStart.sha === HEAD`, `gitAtStart.dirty:false`, `gitAtEnd.sha` igual, `complete:true`, todos los `expected` validados.
- `latest.json` con `ok: true` y `mode` real (`fast`/`static`/`full`); nunca `partial`.
- Sin secretos en el diff.
- Si tocó dinero: webhook 27/27 y truth PASS.
- Si tocó UI: HIG/WCAG + móvil/checkout.
- Si tocó demo: preflight + túnel + video/QR actualizados.
- Handoff actualizado con riesgos y pendientes reales; las pruebas humanas no se sustituyen por gates.

## 10 · Prácticas aplicadas del catálogo

- **Instrucciones repo-local y contexto enrutado:** `AGENTS.md` + este `HARNESS.md`.
- **Gates deterministas y evals:** `harness/EVALS.md` + `web/scripts/harness-gate.mjs`.
- **Observabilidad:** evidencia JSON con commit de inicio/fin, duración, salida redactada, resets y validación de `expected`.
- **Integridad de evidencia:** `web/scripts/verify-evidence.mjs` compara SHA/dirty/complete y cruza motion/contraste.
- **Handoff entre contextos:** `harness/STATE.md` + `harness/templates/LANE-REPORT.md`.
- **Autonomía segura:** guardrails de secretos, `demo_paid`, puertas humanas.
- **Spec-driven:** `GOAL.md`, `GOAL-HIG.md`, `GOAL-ACOMPANAMIENTO.md`.
- **Verificación antes de terminar:** ningún “listo” sin `latest.json`.

Referencias primarias que inspiran estas decisiones: OpenAI *Harness engineering*, Anthropic *Effective harnesses for long-running agents*, `AGENTS.md`, HumanLayer *12 Factor Agents*, y las guías de evals de OpenAI/Anthropic. No se copió código ni se añadió una dependencia.
