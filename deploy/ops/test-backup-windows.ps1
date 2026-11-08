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

foreach ($name in @('ConvertTo-BackupInstant', 'Test-JudgeCaptureFreshness')) {
    $definition = $ast.Find({ param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq $name
    }, $true)
    if (-not $definition) { throw "Backup timestamp helper missing: $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}

$originalCulture = [Threading.Thread]::CurrentThread.CurrentCulture
$timestampChecks = 0
try {
    foreach ($cultureName in @('es-MX', 'en-US')) {
        [Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::GetCultureInfo($cultureName)
        $iso = '2026-11-08T17:08:11.962542+00:00'
        $expected = [DateTimeOffset]::Parse($iso, [Globalization.CultureInfo]::InvariantCulture)
        $fromJson = '{"capturedAt":"2026-11-08T17:08:11.962542+00:00"}' | ConvertFrom-Json
        $utc = [DateTime]::Parse('2026-11-08T17:08:11.962542Z', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
        # PS7 auto-converts this JSON field to a local DateTime; PS5 keeps ISO
        # text. Explicit vectors cover both paths on either test host.
        foreach ($value in @($iso, $fromJson.capturedAt, $utc, $utc.ToLocalTime(), $expected,
                             '2026-11-08T11:08:11.962542-06:00')) {
            $actual = ConvertTo-BackupInstant $value
            if ($actual.UtcDateTime.Ticks -ne $expected.UtcDateTime.Ticks -or $actual.Offset -ne [TimeSpan]::Zero) {
                throw "Timestamp instant changed under $cultureName"
            }
            $timestampChecks++
        }
        $restic = '{"time":"2026-11-08T17:08:12.123456789Z"}' | ConvertFrom-Json
        $nanoseconds = ConvertTo-BackupInstant $restic.time
        # DateTimeOffset rounds nanoseconds to its nearest 100ns tick.
        $tickPrecision = [DateTimeOffset]::Parse('2026-11-08T17:08:12.1234568Z', [Globalization.CultureInfo]::InvariantCulture)
        if ($nanoseconds.UtcDateTime.Ticks -ne $tickPrecision.UtcDateTime.Ticks) { throw 'Restic fractional timestamp lost its instant' }
        $timestampChecks++
        if (-not (Test-JudgeCaptureFreshness $restic.time $fromJson.capturedAt)) { throw 'Fresh mixed-type capture rejected' }
        $timestampChecks++
        # Keep the original inclusive 15-minute age / 5-minute future bounds.
        foreach ($case in @(
            @{ captured = '2026-11-08T16:53:12Z'; fresh = $true },
            @{ captured = '2026-11-08T16:53:11.9999999Z'; fresh = $false },
            @{ captured = '2026-11-08T17:13:12Z'; fresh = $true },
            @{ captured = '2026-11-08T17:13:12.0000001Z'; fresh = $false }
        )) {
            if ((Test-JudgeCaptureFreshness '2026-11-08T17:08:12Z' $case.captured) -ne $case.fresh) {
                throw 'Judge capture freshness boundary changed'
            }
            $timestampChecks++
        }
        foreach ($invalid in @('', '11/08/2026 11:08:11', '2026-11-08T17:08:12',
                               [DateTime]::SpecifyKind($utc, [DateTimeKind]::Unspecified), $null)) {
            $rejected = $false
            try { $null = ConvertTo-BackupInstant $invalid } catch { $rejected = $true }
            if (-not $rejected) { throw 'Ambiguous/missing backup timestamp accepted' }
            $timestampChecks++
        }
    }
    Write-Output "Windows backup timestamp checks: $timestampChecks PASS (es-MX/en-US)."
} finally {
    [Threading.Thread]::CurrentThread.CurrentCulture = $originalCulture
}
