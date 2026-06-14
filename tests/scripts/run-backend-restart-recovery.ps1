$ErrorActionPreference = "Stop"

$root = "C:\Users\athallah\Documents\Code\MWD-MonitoringApp"
$frontendRoot = Join-Path $root "mwd-app-fe"
$backendRoot = Join-Path $root "mwd-app-be"
$markerDir = Join-Path $root "tests\results\recovery\markers"
$frontendOrigin = $env:E2E_BASE_URL
if (-not $frontendOrigin) {
  $frontendOrigin = "http://localhost:3002"
}
$backendCorsOrigins = "http://localhost:3002,http://127.0.0.1:3002,http://localhost:3000,http://127.0.0.1:3000"
$backendRestartRuns = if ($env:BACKEND_RESTART_RUNS) {
  [int]$env:BACKEND_RESTART_RUNS
}
else {
  3
}
if ($backendRestartRuns -lt 1) {
  $backendRestartRuns = 3
}

New-Item -ItemType Directory -Force $markerDir | Out-Null

function Read-EnvFile {
  param([Parameter(Mandatory)] [string] $Path)

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  Get-Content $Path | ForEach-Object {
    if ($_ -notmatch '^[A-Za-z_][A-Za-z0-9_]*=') {
      return
    }

    $parts = $_ -split '=', 2
    $value = $parts[1].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$parts[0]] = $value
  }

  return $values
}

$baseBackendEnv = Read-EnvFile (Join-Path $backendRoot ".env")
$localBackendEnv = Read-EnvFile (Join-Path $backendRoot ".env.local")
$testingBackendEnv = Read-EnvFile (Join-Path $backendRoot ".env.testing")

foreach ($key in $localBackendEnv.Keys) {
  if ($localBackendEnv[$key]) {
    $baseBackendEnv[$key] = $localBackendEnv[$key]
  }
}

function Get-BackendEnvValue {
  param([Parameter(Mandatory)] [string] $Name)

  if ($testingBackendEnv.ContainsKey($Name) -and $testingBackendEnv[$Name]) {
    return $testingBackendEnv[$Name]
  }
  if ($baseBackendEnv.ContainsKey($Name) -and $baseBackendEnv[$Name]) {
    return $baseBackendEnv[$Name]
  }
  return $null
}

$usingTestingDatabase = $testingBackendEnv.ContainsKey("DATABASE_URL") -and $testingBackendEnv["DATABASE_URL"]

if (-not $env:E2E_ENGINEER_USERNAME) {
  $env:E2E_ENGINEER_USERNAME = $(if ($usingTestingDatabase) { "engineer_test" } elseif (Get-BackendEnvValue "ENGINEER_USERNAME") { Get-BackendEnvValue "ENGINEER_USERNAME" } else { "engineer_test" })
}
if (-not $env:E2E_ENGINEER_PASSWORD -and -not $env:E2E_TEST_PASSWORD) {
  $env:E2E_ENGINEER_PASSWORD = $(if ($usingTestingDatabase) { "TestPassword123!" } elseif (Get-BackendEnvValue "ENGINEER_PASSWORD") { Get-BackendEnvValue "ENGINEER_PASSWORD" } else { "TestPassword123!" })
}
if (-not $env:E2E_GATEWAY_API_KEY) {
  $env:E2E_GATEWAY_API_KEY = Get-BackendEnvValue "GATEWAY_API_KEY"
}
if (-not $env:E2E_GATEWAY_HMAC_SECRET) {
  $env:E2E_GATEWAY_HMAC_SECRET = Get-BackendEnvValue "GATEWAY_HMAC_SECRET"
}

function Get-ListenerPid {
  param([Parameter(Mandatory)] [int] $Port)

  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)"
  $listenerLine = netstat -ano |
    Select-String -Pattern $pattern |
    Select-Object -First 1

  if (-not $listenerLine) {
    return $null
  }

  $match = [regex]::Match($listenerLine.Line, 'LISTENING\s+(\d+)\s*$')
  if (-not $match.Success) {
    return $null
  }

  return [int]$match.Groups[1].Value
}

function Get-BackendPid {
  return Get-ListenerPid -Port 5002
}

function Start-Backend {
  param(
    [Parameter(Mandatory)] [string] $RunLabel,
    [Parameter(Mandatory)] [string] $Phase
  )

  Set-Location $backendRoot
  $backendStdoutLog = Join-Path $markerDir "backend-restart-run-$RunLabel-backend-$Phase.out.log"
  $backendStderrLog = Join-Path $markerDir "backend-restart-run-$RunLabel-backend-$Phase.err.log"
  Remove-Item $backendStdoutLog, $backendStderrLog -ErrorAction SilentlyContinue

  $previousPort = $env:PORT
  $previousCorsOrigin = $env:CORS_ORIGIN
  $previousNodeEnv = $env:NODE_ENV
  $previousSerialGatewayEnabled = $env:SERIAL_GATEWAY_ENABLED
  $previousDatabaseUrl = $env:DATABASE_URL
  $previousJwtSecret = $env:JWT_SECRET
  $previousGatewayApiKey = $env:GATEWAY_API_KEY
  $previousGatewayHmacSecret = $env:GATEWAY_HMAC_SECRET

  $env:PORT = "5002"
  $env:CORS_ORIGIN = $backendCorsOrigins
  $env:NODE_ENV = "test"
  $env:SERIAL_GATEWAY_ENABLED = "false"
  $env:DATABASE_URL = Get-BackendEnvValue "DATABASE_URL"
  $env:JWT_SECRET = Get-BackendEnvValue "JWT_SECRET"
  $env:GATEWAY_API_KEY = Get-BackendEnvValue "GATEWAY_API_KEY"
  $env:GATEWAY_HMAC_SECRET = Get-BackendEnvValue "GATEWAY_HMAC_SECRET"

  $backend = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList @("dist/server.js") `
    -PassThru `
    -RedirectStandardOutput $backendStdoutLog `
    -RedirectStandardError $backendStderrLog `
    -WindowStyle Hidden

  $env:PORT = $previousPort
  $env:CORS_ORIGIN = $previousCorsOrigin
  $env:NODE_ENV = $previousNodeEnv
  $env:SERIAL_GATEWAY_ENABLED = $previousSerialGatewayEnabled
  $env:DATABASE_URL = $previousDatabaseUrl
  $env:JWT_SECRET = $previousJwtSecret
  $env:GATEWAY_API_KEY = $previousGatewayApiKey
  $env:GATEWAY_HMAC_SECRET = $previousGatewayHmacSecret

  return @{
    Process = $backend
    StdoutLog = $backendStdoutLog
    StderrLog = $backendStderrLog
  }
}

function Wait-Port {
  param(
    [Parameter(Mandatory)] [bool] $Open,
    [int] $TimeoutSeconds = 60,
    [string] $FailureContext = ""
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $success = (Test-NetConnection -ComputerName localhost -Port 5002 -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($success -eq $Open) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  $context = if ($FailureContext) { "`n$FailureContext" } else { "" }
  throw "Port 5002 did not reach expected open=$Open state.$context"
}

function Wait-FrontendPort {
  param([int] $TimeoutSeconds = 60)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $success = (Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($success) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Frontend port 3002 did not become ready."
}

function Start-Frontend {
  $frontendPid = Get-ListenerPid -Port 3002
  if ($frontendPid) {
    Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }

  $stdoutLog = Join-Path $markerDir "frontend-3002-runner.out.log"
  $stderrLog = Join-Path $markerDir "frontend-3002-runner.err.log"
  Remove-Item $stdoutLog, $stderrLog -ErrorAction SilentlyContinue

  $frontend = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "start:port-3002") `
    -WorkingDirectory $frontendRoot `
    -PassThru `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden

  Start-Sleep -Milliseconds 500
  $frontend.Refresh()
  if ($frontend.HasExited) {
    $stdout = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw } else { "" }
    $stderr = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw } else { "" }
    throw "Frontend process exited before readiness. ExitCode=$($frontend.ExitCode)`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
  }

  Wait-FrontendPort -TimeoutSeconds 60
  return $frontend
}

function Assert-BackendCorsReady {
  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Method Options `
      -Uri "http://localhost:5002/api/auth/login" `
      -Headers @{
        Origin = $frontendOrigin
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type"
      }

    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
      throw "Unexpected preflight status $($response.StatusCode)."
    }
  } catch {
    throw "Backend on port 5002 is not ready for frontend origin $frontendOrigin. Restart backend with PORT=5002 and CORS_ORIGIN=$backendCorsOrigins. Details: $($_.Exception.Message)"
  }
}

function Assert-WebSocketReady {
  try {
    $client = [System.Net.WebSockets.ClientWebSocket]::new()
    $client.Options.SetRequestHeader("Origin", $frontendOrigin)
    $cts = [System.Threading.CancellationTokenSource]::new()
    $cts.CancelAfter(5000)
    $client.ConnectAsync([Uri]"ws://localhost:5002/ws", $cts.Token).GetAwaiter().GetResult()

    if ($client.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
      throw "Unexpected WebSocket state $($client.State)."
    }

    $client.Dispose()
    $cts.Dispose()
  } catch {
    throw "Backend WebSocket /ws is not ready for frontend origin $frontendOrigin. Details: $($_.Exception.Message)"
  }
}

function Assert-BackendProcessRunning {
  param([Parameter(Mandatory)] $BackendStart)

  Start-Sleep -Milliseconds 500
  $BackendStart.Process.Refresh()
  if ($BackendStart.Process.HasExited) {
    $backendStdout = if (Test-Path $BackendStart.StdoutLog) { Get-Content $BackendStart.StdoutLog -Raw } else { "" }
    $backendStderr = if (Test-Path $BackendStart.StderrLog) { Get-Content $BackendStart.StderrLog -Raw } else { "" }
    throw "Backend process exited before readiness checks completed. ExitCode=$($BackendStart.Process.ExitCode)`nBackend STDOUT:`n$backendStdout`nBackend STDERR:`n$backendStderr"
  }
}

$frontendProcess = Start-Frontend

$initialBackendPid = Get-BackendPid
if ($initialBackendPid) {
  Stop-Process -Id $initialBackendPid -Force
  Wait-Port -Open $false -TimeoutSeconds 30
}

$initialBackend = Start-Backend -RunLabel "00" -Phase "initial"
try {
  Assert-BackendProcessRunning $initialBackend
  Wait-Port -Open $true -TimeoutSeconds 60
  Assert-BackendCorsReady
  Assert-WebSocketReady
} catch {
  $backendStdout = if (Test-Path $initialBackend.StdoutLog) { Get-Content $initialBackend.StdoutLog -Raw } else { "" }
  $backendStderr = if (Test-Path $initialBackend.StderrLog) { Get-Content $initialBackend.StderrLog -Raw } else { "" }
  throw "Initial backend did not become ready on port 5002.`nBackend STDOUT:`n$backendStdout`nBackend STDERR:`n$backendStderr"
}

$overallFailed = $false

for ($run = 1; $run -le $backendRestartRuns; $run++) {
  $runLabel = "{0:D2}" -f $run
  $browserReadyMarker = Join-Path $markerDir "backend-restart-run-$runLabel-browser-ready.txt"
  $stopRequestedMarker = Join-Path $markerDir "backend-restart-run-$runLabel-backend-stop-requested.txt"
  $stoppedMarker = Join-Path $markerDir "backend-restart-run-$runLabel-backend-stopped.txt"
  $restoredMarker = Join-Path $markerDir "backend-restart-run-$runLabel-backend-restored.txt"
  $testCompleteMarker = Join-Path $markerDir "backend-restart-run-$runLabel-test-complete.txt"
  $oldReadyMarker = Join-Path $markerDir "backend-restart-run-$runLabel-ready.txt"
  $oldInterruptedMarker = Join-Path $markerDir "backend-restart-run-$runLabel-interrupted.txt"
  $oldRestoredMarker = Join-Path $markerDir "backend-restart-run-$runLabel-restored.txt"

  Remove-Item `
    $browserReadyMarker, `
    $stopRequestedMarker, `
    $stoppedMarker, `
    $restoredMarker, `
    $testCompleteMarker, `
    $oldReadyMarker, `
    $oldInterruptedMarker, `
    $oldRestoredMarker `
    -ErrorAction SilentlyContinue

  Set-Location $frontendRoot
  $env:RECOVERY_SCENARIO = "backend-restart"
  $env:RECOVERY_RUN_NUMBER = [string]$run
  $env:NEXT_PUBLIC_E2E_MODE = "true"

  $stdoutLog = Join-Path $markerDir "backend-restart-run-$runLabel-playwright.out.log"
  $stderrLog = Join-Path $markerDir "backend-restart-run-$runLabel-playwright.err.log"
  Remove-Item $stdoutLog, $stderrLog -ErrorAction SilentlyContinue

  $playwright = Start-Process `
    -FilePath "npx.cmd" `
    -ArgumentList @("playwright", "test", "-c", ".\playwright.performance.config.ts", "tests/performance/recovery.spec.ts", "--workers=1") `
    -PassThru `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(180)
  while (-not (Test-Path $browserReadyMarker)) {
    if ($playwright.HasExited) {
      $stdout = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw } else { "" }
      $stderr = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw } else { "" }
      throw "Playwright exited before creating browser-ready marker for backend restart run $runLabel. ExitCode=$($playwright.ExitCode)`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
    }

    if ((Get-Date) -gt $deadline) {
      $stdout = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw } else { "" }
      $stderr = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw } else { "" }
      Stop-Process -Id $playwright.Id -Force -ErrorAction SilentlyContinue
      throw "Playwright did not create browser-ready marker for backend restart run $runLabel within 180 seconds.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
    }
    Start-Sleep -Milliseconds 500
  }

  $backendPid = Get-BackendPid
  if (-not $backendPid) {
    throw "No backend listener PID found on port 5002."
  }

  Set-Content -Path $stopRequestedMarker -Value ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  Stop-Process -Id $backendPid -Force
  Wait-Port -Open $false -TimeoutSeconds 30
  Set-Content -Path $stoppedMarker -Value ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  Start-Sleep -Seconds 1

  $backendStart = Start-Backend -RunLabel $runLabel -Phase "restored"

  try {
    Assert-BackendProcessRunning $backendStart
    Wait-Port -Open $true -TimeoutSeconds 60
    Assert-BackendCorsReady
    Assert-WebSocketReady

    $newBackendPid = Get-BackendPid
    if (-not $newBackendPid) {
      throw "No backend listener PID found after restart."
    }
    if ($newBackendPid -eq $backendPid) {
      throw "Backend listener PID did not change after restart."
    }
  } catch {
    $backendStdout = if (Test-Path $backendStart.StdoutLog) { Get-Content $backendStart.StdoutLog -Raw } else { "" }
    $backendStderr = if (Test-Path $backendStart.StderrLog) { Get-Content $backendStart.StderrLog -Raw } else { "" }
    Stop-Process -Id $playwright.Id -Force -ErrorAction SilentlyContinue
    throw "Port 5002 did not reach expected open=True state after backend restart.`nBackend STDOUT:`n$backendStdout`nBackend STDERR:`n$backendStderr"
  }
  Set-Content -Path $restoredMarker -Value ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())

  $playwright.WaitForExit()
  $playwright.Refresh()

  $resultPath = Join-Path $root "tests\results\recovery\backend-restart-run-$runLabel.json"
  $result = $null
  if (Test-Path $resultPath) {
    $result = Get-Content $resultPath -Raw | ConvertFrom-Json
  }

  if ($null -ne $playwright.ExitCode -and $playwright.ExitCode -ne 0) {
    if (Test-Path $resultPath) {
      Write-Warning "Backend restart recovery run $runLabel failed. Keeping JSON result for summary."
      $overallFailed = $true
      break
    } else {
      throw "Backend restart recovery run $runLabel failed and did not write a JSON result."
    }
  }

  if ($result) {
    if ($result.result -ne "passed") {
      Write-Warning "Backend restart recovery run $runLabel wrote result=$($result.result)."
      $overallFailed = $true
      break
    }
  } else {
    throw "Backend restart recovery run $runLabel did not write a JSON result."
  }
}

Set-Location $root
node ".\tests\scripts\summarize-recovery-results.mjs"

if ($overallFailed) {
  exit 1
}
