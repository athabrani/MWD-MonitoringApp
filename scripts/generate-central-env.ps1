param(
    [string]$ServerHost,
    [int]$BackendPort = 5001,
    [int]$FrontendPort = 3000,
    [switch]$LocalOnly,
    [switch]$LanMode,
    [switch]$Apply,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (!$Apply) {
    $DryRun = $true
}

if (!$LocalOnly -and !$LanMode) {
    $DryRun = $true
    if (!$ServerHost) {
        $LocalOnly = $true
    } else {
        $LanMode = $true
    }
}

if ($LocalOnly -and $LanMode) {
    throw "Choose only one mode: -LocalOnly or -LanMode."
}

if ($LocalOnly) {
    $ServerHost = "127.0.0.1"
}

if ($LanMode -and !$ServerHost) {
    throw "LanMode requires -ServerHost. Example: -LanMode -ServerHost 192.168.18.75"
}

if ($BackendPort -in @(5002) -or $FrontendPort -in @(3002)) {
    throw "Refusing to generate central env for testing ports 5002/3002."
}

function Read-EnvFile {
    param([string]$Path)

    $orderedKeys = New-Object System.Collections.Generic.List[string]
    $values = @{}
    $rawLines = @()

    if (Test-Path $Path) {
        $rawLines = Get-Content -Path $Path
        foreach ($line in $rawLines) {
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
            if (!$values.ContainsKey($key)) {
                $orderedKeys.Add($key) | Out-Null
            }
            $values[$key] = $value
        }
    }

    return @{
        Keys = $orderedKeys
        Values = $values
    }
}

function Set-EnvValue {
    param(
        [hashtable]$EnvData,
        [string]$Key,
        [string]$Value
    )

    if (!$EnvData.Values.ContainsKey($Key)) {
        $EnvData.Keys.Add($Key) | Out-Null
    }
    $EnvData.Values[$Key] = $Value
}

function ConvertTo-EnvLines {
    param([hashtable]$EnvData)

    $lines = @()
    foreach ($key in $EnvData.Keys) {
        $lines += "$key=$($EnvData.Values[$key])"
    }
    return $lines
}

function Backup-And-WriteEnv {
    param(
        [string]$Path,
        [string[]]$Lines
    )

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    if (Test-Path $Path) {
        Copy-Item -Path $Path -Destination "$Path.central-backup-$timestamp" -Force
    }
    Set-Content -Path $Path -Value $Lines -Encoding UTF8
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendEnvPath = Join-Path $repoRoot "mwd-app-be\.env"
$frontendEnvPath = Join-Path $repoRoot "mwd-app-fe\.env"

if (!(Test-Path $backendEnvPath)) {
    throw "Missing backend env: mwd-app-be/.env"
}
if (!(Test-Path $frontendEnvPath)) {
    throw "Missing frontend env: mwd-app-fe/.env"
}

$backendEnv = Read-EnvFile $backendEnvPath
$frontendEnv = Read-EnvFile $frontendEnvPath

$modeLabel = if ($LanMode) { "LAN" } else { "LocalOnly" }
$frontendApi = "http://$ServerHost`:$BackendPort"
$frontendWs = "ws://$ServerHost`:$BackendPort/ws"
$frontendOrigin = "http://$ServerHost`:$FrontendPort"
$backendHost = if ($LanMode) { "0.0.0.0" } else { "127.0.0.1" }

Set-EnvValue -EnvData $frontendEnv -Key "NEXT_PUBLIC_API_BASE_URL" -Value $frontendApi
Set-EnvValue -EnvData $frontendEnv -Key "NEXT_PUBLIC_API_URL" -Value $frontendApi
Set-EnvValue -EnvData $frontendEnv -Key "NEXT_PUBLIC_WS_URL" -Value $frontendWs
Set-EnvValue -EnvData $backendEnv -Key "HOST" -Value $backendHost
Set-EnvValue -EnvData $backendEnv -Key "BACKEND_HOST" -Value $backendHost
Set-EnvValue -EnvData $backendEnv -Key "PORT" -Value ([string]$BackendPort)
Set-EnvValue -EnvData $backendEnv -Key "AUTH_COOKIE_SECURE" -Value "false"
Set-EnvValue -EnvData $backendEnv -Key "AUTH_COOKIE_SAME_SITE" -Value "Lax"
Set-EnvValue -EnvData $backendEnv -Key "COOKIE_SECURE" -Value "false"
Set-EnvValue -EnvData $backendEnv -Key "COOKIE_SAME_SITE" -Value "lax"

$existingCors = @()
if ($backendEnv.Values.ContainsKey("CORS_ORIGIN") -and $backendEnv.Values["CORS_ORIGIN"]) {
    $existingCors = $backendEnv.Values["CORS_ORIGIN"].Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

$requiredCors = @("http://localhost:$FrontendPort", "http://127.0.0.1:$FrontendPort")
if ($LanMode) {
    $requiredCors += $frontendOrigin
}
$nextCors = @($requiredCors) | ForEach-Object { $_ } | Where-Object { $_ } | Select-Object -Unique
Set-EnvValue -EnvData $backendEnv -Key "CORS_ORIGIN" -Value ($nextCors -join ",")

Write-Host ""
Write-Host "CENTRAL $modeLabel ENV PLAN"
Write-Host ""
Write-Host ("Mode          : {0}" -f $modeLabel)
Write-Host ("Server host   : {0}" -f $ServerHost)
Write-Host ("Backend host  : {0}" -f $backendHost)
Write-Host ("Backend port  : {0}" -f $BackendPort)
Write-Host ("Frontend port : {0}" -f $FrontendPort)
Write-Host ""
Write-Host "Frontend env changes:"
Write-Host ("NEXT_PUBLIC_API_BASE_URL={0}" -f $frontendApi)
Write-Host ("NEXT_PUBLIC_API_URL={0}" -f $frontendApi)
Write-Host ("NEXT_PUBLIC_WS_URL={0}" -f $frontendWs)
Write-Host ""
Write-Host "Backend env changes:"
Write-Host ("HOST={0}" -f $backendHost)
Write-Host ("BACKEND_HOST={0}" -f $backendHost)
Write-Host ("PORT={0}" -f $BackendPort)
Write-Host ("CORS_ORIGIN={0}" -f ($nextCors -join ","))
Write-Host "AUTH_COOKIE_SECURE=false"
Write-Host "AUTH_COOKIE_SAME_SITE=Lax"
Write-Host "COOKIE_SECURE=false"
Write-Host "COOKIE_SAME_SITE=lax"
Write-Host ""
Write-Host "Files touched only with -Apply:"
Write-Host "mwd-app-fe/.env"
Write-Host "mwd-app-be/.env"
Write-Host ""
Write-Host "Files never touched:"
Write-Host "mwd-app-fe/.env.local"
Write-Host "mwd-app-fe/.env.testing"
Write-Host "mwd-app-be/.env.testing"
Write-Host ".env.example files"

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry-run only. Re-run with -Apply to backup and update env files."
    exit 0
}

Backup-And-WriteEnv -Path $frontendEnvPath -Lines (ConvertTo-EnvLines $frontendEnv)
Backup-And-WriteEnv -Path $backendEnvPath -Lines (ConvertTo-EnvLines $backendEnv)

Write-Host ""
Write-Host "Central $modeLabel env applied. Rebuild frontend before using this mode because NEXT_PUBLIC_* values are build-time variables."
