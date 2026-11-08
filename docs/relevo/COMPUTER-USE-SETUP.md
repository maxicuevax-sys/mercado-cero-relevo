# COMPUTER USE — dos PCs + subagentes

## Estado actual
- **PC del Lead:** Cua Driver **0.28.2** en `C:\Users\Elitebook 840 G8\AppData\Local\Programs\Cua\cua-driver\bin\cua-driver.exe`.
  - `cua-driver get_desktop_state` OK (1920×1080, screenshot PNG).
  - Hermes local **v0.22.1** con toolset `computer_use` **enabled**; `hermes computer-use doctor` **OK** (UIA + D3D11).
  - OpenCode: MCP `cua` agregado en `%USERPROFILE%\.config\opencode\opencode.json`; skill linkeado en `%APPDATA%\opencode\skills\cua-driver`.
  - Cua daemon corriendo; autostart quedó pendiente de aceptar UAC.
- **PC de Diego:** mismo setup, falta ejecutar el prompt.
- **VPS:** Hermes tiene Computer Use, pero controla el escritorio del **VPS**, no las laptops. Para las dos PCs, cada laptop corre su propio Hermes/Cua local.

## Instalación por PC (Windows)
```powershell
irm https://cua.ai/driver/install.ps1 | iex
cua-driver --version
cua-driver doctor
cua-driver skills install
```
- Autostart opcional (pide UAC):
```powershell
cua-driver autostart enable
```
- Hermes:
```powershell
hermes --version
hermes tools            # activar Computer Use
hermes computer-use status
hermes computer-use doctor
```
- OpenCode MCP (`%USERPROFILE%\.config\opencode\opencode.json`):
```json
"cua": {
  "type": "local",
  "command": ["C:\\Users\\<USUARIO>\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe", "mcp"],
  "enabled": true
}
```
- Skill:
```powershell
cua-driver skills install   # linkea OpenCode/Codex/Hermes
```

## Uso
- Hermes: `hermes -t computer_use chat` y pedir acciones.
- CLI directo: `cua-driver get_desktop_state "{}"`, `cua-driver get_window_state '{...}'`.
- OpenCode: los subagentes heredan el MCP `cua`; usar `cua` tools con snapshot → acción → verificación.

## Reglas
- `computer_use` actúa sobre la máquina donde corre **ese** Hermes/Cua; no sobre otra PC por arte de magia.
- Para controlar la otra PC: Hermes Desktop conectado a esa instancia, Cua Spaces, o SSH/RDP; no compartir pantalla sin autorización.
- Aprobaciones: `manual/smart`; nunca YOLO en producción.
- Windows: ventanas elevadas (UAC/admin) no se pueden manejar desde un agente Medium-integrity. Si hace falta, el agente corre elevado o se pide interacción humana.
- No passwords por `type`; usar autofill/gestor.
- La app capturada puede tener datos sensibles: no subir capturas al repo.

## Subagentes
- OpenCode: MCP `cua` disponible para sesión y subagentes; skill `cua-driver` linkeado.
- Codex: skill linkeado; `cua-driver` CLI disponible.
- Hermes: `computer_use` toolset; los subagentes lo heredan.
- DSH: el Lead usa CLI; si se necesita MCP para subagentes DSH, registrar `cua-driver mcp` como servidor MCP del perfil.
