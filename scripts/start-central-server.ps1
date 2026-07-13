param(
    [switch]$ForceBuild,
    [switch]$NoBrowser,
    [switch]$LanMode,
    [switch]$LocalOnly,
    [string]$ServerHost,
    [int]$BackendPort = 5001,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host "WARNING: $Message" -ForegroundColor Yellow
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

function Set-ProcessEnv {
    param([hashtable]$Values)

    foreach ($key in $Values.Keys) {
        [Environment]::SetEnvironmentVariable($key, [string]$Values[$key], "Process")
    }
}

function Test-ProductionSecurityEnv {
    param([hashtable]$BackendEnv)

    $issues = @()
    $minSecretLength = 32

    $jwtSecret = $BackendEnv["JWT_SECRET"]
    if (!$jwtSecret -or $jwtSecret.Length -lt $minSecretLength) {
        $issues += "JWT_SECRET length must be at least $minSecretLength"
    }

    $cors = $BackendEnv["CORS_ORIGIN"]
    if (!$cors -or $cors.Contains("*")) {
        $issues += "CORS_ORIGIN must be explicitly configured and must not contain wildcard"
    }

    $gatewayApiKey = $BackendEnv["GATEWAY_API_KEY"]
    if ($gatewayApiKey -and $gatewayApiKey.Length -lt $minSecretLength) {
        $issues += "GATEWAY_API_KEY length must be at least $minSecretLength when configured"
    }

    $gatewayHmacSecret = $BackendEnv["GATEWAY_HMAC_SECRET"]
    if ($gatewayHmacSecret -and $gatewayHmacSecret.Length -lt $minSecretLength) {
        $issues += "GATEWAY_HMAC_SECRET length must be at least $minSecretLength when configured"
    }

    $authExposeToken = $BackendEnv["AUTH_EXPOSE_TOKEN"]
    if ($authExposeToken -and @("1", "true", "yes", "on") -contains $authExposeToken.Trim().ToLowerInvariant()) {
        $issues += "AUTH_EXPOSE_TOKEN must be disabled in production"
    }

    $sameSite = if ($BackendEnv["AUTH_COOKIE_SAME_SITE"]) { $BackendEnv["AUTH_COOKIE_SAME_SITE"] } else { $BackendEnv["COOKIE_SAME_SITE"] }
    $secureCookie = if ($BackendEnv["AUTH_COOKIE_SECURE"]) { $BackendEnv["AUTH_COOKIE_SECURE"] } else { $BackendEnv["COOKIE_SECURE"] }
    $secureCookieValue = ""
    if ($secureCookie) {
        $secureCookieValue = $secureCookie.Trim().ToLowerInvariant()
    }
    if ($sameSite -and $sameSite.Trim().ToLowerInvariant() -eq "none" -and !(@("1", "true", "yes", "on") -contains $secureCookieValue)) {
        $issues += "AUTH_COOKIE_SECURE=true is required when AUTH_COOKIE_SAME_SITE=None"
    }

    return $issues
}

function Get-FirstLanIPv4 {
    try {
        $configs = Get-NetIPConfiguration | Where-Object {
            $_.IPv4Address -and $_.NetAdapter.Status -eq "Up"
        }
        foreach ($config in $configs) {
            foreach ($ip in $config.IPv4Address) {
                if ($ip.IPAddress -and $ip.IPAddress -notmatch "^169\.254\." -and $ip.IPAddress -ne "127.0.0.1") {
                    return $ip.IPAddress
                }
            }
        }
    } catch {
        return $null
    }

    return $null
}

function Get-ListenerInfo {
    param([int]$Port)

    $items = @()
    try {
        $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
        foreach ($connection in $connections) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            $commandLine = $null
            try {
                $wmi = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
                $commandLine = $wmi.CommandLine
            } catch {
            }

            $items += [pscustomobject]@{
                PID = $connection.OwningProcess
                ProcessName = $process.ProcessName
                CommandLine = $commandLine
            }
        }
    } catch {
    }

    if ($items.Count -eq 0) {
        foreach ($binding in Get-PortBindingsFromNetstat -Port $Port) {
            $process = Get-Process -Id $binding.OwningProcess -ErrorAction SilentlyContinue
            $items += [pscustomobject]@{
                PID = $binding.OwningProcess
                ProcessName = $process.ProcessName
                CommandLine = $null
            }
        }
    }

    return $items
}

function Get-PortBindingsFromNetstat {
    param([int]$Port)

    $items = @()
    try {
        $lines = & netstat -ano -p tcp 2>$null
        foreach ($line in $lines) {
            $trimmed = $line.Trim()
            if ($trimmed -notmatch "^TCP\s+(.+?):(\d+)\s+\S+\s+LISTENING\s+(\d+)$") {
                continue
            }

            if ([int]$Matches[2] -ne $Port) {
                continue
            }

            $items += [pscustomobject]@{
                LocalAddress = $Matches[1]
                LocalPort = [int]$Matches[2]
                OwningProcess = [int]$Matches[3]
            }
        }
    } catch {
    }

    return $items
}

function Get-PortBindings {
    param([int]$Port)

    try {
        $bindings = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
        if ($bindings.Count -gt 0) {
            return $bindings
        }
    } catch {
    }

    return @(Get-PortBindingsFromNetstat -Port $Port)
}

function Test-LanBinding {
    param(
        [int]$Port,
        [string]$ServerHost
    )

    $bindings = @(Get-PortBindings -Port $Port)
    foreach ($binding in $bindings) {
        if ($binding.LocalAddress -in @("0.0.0.0", "::", $ServerHost)) {
            return $true
        }
    }

    return $false
}

function Write-PortBindings {
    param(
        [string]$Name,
        [int]$Port
    )

    $bindings = @(Get-PortBindings -Port $Port)
    if ($bindings.Count -eq 0) {
        Write-WarnLine "$Name has no listener on port $Port."
        return
    }

    foreach ($binding in $bindings) {
        Write-Host ("{0} binding: {1}:{2} PID {3}" -f $Name, $binding.LocalAddress, $binding.LocalPort, $binding.OwningProcess)
    }
}

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 8
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Get-UrlHost {
    param([string]$Url)

    if (!$Url) {
        return $null
    }

    try {
        return ([Uri]$Url).Host
    } catch {
        return $null
    }
}

function Assert-FrontendEnvMatchesMode {
    param(
        [hashtable]$FrontendEnv,
        [switch]$LanMode,
        [switch]$LocalOnly,
        [string]$ServerHost,
        [int]$BackendPort
    )

    $apiBase = $FrontendEnv["NEXT_PUBLIC_API_BASE_URL"]
    $apiUrl = $FrontendEnv["NEXT_PUBLIC_API_URL"]
    $wsUrl = $FrontendEnv["NEXT_PUBLIC_WS_URL"]

    foreach ($item in @($apiBase, $apiUrl, $wsUrl)) {
        if (!$item) {
            throw "NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_API_URL, and NEXT_PUBLIC_WS_URL must be configured in mwd-app-fe/.env."
        }
        if ($item -notmatch ":$BackendPort(/|$)") {
            Write-WarnLine "Frontend URL '$item' does not appear to target backend port $BackendPort."
        }
    }

    $apiHosts = @(
        (Get-UrlHost $apiBase),
        (Get-UrlHost $apiUrl),
        (Get-UrlHost $wsUrl)
    ) | Where-Object { $_ }
    $loopbackHosts = @("localhost", "127.0.0.1")

    if ($LocalOnly) {
        $nonLocalHosts = @($apiHosts | Where-Object { $loopbackHosts -notcontains $_ })
        if ($nonLocalHosts.Count -gt 0) {
            throw "LocalOnly mode cannot run because frontend env points to LAN backend. Run npm run central:env:local and rebuild frontend."
        }
    }

    if ($LanMode) {
        $loopbackApiHosts = @($apiHosts | Where-Object { $loopbackHosts -contains $_ })
        if ($loopbackApiHosts.Count -gt 0) {
            throw "LAN mode cannot run because frontend env points to LocalOnly backend. Run npm run central:env:lan and rebuild frontend."
        }

        $wrongLanHosts = @($apiHosts | Where-Object { $_ -ne $ServerHost })
        if ($wrongLanHosts.Count -gt 0) {
            throw "LAN mode cannot run because frontend env does not point to $ServerHost. Run npm run central:env:lan and rebuild frontend."
        }
    }
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpOk -Url $Url -TimeoutSec 3) {
            return $true
        }
        Start-Sleep -Seconds 2
    }

    return $false
}

function Assert-PortAvailableOrHealthy {
    param(
        [int]$Port,
        [string]$HealthUrl,
        [string]$LanHealthUrl,
        [switch]$RequireLanReachable,
        [string]$Name
    )

    $listeners = @(Get-ListenerInfo -Port $Port)
    if ($listeners.Count -eq 0) {
        return $false
    }

    if (Test-HttpOk -Url $HealthUrl -TimeoutSec 3) {
        if ($RequireLanReachable -and !(Test-HttpOk -Url $LanHealthUrl -TimeoutSec 3)) {
            Write-Host ""
            Write-WarnLine "$Name is healthy on localhost port $Port, but is not reachable through LAN URL $LanHealthUrl."
            foreach ($item in $listeners) {
                Write-Host ("PID          : {0}" -f $item.PID)
                Write-Host ("Process name : {0}" -f $item.ProcessName)
                if ($item.CommandLine) {
                    Write-Host ("Command line : {0}" -f $item.CommandLine)
                }
            }
            throw "$Name must be restarted in LAN mode or firewall/binding must be reviewed. This script did not stop the existing process."
        }
        Write-Host "$Name already running and healthy on port $Port. Not starting duplicate."
        return $true
    }

    Write-Host ""
    Write-WarnLine "$Name port $Port is already in use and health check failed."
    foreach ($item in $listeners) {
        Write-Host ("PID          : {0}" -f $item.PID)
        Write-Host ("Process name : {0}" -f $item.ProcessName)
        if ($item.CommandLine) {
            Write-Host ("Command line : {0}" -f $item.CommandLine)
        }
    }
    throw "Close the process using port $Port or run an explicit stop script before starting central server."
}

function Invoke-Npm {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (!$npm) {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
    }
    if (!$npm) {
        throw "npm was not found in PATH."
    }

    $process = Start-Process -FilePath $npm.Source -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "npm $($Arguments -join ' ') failed with exit code $($process.ExitCode)."
    }
}

function Disable-FrontendLocalEnv {
    param([string]$Path)

    if (!(Test-Path $Path)) {
        return $null
    }

    $disabledPath = "$Path.central-ignored-$PID"
    Move-Item -LiteralPath $Path -Destination $disabledPath -Force
    Write-WarnLine "Temporarily ignoring mwd-app-fe/.env.local for central server build/start."
    return $disabledPath
}

function Restore-FrontendLocalEnv {
    param(
        [string]$OriginalPath,
        [string]$DisabledPath
    )

    if ($DisabledPath -and (Test-Path $DisabledPath)) {
        Move-Item -LiteralPath $DisabledPath -Destination $OriginalPath -Force
        Write-WarnLine "Restored mwd-app-fe/.env.local after central server build/start."
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "mwd-app-be"
$frontendDir = Join-Path $repoRoot "mwd-app-fe"
$logsDir = Join-Path $repoRoot "service-logs"
$backendEnvPath = Join-Path $backendDir ".env"
$frontendEnvPath = Join-Path $frontendDir ".env"
$frontendLocalEnvPath = Join-Path $frontendDir ".env.local"
$backendBuild = Join-Path $backendDir "dist\server.js"
$frontendBuildDir = Join-Path $frontendDir ".next"

if (!(Test-Path $backendDir) -or !(Test-Path $frontendDir)) {
    throw "Run this script from the MWD Monitoring App repository."
}

if (Test-Path $frontendLocalEnvPath) {
    Write-WarnLine "mwd-app-fe/.env.local exists but is ignored for central local server deployment."
}

if (!$LanMode -and !$LocalOnly) {
    $LocalOnly = $true
}

if ($LanMode -and $LocalOnly) {
    throw "Choose only one mode: -LanMode or -LocalOnly."
}

if ($LanMode -and !$ServerHost) {
    $ServerHost = Get-FirstLanIPv4
    if (!$ServerHost) {
        throw "LanMode requires -ServerHost when no LAN IPv4 address can be detected."
    }
}

if ($LocalOnly) {
    $ServerHost = "127.0.0.1"
}

$listenHost = if ($LanMode) { "0.0.0.0" } else { "127.0.0.1" }
$appUrl = if ($LanMode) { "http://$ServerHost`:$FrontendPort" } else { "http://127.0.0.1:$FrontendPort" }
$backendHealthUrl = "http://127.0.0.1:$BackendPort/api/health"
$frontendHealthUrl = "http://127.0.0.1:$FrontendPort"

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$backendEnv = Read-EnvFile $backendEnvPath
$frontendEnv = Read-EnvFile $frontendEnvPath

if ($BackendPort -in @(5002) -or $FrontendPort -in @(3002)) {
    throw "Refusing to start central server on testing ports 5002/3002."
}

$backendDatabaseUrl = ""
if ($backendEnv.ContainsKey("DATABASE_URL")) {
    $backendDatabaseUrl = $backendEnv["DATABASE_URL"]
}
if ($backendDatabaseUrl -match "mwd_test") {
    throw "Refusing to start central server with DATABASE_URL pointing to mwd_test."
}

Write-Host ""
Write-Host "CENTRAL LOCAL SERVER START"
Write-Host ""
Write-Host ("Mode          : {0}" -f ($(if ($LanMode) { "LAN" } else { "LocalOnly" })))
Write-Host ("Server host   : {0}" -f $ServerHost)
Write-Host ("Backend port  : {0}" -f $BackendPort)
Write-Host ("Frontend port : {0}" -f $FrontendPort)
Write-Host ("App URL       : {0}" -f $appUrl)
Write-Host ""

Write-Step "[1/8] Validating production security env..."
$securityIssues = @(Test-ProductionSecurityEnv $backendEnv)
if ($securityIssues.Count -gt 0) {
    foreach ($issue in $securityIssues) {
        Write-WarnLine $issue
    }
    throw "Backend production security env is not ready. Fix mwd-app-be/.env before starting central server."
}

Write-Step "[2/8] Checking PostgreSQL reachability..."
$dbUrl = $backendEnv["DATABASE_URL"]
if (!$dbUrl) {
    throw "DATABASE_URL is missing in mwd-app-be/.env."
}
try {
    $dbUri = [Uri]$dbUrl
    $dbHost = $dbUri.Host
    $dbPort = if ($dbUri.Port -gt 0) { $dbUri.Port } else { 5432 }
    if (!(Test-NetConnection -ComputerName $dbHost -Port $dbPort -InformationLevel Quiet -WarningAction SilentlyContinue)) {
        throw "PostgreSQL is not reachable at $dbHost`:$dbPort."
    }
} catch {
    throw "PostgreSQL check failed. $($_.Exception.Message)"
}

Write-Step "[3/8] Checking ports..."
$backendLanHealthUrl = "http://$ServerHost`:$BackendPort/api/health"
$frontendLanHealthUrl = "http://$ServerHost`:$FrontendPort"
$backendAlreadyRunning = Assert-PortAvailableOrHealthy -Port $BackendPort -HealthUrl $backendHealthUrl -LanHealthUrl $backendLanHealthUrl -RequireLanReachable:$LanMode -Name "Backend"
$frontendAlreadyRunning = Assert-PortAvailableOrHealthy -Port $FrontendPort -HealthUrl $frontendHealthUrl -LanHealthUrl $frontendLanHealthUrl -RequireLanReachable:$LanMode -Name "Frontend"

if ($ForceBuild -and ($backendAlreadyRunning -or $frontendAlreadyRunning)) {
    throw "Cannot ForceBuild while backend/frontend are still running. Run: npm run central:reset:dryrun; npm run central:reset. If Windows denies access, stop the shown PID manually as Administrator, then retry."
}

Write-Step "[4/8] Validating frontend API and WebSocket URLs..."
Assert-FrontendEnvMatchesMode -FrontendEnv $frontendEnv -LanMode:$LanMode -LocalOnly:$LocalOnly -ServerHost $ServerHost -BackendPort $BackendPort

Write-Step "[5/8] Building production artifacts when needed..."
Set-ProcessEnv $backendEnv
[Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Process")
[Environment]::SetEnvironmentVariable("PORT", [string]$BackendPort, "Process")
[Environment]::SetEnvironmentVariable("HOST", $listenHost, "Process")
[Environment]::SetEnvironmentVariable("BACKEND_HOST", $listenHost, "Process")
if ($ForceBuild -or !(Test-Path $backendBuild)) {
    Invoke-Npm -Arguments @("run", "build") -WorkingDirectory $backendDir
}

Set-ProcessEnv $frontendEnv
$disabledFrontendLocalEnv = Disable-FrontendLocalEnv -Path $frontendLocalEnvPath
try {
    if ($ForceBuild -or !(Test-Path $frontendBuildDir)) {
        Invoke-Npm -Arguments @("run", "build") -WorkingDirectory $frontendDir
    }
} finally {
    Restore-FrontendLocalEnv -OriginalPath $frontendLocalEnvPath -DisabledPath $disabledFrontendLocalEnv
}

Write-Step "[6/8] Starting backend and frontend..."
if (!$backendAlreadyRunning) {
    Set-ProcessEnv $backendEnv
    [Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Process")
    [Environment]::SetEnvironmentVariable("PORT", [string]$BackendPort, "Process")
    [Environment]::SetEnvironmentVariable("HOST", $listenHost, "Process")
    [Environment]::SetEnvironmentVariable("BACKEND_HOST", $listenHost, "Process")
    $backendProcess = Start-Process -FilePath "node" `
        -ArgumentList @("dist/server.js") `
        -WorkingDirectory $backendDir `
        -RedirectStandardOutput (Join-Path $logsDir "backend.log") `
        -RedirectStandardError (Join-Path $logsDir "backend-error.log") `
        -WindowStyle Hidden `
        -PassThru
    Set-Content -Path (Join-Path $logsDir "central-backend.pid") -Value $backendProcess.Id
}

if (!$frontendAlreadyRunning) {
    Set-ProcessEnv $frontendEnv
    $disabledFrontendLocalEnv = Disable-FrontendLocalEnv -Path $frontendLocalEnvPath
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    try {
        if (!$npm) {
            $npm = Get-Command npm -ErrorAction SilentlyContinue
        }
        if (!$npm) {
            throw "npm was not found in PATH."
        }
        $frontendProcess = Start-Process -FilePath $npm.Source `
            -ArgumentList @("run", "start", "--", "-H", $listenHost, "-p", [string]$FrontendPort) `
            -WorkingDirectory $frontendDir `
            -RedirectStandardOutput (Join-Path $logsDir "frontend.log") `
            -RedirectStandardError (Join-Path $logsDir "frontend-error.log") `
            -WindowStyle Hidden `
            -PassThru
        Set-Content -Path (Join-Path $logsDir "central-frontend.pid") -Value $frontendProcess.Id
    } finally {
        Restore-FrontendLocalEnv -OriginalPath $frontendLocalEnvPath -DisabledPath $disabledFrontendLocalEnv
    }
}

Write-Step "[7/8] Waiting for health checks..."
if (!(Wait-HttpOk -Url $backendHealthUrl -TimeoutSec 45)) {
    throw "Backend did not become healthy. Check service-logs/backend-error.log."
}
if (!(Wait-HttpOk -Url $frontendHealthUrl -TimeoutSec 45)) {
    throw "Frontend did not become reachable. Check service-logs/frontend-error.log."
}

if ($LanMode) {
    $lanBackendUrl = "http://$ServerHost`:$BackendPort/api/health"
    $lanFrontendUrl = "http://$ServerHost`:$FrontendPort"
    Write-PortBindings -Name "Backend" -Port $BackendPort
    Write-PortBindings -Name "Frontend" -Port $FrontendPort
    if (!(Test-LanBinding -Port $BackendPort -ServerHost $ServerHost)) {
        throw "Backend is still bound to 127.0.0.1 or has no LAN listener. LAN clients cannot access $ServerHost`:$BackendPort."
    }
    if (!(Test-LanBinding -Port $FrontendPort -ServerHost $ServerHost)) {
        throw "Frontend is still bound to 127.0.0.1 or has no LAN listener. LAN clients cannot access $ServerHost`:$FrontendPort."
    }
    if (!(Test-HttpOk -Url $lanBackendUrl -TimeoutSec 5)) {
        Write-WarnLine "Backend is not reachable through LAN URL $lanBackendUrl. Check HOST binding and firewall."
    }
    if (!(Test-HttpOk -Url $lanFrontendUrl -TimeoutSec 5)) {
        Write-WarnLine "Frontend is not reachable through LAN URL $lanFrontendUrl. Check host binding and firewall."
    }
}

Write-Step "[8/8] Opening app..."
if (!$NoBrowser) {
    Start-Process $appUrl
}

Write-Host ""
Write-Host "Central local server is running."
Write-Host ("Backend logs  : {0}" -f (Join-Path $logsDir "backend.log"))
Write-Host ("Frontend logs : {0}" -f (Join-Path $logsDir "frontend.log"))
Write-Host ("App URL       : {0}" -f $appUrl)
