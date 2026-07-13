param(
    [switch]$DryRun,
    [switch]$Compile,
    [string]$IssPath = ".\installer\inno\MWDMonitoringCentralServer.iss"
)

$ErrorActionPreference = "Stop"

if (!$Compile) { $DryRun = $true }

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

$iscc = Find-Iscc
$exists = Test-Path $issFullPath
$content = if ($exists) { Get-Content -Path $issFullPath -Raw } else { "" }
$remaining = @([regex]::Matches($content, "\{\{[A-Z0-9_]+\}\}") | ForEach-Object { $_.Value } | Sort-Object -Unique)
$sensitive = @(Get-SensitiveReferences $content)
$ready = $exists -and (Test-Path $packageSource) -and $iscc -and $remaining.Count -eq 0 -and $sensitive.Count -eq 0

Write-Host ""
Write-Host "INNO INSTALLER COMPILE PLAN"
Write-Host ""
Write-Host ("Inno .iss             : {0}" -f $issFullPath)
Write-Host ("Inno .iss exists      : {0}" -f ($(if ($exists) { "yes" } else { "no" })))
Write-Host ("Package source        : {0}" -f ($(if (Test-Path $packageSource) { $packageSource } else { "missing" })))
Write-Host ("Placeholders remaining: {0}" -f ($(if ($remaining.Count -eq 0) { "none" } else { $remaining -join ", " })))
Write-Host ("Sensitive references  : {0}" -f ($(if ($sensitive.Count -eq 0) { "none" } else { $sensitive -join ", " })))
Write-Host ("ISCC found            : {0}" -f ($(if ($iscc) { "yes" } else { "no" })))
Write-Host ("ISCC path             : {0}" -f ($(if ($iscc) { $iscc } else { "not found" })))
Write-Host ("Dry run only          : {0}" -f ($(if ($DryRun) { "yes" } else { "no" })))
Write-Host ("Compile ready         : {0}" -f ($(if ($ready) { "yes" } else { "no" })))

if (!$ready) {
    Write-Host "Final status          : NOT READY"
    exit 1
}

if ($DryRun) {
    Write-Host "Final status          : DRY RUN READY"
    exit 0
}

& $iscc $issFullPath
if ($LASTEXITCODE -ne 0) {
    throw "ISCC failed with exit code $LASTEXITCODE."
}
Write-Host "Final status          : READY"
