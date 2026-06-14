$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$frontendRoot = Join-Path $root "mwd-app-fe"
$resultsRoot = Join-Path $root "tests\results\compatibility"
$archiveRoot = Join-Path $resultsRoot "archive"

$projects = @(
  "chrome-desktop",
  "edge-desktop",
  "firefox-desktop",
  "android-chrome-emulated",
  "safari-mobile-emulated"
)

$interProjectDelaySeconds = if ($env:COMPAT_INTER_PROJECT_DELAY_SECONDS) {
  [int]$env:COMPAT_INTER_PROJECT_DELAY_SECONDS
}
else {
  65
}

function Test-PortOpen {
  param([int]$Port)

  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $open = $async.AsyncWaitHandle.WaitOne(1000, $false)
    if ($open) {
      $client.EndConnect($async)
    }
    $client.Close()
    return $open
  }
  catch {
    return $false
  }
}

function Assert-PortOpen {
  param(
    [int]$Port,
    [string]$Name
  )

  if (-not (Test-PortOpen -Port $Port)) {
    throw "$Name port $Port is not open. Start the service before running compatibility tests."
  }
}

function Assert-RequiredEnvironment {
  $required = @(
    "E2E_ENGINEER_USERNAME",
    "E2E_ENGINEER_PASSWORD"
  )

  foreach ($name in $required) {
    if (-not [Environment]::GetEnvironmentVariable($name)) {
      throw "$name is required. Set it in the environment before running this script."
    }
  }

  if (-not $env:E2E_BASE_URL) {
    $env:E2E_BASE_URL = "http://localhost:3002"
  }
  if (-not $env:E2E_API_URL) {
    $env:E2E_API_URL = "http://localhost:5002"
  }
  if (-not $env:E2E_ACTIVE_SESSION_ID) {
    $env:E2E_ACTIVE_SESSION_ID = "1"
  }
  if (-not $env:E2E_ACTIVE_SESSION_NAME) {
    $env:E2E_ACTIVE_SESSION_NAME = "TEST-MWD-001"
  }
}

function Assert-BrowserChannels {
  $chrome = Get-Command chrome.exe -ErrorAction SilentlyContinue
  $edge = Get-Command msedge.exe -ErrorAction SilentlyContinue
  $chromePaths = @(
    (Join-Path -Path $env:ProgramFiles -ChildPath "Google\Chrome\Application\chrome.exe"),
    (Join-Path -Path ${env:ProgramFiles(x86)} -ChildPath "Google\Chrome\Application\chrome.exe"),
    (Join-Path -Path $env:LocalAppData -ChildPath "Google\Chrome\Application\chrome.exe")
  )
  $edgePaths = @(
    (Join-Path -Path $env:ProgramFiles -ChildPath "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path -Path ${env:ProgramFiles(x86)} -ChildPath "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path -Path $env:LocalAppData -ChildPath "Microsoft\Edge\Application\msedge.exe")
  )
  $chromeInstalled = $chrome -or ($chromePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)
  $edgeInstalled = $edge -or ($edgePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)

  if (-not $chromeInstalled) {
    throw "Google Chrome channel was not found. Install Google Chrome before running chrome-desktop."
  }
  if (-not $edgeInstalled) {
    throw "Microsoft Edge channel was not found. Install Microsoft Edge before running edge-desktop."
  }
}

function Archive-CompatibilityResults {
  if (-not (Test-Path -LiteralPath $resultsRoot)) {
    New-Item -ItemType Directory -Path $resultsRoot | Out-Null
    return
  }

  $items = Get-ChildItem -LiteralPath $resultsRoot -Force | Where-Object {
    $_.Name -ne "archive" -and $_.Name -ne "service-logs" -and $_.Name -notlike "compat-*.log"
  }
  if ($items.Count -eq 0) {
    return
  }

  New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
  $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
  $archive = Join-Path $archiveRoot $stamp
  New-Item -ItemType Directory -Path $archive | Out-Null

  foreach ($item in $items) {
    Move-Item -LiteralPath $item.FullName -Destination $archive
  }
}

Assert-RequiredEnvironment
Assert-PortOpen -Port 5002 -Name "Backend"
Assert-PortOpen -Port 3002 -Name "Frontend"
Assert-BrowserChannels
Archive-CompatibilityResults

New-Item -ItemType Directory -Path (Join-Path $resultsRoot "raw") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $resultsRoot "screenshots") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $resultsRoot "downloads") -Force | Out-Null

$projectExitCodes = @{}
Push-Location $frontendRoot
try {
  for ($index = 0; $index -lt $projects.Count; $index += 1) {
    $project = $projects[$index]
    Write-Host "Running compatibility project: $project"
    $env:COMPAT_PROJECT_NAME = $project
    & npx.cmd playwright test `
      -c ".\playwright.compatibility.config.ts" `
      --project="$project" `
      --workers=1
    $projectExitCodes[$project] = $LASTEXITCODE

    if ($index -lt ($projects.Count - 1) -and $interProjectDelaySeconds -gt 0) {
      Write-Host "Waiting $interProjectDelaySeconds seconds before the next project to avoid cross-platform rate-limit contamination."
      Start-Sleep -Seconds $interProjectDelaySeconds
    }
  }
}
finally {
  Remove-Item Env:\COMPAT_PROJECT_NAME -ErrorAction SilentlyContinue
  Pop-Location
}

Push-Location $root
try {
  & node .\tests\scripts\summarize-compatibility-results.mjs
  $summaryExitCode = $LASTEXITCODE
}
finally {
  Pop-Location
}

$failedProjects = $projectExitCodes.GetEnumerator() | Where-Object { $_.Value -ne 0 }
if ($failedProjects.Count -gt 0 -or $summaryExitCode -ne 0) {
  Write-Host "Compatibility testing failed."
  foreach ($entry in $projectExitCodes.GetEnumerator()) {
    Write-Host ("{0}: exit {1}" -f $entry.Key, $entry.Value)
  }
  exit 1
}

Write-Host "Compatibility testing passed for all projects."
exit 0
