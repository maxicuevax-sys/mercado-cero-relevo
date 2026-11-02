# AGENTS.md — Mercado Cero

Instrucciones de trabajo para **todo** agente (opencode, codex, claude, subagentes) que toque este repo. Léelo antes de escribir código.

## Regla de oro (nunca romper)

Ningún pedido se marca `paid` por lógica del cliente, captura de pantalla, ni webhook sin firma válida. **Solo** el webhook firmado de pey (Standard Webhooks) transiciona `payment_pending → paid`. Idempotencia por `transactionId`/`eventId`; valida monto, moneda y `clientReferenceId` contra la orden.

Los pagos simulados usan `demo_paid`, nunca `paid`. `/api/verify` solo considera comprobantes con `provider = 'pey'`; un `transactionId` demo debe responder `verified: false`.

## Secretos

- `.env.local` **nunca** se commitea.
- `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL` son server-only.
- Antes de tocar pagos/webhook: lee `README.md` §4 "Seguridad mínima".

## Stack — Next.js 16 (no es el Next que conoces)

- Next.js 16 + TypeScript + Tailwind; app en `web/`.
- `web/AGENTS.md` (autogenerado): Next 16 tiene breaking changes. Lee `web/node_modules/next/dist/docs/` antes de escribir código y obedece los deprecation notices.
- SQLite vía `node:sqlite` (prototipo). Sin Postgres aún.
- UI = dirección "Mostrador claro" / "Mercado de papel" (ver `HIG-DESIGN.md`). **No rediseñar** sin decisión explícita.

## Harness (contexto, gates y evidencia)

Lee **`HARNESS.md`** antes de una tarea larga. `harness/STATE.md` es el handoff vivo; `harness/EVALS.md` explica qué prueba cada gate. No declares listo sin `harness/evidence/latest.json` con `ok: true`, `gitAtStart.sha` igual al commit de código entregado, `gitAtStart.dirty:false` y `npm run verify:evidence` PASS.

```bash
cd web
npm install
npm run dev            # o npm run build && npm start

# en otra terminal, desde web/
npm run verify:fast      # 3 gates: guardrails + lint + tipos
npm run verify:static    # 5 gates: fast + deps + build con identidad
npm run verify:full      # 23 gates: runtime + guard/lint/types/deps + p0 (build fuera; film opcional: 24)
npm run verify:list
npm run verify:evidence  # latest.json contra HEAD, árbol y buildSha
npm run harness:report   # tabla Markdown desde latest.json
npm run test:harness     # 48 tests del gate y de la evidencia
```

Los comandos individuales se corren **desde `web/`**; no desde la raíz con `node web/scripts/...`.

`npm run build` sella `BUILD_SHA` y `/api/health` lo devuelve. Un servidor de otro commit no sirve como evidencia: recompila y reinicia antes de `verify:full`.

Nada se considera listo si rompe el contrato del webhook, la verdad demo/pey o baja HIG/WCAG. Un gate no ejecutado no está verde; `--only` y `--skip` son `partial` y nunca `ok:true`; un árbol sucio, un SHA que cambia, un `buildSha` distinto o un artefacto sin hash invalidan la evidencia.

## Fuente de verdad (leer antes de tocar)

- Contrato: `GOAL.md` · Interfaz: `GOAL-HIG.md` + `HIG-DESIGN.md` · Carga cognitiva: `GOAL-ACOMPANAMIENTO.md`
- Plan: `PLAN-8-DIAS.md` · Demo: `RUNBOOK-DEMO.md` + `GUION-3-MIN.md` · Pitch: `PITCH.md`
- Harness: `HARNESS.md` + `harness/STATE.md` + `harness/EVALS.md` · Verificación: `VERIFICACION-F3-FINAL-5.md`

## Convenciones del swarm (worktrees)

- Cada carril trabaja en su worktree (`../mercado-cero-<lane>`, rama `swarm/<lane>`).
- Commit al terminar y escribe `<lane>-report.md` en la raíz del worktree: cambios, verificación corrida y resultado, pendientes. Plantilla: `harness/templates/LANE-REPORT.md`.
- Antes del reporte, corre `npm run verify:fast` como mínimo; si el carril toca runtime, adjunta `harness/evidence/latest.json`.
- El merge lo hace **solo el orquestador** (Hermes), previa revisión humana. Un worker nunca hace merge a `master`.
