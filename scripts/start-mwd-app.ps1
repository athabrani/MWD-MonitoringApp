param(
    [switch]$ForceBuild,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BackendDir = Join-Path $Root "mwd-app-be"
$FrontendDir = Join-Path $Root "mwd-app-fe"
$LogDir = Join-Path $Root "service-logs"
$BackendLog = Join-Path $LogDir "backend.log"
$BackendErrorLog = Join-Path $LogDir "backend-error.log"
$FrontendLog = Join-Path $LogDir "frontend.log"
$FrontendErrorLog = Join-Path $LogDir "frontend-error.log"

function Write-Step {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

function Stop-WithError {
    param([string]$Message)
    Write-Fail ""
    Write-Fail $Message
    exit 1
}

function Assert-Path {
    param(
        [string]$Path,
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Stop-WithError "$Description not found: $Path"
    }
}

function Read-EnvFile {
    param([string]$Path)

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }

        $index = $trimmed.IndexOf("=")
        $key = $trimmed.Substring(0, $index).Trim()
        if ($key.StartsWith("export ")) {
            $key = $key.Substring(7).Trim()
        }

        $value = $trimmed.Substring($index + 1).Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ($key) {
            $values[$key] = $value
        }
    }

    return $values
}

function Set-ProcessEnvValues {
    param([hashtable]$Values)

    foreach ($entry in $Values.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable([string]$entry.Key, [string]$entry.Value, "Process")
    }
}

function Get-PackageJson {
    param([string]$Path)
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-ScriptValue {
    param(
        [object]$PackageJson,
        [string]$Name
    )

    $property = $PackageJson.scripts.PSObject.Properties[$Name]
    if ($property) {
        return [string]$property.Value
    }

    return $null
}

function Get-PortFromScript {
    param([string]$Script)

    if (-not $Script) {
        return $null
    }

    if ($Script -match "(?:^|\s)(?:-p|--port)\s+([0-9]+)(?:\s|$)") {
        return [int]$Matches[1]
    }

    return $null
}

function Get-DatabaseInfo {
    param([string]$DatabaseUrl)

    $info = [ordered]@{
        Host = "localhost"
        Port = 5432
        Database = "unknown"
        Parsed = $false
    }

    if (-not $DatabaseUrl) {
        return $info
    }

    try {
        $uri = [System.Uri]$DatabaseUrl
        if ($uri.Host) {
            $info.Host = $uri.Host
        }
        if ($uri.Port -gt 0) {
            $info.Port = $uri.Port
        }
        $database = $uri.AbsolutePath.Trim("/")
        if ($database) {
            $info.Database = $database
        }
        $info.Parsed = $true
    }
    catch {
        $info.Parsed = $false
    }

    return $info
}

function Get-PortListeners {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    $listeners = @()

    foreach ($connection in $connections) {
        $processName = "unknown"
        try {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction Stop
            $processName = $process.ProcessName
        }
        catch {
            $processName = "unknown"
        }

        $listeners += [pscustomobject]@{
            LocalAddress = $connection.LocalAddress
            LocalPort = $connection.LocalPort
            OwningProcess = $connection.OwningProcess
            ProcessName = $processName
        }
    }

    return $listeners
}

function Show-PortOwners {
    param(
        [int]$Port,
        [object[]]$Listeners
    )

    Write-Warn "Port $Port is already in use by:"
    foreach ($listener in $Listeners) {
        Write-Host ("  PID {0} ({1}) on {2}:{3}" -f $listener.OwningProcess, $listener.ProcessName, $listener.LocalAddress, $listener.LocalPort)
    }
}

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 5
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
    }
    catch {
        return $false
    }
}

function Test-BackendHealth {
    param([int]$Port)

    return (Test-HttpOk -Url "http://localhost:$Port/api/health" -TimeoutSec 5)
}

function Wait-ForBackend {
    param(
        [int]$Port,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-BackendHealth -Port $Port) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Wait-ForFrontend {
    param(
        [int]$Port,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpOk -Url "http://localhost:$Port" -TimeoutSec 5) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Show-LogTail {
    param(
        [string]$Path,
        [string]$Label
    )

    if (Test-Path -LiteralPath $Path) {
        Write-Host ""
        Write-Warn "$Label last 30 lines:"
        Get-Content -LiteralPath $Path -Tail 30
    }
}

function Get-NpmCommand {
    $npmCommandInfo = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npmCommandInfo) {
        return $npmCommandInfo.Source
    }

    return (Get-Command npm -ErrorAction Stop).Source
}

function Invoke-NpmScript {
    param(
        [string]$WorkingDirectory,
        [string]$ScriptName,
        [hashtable]$EnvValues = $null
    )

    $npmCommand = Get-NpmCommand
    if ($EnvValues) {
        Set-ProcessEnvValues -Values $EnvValues
    }

    Push-Location $WorkingDirectory
    try {
        & $npmCommand run $ScriptName
        if ($LASTEXITCODE -ne 0) {
            throw "npm run $ScriptName failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Start-NpmProcess {
    param(
        [string]$WorkingDirectory,
        [string]$ScriptName,
        [string]$StdOutLog,
        [string]$StdErrLog,
        [int]$Port,
        [hashtable]$EnvValues = $null
    )

    $npmCommand = Get-NpmCommand
    $previousPort = $env:PORT
    if ($EnvValues) {
        Set-ProcessEnvValues -Values $EnvValues
    }
    $env:PORT = [string]$Port

    try {
        Start-Process `
            -FilePath $npmCommand `
            -ArgumentList "run", $ScriptName `
            -WorkingDirectory $WorkingDirectory `
            -RedirectStandardOutput $StdOutLog `
            -RedirectStandardError $StdErrLog `
            -WindowStyle Hidden | Out-Null
    }
    finally {
        $env:PORT = $previousPort
    }
}

function Test-PostgresReady {
    param(
        [string]$HostName,
        [int]$Port
    )

    $pgIsReady = Get-Command pg_isready -ErrorAction SilentlyContinue
    if ($pgIsReady) {
        & $pgIsReady.Source -h $HostName -p ([string]$Port) | Out-Null
        return ($LASTEXITCODE -eq 0)
    }

    return (Test-NetConnection -ComputerName $HostName -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue)
}

function Get-UrlPortInfo {
    param([string]$Url)

    if (-not $Url) {
        return $null
    }

    try {
        $uri = [System.Uri]$Url
        $port = $uri.Port
        if ($port -lt 0) {
            if ($uri.Scheme -eq "https" -or $uri.Scheme -eq "wss") {
                $port = 443
            }
            else {
                $port = 80
            }
        }

        return [pscustomobject]@{
            Url = $Url
            Host = $uri.Host
            Port = $port
        }
    }
    catch {
        return $null
    }
}

function Test-FrontendBackendPorts {
    param(
        [hashtable]$FrontendEnv,
        [int]$BackendPort
    )

    $keys = @("NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WS_URL")
    $missing = @()
    $mismatches = @()
    $testingPorts = @()

    foreach ($key in $keys) {
        $url = $FrontendEnv[$key]
        if (-not $url) {
            $missing += $key
            continue
        }

        $info = Get-UrlPortInfo -Url $url
        if (-not $info) {
            $mismatches += [pscustomobject]@{
                Key = $key
                Url = $url
                Port = "unparseable"
            }
            continue
        }

        $isLocal = $info.Host -in @("localhost", "127.0.0.1", "::1")
        if ($isLocal -and $info.Port -ne $BackendPort) {
            $mismatches += [pscustomobject]@{
                Key = $key
                Url = $url
                Port = $info.Port
            }
        }

        if ($info.Port -in @(5002, 3002)) {
            $testingPorts += [pscustomobject]@{
                Key = $key
                Url = $url
                Port = $info.Port
            }
        }
    }

    if ($missing.Count -gt 0 -or $testingPorts.Count -gt 0 -or $mismatches.Count -gt 0) {
        Write-Fail ""
        Write-Fail "ERROR: Frontend API URL does not match backend PORT."
        Write-Fail ""
        Write-Fail "Backend PORT: $BackendPort"
        foreach ($missingKey in $missing) {
            Write-Fail ("{0}: missing" -f $missingKey)
        }
        foreach ($mismatch in $mismatches) {
            Write-Fail ("{0}: {1}" -f $mismatch.Key, $mismatch.Url)
        }
        foreach ($testingPort in $testingPorts) {
            Write-Fail ("Testing port detected in {0}: {1}" -f $testingPort.Key, $testingPort.Url)
        }
        Write-Fail ""
        Write-Fail "Fix mwd-app-fe/.env before running operational startup."
        exit 1
    }
}

Write-Step "MWD Monitoring App local production start"
Write-Step "Root: $Root"

Assert-Path -Path $BackendDir -Description "Backend folder"
Assert-Path -Path $FrontendDir -Description "Frontend folder"
Assert-Path -Path (Join-Path $BackendDir "package.json") -Description "Backend package.json"
Assert-Path -Path (Join-Path $FrontendDir "package.json") -Description "Frontend package.json"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
foreach ($logFile in @($BackendLog, $BackendErrorLog, $FrontendLog, $FrontendErrorLog)) {
    if (-not (Test-Path -LiteralPath $logFile)) {
        New-Item -ItemType File -Path $logFile | Out-Null
    }
}

$backendEnvPath = Join-Path $BackendDir ".env"
$frontendEnvLocalPath = Join-Path $FrontendDir ".env.local"
$frontendEnvPath = Join-Path $FrontendDir ".env"
$frontendEnvLocalIgnored = Test-Path -LiteralPath $frontendEnvLocalPath

$backendEnv = Read-EnvFile -Path $backendEnvPath
if (-not (Test-Path -LiteralPath $backendEnvPath)) {
    Write-Warn "Backend .env not found. Using audited default backend port 5001."
}

if (-not (Test-Path -LiteralPath $frontendEnvPath)) {
    Write-Fail ""
    Write-Fail "ERROR: Frontend production env file not found: mwd-app-fe/.env"
    Write-Fail "Create mwd-app-fe/.env or copy from .env.example and adjust values."
    exit 1
}

$frontendEnv = Read-EnvFile -Path $frontendEnvPath
Set-ProcessEnvValues -Values $frontendEnv

if ($frontendEnvLocalIgnored) {
    Write-Warn "WARNING: mwd-app-fe/.env.local exists but is ignored by this operational startup script."
    Write-Warn "This script uses mwd-app-fe/.env only."
}

$backendPackage = Get-PackageJson -Path (Join-Path $BackendDir "package.json")
$frontendPackage = Get-PackageJson -Path (Join-Path $FrontendDir "package.json")

$backendPort = 5001
if ($backendEnv["PORT"] -and $backendEnv["PORT"] -match "^[0-9]+$") {
    $backendPort = [int]$backendEnv["PORT"]
}

$frontendStartScript = Get-ScriptValue -PackageJson $frontendPackage -Name "start"
$frontendPortFromScript = Get-PortFromScript -Script $frontendStartScript
$frontendPort = 3000
if ($frontendPortFromScript) {
    $frontendPort = $frontendPortFromScript
}
elseif ($frontendEnv["PORT"] -and $frontendEnv["PORT"] -match "^[0-9]+$") {
    $frontendPort = [int]$frontendEnv["PORT"]
}

$databaseInfo = Get-DatabaseInfo -DatabaseUrl $backendEnv["DATABASE_URL"]

Write-Host ""
Write-Host "Backend env file : mwd-app-be/.env"
Write-Host "Frontend env file: mwd-app-fe/.env"
Write-Host ("Frontend .env.local ignored: {0}" -f ($(if ($frontendEnvLocalIgnored) { "yes" } else { "no" })))
Write-Host ("Backend PORT      : {0}" -f $backendPort)
Write-Host ("Frontend PORT     : {0}" -f $frontendPort)
Write-Host ("Database          : {0}" -f $databaseInfo.Database)
Write-Host ("Database Host     : {0}" -f $databaseInfo.Host)
Write-Host ("Database Port     : {0}" -f $databaseInfo.Port)
Write-Host "NOTE: NEXT_PUBLIC_* variables are applied at frontend build time."
Write-Host "Run with -ForceBuild after changing mwd-app-fe/.env."
Write-Host ""

Test-FrontendBackendPorts -FrontendEnv $frontendEnv -BackendPort $backendPort

Write-Step "[1/8] Checking PostgreSQL..."
if (-not (Test-PostgresReady -HostName $databaseInfo.Host -Port $databaseInfo.Port)) {
    Write-Fail "PostgreSQL is not reachable at $($databaseInfo.Host):$($databaseInfo.Port)."
    Write-Host "Suggestions:"
    Write-Host "  - Open Windows Services and start PostgreSQL."
    Write-Host "  - Start the PostgreSQL service manually."
    Write-Host "  - Check DATABASE_URL in mwd-app-be/.env."
    exit 1
}
Write-Ok "[1/8] PostgreSQL: OK"

$backendStarted = $false
$frontendStarted = $false

Write-Step "[2/8] Checking backend port $backendPort..."
$backendListeners = @(Get-PortListeners -Port $backendPort)
if ($backendListeners.Count -gt 0) {
    if (Test-BackendHealth -Port $backendPort) {
        Write-Ok "[2/8] Backend already running: http://localhost:$backendPort"
    }
    else {
        Write-Warn "Backend port $backendPort is listening, but MWD health check failed."
        Show-PortOwners -Port $backendPort -Listeners $backendListeners
        Stop-WithError "Close the process using port $backendPort or update mwd-app-be/.env. No process was killed."
    }
}
else {
    Write-Ok "[2/8] Backend port is free."
}

Write-Step "[3/8] Checking frontend port $frontendPort..."
$frontendListeners = @(Get-PortListeners -Port $frontendPort)
if ($frontendListeners.Count -gt 0) {
    if (Test-HttpOk -Url "http://localhost:$frontendPort" -TimeoutSec 5) {
        Write-Ok "[3/8] Frontend already running: http://localhost:$frontendPort"
    }
    else {
        Write-Warn "Frontend port $frontendPort is listening, but HTTP check failed."
        Show-PortOwners -Port $frontendPort -Listeners $frontendListeners
        Stop-WithError "Close the process using port $frontendPort or change the frontend port. No process was killed."
    }
}
else {
    Write-Ok "[3/8] Frontend port is free."
}

Write-Step "[4/8] Checking production builds..."
$backendDist = Join-Path $BackendDir "dist\server.js"
if ($ForceBuild -or -not (Test-Path -LiteralPath $backendDist)) {
    Write-Step "Building backend..."
    Invoke-NpmScript -WorkingDirectory $BackendDir -ScriptName "build"
    Write-Ok "Backend build: OK"
}
else {
    Write-Ok "Backend build exists: $backendDist"
}

$frontendNext = Join-Path $FrontendDir ".next"
if ($ForceBuild -or -not (Test-Path -LiteralPath $frontendNext)) {
    Write-Step "Building frontend..."
    Invoke-NpmScript -WorkingDirectory $FrontendDir -ScriptName "build" -EnvValues $frontendEnv
    Write-Ok "Frontend build: OK"
}
else {
    Write-Ok "Frontend build exists: $frontendNext"
}

if ($backendListeners.Count -eq 0) {
    Write-Step "[5/8] Starting backend production..."
    Start-NpmProcess -WorkingDirectory $BackendDir -ScriptName "start" -StdOutLog $BackendLog -StdErrLog $BackendErrorLog -Port $backendPort
    $backendStarted = $true

    if (-not (Wait-ForBackend -Port $backendPort -TimeoutSec 30)) {
        Show-LogTail -Path $BackendLog -Label "Backend log"
        Show-LogTail -Path $BackendErrorLog -Label "Backend error log"
        Stop-WithError "Backend did not become healthy within 30 seconds."
    }
    Write-Ok "[5/8] Backend running: http://localhost:$backendPort"
}
else {
    Write-Ok "[5/8] Backend start skipped."
}

if ($frontendListeners.Count -eq 0) {
    Write-Step "[6/8] Starting frontend production..."
    Start-NpmProcess -WorkingDirectory $FrontendDir -ScriptName "start" -StdOutLog $FrontendLog -StdErrLog $FrontendErrorLog -Port $frontendPort -EnvValues $frontendEnv
    $frontendStarted = $true

    if (-not (Wait-ForFrontend -Port $frontendPort -TimeoutSec 30)) {
        Show-LogTail -Path $FrontendLog -Label "Frontend log"
        Show-LogTail -Path $FrontendErrorLog -Label "Frontend error log"
        Stop-WithError "Frontend did not become reachable within 30 seconds."
    }
    Write-Ok "[6/8] Frontend running: http://localhost:$frontendPort"
}
else {
    Write-Ok "[6/8] Frontend start skipped."
}

Write-Step "[7/8] Final readiness check..."
if (-not (Test-BackendHealth -Port $backendPort)) {
    Stop-WithError "Backend health check failed before browser open."
}
if (-not (Test-HttpOk -Url "http://localhost:$frontendPort" -TimeoutSec 5)) {
    Stop-WithError "Frontend health check failed before browser open."
}
Write-Ok "[7/8] Backend and frontend are ready."

$browserStatus = "skipped"
if (-not $NoBrowser) {
    Write-Step "[8/8] Opening browser..."
    Start-Process "http://localhost:$frontendPort"
    $browserStatus = "opened"
}
else {
    Write-Step "[8/8] Browser open skipped by -NoBrowser."
}

Write-Host ""
Write-Ok "MWD Monitoring App is running."
Write-Host ""
Write-Host "PostgreSQL : OK"
Write-Host "Backend    : http://localhost:$backendPort"
Write-Host "Frontend   : http://localhost:$frontendPort"
Write-Host "Browser    : $browserStatus"
Write-Host "Logs       : service-logs/"
Write-Host ""
Write-Host "ENV HANDLING:"
Write-Host "Backend env file : mwd-app-be/.env"
Write-Host "Frontend env file: mwd-app-fe/.env"
Write-Host ("Frontend .env.local ignored: {0}" -f ($(if ($frontendEnvLocalIgnored) { "yes" } else { "no" })))
Write-Host "Testing env avoided: yes"
Write-Host "Secrets redacted: yes"
Write-Host ""
Write-Host ("Backend started this run : {0}" -f $backendStarted)
Write-Host ("Frontend started this run: {0}" -f $frontendStarted)
