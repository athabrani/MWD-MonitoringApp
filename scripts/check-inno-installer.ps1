param(
    [string]$IssPath = ".\installer\inno\MWDMonitoringCentralServer.iss"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$issFullPath = if ([System.IO.Path]::IsPathRooted($IssPath)) { $IssPath } else { Join-Path $repoRoot $IssPath }
$packageSource = Join-Path $repoRoot "dist-central-server-package"

function Find-Iscc {
    if ($env:INNO_SETUP_ISCC -and (Test-Path $env:INNO_SETUP_ISCC)) {
        return (Resolve-Path $env:INNO_SETUP_ISCC).Path
    }
    $candidates = @(
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe"
    )
    if ($env:LOCALAPPDATA) {
        $candidates += (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
    }
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
    }
    $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Get-SensitiveReferences {
    param([string]$Content)
    $patterns = @(
        "\.env(\s|""|;|$)",
        "\.env\.local",
        "\.env\.testing",
        "\.dump",
        "\.log",
        "service-logs",
        "DATABASE_URL\s*=",
        "JWT_SECRET\s*=",
        "GATEWAY_API_KEY\s*=",
        "DROP DATABASE",
        "RESTORE DATABASE",
        "configure-central-firewall",
        "-ConfirmApply"
    )
    $hits = @()
    foreach ($pattern in $patterns) {
        if ($Content -match $pattern) { $hits += $pattern }
    }
    return $hits
}

$exists = Test-Path $issFullPath
$content = if ($exists) { Get-Content -Path $issFullPath -Raw } else { "" }
$remaining = @([regex]::Matches($content, "\{\{[A-Z0-9_]+\}\}") | ForEach-Object { $_.Value } | Sort-Object -Unique)
$sensitive = @(Get-SensitiveReferences $content)
$iscc = Find-Iscc
$compilePossible = $exists -and $remaining.Count -eq 0 -and $sensitive.Count -eq 0 -and (Test-Path $packageSource) -and [bool]$iscc
$final = if ($compilePossible) { "READY" } elseif ($exists -and $remaining.Count -eq 0 -and $sensitive.Count -eq 0 -and (Test-Path $packageSource)) { "PARTIAL" } else { "NOT READY" }

Write-Host ""
Write-Host "INNO INSTALLER CHECK"
Write-Host ""
Write-Host ("Inno .iss exists      : {0}" -f ($(if ($exists) { "yes" } else { "no" })))
Write-Host ("Placeholders remaining: {0}" -f ($(if ($remaining.Count -eq 0) { "none" } else { $remaining -join ", " })))
Write-Host ("Package source        : {0}" -f ($(if (Test-Path $packageSource) { $packageSource } else { "missing" })))
Write-Host ("Sensitive references  : {0}" -f ($(if ($sensitive.Count -eq 0) { "none" } else { $sensitive -join ", " })))
Write-Host ("ISCC found            : {0}" -f ($(if ($iscc) { "yes" } else { "no" })))
Write-Host ("ISCC path             : {0}" -f ($(if ($iscc) { $iscc } else { "not found" })))
Write-Host ("Compile possible      : {0}" -f ($(if ($compilePossible) { "yes" } else { "no" })))
Write-Host ("Final status          : {0}" -f $final)

if ($final -eq "NOT READY") { exit 1 }
