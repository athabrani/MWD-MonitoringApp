param(
    [switch]$DryRun,
    [switch]$ConfirmUninstall
)

$ErrorActionPreference = "Stop"

if (!$ConfirmUninstall) {
    $DryRun = $true
}

$nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue
$services = @("MWDBackend", "MWDFrontend", "MWDReceiver")

Write-Host ""
Write-Host "CENTRAL SERVICES UNINSTALL PLAN"
Write-Host ""
foreach ($name in $services) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    Write-Host ("{0,-12}: {1}" -f $name, $(if ($service) { $service.Status } else { "not installed" }))
}

if ($DryRun) {
    Write-Host "Dry-run only. Re-run with -ConfirmUninstall to remove installed services."
    exit 0
}

if (!$nssm) {
    throw "NSSM was not found in PATH. Remove services manually or install NSSM."
}

foreach ($name in $services) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (!$service) {
        continue
    }
    if ($service.Status -ne "Stopped") {
        Stop-Service -Name $name -ErrorAction Stop
    }
    & $nssm.Source remove $name confirm | Out-Null
    Write-Host ("Removed service: {0}" -f $name)
}
