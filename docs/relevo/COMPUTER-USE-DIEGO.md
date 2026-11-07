# COMPUTER USE EN ONBOARDING DIEGO

Agregar a `START-HERE` y al prompt de Diego:

## Instalar en su PC
```powershell
irm https://cua.ai/driver/install.ps1 | iex
cua-driver --version
cua-driver doctor
cua-driver skills install
```
Aceptar UAC solo si quiere autostart:
```powershell
cua-driver autostart enable
```

## Hermes local
```powershell
# instalador oficial de Hermes Desktop/CLI
hermes --version
hermes tools            # activar Computer Use
hermes computer-use doctor
```

## OpenCode MCP
Agregar a `%USERPROFILE%\.config\opencode\opencode.json`:
```json
"cua": {
  "type": "local",
  "command": ["C:\\Users\\diego\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe", "mcp"],
  "enabled": true
}
```

## Verificación obligatoria
```powershell
cua-driver get_desktop_state "{}"   # screenshot OK
hermes computer-use doctor           # exit 0
cua-driver skills status             # OpenCode/Codex/Hermes linkeados
```

## Aislamiento
- Su Cua controla **su** laptop, no la del Lead ni el VPS.
- No usar YOLO; approvals manual/smart.
- No capturar passwords ni datos sensibles; no subir screenshots al repo.
- Para control cruzado entre PCs: autorización explícita + Cua Spaces/Hermes Desktop/SSH; no abrir puertos públicos.
