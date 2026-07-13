$ErrorActionPreference = "Stop"

$root = "C:\Users\athallah\Documents\Code\MWD-MonitoringApp"

Set-Location $root

$env:BASE_URL = "http://localhost:5002"
$env:SESSION_ID = "1"
$env:TEST_USERNAME = "engineer_test"
$env:TEST_PASSWORD = "TestPassword123!"

$users = @(1, 5, 10)

foreach ($vu in $users) {
  for ($run = 1; $run -le 3; $run++) {
    $runLabel = "{0:D2}" -f $run

    Write-Host "Running load test: $vu VU, run $runLabel"

    k6 run `
      --vus $vu `
      --duration 60s `
      --summary-export ".\tests\results\load\load-$vu-user-run-$runLabel-summary.json" `
      --out "json=.\tests\results\load\load-$vu-user-run-$runLabel-raw.json" `
      ".\tests\load\api-load.js"

    Start-Sleep -Seconds 10
  }
}