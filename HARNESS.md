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

## 2 · Los cuatro comandos

Desde `web/`:

```bash
npm run verify:fast     # guardrails + lint + TypeScript
npm run verify:static   # fast + build de producción
npm run verify:full     # runtime completo: verdad, webhook, móvil, checkout, HIG, ensayo, túnel, preflight
npm run verify:list     # catálogo de gates
```

`verify:full` requiere el servidor de producción en `http://localhost:3000` y el túnel vivo. Si el túnel no está disponible, se puede correr `npm run verify:full -- --skip=tunnel` para verificar todo lo local; **no** cuenta como demo lista para QR público.

Para una sola puerta:

```bash
npm run verify:full -- --only=truth,webhook
npm run verify:full -- --with-film
```

La evidencia se escribe en `harness/evidence/latest.json` y en `harness/evidence/runs/<timestamp>-<mode>.json` (los runs son locales; `latest.json` es el handoff).

---

## 3 · Gates y qué prueba cada uno

| Gate | Prueba | Mutación | Tiempo |
|---|---|---|---|
| `guard` | Sin secretos trackeados, `.env.local` ignorado, verdad demo/pey en el código | No | < 1 s |
| `lint` | ESLint sin errores | No | ~5 s |
| `types` | TypeScript sin errores | No | ~10 s |
| `build` | Build de producción Next.js | `.next/` | ~20 s |
| `truth` | Un `transactionId` demo responde `verified:false` | Reset demo | ~1 s |
| `webhook` | Firma, replay, monto, orden, timestamp, QR; 27/27 | Reset demo | ~3 s |
| `mobile` | Flujo completo a 360 px; 25/25 | Reset demo | ~10 s |
| `checkout` | Checkout público a 360 px; 15/15 | Crea y paga orden | ~10 s |
| `hig` | HIG/WCAG 2.2 AA, 48 px, 200%, 360/390/768/1280 | Reset/recorre | ~60 s |
| `rehearsal` | Guion completo 3 corridas | Reset/recorre | ~15 s |
| `tunnel` | Camino público por Cloudflare; 8/8 | Reset/paga | ~20 s |
| `preflight` | Servidor, túnel, datos, QR y respaldos; 18/18 | Reset demo | ~5 s |
| `film` | 8 beats + contact sheet + motion sheet | Reset/recorre | ~15 s |

El detalle de cada eval, incluyendo las que son **solo humanas**, está en `harness/EVALS.md`.

---

## 4 · Evidencia y handoff

`harness/evidence/latest.json` contiene:

- `git.sha`, `git.branch`, `git.dirty`
- `mode`, `baseUrl`, `startedAt`, `finishedAt`, `durationMs`
- `gates[]`: id, comando, `ok`, `exitCode`, duración y cola de salida redactada
- `resets[]`: cuándo se reinició la demo
- `ok` global

**Regla de honestidad:** un gate que no se ejecutó no está verde. Un output viejo no cuenta. No se declara “listo” sin `latest.json` con `ok: true` para el commit actual.

`harness/STATE.md` es el handoff vivo: qué está verde, qué falta, qué está bloqueado y cuál es la siguiente acción. Se actualiza al cerrar una tarea; no se reconstruye de memoria.

---

## 5 · Guardrails

- `harness/guard.mjs` falla si `.env.local` o un `.env` real está trackeado, si hay un secreto con pinta de real en archivos versionados, o si la ruta demo/pey perdió sus invariantes.
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

1. Añade el comando a `web/scripts/harness-gate.mjs` con `id`, `mode` (`static` o `runtime`), `mutates`, `timeout` y `expected`.
2. Añade la fila a `harness/EVALS.md` con lo que prueba y lo que **no** prueba.
3. Hazlo determinista: reset de demo si muta, timeout, salida sin secretos, exit code real.
4. Si es visual, guarda el artefacto y una nota; no conviertas una captura en prueba de negocio.
5. Corre `verify:full` y actualiza `harness/STATE.md`.

---

## 8 · Protocolo de fallo

1. **Detente.** No “arregles” bajando el estándar, saltando un test o cambiando el umbral.
2. Lee la cola de salida y el artifact del gate.
3. Identifica la causa raíz; si es de producto, corrige producto; si es del gate, corrige el gate.
4. Vuelve a correr el gate afectado y luego `verify:full`.
5. Si el fallo es humano (banco, teléfono, persona), regístralo en `harness/STATE.md`; no lo maquilles.

---

## 9 · Definición de “listo”

- `verify:static` en verde.
- `verify:full` en verde, o los gates no aplicables justificados en `STATE.md`.
- `harness/evidence/latest.json` con `ok: true` y el commit actual.
- Sin secretos en el diff.
- Si tocó dinero: webhook 27/27 y truth PASS.
- Si tocó UI: HIG/WCAG + móvil/checkout.
- Si tocó demo: preflight + túnel + video/QR actualizados.
- Handoff actualizado con riesgos y pendientes reales.

## 10 · Prácticas aplicadas del catálogo

- **Instrucciones repo-local y contexto enrutado:** `AGENTS.md` + este `HARNESS.md`.
- **Gates deterministas y evals:** `harness/EVALS.md` + `web/scripts/harness-gate.mjs`.
- **Observabilidad:** evidencia JSON con commit, duración, salida redactada y resets.
- **Handoff entre contextos:** `harness/STATE.md` + `harness/templates/LANE-REPORT.md`.
- **Autonomía segura:** guardrails de secretos, `demo_paid`, puertas humanas.
- **Spec-driven:** `GOAL.md`, `GOAL-HIG.md`, `GOAL-ACOMPANAMIENTO.md`.
- **Verificación antes de terminar:** ningún “listo” sin `latest.json`.

Referencias primarias que inspiran estas decisiones: OpenAI *Harness engineering*, Anthropic *Effective harnesses for long-running agents*, `AGENTS.md`, HumanLayer *12 Factor Agents*, y las guías de evals de OpenAI/Anthropic. No se copió código ni se añadió una dependencia.
