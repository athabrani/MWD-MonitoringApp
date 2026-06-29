param(
    [string]$BackupFile,
    [string]$TargetDatabase,
    [switch]$DryRun,
    [switch]$Restore,
    [switch]$AllowProductionRestore,
    [string]$PgRestorePath
)

$ErrorActionPreference = "Stop"

if (!$Restore) {
    $DryRun = $true
}

function Read-EnvFile {
    param([string]$Path)
    $values = @{}
    if (!(Test-Path $Path)) { throw "Missing env file: $Path" }
    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if (!$trimmed -or $trimmed.StartsWith("#") -or !$trimmed.Contains("=")) { continue }
        $parts = $trimmed.Split("=", 2)
        $value = $parts[1].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$parts[0].Trim()] = $value
    }
    return $values
}

function Find-PostgresTool {
    param([string]$ToolName, [string]$ExplicitPath)
    if ($ExplicitPath) {
        if (Test-Path $ExplicitPath) { return (Resolve-Path $ExplicitPath).Path }
        throw "Provided $ToolName path was not found: $ExplicitPath"
    }
    $fromPath = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($fromPath) { return $fromPath.Source }
    $roots = @("C:\Program Files\PostgreSQL", "C:\Program Files (x86)\PostgreSQL", "C:\Program Files\pgAdmin 4")
    $candidates = @()
    foreach ($root in $roots) {
        if (Test-Path $root) {
            $candidates += Get-ChildItem -Path $root -Recurse -Filter "$ToolName.exe" -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match "\\bin\\$ToolName\.exe$" -or $_.FullName -match "\\runtime\\$ToolName\.exe$" }
        }
    }
    $preferred = $candidates | Sort-Object FullName -Descending | Select-Object -First 1
    if ($preferred) { return $preferred.FullName }
    return $null
}

function Get-DbInfo {
    param([string]$DatabaseUrl)
    if (!$DatabaseUrl) { throw "DATABASE_URL is missing in mwd-app-be/.env." }
    $uri = [Uri]$DatabaseUrl
    $userInfo = $uri.UserInfo.Split(":", 2)
    return [pscustomobject]@{
        Host = $uri.Host
        Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
        Name = $uri.AbsolutePath.TrimStart("/")
        User = [Uri]::UnescapeDataString($userInfo[0])
        Password = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envValues = Read-EnvFile (Join-Path $repoRoot "mwd-app-be\.env")
$prodDb = Get-DbInfo $envValues["DATABASE_URL"]
$pgRestore = Find-PostgresTool -ToolName "pg_restore" -ExplicitPath $PgRestorePath

if (!$BackupFile) {
    $BackupFile = "<required>"
}
if (!$TargetDatabase) {
    $TargetDatabase = "mwd_restore_verify"
}

$backupExists = $BackupFile -ne "<required>" -and (Test-Path $BackupFile)
$targetIsProduction = $TargetDatabase -eq $prodDb.Name

Write-Host ""
Write-Host "CENTRAL DATABASE RESTORE PLAN"
Write-Host ""
Write-Host ("Backup file           : {0}" -f $BackupFile)
Write-Host ("Backup exists         : {0}" -f ($(if ($backupExists) { "yes" } else { "no" })))
Write-Host ("Production database   : {0}" -f $prodDb.Name)
Write-Host ("Target database       : {0}" -f $TargetDatabase)
Write-Host ("Target is production  : {0}" -f ($(if ($targetIsProduction) { "yes" } else { "no" })))
Write-Host ("pg_restore found      : {0}" -f ($(if ($pgRestore) { "yes" } else { "no" })))
Write-Host ("Dry run only          : {0}" -f ($(if ($DryRun) { "yes" } else { "no" })))
Write-Host "Password              : <redacted>"

if ($DryRun) {
    Write-Host "Final status          : DRY RUN"
    exit 0
}

if (!$backupExists) { throw "BackupFile not found." }
if (!$pgRestore) { throw "pg_restore was not found. Install PostgreSQL client tools or pass -PgRestorePath." }

if ($targetIsProduction) {
    if (!$AllowProductionRestore) {
        throw "Refusing production restore. Use -AllowProductionRestore and explicit confirmation only after extra backup."
    }
    $answer = Read-Host "Type RESTORE PRODUCTION to continue"
    if ($answer -ne "RESTORE PRODUCTION") {
        Write-Host "Restore cancelled."
        exit 1
    }
}

$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $prodDb.Password
    & $pgRestore "-h" $prodDb.Host "-p" $prodDb.Port "-U" $prodDb.User "-d" $TargetDatabase "--no-owner" "--no-privileges" $BackupFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore failed with exit code $LASTEXITCODE."
    }
} finally {
    $env:PGPASSWORD = $previousPassword
}

Write-Host "Final status          : READY"
