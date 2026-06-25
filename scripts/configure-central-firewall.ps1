param(
    [switch]$DryRun,
    [switch]$ConfirmApply,
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 5001
)

$ErrorActionPreference = "Stop"

if (!$ConfirmApply) {
    $DryRun = $true
}

if ($FrontendPort -eq 5432 -or $BackendPort -eq 5432) {
    throw "Refusing to create firewall rules for PostgreSQL port 5432."
}

$rules = @(
    @{
        Name = "MWD Monitoring Frontend $FrontendPort"
        DisplayName = "MWD Monitoring Frontend ($FrontendPort)"
        Port = $FrontendPort
        Description = "Allow LAN users to open the MWD Monitoring frontend."
    },
    @{
        Name = "MWD Monitoring Backend $BackendPort"
        DisplayName = "MWD Monitoring Backend ($BackendPort)"
        Port = $BackendPort
        Description = "Allow browser clients to reach the MWD backend API/WebSocket when frontend calls backend directly."
    }
)

Write-Host ""
Write-Host "CENTRAL SERVER FIREWALL PLAN"
Write-Host ""
Write-Host "PostgreSQL port 5432 will NOT be opened."
Write-Host "Expected flow: User -> Frontend -> Backend -> PostgreSQL"
Write-Host ""

foreach ($rule in $rules) {
    Write-Host ("Rule : {0}" -f $rule.DisplayName)
    Write-Host ("Port : {0}" -f $rule.Port)
    Write-Host ("Mode : Allow inbound TCP")
    Write-Host ""
}

if ($DryRun) {
    Write-Host "Dry-run only. Re-run with -ConfirmApply to create firewall rules."
    exit 0
}

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.DisplayName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host ("Existing rule kept: {0}" -f $rule.DisplayName)
        continue
    }

    New-NetFirewallRule `
        -DisplayName $rule.DisplayName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $rule.Port `
        -Profile Private `
        -Description $rule.Description | Out-Null

    Write-Host ("Created rule: {0}" -f $rule.DisplayName)
}

Write-Host "Firewall configuration complete."
