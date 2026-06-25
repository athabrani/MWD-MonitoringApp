$ErrorActionPreference = "Stop"

$services = @("MWDReceiver", "MWDFrontend", "MWDBackend")

Write-Host ""
Write-Host "STOP CENTRAL SERVICES"
Write-Host ""

foreach ($name in $services) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (!$service) {
        Write-Host ("{0,-12}: not installed" -f $name)
        continue
    }
    if ($service.Status -eq "Stopped") {
        Write-Host ("{0,-12}: already stopped" -f $name)
        continue
    }
    Stop-Service -Name $name
    Write-Host ("{0,-12}: stop requested" -f $name)
}
