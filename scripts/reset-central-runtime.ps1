param(
    [switch]$DryRun,
    [switch]$ConfirmStop
)

$ErrorActionPreference = "Stop"

if (!$ConfirmStop) {
    $DryRun = $true
}

$centralPorts = @(3000, 5001)

function Get-ProcessCommandLine {
    param([int]$ProcessId)

    try {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
        return $process.CommandLine
    } catch {
        return $null
    }
}

function Get-ListenerInfo {
    param([int[]]$Ports)

    $items = @()
    try {
        $connections = Get-NetTCPConnection -State Listen -LocalPort $Ports -ErrorAction SilentlyContinue
        foreach ($connection in $connections) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            $items += [pscustomobject]@{
                LocalAddress = $connection.LocalAddress
                LocalPort = $connection.LocalPort
                PID = $connection.OwningProcess
                ProcessName = if ($process) { $process.ProcessName } else { "unknown" }
                Path = if ($process) { $process.Path } else { $null }
                CommandLine = Get-ProcessCommandLine -ProcessId $connection.OwningProcess
            }
        }
    } catch {
    }

    if ($items.Count -eq 0) {
        try {
            $lines = & netstat -ano -p tcp 2>$null
            foreach ($line in $lines) {
                $trimmed = $line.Trim()
                if ($trimmed -notmatch "^TCP\s+(.+?):(\d+)\s+\S+\s+LISTENING\s+(\d+)$") {
                    continue
                }

                $port = [int]$Matches[2]
                if ($Ports -notcontains $port) {
                    continue
                }

                $pidValue = [int]$Matches[3]
                $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
                $items += [pscustomobject]@{
                    LocalAddress = $Matches[1]
                    LocalPort = $port
                    PID = $pidValue
                    ProcessName = if ($process) { $process.ProcessName } else { "unknown" }
                    Path = if ($process) { $process.Path } else { $null }
                    CommandLine = Get-ProcessCommandLine -ProcessId $pidValue
                }
            }
        } catch {
        }
    }

    return @($items | Sort-Object LocalPort, PID -Unique)
}

function Write-AdminInstruction {
    param(
        [int]$ProcessId,
        [string]$ProcessName,
        [int[]]$Ports
    )

    Write-Host ""
    Write-Host ("Access denied while stopping PID {0} ({1})." -f $ProcessId, $ProcessName)
    Write-Host ("Port(s)       : {0}" -f ($Ports -join ", "))
    Write-Host "Open PowerShell as Administrator and run:"
    Write-Host ("Stop-Process -Id {0} -Force" -f $ProcessId)
    Write-Host ""
    Write-Host "Helper command:"
    Write-Host "Get-NetTCPConnection -LocalPort 3000,5001 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess"
    Write-Host ""
}

function Stop-CentralPid {
    param(
        [int]$ProcessId,
        [string]$ProcessName,
        [int[]]$Ports
    )

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (!$process) {
        Write-Host ("Process already stopped: PID {0}" -f $ProcessId)
        return
    }

    Write-Host ("Stopping PID {0} ({1}) on port(s) {2}" -f $ProcessId, $ProcessName, ($Ports -join ", "))
    try {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    } catch {
        Write-Host ("WARNING: Stop-Process failed for PID {0}: {1}" -f $ProcessId, $_.Exception.Message)
        if ($_.Exception.Message -match "Access is denied|Access denied") {
            Write-AdminInstruction -ProcessId $ProcessId -ProcessName $ProcessName -Ports $Ports
        }
    }
}

Write-Host ""
Write-Host "CENTRAL RUNTIME RESET"
Write-Host ""
Write-Host ("Mode : {0}" -f ($(if ($ConfirmStop) { "ConfirmStop" } else { "DryRun" })))
Write-Host "Ports: 3000, 5001"
Write-Host "PostgreSQL will not be stopped."
Write-Host ""

$listeners = @(Get-ListenerInfo -Ports $centralPorts)

if ($listeners.Count -eq 0) {
    Write-Host "No listeners found on central runtime ports."
    exit 0
}

Write-Host "Detected listeners:"
foreach ($listener in $listeners) {
    Write-Host ("{0}:{1} PID {2} ({3})" -f $listener.LocalAddress, $listener.LocalPort, $listener.PID, $listener.ProcessName)
    if ($listener.Path) {
        Write-Host ("  Path        : {0}" -f $listener.Path)
    }
    if ($listener.CommandLine) {
        Write-Host ("  CommandLine : {0}" -f $listener.CommandLine)
    }
}

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry-run only. Re-run with -ConfirmStop to stop only these port listeners."
    exit 0
}

$groups = $listeners | Group-Object PID
foreach ($group in $groups) {
    $pidValue = [int]$group.Name
    if ($pidValue -eq 0) {
        continue
    }

    $first = $group.Group | Select-Object -First 1
    $ports = @($group.Group | Select-Object -ExpandProperty LocalPort -Unique)
    Stop-CentralPid -ProcessId $pidValue -ProcessName $first.ProcessName -Ports $ports
}

Start-Sleep -Milliseconds 500
$remaining = @(Get-ListenerInfo -Ports $centralPorts)

Write-Host ""
Write-Host "Listeners after reset attempt:"
if ($remaining.Count -eq 0) {
    Write-Host "No listeners found on central runtime ports."
} else {
    foreach ($listener in $remaining) {
        Write-Host ("{0}:{1} PID {2} ({3})" -f $listener.LocalAddress, $listener.LocalPort, $listener.PID, $listener.ProcessName)
    }
    Write-Host "If listeners remain, run the shown Stop-Process commands from an elevated PowerShell."
}
