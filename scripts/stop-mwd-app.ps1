param(
    [switch]$DryRun,
    [switch]$StopPortListeners,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logsDir = Join-Path $repoRoot "service-logs"
$pidFiles = @(
    (Join-Path $logsDir "central-backend.pid")
    (Join-Path $logsDir "central-frontend.pid")
    (Join-Path $logsDir "central-receiver.pid")
)
$centralPorts = @(3000, 5001)
$safePortListenerProcesses = @("node", "npm", "cmd", "powershell", "pwsh")

function Write-AdminStopInstruction {
    param(
        [int]$TargetPid,
        [string]$ProcessName,
        [object[]]$Listeners
    )

    $ports = @($Listeners | Where-Object { $_.PID -eq $TargetPid } | Select-Object -ExpandProperty LocalPort -Unique)
    $portText = if ($ports.Count -gt 0) { $ports -join ", " } else { "unknown" }

    Write-Host ""
    Write-Host ("Access denied while stopping PID {0} ({1})." -f $TargetPid, $ProcessName)
    Write-Host ("Port(s)       : {0}" -f $portText)
    Write-Host "Open PowerShell as Administrator and run:"
    Write-Host ("Stop-Process -Id {0} -Force" -f $TargetPid)
    Write-Host ""
    Write-Host "Helper command to inspect central listeners:"
    Write-Host "Get-NetTCPConnection -LocalPort 3000,5001 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess"
    Write-Host ""
}

function Stop-ProcessTree {
    param(
        [int]$TargetPid,
        [string]$Reason,
        [object[]]$KnownListeners = @()
    )

    $process = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
    if (!$process) {
        Write-Host ("Process already stopped: PID {0}" -f $TargetPid)
        return
    }

    Write-Host ("Stopping PID {0} ({1}) - {2}" -f $process.Id, $process.ProcessName, $Reason)
    if ($DryRun) {
        return $false
    }

    $taskkill = Get-Command taskkill.exe -ErrorAction SilentlyContinue
    if ($taskkill) {
        $outputPath = Join-Path ([System.IO.Path]::GetTempPath()) ("mwd-taskkill-{0}.out" -f ([guid]::NewGuid().ToString("N")))
        $errorPath = Join-Path ([System.IO.Path]::GetTempPath()) ("mwd-taskkill-{0}.err" -f ([guid]::NewGuid().ToString("N")))
        try {
            $taskkillProcess = Start-Process -FilePath $taskkill.Source `
                -ArgumentList @("/PID", [string]$process.Id, "/T", "/F") `
                -Wait `
                -PassThru `
                -WindowStyle Hidden `
                -RedirectStandardOutput $outputPath `
                -RedirectStandardError $errorPath

            $output = @()
            if (Test-Path $outputPath) {
                $output += Get-Content -Path $outputPath -ErrorAction SilentlyContinue
            }
            if (Test-Path $errorPath) {
                $output += Get-Content -Path $errorPath -ErrorAction SilentlyContinue
            }

            if ($taskkillProcess.ExitCode -ne 0) {
                $message = (($output | Out-String).Trim())
                Write-Host ("WARNING: taskkill failed for PID {0}: {1}" -f $process.Id, $message)
                if ($message -match "Access denied") {
                    Write-AdminStopInstruction -TargetPid $process.Id -ProcessName $process.ProcessName -Listeners $KnownListeners
                }
            }
        } finally {
            Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $errorPath -Force -ErrorAction SilentlyContinue
        }

        Start-Sleep -Milliseconds 300
        return -not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)
    }

    try {
        Stop-Process -Id $process.Id -Force -ErrorAction Stop
        Start-Sleep -Milliseconds 300
        return -not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)
    } catch {
        Write-Host ("WARNING: Stop-Process failed for PID {0}: {1}" -f $process.Id, $_.Exception.Message)
        if ($_.Exception.Message -match "Access is denied|Access denied") {
            Write-AdminStopInstruction -TargetPid $process.Id -ProcessName $process.ProcessName -Listeners $KnownListeners
        }
        return $false
    }
}

function Get-ListenerInfo {
    param([int]$Port)

    $items = @()
    try {
        $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
        foreach ($connection in $connections) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            $items += [pscustomobject]@{
                LocalAddress = $connection.LocalAddress
                LocalPort = $connection.LocalPort
                PID = $connection.OwningProcess
                ProcessName = if ($process) { $process.ProcessName } else { "unknown" }
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

                if ([int]$Matches[2] -ne $Port) {
                    continue
                }

                $process = Get-Process -Id ([int]$Matches[3]) -ErrorAction SilentlyContinue
                $items += [pscustomobject]@{
                    LocalAddress = $Matches[1]
                    LocalPort = [int]$Matches[2]
                    PID = [int]$Matches[3]
                    ProcessName = if ($process) { $process.ProcessName } else { "unknown" }
                }
            }
        } catch {
        }
    }

    return $items
}

Write-Host ""
Write-Host "CENTRAL LOCAL SERVER STOP"
Write-Host ""

foreach ($pidFile in $pidFiles) {
    if (!(Test-Path $pidFile)) {
        Write-Host ("PID file missing: {0}" -f $pidFile)
        continue
    }

    $pidText = (Get-Content -Path $pidFile -Raw).Trim()
    if ($pidText -notmatch "^\d+$") {
        Write-Host ("Invalid PID file: {0}" -f $pidFile)
        continue
    }

    $process = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
    if (!$process) {
        Write-Host ("Process already stopped: PID {0}" -f $pidText)
        if (!$DryRun) {
            Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        }
        continue
    }

    $currentListeners = @()
    foreach ($port in $centralPorts) {
        $currentListeners += @(Get-ListenerInfo -Port $port)
    }
    $stopped = Stop-ProcessTree -TargetPid $process.Id -Reason "central PID file" -KnownListeners $currentListeners
    if (!$DryRun -and $stopped) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 500

Write-Host ""
Write-Host "Remaining listeners on central ports:"
$listeners = @()
foreach ($port in $centralPorts) {
    $listeners += @(Get-ListenerInfo -Port $port)
}

if ($listeners.Count -eq 0) {
    Write-Host "No listeners found on ports 3000 or 5001."
} else {
    foreach ($listener in $listeners) {
        Write-Host ("{0}:{1} PID {2} ({3})" -f $listener.LocalAddress, $listener.LocalPort, $listener.PID, $listener.ProcessName)
    }

    if ($StopPortListeners -or $Force) {
        Write-Host ""
        Write-Host "Stopping remaining central port listeners..."
        $listenerPids = @($listeners | Select-Object -ExpandProperty PID -Unique)
        foreach ($listenerPid in $listenerPids) {
            if (!$listenerPid -or $listenerPid -eq 0) {
                continue
            }

            $process = Get-Process -Id ([int]$listenerPid) -ErrorAction SilentlyContinue
            $processName = if ($process) { $process.ProcessName } else { "unknown" }
            $isSafeProcess = $safePortListenerProcesses -contains $processName.ToLowerInvariant()
            if (!$Force -and !$isSafeProcess) {
                Write-Host ("Skipping PID {0} ({1}); use -Force only after verifying it is a central app process." -f $listenerPid, $processName)
                continue
            }

            $null = Stop-ProcessTree -TargetPid ([int]$listenerPid) -Reason "central port listener" -KnownListeners $listeners
        }

        Start-Sleep -Milliseconds 500
        $listeners = @()
        foreach ($port in $centralPorts) {
            $listeners += @(Get-ListenerInfo -Port $port)
        }

        Write-Host ""
        Write-Host "Listeners after stop attempt:"
        if ($listeners.Count -eq 0) {
            Write-Host "No listeners found on ports 3000 or 5001."
        } else {
            foreach ($listener in $listeners) {
                Write-Host ("{0}:{1} PID {2} ({3})" -f $listener.LocalAddress, $listener.LocalPort, $listener.PID, $listener.ProcessName)
            }
            Write-Host "Close remaining listeners manually or rerun from an elevated PowerShell if Windows denies access."
        }
    } else {
        Write-Host "If a remaining listener was not started from a central PID file, close it manually before changing LocalOnly/LAN mode."
        Write-Host "To stop node/npm listeners on central ports, run: powershell -ExecutionPolicy Bypass -File .\scripts\stop-mwd-app.ps1 -StopPortListeners"
    }
}

if ($DryRun) {
    Write-Host "Dry-run only. No process was stopped."
} else {
    Write-Host "Stop command complete."
}
