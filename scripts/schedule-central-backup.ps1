param(
    [switch]$DryRun,
    [switch]$Install,
    [string]$Time = "02:00",
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if (!$Install) {
    $DryRun = $true
}

if ($RetentionDays -lt 1) {
    throw "RetentionDays must be >= 1."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$taskName = "MWDMonitoringDailyDatabaseBackup"
$scriptPath = Join-Path $repoRoot "scripts\backup-central-db.ps1"
$powershellPath = (Get-Command powershell.exe).Source
$taskArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Backup -RetentionDays $RetentionDays"

Write-Host ""
Write-Host "CENTRAL BACKUP SCHEDULE PLAN"
Write-Host ""
Write-Host ("Task name             : {0}" -f $taskName)
Write-Host ("Schedule              : daily {0}" -f $Time)
Write-Host ("RetentionDays         : {0}" -f $RetentionDays)
Write-Host ("Command               : {0} {1}" -f $powershellPath, $taskArgs)
Write-Host ("Dry run only          : {0}" -f ($(if ($DryRun) { "yes" } else { "no" })))
Write-Host "Password              : <not stored in task arguments>"

if ($DryRun) {
    Write-Host "Final status          : DRY RUN"
    exit 0
}

$answer = Read-Host "Type SCHEDULE to create/update scheduled task"
if ($answer -ne "SCHEDULE") {
    Write-Host "Schedule cancelled. No task created."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $taskArgs -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Daily MWD Monitoring PostgreSQL backup" -Force | Out-Null

Write-Host "Task created           : yes"
Write-Host "Final status           : READY"
