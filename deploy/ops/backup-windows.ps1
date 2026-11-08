param([switch]$VerifyRestore, [switch]$RequireJudgeBackup)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$taskRoot = $PSScriptRoot
if ($RequireJudgeBackup -or (Test-Path (Join-Path $taskRoot 'judge-backup-required'))) { $VerifyRestore = $true }
$resticExe = Join-Path $taskRoot 'tools\restic.exe'
$mutex = New-Object System.Threading.Mutex($false, 'Local\MercadoCeroOffHostBackup')
if (-not $mutex.WaitOne(0)) { $mutex.Dispose(); exit 0 }
$temporaryPassword = Join-Path $taskRoot ('.password-' + [guid]::NewGuid().ToString('N'))
$previousRepository = $env:RESTIC_REPOSITORY
$previousPassword = $env:RESTIC_PASSWORD_FILE
function Invoke-Restic {
    & $resticExe @args
    if ($LASTEXITCODE -ne 0) { throw "restic failed with exit $LASTEXITCODE" }
}
function Test-RecoveryHelperVersion([string]$Trusted, [string]$Captured) {
    # Git checkouts may use CRLF while container archives use LF (or vice versa).
    # Normalize only that transport difference; all code remains case-sensitive.
    $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $localCode = [IO.File]::ReadAllText($Trusted, $utf8).Replace("`r`n", "`n")
    $capturedCode = [IO.File]::ReadAllText($Captured, $utf8).Replace("`r`n", "`n")
    return [String]::Equals($localCode, $capturedCode, [StringComparison]::Ordinal)
}
try {
    $encrypted = [IO.File]::ReadAllBytes((Join-Path $taskRoot 'restic-password.dpapi'))
    $clear = [Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($temporaryPassword, $clear)
    [Array]::Clear($clear, 0, $clear.Length)
    $env:RESTIC_PASSWORD_FILE = $temporaryPassword
    $env:RESTIC_REPOSITORY = Join-Path $taskRoot 'repository'
    if (-not (Test-Path (Join-Path $env:RESTIC_REPOSITORY 'config'))) { Invoke-Restic init }
    Invoke-Restic -o 'sftp.args=-oBatchMode=yes -oConnectTimeout=20' copy --from-repo 'sftp:zicua-vps:/opt/mercado-cero/pilot/restic-repo' --from-password-file $temporaryPassword --host mercado-cero-pilot
    if ($VerifyRestore) { Invoke-Restic check --read-data } else { Invoke-Restic check }
    $snapshots = & $resticExe snapshots --json --host mercado-cero-pilot | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $snapshots) { throw 'No off-host snapshots available' }
    $latest = $snapshots | Sort-Object time | Select-Object -Last 1
    $snapshotAge = [DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($latest.time)
    if ($snapshotAge.TotalHours -gt 3 -or $snapshotAge.TotalMinutes -lt -5) {
        throw 'Source snapshot is stale or its timestamp is invalid; copying old data is not a current backup'
    }
    $report = [ordered]@{ ok = $true; timestamp = [DateTime]::UtcNow.ToString('o'); sourceSnapshotTime = $latest.time; snapshot = $latest.id; restoreVerified = $false; destination = $taskRoot }
    if ($VerifyRestore) {
        if ($latest.id -notmatch '^[a-f0-9]{64}$') { throw 'Invalid source snapshot identifier' }
        # The full ID plus the 64-character tenant directory exceeds MAX_PATH on
        # this Windows profile. Bind a short folder to the complete ID explicitly.
        $restoreDir = Join-Path $taskRoot ('restore-verification\snap-' + $latest.id.Substring(0,12))
        $snapshotMarker = Join-Path $restoreDir 'source-snapshot-id'
        if (Test-Path $restoreDir) {
            if (-not (Test-Path $snapshotMarker) -or (Get-Content $snapshotMarker -Raw).Trim() -cne $latest.id) {
                throw 'Restore directory is incomplete or belongs to another snapshot'
            }
        } else {
            Invoke-Restic restore $latest.id --target $restoreDir
            Set-Content -LiteralPath $snapshotMarker -Value $latest.id -Encoding ASCII
        }
        $databaseDir = Join-Path $restoreDir 'opt\mercado-cero\pilot\backup-current\database'
        $expected = ((Get-Content (Join-Path $databaseDir 'SHA256SUMS') -Raw).Split(' ')[0]).Trim()
        $actual = (Get-FileHash (Join-Path $databaseDir 'mercado-cero.db') -Algorithm SHA256).Hash
        if ($expected -ne $actual) { throw 'Restored database hash mismatch' }
        $coolifyDir = Join-Path $restoreDir 'opt\mercado-cero\pilot\backup-current\coolify'
        if (Test-Path (Join-Path $coolifyDir 'database.dump')) {
            $expectedDump = ((Get-Content (Join-Path $coolifyDir 'SHA256SUMS') -Raw).Split(' ')[0]).Trim()
            $actualDump = (Get-FileHash (Join-Path $coolifyDir 'database.dump') -Algorithm SHA256).Hash
            if ($expectedDump -ne $actualDump) { throw 'Restored Coolify dump hash mismatch' }
            if (-not (Test-Path (Join-Path $coolifyDir '.env'))) { throw 'Coolify APP_KEY recovery file missing' }
            $report['coolifyDumpSha256'] = $actualDump.ToLowerInvariant()
        }
        & python (Join-Path $taskRoot 'verify-db.py') (Join-Path $databaseDir 'mercado-cero.db')
        if ($LASTEXITCODE -ne 0) { throw 'Restored SQLite validation failed' }
        $report.restoreVerified = $true
        $report.databaseSha256 = $actual.ToLowerInvariant()
        $stageDir = Join-Path $restoreDir 'opt\mercado-cero\pilot\backup-current'
        $judgeDir = Join-Path $stageDir 'judges'
        $judgeTools = Join-Path $stageDir 'judge-tools'
        $judgeExpected = $RequireJudgeBackup -or (Test-Path (Join-Path $taskRoot 'judge-backup-required')) -or
            (Test-Path (Join-Path $stageDir 'config\judge-backup.env')) -or (Test-Path $judgeDir)
        if ($judgeExpected) {
            $localRecovery = Join-Path $taskRoot 'tools\judge-snapshot.mjs'
            $verifier = Join-Path $taskRoot 'verify-judge-snapshot.py'
            if (-not (Test-Path $judgeDir) -or -not (Test-Path $judgeTools)) { throw 'Required judge backup missing' }
            # Never execute a helper recovered from a repository. Require the reviewed,
            # locally installed helper to match the captured runtime version first.
            if (-not (Test-RecoveryHelperVersion $localRecovery (Join-Path $judgeTools 'judge-snapshot.mjs'))) {
                throw 'Judge recovery helper version requires review'
            }
            $sumLines = Get-Content (Join-Path $judgeTools 'SHA256SUMS')
            foreach ($name in @('judge-snapshot.mjs', 'runtime-env.json', 'capture.json')) {
                $line = @($sumLines | Where-Object { $_ -match ('^[a-f0-9]{64}  ' + [regex]::Escape($name) + '$') })
                if ($line.Count -ne 1) { throw 'Judge recovery metadata checksum missing' }
                $hash = (Get-FileHash (Join-Path $judgeTools $name) -Algorithm SHA256).Hash
                if ($hash -ne $line[0].Substring(0,64)) { throw 'Judge recovery metadata checksum mismatch' }
            }
            $capture = Get-Content (Join-Path $judgeTools 'capture.json') -Raw | ConvertFrom-Json
            $captureAge = [DateTimeOffset]::Parse($latest.time) - [DateTimeOffset]::Parse($capture.capturedAt)
            if ($captureAge.TotalMinutes -gt 15 -or $captureAge.TotalMinutes -lt -5) { throw 'Judge capture is stale' }
            & python $verifier $judgeDir --snapshot-time $latest.time
            if ($LASTEXITCODE -ne 0) { throw 'Judge snapshot validation failed' }
            $judgeRestored = Join-Path $restoreDir 'judge-application-restored'
            if (-not (Test-Path $judgeRestored)) {
                & node --no-warnings $localRecovery restore $judgeDir $judgeRestored
                if ($LASTEXITCODE -ne 0) { throw 'Judge restore failed; inactive destination is not approved' }
            }
            $judgeResult = & python $verifier $judgeDir --restored-root $judgeRestored --snapshot-time $latest.time
            if ($LASTEXITCODE -ne 0) { throw 'Judge restored data validation failed' }
            $judgeStatus = $judgeResult | ConvertFrom-Json
            $report['judgeSnapshotVerified'] = $true
            $report['judgeRestoreVerified'] = $true
            $report['judgeAccounts'] = $judgeStatus.accounts
            $report['judgeSessionsRevoked'] = $judgeStatus.sessionsRevoked
        }
    }
    $report | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $taskRoot 'last-success.json')
    Write-Output ($report | ConvertTo-Json -Compress)
} catch {
    @{ ok = $false; timestamp = [DateTime]::UtcNow.ToString('o'); error = $_.Exception.Message } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $taskRoot 'last-failure.json')
    throw
} finally {
    if (Test-Path $temporaryPassword) { Remove-Item -LiteralPath $temporaryPassword -Force }
    $env:RESTIC_REPOSITORY = $previousRepository
    $env:RESTIC_PASSWORD_FILE = $previousPassword
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
