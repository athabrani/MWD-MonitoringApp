param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Copy-IfExists {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (Test-Path $Source) {
        Copy-Item -Path $Source -Destination $Destination -Recurse -Force
    }
}

function Invoke-Npm {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (!$npm) {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
    }
    if (!$npm) {
        throw "npm was not found in PATH."
    }

    $process = Start-Process -FilePath $npm.Source -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "npm $($Arguments -join ' ') failed with exit code $($process.ExitCode)."
    }
}

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 3
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Disable-FrontendLocalEnv {
    param([string]$Path)

    if (!(Test-Path $Path)) {
        return $null
    }

    $disabledPath = "$Path.central-ignored-$PID"
    Move-Item -LiteralPath $Path -Destination $disabledPath -Force
    Write-Host "Temporarily ignoring mwd-app-fe/.env.local for central package build."
    return $disabledPath
}

function Restore-FrontendLocalEnv {
    param(
        [string]$OriginalPath,
        [string]$DisabledPath
    )

    if ($DisabledPath -and (Test-Path $DisabledPath)) {
        Move-Item -LiteralPath $DisabledPath -Destination $OriginalPath -Force
        Write-Host "Restored mwd-app-fe/.env.local after central package build."
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "mwd-app-be"
$frontendDir = Join-Path $repoRoot "mwd-app-fe"
$frontendLocalEnvPath = Join-Path $frontendDir ".env.local"
$outputDir = Join-Path $repoRoot "dist-central-server-package"
$backendBuildPath = Join-Path $backendDir "dist\server.js"

if (!$SkipBuild) {
    $backendRunning = Test-HttpOk -Url "http://127.0.0.1:5001/api/health"
    if ($backendRunning -and (Test-Path $backendBuildPath)) {
        Write-Host "Backend is currently running; using existing backend production build to avoid Prisma client file lock."
        Write-Host "Stop the central server and rerun without -SkipBuild when a clean backend rebuild is required."
    } else {
        Invoke-Npm -Arguments @("run", "build") -WorkingDirectory $backendDir
    }
    $disabledFrontendLocalEnv = Disable-FrontendLocalEnv -Path $frontendLocalEnvPath
    try {
        Invoke-Npm -Arguments @("run", "build") -WorkingDirectory $frontendDir
    } finally {
        Restore-FrontendLocalEnv -OriginalPath $frontendLocalEnvPath -DisabledPath $disabledFrontendLocalEnv
    }
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputDir "backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputDir "frontend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputDir "receiver") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputDir "scripts") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputDir "docs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputDir "installer") | Out-Null

Copy-IfExists (Join-Path $backendDir "dist") (Join-Path $outputDir "backend")
Copy-IfExists (Join-Path $backendDir "prisma") (Join-Path $outputDir "backend")
Copy-IfExists (Join-Path $backendDir "package.json") (Join-Path $outputDir "backend")
Copy-IfExists (Join-Path $backendDir "package-lock.json") (Join-Path $outputDir "backend")
Copy-IfExists (Join-Path $backendDir ".env.example") (Join-Path $outputDir "backend\.env.template")

Copy-IfExists (Join-Path $frontendDir ".next") (Join-Path $outputDir "frontend")
Copy-IfExists (Join-Path $frontendDir "public") (Join-Path $outputDir "frontend")
Copy-IfExists (Join-Path $frontendDir "next.config.ts") (Join-Path $outputDir "frontend")
Copy-IfExists (Join-Path $frontendDir "package.json") (Join-Path $outputDir "frontend")
Copy-IfExists (Join-Path $frontendDir "package-lock.json") (Join-Path $outputDir "frontend")
Copy-IfExists (Join-Path $frontendDir ".env.example") (Join-Path $outputDir "frontend\.env.template")

$deploymentScripts = @(
    "backup-central-db.ps1",
    "check-central-server.ps1",
    "check-central-services.ps1",
    "configure-central-firewall.ps1",
    "create-central-shortcut.ps1",
    "build-central-frontend.ps1",
    "generate-central-env.ps1",
    "install-central-services.ps1",
    "prepare-central-server-package.ps1",
    "start-central-server.ps1",
    "start-central-services.ps1",
    "stop-central-services.ps1",
    "stop-mwd-app.ps1",
    "uninstall-central-services.ps1"
)

foreach ($scriptName in $deploymentScripts) {
    Copy-IfExists (Join-Path $repoRoot "scripts\$scriptName") (Join-Path $outputDir "scripts\$scriptName")
}

Copy-IfExists (Join-Path $repoRoot "docs") (Join-Path $outputDir "docs")
Copy-IfExists (Join-Path $repoRoot "installer") (Join-Path $outputDir "installer")
Copy-IfExists (Join-Path $repoRoot "README-CENTRAL-SERVER-DEPLOYMENT.md") (Join-Path $outputDir "README-CENTRAL-SERVER-DEPLOYMENT.md")

Write-Host "Central server package prepared."
Write-Host ("Output: {0}" -f $outputDir)
Write-Host "Secrets copied: no"
Write-Host ".env.local copied: no"
Write-Host ".env.testing copied: no"
Write-Host "Database dumps copied: no"
