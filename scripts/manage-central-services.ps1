param(
    [switch]$Start,
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Status,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

if (!$Start -and !$Stop -and !$Restart -and !$Status -and !$Uninstall) {
    $Status = $true
}

$services = @("MWDMonitoringBackend", "MWDMonitoringFrontend", "MWDMonitoringReceiver")

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Write-AdminInstruction {
    param(
        [string]$Action,
        [string]$Name,
        [string]$ErrorMessage
    )

    Write-Host ("{0,-24}: {1} failed" -f $Name, $Action)
    Write-Host ("Reason: {0}" -f $ErrorMessage)
    if (!(Test-IsAdministrator)) {
        Write-Host "Open PowerShell as Administrator and run:"
        Write-Host ("cd `"{0}`"" -f (Resolve-Path (Join-Path $PSScriptRoot "..")).Path)
        if ($Action -eq "start") {
            Write-Host "npm run central:services:start"
        } elseif ($Action -eq "stop") {
            Write-Host "npm run central:services:stop"
        } elseif ($Action -eq "restart") {
            Write-Host "npm run central:services:restart"
        } else {
            Write-Host ("{0}-Service -Name {1}" -f ($Action.Substring(0,1).ToUpper() + $Action.Substring(1)), $Name)
        }
    }
}

function Show-Status {
    foreach ($name in $services) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (!$service) {
            $state = if ($name -eq "MWDMonitoringReceiver") { "pending" } else { "not installed" }
            Write-Host ("{0,-24}: {1}" -f $name, $state)
            continue
        }
        Write-Host ("{0,-24}: {1}" -f $name, $service.Status)
    }
}

function Start-CentralService {
    param([string]$Name)

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (!$service) {
        $state = if ($Name -eq "MWDMonitoringReceiver") { "pending" } else { "not installed" }
        Write-Host ("{0,-24}: {1}" -f $Name, $state)
        return
    }
    if ($service.Status -eq "Running") {
        Write-Host ("{0,-24}: already running" -f $Name)
        return
    }
    try {
        Start-Service -Name $Name -ErrorAction Stop
        Write-Host ("{0,-24}: start requested" -f $Name)
    } catch {
        Write-AdminInstruction -Action "start" -Name $Name -ErrorMessage $_.Exception.Message
    }
}

function Stop-CentralService {
    param([string]$Name)

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (!$service) {
        $state = if ($Name -eq "MWDMonitoringReceiver") { "pending" } else { "not installed" }
        Write-Host ("{0,-24}: {1}" -f $Name, $state)
        return
    }
    if ($service.Status -eq "Stopped") {
        Write-Host ("{0,-24}: already stopped" -f $Name)
        return
    }
    try {
        Stop-Service -Name $Name -ErrorAction Stop
        Write-Host ("{0,-24}: stop requested" -f $Name)
    } catch {
        Write-AdminInstruction -Action "stop" -Name $Name -ErrorMessage $_.Exception.Message
    }
}

Write-Host ""
Write-Host "CENTRAL SERVICES MANAGE"
Write-Host "Service manager: WinSW"
Write-Host ""

if ($Uninstall) {
    Write-Host "This will uninstall installed MWD Monitoring WinSW services."
    Write-Host "It will not delete logs, env files, database data, or application builds."
    $answer = Read-Host "Type UNINSTALL to continue"
    if ($answer -ne "UNINSTALL") {
        Write-Host "Uninstall cancelled. No services removed."
        exit 1
    }
    foreach ($name in @("MWDMonitoringReceiver", "MWDMonitoringFrontend", "MWDMonitoringBackend")) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (!$service) {
            $state = if ($name -eq "MWDMonitoringReceiver") { "pending" } else { "not installed" }
            Write-Host ("{0,-24}: {1}" -f $name, $state)
            continue
        }
        if ($service.Status -ne "Stopped") {
            try {
                Stop-Service -Name $name -ErrorAction Stop
            } catch {
                Write-AdminInstruction -Action "stop" -Name $name -ErrorMessage $_.Exception.Message
                continue
            }
        }
        $exe = Get-ChildItem -Path (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "service\winsw") -Recurse -Filter "$name.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exe) {
            try {
                & $exe.FullName uninstall | Out-Null
                Write-Host ("{0,-24}: uninstall requested" -f $name)
            } catch {
                Write-AdminInstruction -Action "uninstall" -Name $name -ErrorMessage $_.Exception.Message
            }
        } else {
            Write-Host ("{0,-24}: service exists but WinSW exe was not found" -f $name)
        }
    }
}

if ($Stop -or $Restart) {
    foreach ($name in @("MWDMonitoringReceiver", "MWDMonitoringFrontend", "MWDMonitoringBackend")) {
        Stop-CentralService -Name $name
    }
}

if ($Start -or $Restart) {
    foreach ($name in @("MWDMonitoringBackend", "MWDMonitoringFrontend", "MWDMonitoringReceiver")) {
        Start-CentralService -Name $name
    }
}

if ($Status -or $Start -or $Stop -or $Restart -or $Uninstall) {
    Write-Host ""
    Show-Status
}
