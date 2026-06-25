$ErrorActionPreference = "Stop"

$services = @("MWDBackend", "MWDFrontend", "MWDReceiver")

Write-Host ""
Write-Host "START CENTRAL SERVICES"
Write-Host ""

foreach ($name in $services) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (!$service) {
        Write-Host ("{0,-12}: not installed" -f $name)
        continue
    }
    if ($service.Status -eq "Running") {
        Write-Host ("{0,-12}: already running" -f $name)
        continue
    }
    Start-Service -Name $name
    Write-Host ("{0,-12}: start requested" -f $name)
}
