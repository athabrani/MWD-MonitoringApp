param(
    [string]$ServerHost,
    [string]$ExpectedBranch = "package",
    [switch]$LanMode,
    [switch]$LocalOnly
)

$ErrorActionPreference = "Stop"

function Write-Result {
    param(
        [string]$Label,
        [string]$Value
    )
    Write-Host ("{0,-18}: {1}" -f $Label, $Value)
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host "WARNING: $Message" -ForegroundColor Yellow
}

function Read-EnvFile {
    param([string]$Path)

    $values = @{}
    if (!(Test-Path $Path)) {
        return $values
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

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-BranchName {
    param([string]$RepoRoot)

    try {
        $safeRoot = $RepoRoot.Replace("\", "/")
        $branch = & git -c "safe.directory=$safeRoot" branch --show-current 2>$null
        if ($LASTEXITCODE -eq 0 -and $branch) {
            return $branch.Trim()
        }
    } catch {
    }

    try {
        $headPath = Join-Path $RepoRoot ".git\HEAD"
        if (Test-Path $headPath) {
            $head = (Get-Content -Path $headPath -Raw).Trim()
            if ($head -match "^ref:\s+refs/heads/(.+)$") {
                return $Matches[1]
            }
            if ($head) {
                return "detached"
            }
        }
    } catch {
    }

    return "unknown"
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

function Get-PortFromUrl {
    param(
        [string]$Url,
        [int]$DefaultHttpPort = 80,
        [int]$DefaultHttpsPort = 443
    )

    if (!$Url) {
        return $null
    }

    try {
        $uri = [Uri]$Url
        if ($uri.Port -gt 0) {
            return $uri.Port
        }
        if ($uri.Scheme -in @("https", "wss")) {
            return $DefaultHttpsPort
        }
        return $DefaultHttpPort
    } catch {
        return $null
    }
}

function Get-HostFromUrl {
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

function Test-PortListening {
    param([int]$Port)

    return [bool]@(Get-PortBindings -Port $Port)
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

function Get-BindingSummary {
    param([int]$Port)

    $bindings = @(Get-PortBindings -Port $Port)
    if ($bindings.Count -eq 0) {
        return "none"
    }

    return (($bindings | ForEach-Object { "$($_.LocalAddress):$($_.LocalPort)" }) -join ", ")
}

function Test-LoginApiReachable {
    param(
        [string]$ServerHost,
        [int]$BackendPort,
        [string]$Origin
    )

    try {
        $response = Invoke-WebRequest `
            -Uri "http://$ServerHost`:$BackendPort/api/auth/login" `
            -UseBasicParsing `
            -TimeoutSec 4 `
            -Method Options `
            -Headers @{
                Origin = $Origin
                "Access-Control-Request-Method" = "POST"
                "Access-Control-Request-Headers" = "content-type"
            }
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch [System.Net.WebException] {
        return $false
    } catch {
        return $false
    }
}

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 4
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Test-PostgreSql {
    param([hashtable]$BackendEnv)

    $pgIsReady = Get-Command pg_isready -ErrorAction SilentlyContinue
    if ($pgIsReady) {
        try {
            & pg_isready | Out-Null
            if ($LASTEXITCODE -eq 0) {
                return "OK"
            }
        } catch {
        }
    }

    $dbUrl = $BackendEnv["DATABASE_URL"]
    if (!$dbUrl) {
        return "NOT READY"
    }

    try {
        $uri = [Uri]$dbUrl
        $hostName = $uri.Host
        $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
        if (Test-NetConnection -ComputerName $hostName -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue) {
            return "OK"
        }
    } catch {
    }

    return "NOT READY"
}

function Test-CorsConfig {
    param(
        [hashtable]$BackendEnv,
        [string]$ExpectedOrigin
    )

    $cors = $BackendEnv["CORS_ORIGIN"]
    if (!$cors) {
        return "WARNING"
    }

    $origins = $cors.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if ($origins -contains $ExpectedOrigin) {
        return "OK"
    }

    return "WARNING"
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

function Test-BrowserInstalled {
    param(
        [string]$CommandName,
        [string[]]$CommonPaths
    )

    if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
        return $true
    }

    foreach ($path in $CommonPaths) {
        if ($path -and (Test-Path $path)) {
            return $true
        }
    }

    return $false
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

if ($LocalOnly -and !$ServerHost) {
    $ServerHost = "127.0.0.1"
}

$repoRoot = Get-RepoRoot
$backendDir = Join-Path $repoRoot "mwd-app-be"
$frontendDir = Join-Path $repoRoot "mwd-app-fe"
$backendEnvPath = Join-Path $backendDir ".env"
$frontendEnvPath = Join-Path $frontendDir ".env"
$frontendLocalEnvPath = Join-Path $frontendDir ".env.local"

$backendEnv = Read-EnvFile $backendEnvPath
$frontendEnv = Read-EnvFile $frontendEnvPath

$branch = Get-BranchName $repoRoot
$backendPort = 5001
if ($backendEnv["PORT"] -and $backendEnv["PORT"] -match "^\d+$") {
    $backendPort = [int]$backendEnv["PORT"]
}
$frontendPort = 3000
if ($frontendEnv["PORT"] -and $frontendEnv["PORT"] -match "^\d+$") {
    $frontendPort = [int]$frontendEnv["PORT"]
}

$mode = if ($LanMode) { "LAN" } else { "LocalOnly" }
$frontendOrigin = "http://$ServerHost`:$frontendPort"
$apiBaseUrl = $frontendEnv["NEXT_PUBLIC_API_BASE_URL"]
$apiUrl = $frontendEnv["NEXT_PUBLIC_API_URL"]
$wsUrl = $frontendEnv["NEXT_PUBLIC_WS_URL"]
$apiPort = Get-PortFromUrl $apiBaseUrl
$apiHost = Get-HostFromUrl $apiBaseUrl
$wsPort = Get-PortFromUrl $wsUrl
$wsHost = Get-HostFromUrl $wsUrl

$apiStatus = "OK"
if (!$apiBaseUrl -or $apiPort -ne $backendPort) {
    $apiStatus = "NOT OK"
}
if ($LanMode -and $apiHost -in @("localhost", "127.0.0.1")) {
    $apiStatus = "NOT OK"
}
if ($LocalOnly -and $apiHost -and $apiHost -notin @("localhost", "127.0.0.1")) {
    $apiStatus = "NOT OK"
}

$wsStatus = "OK"
if (!$wsUrl -or $wsPort -ne $backendPort) {
    $wsStatus = "NOT OK"
}
if ($LanMode -and $wsHost -in @("localhost", "127.0.0.1")) {
    $wsStatus = "NOT OK"
}
if ($LocalOnly -and $wsHost -and $wsHost -notin @("localhost", "127.0.0.1")) {
    $wsStatus = "NOT OK"
}

$corsStatus = Test-CorsConfig -BackendEnv $backendEnv -ExpectedOrigin $frontendOrigin
$backendListening = Test-PortListening $backendPort
$frontendListening = Test-PortListening $frontendPort
$backendBindingOk = if ($LanMode) { Test-LanBinding -Port $backendPort -ServerHost $ServerHost } else { $backendListening }
$frontendBindingOk = if ($LanMode) { Test-LanBinding -Port $frontendPort -ServerHost $ServerHost } else { $frontendListening }
$backendBindingSummary = Get-BindingSummary -Port $backendPort
$frontendBindingSummary = Get-BindingSummary -Port $frontendPort
$backendLocal = Test-HttpOk "http://127.0.0.1:$backendPort/api/health"
$frontendLocal = Test-HttpOk "http://127.0.0.1:$frontendPort"
$backendLan = if ($LanMode) { Test-HttpOk "http://$ServerHost`:$backendPort/api/health" } else { $backendLocal }
$frontendLan = if ($LanMode) { Test-HttpOk "http://$ServerHost`:$frontendPort" } else { $frontendLocal }
$lanLoginApi = if ($LanMode) { Test-LoginApiReachable -ServerHost $ServerHost -BackendPort $backendPort -Origin $frontendOrigin } else { $backendLocal }
$backendBuild = Test-Path (Join-Path $backendDir "dist\server.js")
$frontendBuild = Test-Path (Join-Path $frontendDir ".next")
$receiverFound = (Test-Path (Join-Path $backendDir "src\services\serial-gateway.service.ts")) -or (Test-Path (Join-Path $backendDir "dist\services\serial-gateway.service.js"))
$edgeFound = Test-BrowserInstalled -CommandName "msedge.exe" -CommonPaths @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
)
$chromeFound = Test-BrowserInstalled -CommandName "chrome.exe" -CommonPaths @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$shortcutScriptFound = Test-Path (Join-Path $repoRoot "scripts\create-central-shortcut.ps1")
$postgres = Test-PostgreSql $backendEnv
$securityIssues = @(Test-ProductionSecurityEnv $backendEnv)
$securityStatus = if ($securityIssues.Count -eq 0) { "OK" } else { "NOT OK" }
$authExposeToken = $backendEnv["AUTH_EXPOSE_TOKEN"]
$authExposeEnabled = $authExposeToken -and @("1", "true", "yes", "on") -contains $authExposeToken.Trim().ToLowerInvariant()
$authCookieStatus = if ($securityStatus -eq "OK" -and !$authExposeEnabled) { "OK" } else { "NOT OK" }

$finalReady = $true
foreach ($condition in @(
    (Test-Path $repoRoot),
    ($branch -eq $ExpectedBranch),
    (Test-Path $backendDir),
    (Test-Path $frontendDir),
    (Test-Path $backendEnvPath),
    (Test-Path $frontendEnvPath),
    ($postgres -eq "OK"),
    ($apiStatus -eq "OK"),
    ($wsStatus -eq "OK"),
    ($corsStatus -eq "OK"),
    ($securityStatus -eq "OK"),
    $backendBuild,
    $frontendBuild
)) {
    if (!$condition) {
        $finalReady = $false
    }
}

if ($LanMode -and (!$backendLan -or !$frontendLan -or !$backendBindingOk -or !$frontendBindingOk -or !$lanLoginApi)) {
    $finalReady = $false
}

Write-Host ""
Write-Host "CENTRAL LOCAL SERVER CHECK"
Write-Host ""
Write-Result "Repository" "OK"
Write-Result "Branch" $branch
Write-Result "Expected branch" $ExpectedBranch
if ($branch -ne $ExpectedBranch) {
    Write-WarnLine "Current branch is '$branch', expected '$ExpectedBranch'. No checkout was performed."
}
Write-Result "Backend env" "mwd-app-be/.env"
Write-Result "Frontend env" "mwd-app-fe/.env"
if (Test-Path $frontendLocalEnvPath) {
    Write-Result ".env.local" "exists but ignored"
    Write-WarnLine "mwd-app-fe/.env.local exists but is ignored for central local server deployment."
} else {
    Write-Result ".env.local" "not found"
}
Write-Result "PostgreSQL" $postgres
Write-Result "Backend port" "$backendPort"
Write-Result "Frontend port" "$frontendPort"
Write-Result "Server host" $ServerHost
Write-Result "Mode" $mode
Write-Result "API URL" $apiStatus
Write-Result "WS URL" $wsStatus
Write-Result "CORS" $corsStatus
Write-Result "Security env" $securityStatus
Write-Result "Auth cookie" $authCookieStatus
Write-Result "Backend binding" $(if ($backendBindingOk) { "OK" } else { "NOT OK" })
Write-Result "Frontend binding" $(if ($frontendBindingOk) { "OK" } else { "NOT OK" })
Write-Result "Backend bindings" $backendBindingSummary
Write-Result "Frontend bindings" $frontendBindingSummary
if ($LanMode) {
    Write-Result "LAN backend listen" $(if ($backendBindingOk) { $backendBindingSummary } else { "NOT OK" })
    Write-Result "LAN frontend listen" $(if ($frontendBindingOk) { $frontendBindingSummary } else { "NOT OK" })
    Write-Result "Frontend URL" $frontendOrigin
    Write-Result "Backend health" $(if ($backendLan) { "OK" } else { "NOT OK" })
}
Write-Result "Backend local" $(if ($backendLocal) { "OK" } else { "NOT READY" })
Write-Result "Backend LAN" $(if ($backendLan) { "OK" } else { "NOT READY" })
Write-Result "Backend IP health" $(if ($backendLan) { "OK" } else { "NOT OK" })
Write-Result "Frontend local" $(if ($frontendLocal) { "OK" } else { "NOT READY" })
Write-Result "Frontend LAN" $(if ($frontendLan) { "OK" } else { "NOT READY" })
Write-Result "Frontend IP access" $(if ($frontendLan) { "OK" } else { "NOT OK" })
Write-Result "LAN login API" $(if ($lanLoginApi) { "reachable" } else { "refused" })
Write-Result "Receiver" $(if ($receiverFound) { "found" } else { "not found" })
Write-Result "Health endpoint" $(if ($backendLocal -or $backendLan) { "OK" } else { "NOT READY" })
Write-Result "Build backend" $(if ($backendBuild) { "found" } else { "missing" })
Write-Result "Build frontend" $(if ($frontendBuild) { "found" } else { "missing" })
Write-Result "Edge" $(if ($edgeFound) { "found" } else { "not found" })
Write-Result "Chrome" $(if ($chromeFound) { "found" } else { "not found" })
Write-Result "Shortcut script" $(if ($shortcutScriptFound) { "found" } else { "missing" })
Write-Result "Backend port listen" $(if ($backendListening) { "listening" } else { "not listening" })
Write-Result "Frontend port listen" $(if ($frontendListening) { "listening" } else { "not listening" })
Write-Result "Final status" $(if ($finalReady) { "READY" } else { "NOT READY" })

if ($LanMode -and ($apiStatus -ne "OK" -or $wsStatus -ne "OK")) {
    Write-Host ""
    Write-WarnLine "For LAN mode, rebuild frontend after setting NEXT_PUBLIC_* to http/ws://$ServerHost`:$backendPort."
}

if ($corsStatus -ne "OK") {
    Write-WarnLine "CORS_ORIGIN should include $frontendOrigin for this mode."
}

if ($LanMode -and !$backendBindingOk) {
    Write-WarnLine "Backend LAN is NOT READY because backend is bound to 127.0.0.1 only or has no LAN listener."
}

if ($LanMode -and !$frontendBindingOk) {
    Write-WarnLine "Frontend LAN is NOT READY because frontend is bound to 127.0.0.1 only or has no LAN listener."
}

foreach ($issue in $securityIssues) {
    Write-WarnLine $issue
}

if ($finalReady) {
    exit 0
}

exit 1
