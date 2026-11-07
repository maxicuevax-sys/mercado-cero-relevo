# PROMPT — DIEGO / OPENCODE + AGENT-DESKTOP

Eres el agente de Diego. Trabajas en **su** laptop, con **su** identidad y **su** worktree. No compartes credenciales, bridge, DB ni pantalla con el Lead.

## 0. Reglas duras
- No tocar producción: CyberPanel, LiteSpeed, mail, DNS, 443.
- **4497 es solo lectura** para Diego. No escribir, no reiniciar, no matar procesos.
- No usar el bridge compartido ni `C:\Users\Max 2\.codex`.
- No hacer merge a `main` ni push a `main`; solo tu rama `diego/visual-*`.
- No subir secretos, snapshots, screenshots privados, DBs ni `.env`.
- Un solo writer por worktree.
- Si algo falla, reporta el error exacto; no inventes ni autoapruebes.

## 1. Accesos
1. Aceptar la invitación de GitHub a:
   - `https://github.com/maxicuevax-sys/mercado-cero-relevo`
   - `https://github.com/maxicuevax-sys/mercado-cero-refs`
2. Verificar:
```powershell
gh auth status
gh repo view maxicuevax-sys/mercado-cero-relevo
gh repo view maxicuevax-sys/mercado-cero-refs
```
3. Tailscale: iniciar sesión con **tu** cuenta. 4497 solo lectura; tu servidor propio en **4600**.
4. No pedir tokens del Lead. Si GitHub da 403/404, pega el error exacto y detente.

## 2. Refs LFS (obligatorio)
```powershell
git lfs install
git clone https://github.com/maxicuevax-sys/mercado-cero-refs.git
cd mercado-cero-refs
git lfs pull
git lfs ls-files
```
- Deben estar los **31 activos** de `references/DEFINITIVE`, no punteros `.lfs`.
- Verifica tamaño/tipo de archivo; no edites ni hagas push a `mercado-cero-refs`.
- Si faltan refs, reporta `REFS_INCOMPLETAS` con el listado.

## 3. Instalar agent-desktop
Fuente: https://github.com/vercel-labs/agent-desktop
```powershell
npm install -g agent-desktop
agent-desktop status
agent-desktop skills get desktop
agent-desktop skills get platform
agent-desktop version
```
- Requisito Windows: Windows 10 1809+ x64/ARM64, UI Automation.
- Instala el skill en tu harness:
```powershell
npx skills add https://github.com/vercel-labs/agent-desktop --skill agent-desktop
```
- Añade a tu `AGENTS.md`:
```markdown
Usa `agent-desktop` para ver y operar apps nativas del escritorio.
Antes del primer uso ejecuta:
  agent-desktop skills get desktop
  agent-desktop skills get platform
Respeta snapshot → ref → acción → snapshot de verificación.
Nunca uses --headed sin autorización explícita.
```

## 4. Conectar agent-desktop a OpenCode
Edita `%USERPROFILE%\.config\opencode\opencode.json` y agrega bajo `mcp`:
```json
"agent-desktop": {
  "type": "local",
  "command": ["agent-desktop", "mcp"],
  "enabled": true
}
```
Valida el JSON y reinicia OpenCode. En una sesión nueva verifica que existan herramientas `desktop_snapshot`, `desktop_click`, etc.

## 5. Prueba real, headless, sin robar foco
Elige una app benigna ya abierta (Explorador/Calculator/Notepad). NO uses el navegador del usuario.
```powershell
agent-desktop list-apps
agent-desktop snapshot --app Calculator -i
agent-desktop click '@SNAPSHOT_ID:REF_ID'
agent-desktop snapshot --app Calculator -i
```
Reglas:
- Refs siempre entre comillas simples en PowerShell: `'@s8f3k2p9:e8'`.
- Si `STALE_REF`/`AMBIGUOUS_TARGET`: nuevo snapshot; no adivines.
- **Headless por defecto**; nunca `--headed`, `focus-window`, ni clics físicos sobre la ventana activa del usuario.
- Si necesitas operar el navegador para la web, usa **Playwright/headless**, no agent-desktop.
- No leas clipboard, notificaciones ni documentos privados.
- Reporta el JSON envelope de una prueba: `ok`, `snapshot_id`, `ref_count`.

## 6. Tu worktree
Cuando el Lead confirme que la rama existe:
```powershell
git clone https://github.com/maxicuevax-sys/mercado-cero-relevo.git
cd mercado-cero-relevo
git fetch origin revision/assembly-fixes
git worktree add ..\diego-visual origin/revision/assembly-fixes
cd ..\diego-visual
git switch -c diego/visual-caja-fiados
```
- Copia `.env.local` desde la plantilla; DB demo **tuya**.
- Corre en **4600**, no 4497.
- Si la rama no existe, reporta `BRANCH_FALTA` y no inventes código.

## 7. Tus pantallas de hoy
Te tocan **Caja** y **Fiados**. Una por una, con la ref exacta:
- `/caja` → `references/DEFINITIVE/mobile/02_nueva_venta_941x1672.png`
- `/fiados` → `references/DEFINITIVE/mobile/05_fiados_390x693.png`

Para cada una:
1. `http://127.0.0.1:4600/<ruta>` a **390×693**.
2. Captura actual + ref, side-by-side.
3. Escribe **5 diferencias concretas** (color, familia tipográfica, tamaño, posición, texto).
4. Corrige una diferencia a la vez.
5. Build + vuelve a capturar.
6. Guarda `reports/RELEVO/visual/<pantalla>.png` y `VISUAL.md`.
7. `git commit` en `diego/visual-caja-fiados`; push solo de tu rama.
8. Si no mejora, `BLOCKED` con la captura; no sigas tocando.

Prohibido usar build/rutas verdes como prueba visual. El gate es **side-by-side**; el autor no se autoaprueba.

## 8. Entrega
Devuelve:
- `agent-desktop status` + JSON de prueba headless.
- `git lfs ls-files` (refs).
- `git log --oneline -3` de tu rama.
- `VISUAL.md` con diferencias/cambios/qué sigue mal.
- Capturas y side-by-side.
- Confirmación: no tocaste 4497, no usaste `--headed`, no subiste secretos.
