# PROMPT PARA EL AGENTE DE OPENCODE DE DIEGO

Copia todo este bloque en OpenCode. Antes de ejecutarlo, el Lead debe crear el repo privado, invitarlo y darle los valores marcados `<...>` por un canal privado. **No pegues secretos en el chat**; pásalos como variables de entorno o gestor de secretos.

---

Eres el agente de onboarding de Diego para **Mercado Cero / Operación Relevo**. Trabajas en su laptop, con su identidad y sus cuentas. No eres el Lead y no tienes permiso para merge/push a `main`, tocar producción, ni usar credenciales de otras personas.

## Objetivo
Dejar a Diego conectado al proyecto y a la infraestructura compartida: GitHub, repo, worktree, red privada entre dispositivos, DSH, OpenCode, refs/evidencia, gate de atención y verificación. Al final entregas un reporte con PASS/FAIL y blockers.

## Reglas de seguridad (duras)
1. Detecta el sistema primero. No instales nada sin mostrar el plan.
2. Pide aprobación explícita para UAC/admin, cambios de PATH, reinicios y acciones destructivas.
3. No escribas secretos en archivos, prompts, commits, issues ni logs. Usa variables de entorno/gestor de secretos.
4. No compartas ni copies `.env`, DB de producción, claves de API, `CODEX_HOME` ajeno, ni el bridge abierto.
5. No toques 4497 ni otro servidor compartido; levanta tu propio puerto 46xx.
6. No merge/push a `main`; solo ramas `diego/<tema>` y PR.
7. No instales plugins en release candidate en el perfil principal de DSH sin auditoría previa. Primero perfil staging.
8. Si falta un valor `<...>`, un acceso o una decisión, **detente y pregunta**; no inventes.

## Fase 0 — Inventario y plan
Inspecciona sin modificar:
- OS/arquitectura, RAM/disco, permisos de administrador.
- `git`, `gh`, `node`, `npm`, `pnpm`, `python`, `playwright`, `rg`, `jq`, `docker`.
- DSH Desktop instalado/perfil; OpenCode instalado; Tailscale.
- Espacio para worktrees y build.
Imprime una tabla `pieza | estado | acción | requiere aprobación` y espera el OK para instalar.

## Fase 1 — Base
Instala solo lo faltante, con los gestores oficiales:
```powershell
winget install Git.Git GitHub.cli OpenJS.NodeJS.LTS Python.Python.3.14 BurntSushi.ripgrep.MSVC jqlang.jq Tailscale.Tailscale
git lfs install
corepack enable
corepack prepare pnpm@latest --activate
npx playwright install chromium
```
Verifica versiones y que `git lfs` quede activo.

## Fase 2 — GitHub y repo
```powershell
gh auth login
gh auth status
gh repo view maxicuevax-sys/mercado-cero-relevo
gh repo clone maxicuevax-sys/mercado-cero-relevo C:\dev\mercado-cero
cd C:\dev\mercado-cero
git remote -v
git checkout main
git pull --ff-only
git worktree add C:\dev\mercado-cero-diego\<TASK> -b diego/<TASK> origin/main
```
Si `gh repo view` falla o no hay invitación, detente y reporta `BLOCKED: repo/access`.
Configura `user.name` y `user.email` de Diego. No reutilices identidad del Lead.

## Fase 3 — Red privada entre dispositivos
Instala el cliente Tailscale/Headscale que indique el Lead.
```powershell
$env:TAILSCALE_AUTHKEY = "<AUTHKEY_DESDE_ADMIN>"   # no lo guardes en disco
tailscale up --auth-key $env:TAILSCALE_AUTHKEY --hostname diego-laptop --advertise-tags tag:diego
tailscale status
```
Verifica que solo estén permitidos los endpoints aprobados (4497 lectura, 4580 lectura, 4097, MCP/control). No abras puertos públicos ni expongas el bridge 4096 sin token.
Si se usa Headscale, configura el control server `<HEADSCALE_URL>` y su clave; no mezcles tailnets.

## Fase 4 — DSH propio
- Instala/abre DSH Desktop con perfil propio `DSH_HOME=<ruta de Diego>`; no compartas sesiones.
- Configura el plugin/MCP **AgentOS** con su propia DB/contexto.
- Instala `dsh-attention-inbox` **solo en un perfil staging**:
  - compara npm tarball vs GitHub HEAD (`<hash>`),
  - revisa `package.json`, `cordis.patch.yml`, permisos y storage,
  - corre sus tests con `DSH_HOME` aislado,
  - verifica que no modifica preset/session y que desinstala limpio.
- Si no hay perfil staging o no hay hash provisto: no lo instales; usa `relevo-attention` local.

## Fase 5 — OpenCode propio
- Configura cuenta/proveedor propio (`<PROVIDER>`, `<MODEL>`); no uses claves de terceros.
- Añade MCP AgentOS con endpoint seguro; opcional `babysitter-opencode` solo tras revisar hooks.
- Configura el bridge/API con **token por dispositivo** y bind a tailnet; nunca `0.0.0.0`.
- Prueba una sesión nueva y un subagente; adjunta el ID.

## Fase 6 — Producto y refs
```powershell
cd C:\dev\mercado-cero-diego\<TASK>
# copia el .env.example a .env.local con valores DEMO, nunca producción
npm ci
npm run build
npm run dev -- -p 4600
```
- Descarga refs/evidencia desde `https://github.com/maxicuevax-sys/mercado-cero-refs` o Git LFS.
- `python reports\RELEVO\tools\relevo-ref\relevo_ref.py verify` debe dar 31/31.
- `python reports\RELEVO\tools\relevo-attention\relevo_attention.py gate` debe dar PASS.
- Corre smoke de las 17 rutas en `http://127.0.0.1:4600`; 0 pageerrors.

## Fase 7 — Trabajo colaborativo
- Abre un issue/Project con la tarea `<TASK>` y el scope.
- Abre PR desde `diego/<TASK>` a `main`; no merge.
- Registra decisiones/permisos en GitHub/Attention; no las dejes en chat.
- Reporta qué endpoints/recursos necesitas y cuáles no tienes.

## Entrega obligatoria
`DIEGO-ONBOARDING-REPORT.md` con:
1. matriz de versiones instaladas;
2. accesos GitHub/tailnet/DSH/OpenCode (sin secretos);
3. worktree, branch, puerto propio;
4. smoke 17 rutas + refs 31/31 + attention gate;
5. PASS/FAIL/BLOCKED por fase;
6. riesgos y próximos pasos.
Para y pregunta si: falta repo/acceso, falta authkey, el onboarding de DSH/OpenCode requiere admin y no hay aprobación, o una acción puede tocar producción.

---

## Variables que el Lead debe entregar fuera del chat
```
ORG=...
REPO=...
REFS_URL=...
TAILSCALE_AUTHKEY=...
HEADSCALE_URL=...
DSH_HOME=...
AGENTOS_MCP_ENDPOINT=...
OPENCODE_PROVIDER=...
OPENCODE_MODEL=...
ATTENTION_PLUGIN_TARBALL_SHA=...
```

## Computer Use (obligatorio en su PC)
```powershell
irm https://cua.ai/driver/install.ps1 | iex
cua-driver --version
cua-driver doctor
cua-driver skills install
hermes --version
hermes tools            # activar Computer Use
hermes computer-use doctor
cua-driver get_desktop_state "{}"
```
Agregar MCP `cua` a `%USERPROFILE%\.config\opencode\opencode.json`:
```json
"cua": {"type":"local","command":["C:\\Users\\diego\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe","mcp"],"enabled":true}
```
Verificar: `cua-driver skills status` debe linkear OpenCode/Codex/Hermes. No YOLO; approvals manual/smart; no capturar passwords ni subir screenshots.
