param(
    [switch]$DryRun,
    [switch]$Backup,
    [int]$RetentionDays = 14,
    [string]$OutputDir = ".\backups\database",
    [switch]$InstalledMode,
    [string]$PgDumpPath
)

$ErrorActionPreference = "Stop"

if (!$Backup) {
    $DryRun = $true
}

function Read-EnvFile {
    param([string]$Path)

    $values = @{}
    if (!(Test-Path $Path)) {
        throw "Missing env file: $Path"
    }

    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if (!$trimmed -or $trimmed.StartsWith("#") -or !$trimmed.Contains("=")) {
            continue
        }

        $parts = $trimmed.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$key] = $value
    }

    return $values
}

function Find-PostgresTool {
    param(
        [string]$ToolName,
        [string]$ExplicitPath
    )

    if ($ExplicitPath) {
        if (Test-Path $ExplicitPath) {
            return (Resolve-Path $ExplicitPath).Path
        }
        throw "Provided $ToolName path was not found: $ExplicitPath"
    }

    $fromPath = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    $candidateRoots = @(
        "C:\Program Files\PostgreSQL",
        "C:\Program Files (x86)\PostgreSQL",
        "C:\Program Files\pgAdmin 4"
    )

    $candidates = @()
    foreach ($root in $candidateRoots) {
        if (Test-Path $root) {
            $candidates += Get-ChildItem -Path $root -Recurse -Filter "$ToolName.exe" -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match "\\bin\\$ToolName\.exe$" -or $_.FullName -match "\\runtime\\$ToolName\.exe$" }
        }
    }

    $preferred = $candidates |
        Sort-Object @{ Expression = { if ($_.FullName -match "\\bin\\$ToolName\.exe$") { 0 } else { 1 } } }, FullName -Descending |
        Select-Object -First 1

    if ($preferred) {
        return $preferred.FullName
    }

    return $null
}

function Get-DbInfo {
    param([string]$DatabaseUrl)

    if (!$DatabaseUrl) {
        throw "DATABASE_URL is missing in mwd-app-be/.env."
    }
    if ($DatabaseUrl -match "mwd_test") {
        throw "Refusing to backup testing database mwd_test from central backup script."
    }

    try {
        $uri = [Uri]$DatabaseUrl
        $userInfo = $uri.UserInfo.Split(":", 2)
        return [pscustomobject]@{
            Host = $uri.Host
            Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
            Name = $uri.AbsolutePath.TrimStart("/")
            User = [Uri]::UnescapeDataString($userInfo[0])
            Password = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
        }
    } catch {
        throw "Unable to parse DATABASE_URL. $($_.Exception.Message)"
    }
}

if ($RetentionDays -lt 1) {
    throw "RetentionDays must be >= 1."
}

if ($InstalledMode) {
    $OutputDir = "C:\ProgramData\MWDMonitoringApp\backups\database"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendEnvPath = Join-Path $repoRoot "mwd-app-be\.env"
$envValues = Read-EnvFile $backendEnvPath
$db = Get-DbInfo $envValues["DATABASE_URL"]
$pgDump = Find-PostgresTool -ToolName "pg_dump" -ExplicitPath $PgDumpPath
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $repoRoot $OutputDir }
$backupFile = Join-Path $backupDir "mwd-db-backup-$timestamp.dump"

Write-Host ""
Write-Host "CENTRAL DATABASE BACKUP"
Write-Host ""
Write-Host ("Database backup target: {0}@{1}:{2}/{3}" -f $db.User, $db.Host, $db.Port, $db.Name)
Write-Host ("Backup directory      : {0}" -f $backupDir)
Write-Host ("Backup filename       : {0}" -f (Split-Path -Leaf $backupFile))
Write-Host ("pg_dump found         : {0}" -f ($(if ($pgDump) { "yes" } else { "no" })))
Write-Host ("RetentionDays         : {0}" -f $RetentionDays)
Write-Host ("Dry run only          : {0}" -f ($(if ($DryRun) { "yes" } else { "no" })))
Write-Host "Password              : <redacted>"

if (!$pgDump) {
    Write-Host ""
    Write-Host "pg_dump was not found. Install PostgreSQL client tools or pass -PgDumpPath."
    Write-Host "Final status          : NOT READY"
    exit 1
}

$oldBackups = @()
if (Test-Path $backupDir) {
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $oldBackups = @(Get-ChildItem -Path $backupDir -Filter "mwd-db-backup-*.dump" -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoff })
}
Write-Host ("Retention candidates  : {0}" -f $oldBackups.Count)

if ($DryRun) {
    Write-Host "Final status          : DRY RUN"
    exit 0
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $db.Password
    & $pgDump "-h" $db.Host "-p" $db.Port "-U" $db.User "-F" "c" "-f" $backupFile $db.Name
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE."
    }
} finally {
    $env:PGPASSWORD = $previousPassword
}

$created = Get-Item -Path $backupFile
if ($created.Length -le 0) {
    throw "Backup file was created but is empty."
}

foreach ($old in $oldBackups) {
    Remove-Item -LiteralPath $old.FullName -Force
}

Write-Host ("Backup file           : {0}" -f $created.FullName)
Write-Host ("Backup size bytes     : {0}" -f $created.Length)
Write-Host ("Retention removed     : {0}" -f $oldBackups.Count)
Write-Host "Database modified     : no"
Write-Host "Final status          : READY"
