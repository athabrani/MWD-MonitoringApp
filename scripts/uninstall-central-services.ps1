param(
    [switch]$DryRun,
    [switch]$ConfirmUninstall
)

$ErrorActionPreference = "Stop"

if (!$ConfirmUninstall) {
    Write-Host ""
    Write-Host "CENTRAL SERVICES UNINSTALL PLAN"
    Write-Host "Service manager: WinSW"
    Write-Host ""
    & (Join-Path $PSScriptRoot "manage-central-services.ps1") -Status
    Write-Host ""
    Write-Host "Dry-run only. Re-run with -ConfirmUninstall to request uninstall confirmation."
    exit 0
}

& (Join-Path $PSScriptRoot "manage-central-services.ps1") -Uninstall
