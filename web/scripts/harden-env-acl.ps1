<#
.SYNOPSIS
  Restringe la ACL de web/.env.local al usuario que ejecuta el servidor.

.DESCRIPTION
  Quita la herencia de permisos y deja solo al usuario actual con control
  total. No lee, imprime ni modifica el contenido del archivo.

  Uso (desde cualquier directorio):
    powershell -ExecutionPolicy Bypass -File web/scripts/harden-env-acl.ps1

  Para otro checkout:
    powershell -ExecutionPolicy Bypass -File web/scripts/harden-env-acl.ps1 `
      -Path "C:\ruta\al\checkout\web\.env.local"
#>
param(
  [string]$Path = (Join-Path $PSScriptRoot "..\.env.local")
)

$ErrorActionPreference = "Stop"
$resolved = [System.IO.Path]::GetFullPath($Path)

if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
  Write-Host "Sin cambios: no existe $resolved"
  Write-Host "La ACL se aplicará cuando el checkout tenga su .env.local."
  exit 0
}

$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $resolved /inheritance:r /grant:r "${user}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "icacls falló con código $LASTEXITCODE"
}

Write-Host "ACL restringida a $user (sin herencia)."
Write-Host "No se imprimieron ni modificaron valores del archivo."
