param(
    [string]$OutputDir = ".\backups\database",
    [switch]$InstalledMode
)

$ErrorActionPreference = "Stop"

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

if ($InstalledMode) {
    $OutputDir = "C:\ProgramData\MWDMonitoringApp\backups\database"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendEnvPath = Join-Path $repoRoot "mwd-app-be\.env"
$envValues = Read-EnvFile $backendEnvPath
$databaseUrl = $envValues["DATABASE_URL"]

if (!$databaseUrl) {
    throw "DATABASE_URL is missing in mwd-app-be/.env."
}
if ($databaseUrl -match "mwd_test") {
    throw "Refusing to backup testing database mwd_test from central backup script."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (!$pgDump) {
    throw "pg_dump was not found in PATH. Install PostgreSQL client tools on the server."
}

try {
    $uri = [Uri]$databaseUrl
    $dbHost = $uri.Host
    $dbPort = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    $dbName = $uri.AbsolutePath.TrimStart("/")
    $userInfo = $uri.UserInfo.Split(":", 2)
    $dbUser = [Uri]::UnescapeDataString($userInfo[0])
    $dbPassword = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
} catch {
    throw "Unable to parse DATABASE_URL. $($_.Exception.Message)"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $OutputDir "mwd-db-$dbName-$timestamp.dump"

$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $dbPassword
    & $pgDump.Source "-h" $dbHost "-p" $dbPort "-U" $dbUser "-F" "c" "-f" $backupFile $dbName
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE."
    }
} finally {
    $env:PGPASSWORD = $previousPassword
}

Write-Host "Database backup complete."
Write-Host ("Database : {0}" -f $dbName)
Write-Host ("Output   : {0}" -f (Resolve-Path $backupFile).Path)
Write-Host "Password : <redacted>"
