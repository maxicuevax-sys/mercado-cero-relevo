# HERMES CONTROL PLANE — arquitectura y despliegue

**Decisión:** Hermes Agent (MIT, Nous Research) será la capa **supervisora always-on** por encima de los agentes locales. No sustituye a DSH/OpenCode/Codex: los **orquesta, observa, recuerda y escala**. Los humanos siguen aprobando dinero, merges, deploy y GO.

## Por qué Hermes
Fuente: [README de NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) · [docs](https://hermes-agent.nousresearch.com/docs/).

- **MIT**, self-hosted, Windows/macOS/Linux/WSL2/Termux.
- Corre en **VPS de $5**, GPU o serverless; terminal backends local/Docker/SSH/Modal/Daytona/Vercel.
- **Gateway siempre online**: Telegram, Discord, Slack, WhatsApp, Signal, Email, CLI. Un proceso atiende varios profiles.
- **Profiles** con memoria, skills, credenciales y sesiones aisladas; un solo gateway multiplexa.
- **Desktop multi-instancia**: registra VPS, LAN, SSH y Cloud; todos conectados; `gateway → profile → sessions`.
- **Cron/triggers**, subagentes, MCP, skills, memoria persistente, búsqueda de sesiones.
- **Worktrees**: `hermes -w`, `/worktree new`, aislamiento por subagente y checkpoints/rollback.
- **Seguridad**: approvals smart/manual, deny rules, blocklist dura, allowlists/DM pairing, aislamiento Docker, `HERMES_WRITE_SAFE_ROOT`.

## OpenCode Go
Fuente: [OpenCode Go](https://opencode.ai/console/go).

- Suscripción **$10/mes** (Go) o **$40/mes** (Go Plus) con modelos open-weight, límites generosos y top-up.
- Diseñada para OpenCode y otros agentes; **puede alimentar a los workers OpenCode** (DeepSeek V4.1 Flash, MiMo, Kimi, GLM, etc.).
- No asumir que el token de Go sirve directamente en Hermes: Hermes usa su propio provider (`hermes model`) o un endpoint compatible. **Probar** antes de enrutar producción.
- Reparto recomendado: Go/Go Plus para OpenCode workers; Hermes con Nous Portal/OpenRouter/modelo propio para supervisión y memoria.

## Arquitectura de dos niveles
```
HUMANOS (tú, Diego, aprobadores)
  │  Telegram/Discord/DSH/PRs: solo decisiones y GO
  ▼
HERMES CONTROL PLANE (VPS always-on)
  ├─ profile orchestrator  : dispatch, memoria, cron, MCP, escalado
  ├─ profile demo-guard    : 4580/4497/watchdog/refs, solo lectura
  ├─ profile diego         : su asistente, su memoria, sus credenciales
  └─ profile ops           : VPS, backups, red, alertas
  │  tareas/leases, no merges
  ▼
WORKERS LOCALES
  ├─ DSH Lead session + AgentOS + attention ledger
  ├─ OpenCode (Go/Go Plus) + subagentes + worktrees
  ├─ Codex A/B cuando aplique
  └─ product servers 4580/4497 (uno servido, otro fallback)
  │
  ▼
ESTADO COMPARTIDO
  ├─ GitHub privado: issues/PRs/Projects (decisiones durables)
  ├─ Tailscale/Headscale: red entre dispositivos
  ├─ Git LFS/MinIO: refs y evidencia
  └─ relevo-attention: gate humano; Hermes lo consulta antes de continuar
```

### Regla de autoridad
- **Hermes está arriba de los agentes, no de las personas.**
- Hermes puede: observar, recordar, programar, despachar, resumir, escalar, abrir PR/issue, pedir aprobación.
- Hermes **no puede**: aprobar pagos, mergear a `main`, desplegar producción ni saltarse el gate de atención.
- DSH Lead sigue siendo el orquestador de ejecución del candidato; Hermes es el supervisor de Cartera.
- Un solo “router” por nivel evita peleas: Hermes (eventos/tiempo) ≠ DSH Lead (tarea/candidato) ≠ workers.

## Profiles propuestos
| Profile | Máquina | Rol | Puede escribir |
|---|---|---|---|
| `orchestrator` | VPS | dispatch, cron, digest, GitHub read, escalado | issues/PRs, no `main` |
| `demo-guard` | VPS | 4580/4497/health/refs/watchdog | solo lectura |
| `lead` | desktop/VPS | asistente del Lead humano | PRs, no `main` |
| `diego` | desktop de Diego | su agente personal | su worktree/PR |
| `ops` | VPS | backups, Tailscale, updates, alertas | infra aprobada |

Cada profile tiene `.env`/memoria/sesiones propias; nunca se comparten claves entre profiles.

## Despliegue P0 (staging, no producción)
### VPS
- Ubuntu 24.04, 2 vCPU/4 GB/80 GB, usuario no-root, SSH por llave, firewall, unattended-upgrades.
- Instalar Hermes con el instalador oficial o paquete verificado; `hermes doctor`.
- `hermes profile create orchestrator`, `demo-guard`, `lead`, `diego`, `ops`.
- Un solo gateway host (multiplex) + servicios supervisados.
- `hermes gateway install`; token/sesión de dashboard; bind a `127.0.0.1`/Tailscale, nunca público.
- MCP: AgentOS (lectura), GitHub (skills/gh), filesystem limitado; OpenCode/DSH vía SSH/terminal backend o HTTP seguro.
- Cron: digest de atención, health 4580/4497, refs SHA, PRs estancados.
- Backups de `HERMES_HOME`, DB de sesiones y secretos cifrados.

### Desktop
- Hermes Desktop en tu laptop y en la de Diego.
- Settings → Gateways: agregar VPS por **SSH** o **Remote gateway + token**; Test debe dar “Reachable”.
- Cada profile aparece como agente; approvals vuelven al backend dueño.
- No usar `GATEWAY_ALLOW_ALL_USERS`; usar pairing/allowlist.
- `approvals.mode: smart` o `manual`; `cron_mode: deny`; `single_query_mode: deny`; `unattended_mode: deny`.
- Sin YOLO, sin `command_allowlist` amplia; `HERMES_WRITE_SAFE_ROOT` al workspace.

### Diego
- Su propio profile `diego` en el VPS o en su desktop; su cuenta/modelo.
- Acceso a repo privado, worktree `diego/<task>`, PR; no a 4497.
- Hermes Desktop conectado al VPS; puede ver/consultar sin tocar el servidor.

## Cómo se “sale del loop”
Hermes no elimina la responsabilidad humana; elimina el **polling y el paso a paso**:
1. **Cron/triggers** revisan GitHub, health, refs, colas y abren un digest.
2. **Clasificación** hard/system/soft con `relevo-attention`; hard pausa el goal.
3. **Dispatch** a workers con lease/worktree; resultados → resumen + artifact.
4. **Escalado** a Telegram/Discord solo si necesita decisión; no inunda.
5. **Memoria/skills** aprende del historial y evita repetir contexto.
6. **Watchdog** independiente reinicia/avisa; Hermes no es el único punto de fallo.

## OpenCode Go en esta arquitectura
- Los workers OpenCode usan Go/Go Plus para modelos; Hermes no consume necesariamente esa cuota.
- Si Hermes usa Go como provider, probar endpoint/API key en staging y medir; si no, provider separado.
- Regla de coste: Go para volumen de workers; modelos caros solo para revisión/GO.
- Un solo pool de credenciales por profile; no compartir la suscripción con Diego sin control de asientos.

## Riesgos y límites
- Hermes es un agente con terminal; en VPS tiene poder real. Sin allowlist, approvals y sandbox, un prompt injection o un skill malo puede tocar producción.
- No habilitar `approvals.mode: off` ni `/yolo` en profiles con acceso a repo/producción.
- No exponer `hermes serve` a Internet sin TLS/token/Tailscale.
- `dsh-attention-inbox` es personal, no team; para compartir con Diego usar GitHub/HumanLayer hasta que exista extensión.
- Verificar licencias y versiones de Headscale/Coder/Hatchet/Langfuse antes de desplegar.

## Fases
1. **P0:** VPS staging + profiles + gateway + Telegram/allowlist + MCP lectura + cron digest.
2. **P1:** desktop multi-gateway (tú/Diego) + `demo-guard` + GitHub PR/issue + Tailscale.
3. **P2:** OpenCode Go workers + worktrees + `relevo-attention` gate + HumanLayer/control center.
4. **P3:** durable jobs (Hatchet), trazas/coste (Langfuse/LiteLLM), multi-región/backups.
