# AGENTS.md — Mercado Cero

Instrucciones de trabajo para **todo** agente (opencode, codex, claude, subagentes) que toque este repo. Léelo antes de escribir código.

## Regla de oro (nunca romper)

Ningún pedido se marca `paid` por lógica del cliente, captura de pantalla, ni webhook sin firma válida. **Solo** el webhook firmado de pey (Standard Webhooks) transiciona `payment_pending → paid`. Idempotencia por `transactionId`/`eventId`; valida monto, moneda y `clientReferenceId` contra la orden.

## Secretos

- `.env.local` **nunca** se commitea.
- `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL` son server-only.
- Antes de tocar pagos/webhook: lee `README.md` §4 "Seguridad mínima".

## Stack — Next.js 16 (no es el Next que conoces)

- Next.js 16 + TypeScript + Tailwind; app en `web/`.
- `web/AGENTS.md` (autogenerado): Next 16 tiene breaking changes. Lee `web/node_modules/next/dist/docs/` antes de escribir código y obedece los deprecation notices.
- SQLite vía `node:sqlite` (prototipo). Sin Postgres aún.
- UI = dirección "Mostrador claro" / "Mercado de papel" (ver `HIG-DESIGN.md`). **No rediseñar** sin decisión explícita.

## Cómo verificar (definición de "listo")

```bash
cd web && npm install && npm run dev          # arranca; sin API key = modo demo
node web/scripts/webhook-contract.mjs         # 27/27 aserciones del webhook
python web/scripts/mobile-audit.py            # 25/25 a 360px
python web/scripts/checkout-audit.py          # 15/15
python web/scripts/tunnel-smoke.py            # 8/8
node web/scripts/preflight.mjs                # 18/18
node web/scripts/reconcile.mjs                # conciliación vs pey
```

Nada se considera listo si rompe el contrato del webhook o baja Lighthouse (objetivo 100/100/100).

## Fuente de verdad (leer antes de tocar)

- Contrato: `GOAL.md` · Interfaz: `GOAL-HIG.md` + `HIG-DESIGN.md` · Plan: `PLAN-8-DIAS.md`
- Demo: `RUNBOOK-DEMO.md` + `GUION-3-MIN.md` · Pitch: `PITCH.md` · Verificación: `VERIFICACION-F3-FINAL-5.md`

## Convenciones del swarm (worktrees)

- Cada carril trabaja en su worktree (`../mercado-cero-<lane>`, rama `swarm/<lane>`).
- Commit al terminar y escribe `<lane>-report.md` en la raíz del worktree: cambios, verificación corrida y resultado, pendientes.
- El merge lo hace **solo el orquestador** (Hermes), previa revisión humana. Un worker nunca hace merge a `master`.
