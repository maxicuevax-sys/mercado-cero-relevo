# ONBOARDING DIEGO — Mercado Cero / DSH / OpenCode

**Objetivo:** que Diego vea el proyecto, tenga sus propias capacidades y se una al sistema sin compartir credenciales, servidores ni el bridge abierto.

## 0. Bloqueo actual
El checkout local **no tiene remote** (`git remote -v` vacío). Antes de invitar a Diego:
1. Crear repo privado en GitHub (código + docs).
2. Decidir si refs/evidencia van en **Git LFS** o en almacenamiento aparte (MinIO/S3).
3. Hacer el primer push **solo con autorización explícita** del dueño.
4. Invitar a Diego como collaborator, no owner.
5. Proteger `main`: PR obligatorio, sin force-push, CODEOWNERS.

## 1. Qué debe instalar Diego (mínimo para ver y contribuir)

| Pieza | Windows | Verificación |
|---|---|---|
| Git + Git LFS | `winget install Git.Git` + `git lfs install` | `git --version`, `git lfs version` |
| GitHub CLI | `winget install GitHub.cli` | `gh auth status` |
| Node 24/25 | `winget install OpenJS.NodeJS.LTS` o fnm | `node -v`, `npm -v` |
| pnpm | `corepack enable; corepack prepare pnpm@latest --activate` | `pnpm -v` |
| Python 3.14 | `winget install Python.Python.3.14` | `python --version` |
| Playwright | `npx playwright install chromium` | `npx playwright --version` |
| ripgrep/jq | `winget install BurntSushi.ripgrep.MSVC`, `jqlang.jq` | `rg --version`, `jq --version` |
| DSH Desktop | instalador oficial DeepSeek Harness | abrir GUI, perfil propio |
| OpenCode | desktop/CLI oficial | `opencode --version` |
| Tailscale | `winget install Tailscale.Tailscale` | `tailscale status` |
| Docker (opcional) | Docker Desktop | `docker version` |

**No necesita:** la DB de producción, el `.env` real, las credenciales de A/B, el `CODEX_HOME` de Max 2, ni acceso al bridge 4096 sin token.

## 2. Red privada entre dispositivos
Recomendado: **Tailscale** (cliente) + **Headscale** (control server open source) si no quieren depender del SaaS.

- Diego entra a la tailnet con **su propia auth key**, hostname `diego-laptop`, tag `tag:diego`.
- ACL: solo puertos aprobados (`4497`, `4580`, `4097`, MCP/control) y solo lectura salvo su worktree.
- Nada de `0.0.0.0` ni bridge público.
- Alternativa/extra: [Coder](https://github.com/coder/coder) para workspaces remotos; [Headscale](https://github.com/juanfont/headscale) para control de tailnet.
- Archivos compartidos: Git LFS o MinIO; no Syncthing para evidencia (conflictos).

## 3. Repo y worktrees
```powershell
gh repo clone maxicuevax-sys/mercado-cero-relevo C:\dev\mercado-cero
cd C:\dev\mercado-cero
git remote -v
git worktree add ..\mercado-cero-diego\<task> -b diego/<task> origin/main
```
Reglas:
- Un writer por worktree.
- No tocar 4497; levantar su propio puerto 46xx.
- PR a `main`; nunca push directo.
- `CODEOWNERS` para áreas críticas (dinero, refs, infra).
- Issues/Project como tablero de decisiones; el agente no decide merges.

## 4. DSH
- Instalar DSH Desktop y usar **DSH_HOME/perfil propio**; no compartir sesiones.
- Plugin AgentOS MCP con su propia DB/contexto; no apuntar a la DB del Lead.
- `dsh-attention-inbox` (MIT, RC): instalar primero en **perfil staging** y auditar tarball/permisos; no en el perfil principal.
- El plugin DSH actual es personal, **no team**: para compartir decisiones con Diego usar GitHub/HumanLayer hasta que exista extensión de equipo.

## 5. OpenCode
- Cuenta/modelo propio (OpenCode Go/DeepSeek); no compartir API key.
- Config MCP AgentOS con endpoint seguro; opcional `babysitter-opencode` para hooks/HITL.
- Bridge: si se usa, **token por dispositivo + bind a tailnet**, nunca el 4096 abierto.
- Reglas: no merge/push, no secretos en prompts, no tocar 4497, no `paid`.

## 6. Centro de control que falta
Hoy no hay un control center multiusuario completo. Orden recomendado:
1. **GitHub Project + Issues + PRs** como fuente de verdad de decisiones y trabajo (P0).
2. **HumanLayer** (Apache 2.0; OpenCode plugin; tareas/planes/reviews; self-hosting en progreso) como control center de agentes (P1).
3. **Tailscale/Headscale** para red entre dispositivos (P1).
4. **Coder** para entornos remotos si Diego no quiere montar todo local (P2).
5. **Langfuse + LiteLLM** para trazas/caché/coste; **ntfy** para notificaciones; **Hatchet/Temporal** para durables (P2/P3).
6. **DSH attention inbox** cuando pase auditoría; mientras tanto, `relevo-attention` local para el gate.

## 7. Criterio de “Diego está dentro”
- [ ] `gh auth status` OK y PR de prueba abierto.
- [ ] clone + worktree + build OK en puerto propio.
- [ ] smoke propio 17 rutas / su tarea.
- [ ] tailnet conectada y ACL verificada.
- [ ] DSH/OpenCode con cuentas propias.
- [ ] refs/evidencia descargadas y `relevo-ref verify` PASS.
- [ ] `relevo-attention gate` PASS o decisiones registradas.
- [ ] reporte `DIEGO-ONBOARDING-REPORT.md` con evidencia y gaps.

## 8. Enlaces de referencia
- [HumanLayer](https://github.com/humanlayer/humanlayer) (Apache 2.0)
- [DSH Attention Inbox](https://github.com/QingJ01/dsh-attention-inbox) (MIT, RC)
- [Babysitter OpenCode](https://github.com/a5c-ai/babysitter-opencode) (MIT)
- [Headscale](https://github.com/juanfont/headscale) / [Tailscale](https://github.com/tailscale/tailscale)
- [Coder](https://github.com/coder/coder)
- [Hatchet](https://github.com/hatchet-dev/hatchet)
- [Langfuse](https://github.com/langfuse/langfuse) / [LiteLLM](https://github.com/BerriAI/litellm)
- [ntfy](https://github.com/binwiederhier/ntfy)

> Verificar licencia/versión antes de desplegar cada pieza; no instalar plugins RC en el perfil principal sin auditoría.
