$ErrorActionPreference = "Stop"

function Disable-FrontendLocalEnv {
    param([string]$Path)

    if (!(Test-Path $Path)) {
        return $null
    }

    $disabledPath = "$Path.central-ignored-$PID"
    Move-Item -LiteralPath $Path -Destination $disabledPath -Force
    Write-Host "Temporarily ignoring mwd-app-fe/.env.local for central frontend build."
    return $disabledPath
}

function Restore-FrontendLocalEnv {
    param(
        [string]$OriginalPath,
        [string]$DisabledPath
    )

    if ($DisabledPath -and (Test-Path $DisabledPath)) {
        Move-Item -LiteralPath $DisabledPath -Destination $OriginalPath -Force
        Write-Host "Restored mwd-app-fe/.env.local after central frontend build."
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontendDir = Join-Path $repoRoot "mwd-app-fe"
$frontendLocalEnvPath = Join-Path $frontendDir ".env.local"

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (!$npm) {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
}
if (!$npm) {
    throw "npm was not found in PATH."
}

$disabledFrontendLocalEnv = Disable-FrontendLocalEnv -Path $frontendLocalEnvPath
try {
    $process = Start-Process -FilePath $npm.Source -ArgumentList @("run", "build") -WorkingDirectory $frontendDir -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Frontend central build failed with exit code $($process.ExitCode)."
    }
} finally {
    Restore-FrontendLocalEnv -OriginalPath $frontendLocalEnvPath -DisabledPath $disabledFrontendLocalEnv
}

Write-Host "Central frontend build complete."
