param(
    [string]$ServerHost = "192.168.18.75",
    [int]$BackendPort = 5001,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

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

function Get-ServiceState {
    param([string]$Name)

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (!$service) {
        return "not installed"
    }
    return $service.Status.ToString().ToLowerInvariant()
}

function Test-Url {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch {
        return $false
    }
}

$winswPath = Find-WinSw
$backendName = "MWDMonitoringBackend"
$frontendName = "MWDMonitoringFrontend"
$receiverName = "MWDMonitoringReceiver"
$backendHealthUrl = "http://$ServerHost`:$BackendPort/api/health"
$frontendUrl = "http://$ServerHost`:$FrontendPort"

$backendState = Get-ServiceState $backendName
$frontendState = Get-ServiceState $frontendName
$receiverState = Get-ServiceState $receiverName
if ($receiverState -eq "not installed") {
    $receiverState = "pending"
}

$backendHealth = Test-Url $backendHealthUrl
$frontendHealth = Test-Url $frontendUrl
$finalStatus = "NOT READY"
if ($backendState -eq "running" -and $frontendState -eq "running" -and $backendHealth -and $frontendHealth) {
    $finalStatus = "READY"
} elseif (($backendState -ne "not installed" -or $frontendState -ne "not installed") -or $backendHealth -or $frontendHealth) {
    $finalStatus = "PARTIAL"
}

Write-Host ""
Write-Host "CENTRAL SERVICES CHECK"
Write-Host ""
Write-Host "Service manager       : WinSW"
Write-Host ("WinSW found           : {0}" -f ($(if ($winswPath) { "yes" } else { "no" })))
Write-Host ("WinSW path            : {0}" -f ($(if ($winswPath) { $winswPath } else { "not found" })))
Write-Host ("Backend service       : {0}" -f $backendState)
Write-Host ("Frontend service      : {0}" -f $frontendState)
Write-Host ("Receiver service      : {0}" -f $receiverState)
Write-Host ("Backend health        : {0}" -f ($(if ($backendHealth) { "OK" } else { "FAIL" })))
Write-Host ("Frontend health       : {0}" -f ($(if ($frontendHealth) { "OK" } else { "FAIL" })))
Write-Host ("LAN frontend URL      : {0}" -f $frontendUrl)
Write-Host ("LAN backend health    : {0}" -f $backendHealthUrl)
Write-Host ("Final status          : {0}" -f $finalStatus)
