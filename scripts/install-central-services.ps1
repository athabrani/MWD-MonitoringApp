param(
    [switch]$DryRun,
    [switch]$ConfirmInstall,
    [switch]$LanMode,
    [string]$ServerHost
)

$ErrorActionPreference = "Stop"

if (!$ConfirmInstall) {
    $DryRun = $true
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "mwd-app-be"
$frontendDir = Join-Path $repoRoot "mwd-app-fe"
$logsDir = Join-Path $repoRoot "service-logs"
$listenHost = if ($LanMode) { "0.0.0.0" } else { "127.0.0.1" }

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue

$services = @(
    @{
        Name = "MWDBackend"
        App = "node.exe"
        Args = "dist/server.js"
        Dir = $backendDir
        Stdout = Join-Path $logsDir "service-backend.log"
        Stderr = Join-Path $logsDir "service-backend-error.log"
        Env = "NODE_ENV=production`0HOST=$listenHost`0PORT=5001"
    },
    @{
        Name = "MWDFrontend"
        App = "npm.cmd"
        Args = "run start -- -H $listenHost -p 3000"
        Dir = $frontendDir
        Stdout = Join-Path $logsDir "service-frontend.log"
        Stderr = Join-Path $logsDir "service-frontend-error.log"
        Env = "NODE_ENV=production"
    }
)

Write-Host ""
Write-Host "CENTRAL SERVICES INSTALL PLAN"
Write-Host ""
Write-Host ("Mode        : {0}" -f ($(if ($LanMode) { "LAN" } else { "LocalOnly" })))
Write-Host ("Listen host : {0}" -f $listenHost)
if ($ServerHost) {
    Write-Host ("Server host : {0}" -f $ServerHost)
}
Write-Host ""

foreach ($service in $services) {
    Write-Host ("Service : {0}" -f $service.Name)
    Write-Host ("Command : {0} {1}" -f $service.App, $service.Args)
    Write-Host ("Workdir : {0}" -f $service.Dir)
    Write-Host ("Stdout  : {0}" -f $service.Stdout)
    Write-Host ("Stderr  : {0}" -f $service.Stderr)
    Write-Host ""
}

Write-Host "Service : MWDReceiver"
Write-Host "Status  : Receiver service skipped: receiver command requires manual verification."
Write-Host ""

if (!$nssm) {
    Write-Host "NSSM was not found in PATH."
    Write-Host "Install NSSM manually on the server, then rerun this script."
    exit 0
}

if ($DryRun) {
    Write-Host "Dry-run only. Re-run with -ConfirmInstall to install services."
    exit 0
}

foreach ($service in $services) {
    $existing = Get-Service -Name $service.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host ("Service already exists: {0}" -f $service.Name)
        continue
    }

    & $nssm.Source install $service.Name $service.App $service.Args | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install service $($service.Name)."
    }

    & $nssm.Source set $service.Name AppDirectory $service.Dir | Out-Null
    & $nssm.Source set $service.Name AppStdout $service.Stdout | Out-Null
    & $nssm.Source set $service.Name AppStderr $service.Stderr | Out-Null
    & $nssm.Source set $service.Name AppRotateFiles 1 | Out-Null
    & $nssm.Source set $service.Name AppRotateOnline 1 | Out-Null
    & $nssm.Source set $service.Name Start SERVICE_AUTO_START | Out-Null
    & $nssm.Source set $service.Name AppRestartDelay 5000 | Out-Null
    & $nssm.Source set $service.Name AppEnvironmentExtra $service.Env | Out-Null

    Write-Host ("Installed service: {0}" -f $service.Name)
}

Write-Host "Central services installed. Receiver service skipped pending manual verification."
