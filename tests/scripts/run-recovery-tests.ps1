$ErrorActionPreference = "Stop"

$root = "C:\Users\athallah\Documents\Code\MWD-MonitoringApp"
$frontendRoot = Join-Path $root "mwd-app-fe"

Set-Location $frontendRoot

$scenarios = @("network-loss", "websocket-interruption")

foreach ($scenario in $scenarios) {
  for ($run = 1; $run -le 3; $run++) {
    $env:RECOVERY_SCENARIO = $scenario
    $env:RECOVERY_RUN_NUMBER = [string]$run
    $env:NEXT_PUBLIC_E2E_MODE = "true"

    npx playwright test `
      -c ".\playwright.performance.config.ts" `
      "tests/performance/recovery.spec.ts" `
      --workers=1

    if ($LASTEXITCODE -ne 0) {
      throw "Recovery test failed: $scenario run $run"
    }
  }
}

Set-Location $root
node ".\tests\scripts\summarize-recovery-results.mjs"
