param(
  [switch]$SkipZap
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$securityRoot = Join-Path $repoRoot "tests\results\security"
$rawDir = Join-Path $securityRoot "raw"
$evidenceDir = Join-Path $securityRoot "evidence"
$zapDir = Join-Path $securityRoot "zap"
$dependencyDir = Join-Path $securityRoot "dependency"
$reportsDir = Join-Path $securityRoot "reports"
$archiveDir = Join-Path $securityRoot "archive"

function Ensure-Directory($Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Test-PortOpen($Port) {
  $result = Test-NetConnection localhost -Port $Port -WarningAction SilentlyContinue
  return [bool]$result.TcpTestSucceeded
}

function Load-DotEnv($Path) {
  if (!(Test-Path $Path)) {
    return
  }

  foreach ($line in Get-Content -Path $Path) {
    $trimmed = $line.Trim()
    if (!$trimmed -or $trimmed.StartsWith("#") -or !$trimmed.Contains("=")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name) {
      if (!$value -and [Environment]::GetEnvironmentVariable($name, "Process")) {
        continue
      }
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function Write-EnvironmentReport {
  $branch = "unknown"
  $commit = "unknown"
  try { $branch = (git -c "safe.directory=$repoRoot" -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null) } catch {}
  try { $commit = (git -c "safe.directory=$repoRoot" -C $repoRoot rev-parse HEAD 2>$null) } catch {}
  $dbName = "unknown"
  if ($env:DATABASE_URL -match "/([^/?]+)(\?|$)") {
    $dbName = $Matches[1]
  }

  $nodeVersion = "unknown"
  $npmVersion = "unknown"
  $pwVersion = "unknown"
  try { $nodeVersion = (node --version) } catch {}
  try { $npmVersion = (npm --version) } catch {}
  try {
    Push-Location (Join-Path $repoRoot "mwd-app-fe")
    $pwVersion = (npx playwright --version)
    Pop-Location
  } catch {
    Pop-Location -ErrorAction SilentlyContinue
  }

  @(
    "Test date: $((Get-Date).ToUniversalTime().ToString('o'))",
    "Operating system: $([System.Environment]::OSVersion.VersionString)",
    "Node.js version: $nodeVersion",
    "npm version: $npmVersion",
    "Playwright version: $pwVersion",
    "Backend URL: $($env:E2E_API_URL)",
    "Frontend URL: $($env:E2E_BASE_URL)",
    "Database name: $dbName",
    "Branch: $branch",
    "Commit hash: $commit",
    "Test account names: admin_test, engineer_test, operator_test, security_rate_limit_test_*",
    "Session IDs: 1 TEST-MWD-001; TEST-MWD-002; TEST-MWD-EMPTY"
  ) | Set-Content -Path (Join-Path $securityRoot "security-environment.txt")
}

function Write-SecretScan {
  $patterns = "JWT_SECRET|DATABASE_URL|GATEWAY_API_KEY|GATEWAY_HMAC_SECRET|PRIVATE_KEY|ACCESS_TOKEN|PASSWORD="
  $matches = @()
  try {
    $grepOutput = git -c "safe.directory=$repoRoot" -C $repoRoot grep -n -I -E $patterns 2>$null
    foreach ($line in $grepOutput) {
      $parts = $line.Split(":", 3)
      if ($parts.Count -lt 3) { continue }
      $variableMatches = [regex]::Matches($parts[2], $patterns)
      foreach ($match in $variableMatches) {
        $matches += [pscustomobject]@{
          path = $parts[0]
          line = [int]$parts[1]
          variable = $match.Value.TrimEnd("=")
          value = "REDACTED"
          tracked = $true
        }
      }
    }
  } catch {}

  $trackedEnv = @()
  $trackedActiveEnv = @()
  try {
    $trackedEnv = git -c "safe.directory=$repoRoot" -C $repoRoot ls-files | Select-String -Pattern "(^|/)\.env($|\.)|secret|credential|private" | ForEach-Object { $_.Line }
    $trackedActiveEnv = $trackedEnv | Where-Object {
      $_ -match "(^|/)\.env($|\.local$|\.testing$|\.production$|\.development$)" -and
      $_ -notmatch "\.example$"
    }
  } catch {}

  $ignored = @()
  foreach ($file in @(".\mwd-app-be\.env", ".\mwd-app-be\.env.testing", ".\mwd-app-fe\.env.local")) {
    try {
      $ignored += git -c "safe.directory=$repoRoot" -C $repoRoot check-ignore -v $file 2>$null
    } catch {}
  }

  $result = [pscustomobject]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    matches = $matches
    trackedEnvironmentLikeFiles = $trackedEnv
    trackedActiveEnvironmentFiles = $trackedActiveEnv
    gitignoreEvidence = $ignored
    secretsTracked = $trackedActiveEnv.Count
  }
  $result | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $rawDir "secret-scan.json")
}

Ensure-Directory $securityRoot
Ensure-Directory $archiveDir

if (Test-Path $securityRoot) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $currentItems = Get-ChildItem -Path $securityRoot -Force | Where-Object {
    $_.Name -ne "archive" -and $_.Name -ne "service-logs"
  }
  if ($currentItems.Count -gt 0) {
    $target = Join-Path $archiveDir $timestamp
    Ensure-Directory $target
    foreach ($item in $currentItems) {
      Move-Item -Path $item.FullName -Destination $target -Force
    }
  }
}

foreach ($dir in @($rawDir, $evidenceDir, $zapDir, $dependencyDir, $reportsDir, (Join-Path $securityRoot "test-artifacts"))) {
  Ensure-Directory $dir
}

Load-DotEnv (Join-Path $repoRoot "mwd-app-be\.env")
Load-DotEnv (Join-Path $repoRoot "mwd-app-be\.env.testing")

if (!$env:E2E_BASE_URL) { $env:E2E_BASE_URL = "http://localhost:3002" }
if (!$env:E2E_API_URL) { $env:E2E_API_URL = "http://localhost:5002" }
if (!$env:E2E_ACTIVE_SESSION_ID) { $env:E2E_ACTIVE_SESSION_ID = "1" }
if (!$env:E2E_ACTIVE_SESSION_NAME) { $env:E2E_ACTIVE_SESSION_NAME = "TEST-MWD-001" }
if (!$env:E2E_ADMIN_USERNAME) { $env:E2E_ADMIN_USERNAME = "admin_test" }
if (!$env:E2E_ENGINEER_USERNAME) { $env:E2E_ENGINEER_USERNAME = "engineer_test" }
if (!$env:E2E_OPERATOR_USERNAME) { $env:E2E_OPERATOR_USERNAME = "operator_test" }
if (!$env:E2E_TEST_PASSWORD -and !$env:E2E_ENGINEER_PASSWORD) {
  $seedPath = Join-Path $repoRoot "mwd-app-be\prisma\seed.testing.mjs"
  $seedText = Get-Content -Raw -Path $seedPath
  $match = [regex]::Match($seedText, "username:\s*'engineer_test'[\s\S]*?password:\s*'([^']+)'")
  if ($match.Success) {
    $env:E2E_TEST_PASSWORD = $match.Groups[1].Value
  }
}
if (!$env:E2E_GATEWAY_API_KEY -and $env:GATEWAY_API_KEY) { $env:E2E_GATEWAY_API_KEY = $env:GATEWAY_API_KEY }
if (!$env:E2E_GATEWAY_HMAC_SECRET -and $env:GATEWAY_HMAC_SECRET) { $env:E2E_GATEWAY_HMAC_SECRET = $env:GATEWAY_HMAC_SECRET }

if (!(Test-PortOpen 5002)) {
  throw "Backend port 5002 is not active. Start backend before security testing."
}
if (!(Test-PortOpen 3002)) {
  throw "Frontend port 3002 is not active. Start frontend before security testing."
}
if ($env:DATABASE_URL -notmatch "mwd_test") {
  throw "DATABASE_URL does not appear to target mwd_test. Refusing to run security tests."
}

Write-EnvironmentReport

Push-Location (Join-Path $repoRoot "mwd-app-fe")
npm audit --json | Out-File -FilePath (Join-Path $dependencyDir "frontend-npm-audit.json") -Encoding utf8
Pop-Location

Push-Location (Join-Path $repoRoot "mwd-app-be")
npm audit --json | Out-File -FilePath (Join-Path $dependencyDir "backend-npm-audit.json") -Encoding utf8
Pop-Location

Write-SecretScan

$playwrightExit = 0
Push-Location (Join-Path $repoRoot "mwd-app-fe")
npx playwright test -c ".\playwright.security.config.ts" --workers=1 --max-failures=0
$playwrightExit = $LASTEXITCODE
Pop-Location

$zapExit = 0
$dockerAvailable = $false
if (!$SkipZap) {
  try {
    docker version *> (Join-Path $zapDir "docker-version.txt")
    $dockerAvailable = $LASTEXITCODE -eq 0
  } catch {
    $dockerAvailable = $false
  }

  if ($dockerAvailable) {
    docker run --rm -v "$securityRoot\zap:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "http://host.docker.internal:3002" -J "zap-report.json" -r "zap-report.html" -I
    $zapExit = $LASTEXITCODE
  } else {
    @{
      status = "SKIPPED"
      reason = "Docker is not available; ZAP baseline was not executed."
      alerts = @()
    } | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $zapDir "zap-report.json")
    "<html><body><h1>ZAP baseline skipped</h1><p>Docker is not available.</p></body></html>" | Set-Content -Path (Join-Path $zapDir "zap-report.html")
  }
}

node (Join-Path $repoRoot "tests\scripts\summarize-security-results.mjs")
$summaryExit = $LASTEXITCODE

$summaryPath = Join-Path $securityRoot "security-summary.json"
$status = "FAILED"
if (Test-Path $summaryPath) {
  $summary = Get-Content -Raw -Path $summaryPath | ConvertFrom-Json
  $status = $summary.status
}

if ($playwrightExit -ne 0 -or $zapExit -ne 0 -or $summaryExit -ne 0 -or $status -ne "APPROVED") {
  exit 1
}

exit 0
