# Swarm del hackathon — Mercado Cero

**Límite:** demo **sáb 7 nov, 10:00–16:00** (UTOPÍA Elena Poniatowska, Coyoacán) · entrega **dom 8 nov, 13:00**.

## Qué es

Un enjambre de agentes organizado en **carriles paralelos**, con un **orquestador** (Hermes), un **tablero** Kanban (`board.md`) y un **gate humano** antes de cualquier merge o acción irreversible. El patrón sigue `hermes-multi-agent-workflow` (roles → carriles → gate → fulfill), aplicado a **terminar y verificar** Mercado Cero, no a greenfield.

## Estado real (para no repetir trabajo)

La mayor parte **ya está hecha y verificada** (ver `README.md` §10–11):

- F3 "Mostrador claro" implementado, verificado de forma independiente y desplegado en producción.
- Lighthouse 100 accesibilidad · 100 best practices · 100 SEO.
- Webhook pey: 34/34 aserciones (pago válido, replay, firma falsa, monto alterado, etc.).
- Auditorías: móvil 25/25 · checkout 15/15 · túnel 8/8 · ensayo 15/15.
- Video de respaldo, QR imprimible, guion, pitch y runbook listos.

Por eso el swarm aquí **no reescribe el producto**: hace estas 4 cosas.

1. **Verificar** que todo sigue pasando en producción (auditorías frescas, no las viejas).
2. **Cerrar gaps** que la verificación encuentre.
3. **Desbloquear el pago real** — la única pieza que depende de un humano (cuenta pey + API key).
4. **Ensayar** hasta que la demo salga sin pensar.

## Roles

| Rol | Quién | Alcance |
|-----|-------|---------|
| Orquestador | Hermes (yo) | Reparte carriles, revisa diffs, reconcilia, decide merge |
| Lane UI | Codex CLI | `web/src` — pulido, accesibilidad, responsive |
| Lane API | Codex CLI | `web/src/app/api` — webhook, estados, fiado, corte |
| Lane Pagos | Codex CLI | pey, anti-fraude, verificación de comprobante, `reconcile.mjs` |
| Lane QA | Subagentes Hermes | Corre las auditorías y devuelve reporte de evidencia |
| Lane Demo | Subagentes Hermes | Guion, ensayos cronometrados, Q&A de objeciones, backup |

## Mecánica: worktrees, no ramas compartidas

Cada carril de código trabaja en un **git worktree** separado sobre la rama actual, para editar en paralelo sin pisarse. Al terminar, el orquestador revisa el diff y propone el merge. Si dos carriles tocan el mismo archivo, entra **merge-reconciler** (resolución neutral de conflictos).

```
<rama actual>
├─ swarm/ui        → ../mercado-cero-ui        (Codex)
├─ swarm/api       → ../mercado-cero-api       (Codex)
└─ swarm/payments  → ../mercado-cero-payments  (Claude)
```

## Gate humano — lo que NUNCA hace un agente solo

- Crear la cuenta pey / meter la API key / el webhook secret.
- Marcar `paid` sin webhook firmado (regla de oro del proyecto).
- Commitear `.env.local` o cualquier secreto.
- Merge a la rama principal (el orquestador prepara el diff y pide OK).
- Deploy final a Vercel.

## Cómo disparar

```bash
cd "~/Documents/Default Project/mercado-cero"
bash SWARM/fire.sh          # crea worktrees y lanza los workers
```

Para detener: `bash SWARM/stop.sh`. Para modo sin sandbox ni aprobaciones: `bash SWARM/fire.sh --yolo` (más rápido, más peligroso).

## Verificación de no-cuelgue (probado 1 nov)

- **Codex CLI 0.159.1** ✅ — `codex exec` es no-interactivo; smoke test en vivo salió `exit 0` en segundos. Flags usados: `--sandbox workspace-write --approve-for-me` (seguro) o `--dangerously-bypass-approvals-and-sandbox` (--yolo). *Nota:* tu config de codex tiene un MCP a `chatgpt.com` que da 403 Cloudflare; no es fatal, solo ruido.
- **Claude Code 2.1.63** ⚠️ — `claude -p` es no-interactivo y no cuelga, pero el token OAuth **expiró** (401). Re-autentica con `claude` antes de usarlo en algún lane.
- **Tope duro:** cada worker corre bajo `timeout` (`SWARM_TIMEOUT`, 1800 s por defecto), así que aunque un agente se quede atascado, el script no se queda colgado para siempre.

## Seguridad

- Leer `README.md` §4 "Seguridad mínima" antes de tocar webhooks/pagos.
- Sin secretos en el repo; `web/scripts/verify-env.mjs` revisa demo/real sin imprimirlos.
- Regla de oro intacta: **ningún `paid` por lógica del cliente, captura de pantalla o webhook sin firma válida.**
