$ErrorActionPreference = "Stop"

$services = @("MWDBackend", "MWDFrontend", "MWDReceiver")
$nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "CENTRAL SERVICES CHECK"
Write-Host ""
Write-Host ("NSSM        : {0}" -f ($(if ($nssm) { "found" } else { "not found" })))

foreach ($name in $services) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (!$service) {
        Write-Host ("{0,-12}: not installed" -f $name)
        continue
    }

    Write-Host ("{0,-12}: {1}" -f $name, $service.Status)
}
