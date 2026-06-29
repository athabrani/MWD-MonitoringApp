param(
    [switch]$DryRun,
    [switch]$Install,
    [ValidateSet("WinSW")]
    [string]$ServiceManager = "WinSW",
    [string]$ServerHost = "192.168.18.75",
    [int]$BackendPort = 5001,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

if (!$Install) {
    $DryRun = $true
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "mwd-app-be"
$frontendDir = Join-Path $repoRoot "mwd-app-fe"
$logsDir = Join-Path $repoRoot "service-logs"
$backendEnvPath = Join-Path $backendDir ".env"
$frontendEnvPath = Join-Path $frontendDir ".env"
$backendBuild = Join-Path $backendDir "dist\server.js"
$frontendBuild = Join-Path $frontendDir ".next\BUILD_ID"
$winswRoot = Join-Path $repoRoot "service\winsw"
$backendServiceDir = Join-Path $winswRoot "backend"
$frontendServiceDir = Join-Path $winswRoot "frontend"
$receiverServiceDir = Join-Path $winswRoot "receiver"
$backendTemplate = Join-Path $backendServiceDir "MWDMonitoringBackend.xml.template"
$frontendTemplate = Join-Path $frontendServiceDir "MWDMonitoringFrontend.xml.template"

New-Item -ItemType Directory -Force -Path $logsDir, $backendServiceDir, $frontendServiceDir, $receiverServiceDir | Out-Null

function Read-DotEnv {
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
        $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Find-WinSw {
    $candidates = @()
    if ($env:WINSW_PATH) {
        $candidates += $env:WINSW_PATH
    }
    $candidates += @(
        "C:\Tools\winsw\WinSW-x64.exe",
        "C:\winsw\WinSW-x64.exe",
        (Join-Path $repoRoot "tools\winsw\WinSW-x64.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }
    return $null
}

function Find-CommandPath {
    param([string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    return $null
}

function Get-PortListeners {
    param([int[]]$Ports)

    $listeners = @()
    try {
        $connections = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction Stop
        foreach ($connection in $connections) {
            $listeners += [pscustomobject]@{
                LocalAddress = $connection.LocalAddress
                LocalPort = [int]$connection.LocalPort
                OwningProcess = [int]$connection.OwningProcess
            }
        }
        return $listeners
    } catch {
        $netstat = netstat -ano -p tcp
        foreach ($line in $netstat) {
            foreach ($port in $Ports) {
                if ($line -match "^\s*TCP\s+(\S+):$port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
                    $listeners += [pscustomobject]@{
                        LocalAddress = $Matches[1]
                        LocalPort = [int]$port
                        OwningProcess = [int]$Matches[2]
                    }
                }
            }
        }
        return $listeners
    }
}

function Escape-Xml {
    param([string]$Value)
    return [System.Security.SecurityElement]::Escape($Value)
}

function Render-Template {
    param(
        [string]$TemplatePath,
        [hashtable]$Values
    )

    $content = Get-Content -Path $TemplatePath -Raw
    foreach ($key in $Values.Keys) {
        $content = $content.Replace("{{$key}}", (Escape-Xml $Values[$key]))
    }
    return $content
}

$backendEnv = Read-DotEnv $backendEnvPath
$frontendEnv = Read-DotEnv $frontendEnvPath
$winswPath = Find-WinSw
$winswFound = [bool]$winswPath
$nodePath = Find-CommandPath "node.exe"
$npmPath = Find-CommandPath "npm.cmd"
$backendApiUrl = "http://$ServerHost`:$BackendPort"
$expectedCors = "http://$ServerHost`:$FrontendPort"
$manualListeners = @(Get-PortListeners -Ports @($BackendPort, $FrontendPort))

$lanEnvOk = $true
$lanEnvIssues = @()
if ($backendEnv["HOST"] -ne "0.0.0.0" -or $backendEnv["BACKEND_HOST"] -ne "0.0.0.0") {
    $lanEnvOk = $false
    $lanEnvIssues += "Backend HOST/BACKEND_HOST must be 0.0.0.0 for service LAN mode."
}
if ($backendEnv["PORT"] -and $backendEnv["PORT"] -ne "$BackendPort") {
    $lanEnvOk = $false
    $lanEnvIssues += "Backend PORT must be $BackendPort."
}
if (!$backendEnv["CORS_ORIGIN"] -or !$backendEnv["CORS_ORIGIN"].Contains($expectedCors)) {
    $lanEnvOk = $false
    $lanEnvIssues += "CORS_ORIGIN must include $expectedCors."
}
foreach ($name in @("NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_API_URL")) {
    if ($frontendEnv[$name] -ne $backendApiUrl) {
        $lanEnvOk = $false
        $lanEnvIssues += "$name must be $backendApiUrl."
    }
}
if ($frontendEnv["NEXT_PUBLIC_WS_URL"] -notlike "ws://$ServerHost`:$BackendPort*") {
    $lanEnvOk = $false
    $lanEnvIssues += "NEXT_PUBLIC_WS_URL must point to ws://$ServerHost`:$BackendPort."
}

$services = @(
    @{
        Name = "MWDMonitoringBackend"
        SourceExe = $winswPath
        ServiceExe = Join-Path $backendServiceDir "MWDMonitoringBackend.exe"
        Template = $backendTemplate
        Xml = Join-Path $backendServiceDir "MWDMonitoringBackend.xml"
        Values = @{
            BACKEND_DIR = $backendDir
            NODE_EXECUTABLE = $nodePath
            BACKEND_START_ARGUMENTS = "dist/server.js"
            LOG_DIR = $logsDir
        }
    },
    @{
        Name = "MWDMonitoringFrontend"
        SourceExe = $winswPath
        ServiceExe = Join-Path $frontendServiceDir "MWDMonitoringFrontend.exe"
        Template = $frontendTemplate
        Xml = Join-Path $frontendServiceDir "MWDMonitoringFrontend.xml"
        Values = @{
            FRONTEND_DIR = $frontendDir
            NPM_EXECUTABLE = $npmPath
            FRONTEND_START_ARGUMENTS = "run start:central:lan"
            LOG_DIR = $logsDir
        }
    }
)

$installPossible = $winswFound -and $nodePath -and $npmPath -and $lanEnvOk -and (Test-Path $backendBuild) -and (Test-Path $frontendBuild) -and $manualListeners.Count -eq 0

Write-Host ""
Write-Host "CENTRAL SERVICES INSTALL PLAN"
Write-Host ""
Write-Host ("Service manager         : {0}" -f $ServiceManager)
Write-Host ("Mode                    : LAN")
Write-Host ("Server host             : {0}" -f $ServerHost)
Write-Host ("Backend port            : {0}" -f $BackendPort)
Write-Host ("Frontend port           : {0}" -f $FrontendPort)
Write-Host ("WinSW found             : {0}" -f ($(if ($winswFound) { "yes" } else { "no" })))
Write-Host ("WinSW path              : {0}" -f ($(if ($winswFound) { $winswPath } else { "not found" })))
Write-Host ("Node path               : {0}" -f ($(if ($nodePath) { $nodePath } else { "not found" })))
Write-Host ("NPM path                : {0}" -f ($(if ($npmPath) { $npmPath } else { "not found" })))
Write-Host ("Service install possible: {0}" -f ($(if ($installPossible) { "yes" } else { "no" })))
Write-Host ("Backend build           : {0}" -f ($(if (Test-Path $backendBuild) { "found" } else { "missing" })))
Write-Host ("Frontend build          : {0}" -f ($(if (Test-Path $frontendBuild) { "found" } else { "missing" })))
Write-Host ("LAN env                 : {0}" -f ($(if ($lanEnvOk) { "OK" } else { "NOT OK" })))
Write-Host ""

foreach ($issue in $lanEnvIssues) {
    Write-Host ("WARNING: {0}" -f $issue)
}

if ($manualListeners.Count -gt 0) {
    Write-Host "Manual runtime is still running on central ports:"
    foreach ($listener in $manualListeners) {
        Write-Host ("{0}:{1} PID {2}" -f $listener.LocalAddress, $listener.LocalPort, $listener.OwningProcess)
    }
    Write-Host ""
    Write-Host "Manual runtime is still running on port 3000/5001."
    Write-Host "Run:"
    Write-Host "npm run central:reset"
    Write-Host "before installing services."
    Write-Host ""
}

foreach ($service in $services) {
    Write-Host ("Service : {0}" -f $service.Name)
    Write-Host ("WinSW EXE source : {0}" -f ($(if ($winswPath) { $winswPath } else { "not found" })))
    Write-Host ("WinSW EXE target : {0}" -f $service.ServiceExe)
    Write-Host ("XML template     : {0}" -f $service.Template)
    Write-Host ("XML output       : {0}" -f $service.Xml)
    Write-Host ("Workdir          : {0}" -f ($(if ($service.Name -eq "MWDMonitoringBackend") { $backendDir } else { $frontendDir })))
    Write-Host ""
}

Write-Host "Service : MWDMonitoringReceiver"
Write-Host "Status  : pending - receiver service skipped because no standalone receiver entrypoint is verified."
Write-Host ""

if (!$winswFound) {
    Write-Host "WinSW not found."
    Write-Host "Download WinSW x64 from the official GitHub Releases page."
    Write-Host "Place it at:"
    Write-Host "C:\Tools\winsw\WinSW-x64.exe"
    Write-Host ""
    Write-Host "or set:"
    Write-Host '$env:WINSW_PATH="D:\path\to\WinSW-x64.exe"'
    Write-Host ""
    Write-Host "This script will not download WinSW automatically."
}

if ($DryRun) {
    Write-Host "Dry-run only. Re-run with -Install -ServiceManager WinSW to request interactive installation."
    exit 0
}

if (!$winswFound) {
    throw "WinSW was not found. Service install cannot continue."
}
if (!$nodePath -or !$npmPath) {
    throw "node.exe and npm.cmd must be available before installing services."
}
if (!$lanEnvOk) {
    throw "LAN env is not ready. Run npm run central:env:lan, rebuild, and re-check before installing services."
}
if (!(Test-Path $backendBuild)) {
    throw "Backend build missing. Run npm --prefix mwd-app-be run build first."
}
if (!(Test-Path $frontendBuild)) {
    throw "Frontend build missing. Run npm --prefix mwd-app-fe run build first."
}
if ($manualListeners.Count -gt 0) {
    throw "Manual runtime is still running on port 3000/5001. Run npm run central:reset before installing services."
}

Write-Host "This will install auto-start Windows services for backend and frontend using WinSW."
Write-Host "It will not install receiver, apply firewall rules, or modify the database."
$answer = Read-Host "Type INSTALL to continue"
if ($answer -ne "INSTALL") {
    Write-Host "Service install cancelled. No services installed."
    exit 1
}

foreach ($service in $services) {
    $existing = Get-Service -Name $service.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host ("Service already exists: {0}" -f $service.Name)
        continue
    }

    Copy-Item -Path $service.SourceExe -Destination $service.ServiceExe -Force
    $xml = Render-Template -TemplatePath $service.Template -Values $service.Values
    Set-Content -Path $service.Xml -Value $xml -Encoding UTF8

    & $service.ServiceExe install | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install service $($service.Name)."
    }

    Write-Host ("Installed service: {0}" -f $service.Name)
}

Write-Host "Central services installed with WinSW. Receiver service skipped pending manual verification."
