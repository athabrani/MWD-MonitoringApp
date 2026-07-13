param(
    [switch]$DryRun,
    [switch]$Apply,
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

if (!$Apply) { $DryRun = $true }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$templatePath = Join-Path $repoRoot "installer\inno\MWDMonitoringCentralServer.iss.template"
$outputPath = Join-Path $repoRoot "installer\inno\MWDMonitoringCentralServer.iss"
$packageSource = Join-Path $repoRoot "dist-central-server-package"
$outputDir = Join-Path $repoRoot "installer\output"
$packageSourceForIss = "..\..\dist-central-server-package"
$outputDirForIss = "..\output"
$outputBaseFilename = "MWDMonitoringCentralServer-$Version"
$appName = "MWD Monitoring App Central Server"
$appId = "MWDMonitoringCentralServer-9F93CF69-7E26-4D1D-90C3-CENTRAL"

function Get-UnsafePackageFiles {
    param([string]$PackageDir)

    if (!(Test-Path $PackageDir)) {
        return @()
    }

    $patterns = @(
        "\\.env$",
        "\\.env\.local$",
        "\\.env\.testing$",
        "\.env\.backup$",
        "\.env\.bak$",
        "\\service-logs\\",
        "\\backups\\",
        "\.dump$",
        "\.log$",
        "\.sqlite$",
        "\.db$"
    )

    $files = Get-ChildItem -Path $PackageDir -Recurse -File -ErrorAction SilentlyContinue
    $bad = @()
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($PackageDir.Length).TrimStart("\", "/")
        foreach ($pattern in $patterns) {
            if ($relative -match $pattern) {
                $bad += $relative
                break
            }
        }
    }
    return $bad
}

function Test-ContentSensitive {
    param([string]$Content)

    $patterns = @(
        "DATABASE_URL\s*=",
        "JWT_SECRET\s*=",
        "GATEWAY_API_KEY\s*=",
        "password\s*=",
        "\.env(\s|""|;|$)",
        "\.dump(\s|""|;|$)",
        "service-logs"
    )

    $hits = @()
    foreach ($pattern in $patterns) {
        if ($Content -match $pattern) { $hits += $pattern }
    }
    return $hits
}

$packageExists = Test-Path $packageSource
$unsafeFiles = @(Get-UnsafePackageFiles $packageSource)
$templateExists = Test-Path $templatePath
$template = if ($templateExists) { Get-Content -Path $templatePath -Raw } else { "" }
$templatePlaceholders = @([regex]::Matches($template, "\{\{[A-Z0-9_]+\}\}") | ForEach-Object { $_.Value } | Sort-Object -Unique)
$replacements = @{
    "{{APP_NAME}}" = $appName
    "{{APP_VERSION}}" = $Version
    "{{PACKAGE_SOURCE}}" = $packageSourceForIss
    "{{OUTPUT_DIR}}" = $outputDirForIss
    "{{OUTPUT_BASE_FILENAME}}" = $outputBaseFilename
    "{{APP_ID}}" = $appId
}

$rendered = $template
foreach ($key in $replacements.Keys) {
    $rendered = $rendered.Replace($key, $replacements[$key])
}
$remaining = @([regex]::Matches($rendered, "\{\{[A-Z0-9_]+\}\}") | ForEach-Object { $_.Value } | Sort-Object -Unique)
$renderedSensitive = @(Test-ContentSensitive $rendered)

Write-Host ""
Write-Host "INNO INSTALLER GENERATE"
Write-Host ""
Write-Host ("Template              : {0}" -f $templatePath)
Write-Host ("Output .iss           : {0}" -f $outputPath)
Write-Host ("Package source        : {0}" -f $packageSource)
Write-Host ("Output installer dir  : {0}" -f $outputDir)
Write-Host "Service manager       : WinSW"
Write-Host "Backend service       : MWDMonitoringBackend"
Write-Host "Frontend service      : MWDMonitoringFrontend"
Write-Host "Receiver service      : pending"
Write-Host "WinSW bundled         : no"
Write-Host ("Secrets included      : {0}" -f ($(if ($renderedSensitive.Count -eq 0) { "no" } else { "CHECK" })))
Write-Host ("Backup included       : {0}" -f ($(if ($unsafeFiles | Where-Object { $_ -match "\.dump$|\\backups\\" }) { "yes" } else { "no" })))
Write-Host ("Logs included         : {0}" -f ($(if ($unsafeFiles | Where-Object { $_ -match "\.log$|\\service-logs\\" }) { "yes" } else { "no" })))
Write-Host ("Package exists        : {0}" -f ($(if ($packageExists) { "yes" } else { "no" })))
Write-Host ("Unsafe package files  : {0}" -f $unsafeFiles.Count)
Write-Host ("Placeholders found    : {0}" -f ($templatePlaceholders -join ", "))
Write-Host ("Remaining after render: {0}" -f ($(if ($remaining.Count -eq 0) { "none" } else { $remaining -join ", " })))
Write-Host ("Dry run only          : {0}" -f ($(if ($DryRun) { "yes" } else { "no" })))

if (!$templateExists) {
    Write-Host "Final status          : NOT READY"
    throw "Template not found."
}
if (!$packageExists) {
    Write-Host "Run first: npm run central:package"
    Write-Host "Final status          : NOT READY"
    exit 1
}
if ($unsafeFiles.Count -gt 0) {
    Write-Host "Unsafe package files:"
    $unsafeFiles | Select-Object -First 50 | ForEach-Object { Write-Host ("- {0}" -f $_) }
    Write-Host "Final status          : FAIL"
    exit 1
}
if ($remaining.Count -gt 0) {
    Write-Host "Final status          : FAIL"
    throw "Rendered .iss still contains placeholders."
}
if ($renderedSensitive.Count -gt 0) {
    Write-Host "Sensitive references:"
    $renderedSensitive | ForEach-Object { Write-Host ("- {0}" -f $_) }
    Write-Host "Final status          : FAIL"
    exit 1
}

if ($DryRun) {
    Write-Host "Final status          : DRY RUN"
    exit 0
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath), $outputDir | Out-Null
Set-Content -Path $outputPath -Value $rendered -Encoding UTF8
Write-Host "Final status          : READY"
