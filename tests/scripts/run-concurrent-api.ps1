$ErrorActionPreference = "Stop"

$root = "C:\Users\athallah\Documents\Code\MWD-MonitoringApp"
$resultsDir = Join-Path $root "tests\results\load"

Set-Location $root
New-Item -ItemType Directory -Force $resultsDir | Out-Null

$env:BASE_URL = if ($env:BASE_URL) { $env:BASE_URL.TrimEnd("/") } else { "http://localhost:5002" }
$env:SESSION_ID = if ($env:SESSION_ID) { $env:SESSION_ID } else { "1" }
$env:TEST_USERNAME = if ($env:TEST_USERNAME) { $env:TEST_USERNAME } else { "engineer_test" }
$env:ALLOW_SETUP_LOGIN = "false"
$env:PACING_SECONDS = if ($env:PACING_SECONDS) { $env:PACING_SECONDS } else { "1" }
$env:MEASURED_FROM = if ($env:MEASURED_FROM) { $env:MEASURED_FROM } else { "2026-06-01T00:00:00.000Z" }
$env:MEASURED_TO = if ($env:MEASURED_TO) { $env:MEASURED_TO } else { "2026-06-01T00:14:55.000Z" }

function Get-AuthToken {
  if ($env:TEST_TOKEN) {
    return [string]$env:TEST_TOKEN
  }

  if (-not $env:TEST_PASSWORD) {
    throw "TEST_PASSWORD or TEST_TOKEN environment variable is required."
  }

  $loginBody = @{
    identifier = $env:TEST_USERNAME
    password = $env:TEST_PASSWORD
  } | ConvertTo-Json

  $loginResponse = Invoke-RestMethod `
    -UseBasicParsing `
    -Method Post `
    -Uri "$($env:BASE_URL)/api/auth/login" `
    -ContentType "application/json" `
    -Headers @{ Accept = "application/json" } `
    -Body $loginBody

  $token = $loginResponse.token

  if (-not $token) {
    $token = $loginResponse.accessToken
  }

  if ((-not $token) -and $loginResponse.data) {
    $token = $loginResponse.data.token
  }

  if ((-not $token) -and $loginResponse.data) {
    $token = $loginResponse.data.accessToken
  }

  if (-not $token) {
    throw "Login succeeded but no token field was returned."
  }

  return [string]$token
}

function Test-AuthToken {
  param([Parameter(Mandatory)] [string] $Token)

  Invoke-RestMethod `
    -UseBasicParsing `
    -Method Get `
    -Uri "$($env:BASE_URL)/api/mwd-sessions" `
    -Headers @{
      Authorization = "Bearer $Token"
      Accept = "application/json"
    } | Out-Null
}

function Remove-K6SummaryToken {
  param([Parameter(Mandatory)] [string] $Path)

  if (-not (Test-Path $Path)) {
    return
  }

  $summary = Get-Content -Path $Path -Raw | ConvertFrom-Json

  if ($summary.setup_data -and $summary.setup_data.token) {
    $summary.setup_data.PSObject.Properties.Remove("token")
    $summary |
      ConvertTo-Json -Depth 100 |
      Set-Content -Path $Path -Encoding UTF8
  }
}

$users = @(1, 5, 10)

try {
  $env:TEST_TOKEN = Get-AuthToken
  Test-AuthToken -Token $env:TEST_TOKEN

  foreach ($vu in $users) {
    for ($run = 1; $run -le 3; $run++) {
      $runLabel = "{0:D2}" -f $run
      $summaryPath = ".\tests\results\load\concurrent-$vu-vu-run-$runLabel-summary.json"
      $rawPath = ".\tests\results\load\concurrent-$vu-vu-run-$runLabel-raw.json"

      Write-Host ""
      Write-Host "========================================"
      Write-Host "Concurrent API: $vu VU, run $runLabel"
      Write-Host "========================================"

      & k6 run `
        --vus $vu `
        --duration 60s `
        --summary-export $summaryPath `
        --out "json=$rawPath" `
        ".\tests\load\concurrent-api.js"

      if ($LASTEXITCODE -ne 0) {
        throw "k6 run failed for $vu VU run $runLabel with exit code $LASTEXITCODE."
      }

      Remove-K6SummaryToken -Path $summaryPath

      if (-not (($vu -eq 10) -and ($run -eq 3))) {
        Start-Sleep -Seconds 15
      }
    }
  }
}
finally {
  Remove-Item Env:\TEST_TOKEN -ErrorAction SilentlyContinue
}
