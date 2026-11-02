# HARNESS — Mercado Cero

> **Qué es:** la capa que hace que un agente trabaje con el contexto correcto, se detenga en las puertas correctas y deje evidencia verificable.
> **Qué no es:** otro framework, otro benchmark ajeno o una excusa para añadir módulos al producto.
>
> Aplicado a partir de **Awesome Harness Engineering** (`walkinglabs/awesome-harness-engineering`), seleccionando las prácticas que sí mueven la aguja en este repo: contexto enrutado, instrucciones repo-local, gates deterministas, evals, observabilidad y autonomía segura.

---

## 1 · Mapa de contexto: qué leer según la tarea

| Si la tarea toca… | Lee primero | Gate mínimo |
|---|---|---|
| Dinero, webhook, `paid`, demo | `GOAL.md`, `AGENTS.md`, `web/src/lib/pey-events.ts` | `verify:full` (webhook + truth + p0-dinero) |
| Interfaz, accesibilidad, HIG | `GOAL-HIG.md`, `HIG-DESIGN.md`, `ACCESIBILIDAD.md` | `verify:full` (HIG + mobile-320) |
| Carga cognitiva, acompañamiento, pendientes | `GOAL-ACOMPANAMIENTO.md` | `verify:full` + pruebas humanas |
| Demo, video, QR, túnel | `RUNBOOK-DEMO.md`, `demo/STATUS.md` | `verify:full` + `preflight` |
| Swarm, carriles, worktrees | `SWARM/README.md`, `harness/templates/LANE-REPORT.md` | `verify:fast` antes del reporte |
| Cambio pequeño de texto o estilo | `AGENTS.md`, este archivo | `verify:fast` |
| Antes de decir “listo” | `harness/STATE.md`, `harness/EVALS.md` | `verify:full` y `verify:evidence` |

**Regla:** no leas todo el repo por reflejo. Lee el contrato de la tarea y el estado actual; luego abre los archivos que el gate o el error señalan.

---

## 2 · Los comandos

Desde `web/`:

```bash
npm run verify:fast      # 3 gates: guard + lint + types
npm run verify:static    # 5 gates: fast + deps + build (con identidad)
npm run verify:full      # 23 gates: runtime + guard/lint/types/deps + contratos + p0
npm run verify:full -- --with-film   # 24 gates (film es opcional)
npm run verify:list      # catálogo y composición de cada modo
npm run verify:evidence  # valida latest.json contra HEAD, árbol y build
npm run harness:report   # tabla Markdown generada desde latest.json
npm run test:harness     # 48 tests del gate y de la integridad de evidencia
```

**Qué corre en cada modo:**

- `fast` = `guard`, `lint`, `types`.
- `static` = `fast` + `deps` + `build`.
- `full` = `guard`, `lint`, `types`, `deps` + los runtime: `truth`, `webhook`, `mobile`, `checkout`, `hig`, `motion`, `contrast`, `mobile-320`, `rehearsal`, `security`, `data`, `perf`, `p0-venta`, `p0-fiado`, `p0-corte`, `p0-integracion`, `p0-dinero`, `tunnel`, `preflight`.
- **`build` no está en `full`**: es un gate de modo `build` y se valida con `verify:static`. `full` exige que el servidor servido tenga el mismo `buildSha` que `gitAtStart.sha`, aunque el build se haya hecho antes con `static` o `npm run build`.
- `film` es opcional y solo entra con `--with-film`.

`verify:full` requiere el servidor de producción en `http://localhost:3000` (o `BASE_URL`) y el túnel vivo para `tunnel`/`preflight`. Si el túnel no está disponible, `--skip=tunnel` ejecuta lo local pero **no** produce `ok: true`: la corrida queda `partial` y no cuenta como demo lista para QR público.

Para una sola puerta:

```bash
npm run verify:full -- --only=truth,webhook
npm run verify:full -- --with-film
```

`--only` produce `mode: "partial"`. Cualquier `--skip` también marca `partial: true`. Ninguno puede quedar `ok: true`; sirven para depurar, no para handoff. La evidencia se escribe en `harness/evidence/runs/<timestamp>-<mode>.json`. Solo una corrida `full` o `static` con `ok: true` escribe `harness/evidence/latest.json`.

**Regla de árbol limpio:** el gate exige `gitAtStart.dirty=false` (incluye untracked, `--untracked-files=all`) y que `gitAtEnd.sha` sea igual al SHA inicial, además de `gitAtEnd.dirty=false`. Los artefactos generados por los gates están en `.gitignore`; escribirlos ya no ensucia el árbol. Si el árbol está sucio, los gates pueden correr para diagnóstico, pero el resultado queda `ok: false` y no es evidencia válida. Commitea primero.

**Identidad del build:** `npm run build` ejecuta `web/scripts/build-gate.mjs`, que fija `BUILD_SHA`/`NEXT_PUBLIC_BUILD_SHA` al `git rev-parse HEAD`, escribe `.next/BUILD_SHA` (ignorado) y compila. `/api/health` devuelve `buildSha`. El harness lo consulta antes de correr gates de runtime y **aborta** si no coincide con `gitAtStart.sha`:

```bash
cd web
npm run build
npm start                 # en otra terminal, con la DB y APP_URL correctos
npm run verify:full       # exige buildSha === HEAD
```

Si cambias de commit, vuelve a construir y reiniciar. Un servidor viejo no es evidencia de este árbol.

---

## 3 · Gates y qué prueba cada uno

Markers exactos: el harness no acepta substrings. `0 FAIL` no coincide con `10 FAIL`, `25/25` no coincide con `125/125`. Cada gate debe imprimir su resumen real.

| Gate | Prueba | Marcador exacto | Artefactos |
|---|---|---|---|
| `guard` | Sin secretos trackeados, `.env.local` ignorado, verdad demo/pey en el código | `Guardrails OK.` | — |
| `lint` | ESLint; wrapper imprime el marcador solo con exit 0 | `LINT OK` | — |
| `types` | `next typegen` + `tsc --noEmit` | `TYPES OK` | — |
| `deps` | `npm audit --omit=dev --audit-level=high`; 0 high/critical | `DEPS OK` | — |
| `build` | Build Next.js con `BUILD_SHA` y `.next/BUILD_SHA`; **solo `static`** | `BUILD OK` + `compiled successfully` | `.next/BUILD_SHA` |
| `truth` | Un `transactionId` demo responde `verified:false` | `VERDAD OK` | — |
| `webhook` | Firma, replay, monto, orden, timestamp, QR, 409/404 | `WEBHOOK OK` + `34/34` | — |
| `mobile` | Flujo completo a 360 px | `MOBILE OK` + `25/25` | `demo/mobile-*` |
| `checkout` | Checkout público a 360 px | `CHECKOUT OK` + `19/19` | `demo/checkout-*` |
| `hig` | HIG/WCAG 2.2 AA, 48 px, 200%, **4 viewports** | `HIG OK` + `4 viewports` | `demo/hig-after/audit.json` |
| `motion` | Duraciones, scroll trigger, reduced-motion | `MOTION OK` + `19 PASS` + `0 FAIL` | `harness/evidence/motion*` |
| `contrast` | Alto contraste: axe, foco visible y 360 px | `CONTRAST OK` + `0 FAIL` | `harness/evidence/a11y-contrast*` |
| `mobile-320` | HIG móvil 320/360 en Chromium, Firefox y WebKit | `MOBILE 320/360 E2E` + `42 PASS` + `0 FAIL` | `mobile-320-e2e.json` + capturas 320/360 |
| `rehearsal` | Guion completo, 3 corridas, 15 pasos por corrida | `REHEARSAL OK` + `todo en verde: True` | `demo/rehearsal.json` |
| `security` | CSRF, token de reset, límites, rate limit, headers, backups | `SEGURIDAD OK` | — |
| `data` | Idempotencia, transacciones, migraciones y enlaces; **85 checks (58+20+7)** | `DATOS OK` + `P0 FIX DATOS` + `P0 DB GUARDS` + `P0 ORDERS ATOMIC` | - |
| `perf` | Presupuesto de JS, CSS, fuentes, fotos e iconos | `PERF BUDGET OK` | — |
| `p0-venta` | Venta durable, draft, validaciones, monto y cambio | `65 PASS` + `0 FAIL` + `0 KNOWN` | `harness/evidence/p0-venta-e2e.json` |
| `p0-fiado` | Abono confirmado, saldo vivo, idempotencia | `51 PASS` + `0 FAIL` + `0 KNOWN` | `p0-fiado-e2e.json` + captura |
| `p0-corte` | Corte no destructivo, versiones, migración, 409 | `69 PASS` + `0 FAIL` + `0 KNOWN` | `p0-corte-e2e.json` + capturas |
| `p0-integracion` | Pendientes, tareas, venta mixta, carrera de refresco | `51 PASS` + `0 FAIL` + `0 KNOWN` | `p0-integracion-e2e.json` + capturas |
| `p0-dinero` | Dinero, webhook, verify, fiado, corte, negativos | `45 PASS` + `0 FAIL` + `3 KNOWN` | `p0-dinero-e2e.json` |
| `tunnel` | Camino público HTTPS por Cloudflare | `TUNNEL OK` + `8/8` | `demo/tunnel-*` |
| `preflight` | Servidor, túnel, datos, QR y respaldos | `PREFLIGHT OK` + `18/18` | — |
| `film` | 8 beats + contact sheet + motion sheet; opcional | `FILM OK` + `SHEET` | `demo/stageshow/film-check.json` + hojas |

**Aritmética del catálogo:** hay **25 gates** en total. `fast` ejecuta 3, `static` 5 y `full` **23** por defecto (sin `build`, sin `film`). Con `--with-film`, `full` ejecuta 24. Cualquier marcador de un catálogo anterior (menos gates, motion con menos comprobaciones o webhook con 27 aserciones) es histórico y no describe el catálogo actual.

**Cobertura p0:** los cinco gates p0 levantan su propio `next start` aislado con SQLite temporal (puertos 3211–3213) y nunca usan la base de la demo compartida. `p0-venta` usa un wrapper (`p0-venta-gate.mjs`) porque el script original esperaba un servidor externo; `mobile-320` usa `mobile-320-gate.mjs` para lo mismo con 3 motores. Los puertos aislados viven en 3190+ (`security` 3191, `data` 3192, `mobile-320` 3214) o 3211–3213 (p0), siempre con DB temporal; nunca el `:3000` de demo. Los scripts respetan `BASE_URL`, `RUNTIME_BASE_URL`, `CHECKOUT_BASE_URL`, `MOBILE_BASE_URL`, `P0_BASE_URL`, `MOTION_BASE_URL` y `CONTRAST_BASE_URL`; el harness fija los que comparten servidor y registra `baseUrl` por gate.

El detalle de cada eval, incluyendo las que son **solo humanas**, está en `harness/EVALS.md`.

---

## 4 · Evidencia v2 y handoff

`harness/evidence/latest.json` sigue este esquema:

- `schemaVersion: 2`, `mode`, `requestedMode`, `partial`, `ok`, `complete`, `gatesOk`, `buildBound`.
- `startedAt`, `endedAt`, `durationMs`, `baseUrl`, `serverBuildSha`, `buildMatches`, `node`, `os`, `python`.
- `gitAtStart { sha, branch, dirty }` y `gitAtEnd { sha, branch, dirty }`.
- `expectedGates[]`, `criticalGates[]`, `skipped[]`, `notRun[]`, `notRunReasons{}`, `resets[]`.
- `gates[]`: `id`, `name`, `command`, `baseUrl`, `buildSha`, `ok`, `exitCode`, `reason`, `durationMs`, `expected`, `expectedBasis`, `expectedMatched`, `artifacts[]` y `outputTail` redactado. `buildSha` se cruza con `gitAtStart.sha` en cada gate de runtime.
- `artifacts[]`: cada uno con `path` relativo, `exists`, `sha256` y `size`. `verify:evidence` recomputa el hash y el tamaño.
- `missing`, `criticalMissing`, `reasons`, `error`.

**Reglas de honestidad del `ok`:**

1. Se ejecutaron **todos** los gates del modo (o todos los de `--only`, pero entonces `mode: "partial"` y `ok: false`).
2. Todos los gates tienen `ok: true`, `exitCode: 0`, `reason: "ok"` y `expectedMatched: true`.
3. Cada `expected` aparece en la salida con límites de palabra; un exit 0 con el marcador ausente es `FAIL`.
4. Los artefactos declarados existen y su `sha256`/`size` coinciden.
5. No hay `skipped` ni `notRun` de gates críticos.
6. `gitAtStart.dirty === false`, `gitAtEnd.sha === gitAtStart.sha`, `gitAtEnd.dirty === false`.
7. `serverBuildSha === gitAtStart.sha` y `buildBound: true`.
8. `latest.json` es de este HEAD: `npm run verify:evidence` compara `gitAtStart.sha` con `git rev-parse HEAD` y exige el árbol actual limpio.

**Sobre el SHA y el archivo de evidencia:** `latest.json` **no se versiona** (está en `.gitignore`). Se escribe únicamente al final de una corrida `full` o `static` con `ok: true`. Las corridas `partial` o fallidas van solo a `harness/evidence/runs/` y **no pisan** el handoff anterior. El flujo correcto es: commitear código y docs → construir desde ese commit → correr el gate sobre el árbol limpio → ejecutar `verify:evidence` contra ese HEAD → dejar `latest.json` como artefacto local de handoff. `runs/` también es local/ignorado.

**Artefactos generados, no versionados:** los JSON/PNG de mobile, checkout, motion, contraste, mobile-320, p0, rehearsal, tunnel y film; y `harness/evidence/runs/` + `latest.json`. El QR (`demo/qr-demo.*`) y el video son **entregables** y se versionan aparte; el full no los reescribe. `demo/hig-after/` es generado e ignorado.

**Reporte desde la evidencia:** `npm run harness:report` imprime la tabla Markdown de `latest.json`, con SHA, buildSha, gates, artefactos y no ejecutados. Copia esa tabla a `STATE.md`; no la escribas de memoria.

---

## 5 · Guardrails

- `web/scripts/harness-guard.mjs` falla si `.env.local` o un `.env` real está trackeado, si hay un secreto con pinta de real en archivos versionados, o si la ruta demo/pey perdió sus invariantes.
- `web/scripts/check-deps.mjs` falla si `npm audit --omit=dev --audit-level=high` encuentra vulnerabilidades `high` o `critical` en dependencias de producción. Los `moderate`/`low` se reportan pero no bloquean este gate.
- El gate **no** inicia ni reinicia el servidor principal por su cuenta. El runtime es un recurso compartido; el agente lo arranca explícitamente y el gate solo verifica. Los gates p0 sí levantan servidores aislados y los limpian.
- El gate **sí** reinicia los datos de demo antes de `truth` y `preflight` para que la evidencia sea reproducible.
- Ningún gate toca el pago real. El pago de $0.01, la cuenta pey, el webhook secret, el merge a `master` y el deploy son **puertas humanas**.
- **CI:** `.github/workflows/harness.yml` corre en push/PR `test:harness`, `verify:static`, `test:security`, `test:fix-datos`, `test:perf-budget` y `test:perf-data`. El job `full-release` (schedule/workflow_dispatch, runner self-hosted con secretos y túnel) corre `verify:full` + `verify:evidence` contra un servidor construido desde HEAD. No arranca túneles desde CI.

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

1. Añade el comando a `web/scripts/harness-gate.mjs` con `id`, `name`, `mode` (`static`, `runtime` o `build`), `timeout`, `expected` (string o array), `expectedBasis`, `artifacts` y `optional` si aplica. Si el comando es silencioso en verde, envuélvelo para que imprima un marcador real; no pongas un `expected` decorativo ni uses substrings ambiguos.
2. Añade la fila a `harness/EVALS.md` con lo que prueba y lo que **no** prueba.
3. Hazlo determinista: reset de demo si muta, timeout, salida sin secretos, exit code real y marcador verificable.
4. Si produce archivos, declara `artifacts` para que el schema guarde hash/tamaño. Añade el path a `.gitignore`.
5. Añade o actualiza un test en `web/scripts/*.test.mjs` y corre `npm run test:harness`.
6. Si el gate es visual, guarda el artefacto y una nota; no conviertas una captura en prueba de negocio.
7. Corre `verify:static`, luego `verify:full` en el servidor/túnel correctos, y actualiza `harness/STATE.md` con la tabla de `harness:report`.

**No añadas `build` a `full`:** el build vive en `static` porque muta `.next/` y no necesita el runtime. `film` es opcional y solo se pide con `--with-film`.

---

## 8 · Protocolo de fallo

1. **Detente.** No “arregles” bajando el estándar, saltando un test o cambiando el umbral.
2. Lee la cola de salida y el artefacto del gate.
3. Identifica la causa raíz; si es de producto, corrige producto; si es del gate, corrige el gate.
4. Vuelve a correr el gate afectado y luego `verify:full`.
5. Si el fallo es humano (banco, teléfono, persona), regístralo en `harness/STATE.md`; no lo maquilles.

---

## 9 · Definición de “listo”

- `npm run test:harness` en verde: **48/48** tests del gate y de la integridad de evidencia.
- `verify:static` en verde sobre un árbol limpio: **5/5** (`guard`, `lint`, `types`, `deps`, `build`).
- `verify:full` en verde: **23/23** por defecto o **24/24** con `--with-film`. Si algún gate no aplica, se justifica en `STATE.md`; un `--skip` deja `partial` y `ok:false`.
- `npm run verify:evidence` PASS contra el HEAD entregado: `gitAtStart.sha === HEAD`, `gitAtStart.dirty:false`, árbol actual limpio, `serverBuildSha === gitAtStart.sha`, `complete:true`, todos los `expected` validados y todos los artefactos con hash correcto.
- `latest.json` con `ok: true` y `mode` real (`full`/`static`); nunca `partial` ni `fast` sin `--allow-fast`.
- Sin secretos en el diff.
- Si tocó dinero: webhook **34/34**, truth PASS y `p0-dinero` **45 + 3 KNOWN**.
- Si tocó UI: HIG **4 viewports**, mobile **25/25**, checkout **19/19**, motion **19 PASS**, contraste 0 FAIL y mobile-320 **42/42** en 3 motores.
- Si tocó demo: preflight + túnel + video/QR actualizados.
- Handoff actualizado con `npm run harness:report`; las pruebas humanas no se sustituyen por gates.

## 10 · Prácticas aplicadas del catálogo

- **Instrucciones repo-local y contexto enrutado:** `AGENTS.md` + este `HARNESS.md`.
- **Gates deterministas y evals:** `harness/EVALS.md` + `web/scripts/harness-gate.mjs`.
- **Identidad de build:** `build-gate.mjs`, `.next/BUILD_SHA` y `/api/health`.
- **Observabilidad:** evidencia v2 con commit de inicio/fin, buildSha, duración, artefactos con hash, salida redactada y resets.
- **Integridad de evidencia:** `web/scripts/verify-evidence.mjs` compara SHA/dirty/build/complete/artefactos.
- **Handoff entre contextos:** `harness/STATE.md` + `harness:report`.
- **Autonomía segura:** guardrails de secretos, `demo_paid`, puertas humanas.
- **Spec-driven:** `GOAL.md`, `GOAL-HIG.md`, `GOAL-ACOMPANAMIENTO.md`.
- **Verificación antes de terminar:** ningún “listo” sin `latest.json` + `verify:evidence`.

Referencias primarias que inspiran estas decisiones: OpenAI *Harness engineering*, Anthropic *Effective harnesses for long-running agents*, `AGENTS.md`, HumanLayer *12 Factor Agents*, y las guías de evals de OpenAI/Anthropic. No se copió código ni se añadió una dependencia.
