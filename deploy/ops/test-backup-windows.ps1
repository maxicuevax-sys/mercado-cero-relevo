$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot 'backup-windows.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Backup script syntax failed' }
$function = $ast.Find({ param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -eq 'Test-RecoveryHelperVersion'
}, $true)
if (-not $function) { throw 'Helper version check missing' }
. ([scriptblock]::Create($function.Extent.Text))
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('judge-helper-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
try {
    $trusted = Join-Path $fixture 'trusted.mjs'
    $captured = Join-Path $fixture 'captured.mjs'
    [IO.File]::WriteAllText($trusted, "const Value = 1;`n")
    [IO.File]::WriteAllText($captured, "const Value = 1;`r`n")
    if (-not (Test-RecoveryHelperVersion $trusted $captured)) { throw 'Line ending transport rejected' }
    [IO.File]::WriteAllText($captured, "const value = 1;`n")
    if (Test-RecoveryHelperVersion $trusted $captured) { throw 'Case-sensitive code change accepted' }
    [IO.File]::WriteAllText($captured, "const Value = 2;`n")
    if (Test-RecoveryHelperVersion $trusted $captured) { throw 'Changed code accepted' }
    Write-Output 'Windows recovery helper checks: 3/3 PASS.'
} finally {
    # Only remove explicitly created fixture files; no recursive filesystem action.
    Remove-Item -LiteralPath $trusted, $captured -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $fixture -Force
}
