# Instalación segura en Windows PowerShell

**No ejecute comandos con una ubicación supuesta.** Ajusta `$repo` a tu repo REAL y `$kit` al directorio donde descomprimiste este paquete.

```powershell
$repo = 'C:\ruta\real\a\MercadoCero'   # CAMBIAR
$kit  = 'C:\ruta\real\a\MercadoCero_DesignOps_Kit' # CAMBIAR
if (-not (Test-Path $repo)) { throw 'Ruta del repo no existe' }
if (-not (Test-Path $kit)) { throw 'Ruta del kit no existe' }
Set-Location $repo
git status --short
# PRIMERO comprobar si ya existen archivos con los mismos nombres.
Get-ChildItem .opencode\agents -ErrorAction SilentlyContinue
Get-ChildItem .opencode\skills -ErrorAction SilentlyContinue
# Copiar referencias a carpeta nueva sin tocar el código existente.
$dest = Join-Path $repo 'design-references\mercado-cero'
if (Test-Path $dest) { throw 'Destino existente; revisa antes de sobreescribir' }
Copy-Item -Path $kit -Destination $dest -Recurse
# Revisar los agentes que están dentro de:
# $dest\06_OPENCODE_COPIAR_AL_REPO\.opencode\agents
# COPIARLOS a $repo\.opencode\agents solo cuando hayas comparado nombres.
```

**Sugerencia:** si necesitas que OpenCode lea el kit sin añadirlo a git, usa `design-references/mercado-cero` pero exclúyelo del commit solo después de decidir política de versionado. Los agentes esperan esa ruta en el proyecto. Dentro de OpenCode, verifica `opencode agent list` y ejecuta el prompt inicial.

**Importante:** no copiar automáticamente `opencode.config.EJEMPLO.json` sobre `opencode.json` existente. No fijar proveedor/modelo sin inspección: OpenCode heredará el seleccionado cuando la configuración de agentes no indique `model`.
