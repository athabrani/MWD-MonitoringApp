param(
    [int]$BackendPort = 5002,
    [int]$FrontendPort = 3002,
    [string]$BackendEnvFile = ".\mwd-app-be\.env",
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $Root "mwd-app-be"
$FrontendDir = Join-Path $Root "mwd-app-fe"
$BackendUrl = "http://localhost:$BackendPort"
$FrontendUrl = "http://localhost:$FrontendPort"
$FrontendOrigin = $FrontendUrl

function Write-Step {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

function Import-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return
    }

    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }

        $index = $trimmed.IndexOf("=")
        $key = $trimmed.Substring(0, $index).Trim()
        $value = $trimmed.Substring($index + 1).Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

function Test-PortListening {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $connection
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$Timeout
    )

    $deadline = (Get-Date).AddSeconds($Timeout)
    $lastError = ""

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return $response
            }
            $lastError = "HTTP $($response.StatusCode)"
        }
        catch {
            $lastError = $_.Exception.Message
        }

        Start-Sleep -Seconds 1
    }

    throw "Timed out waiting for $Url. Last error: $lastError"
}

function Wait-Readiness {
    param([int]$Timeout)

    $deadline = (Get-Date).AddSeconds($Timeout)
    $lastError = ""

    while ((Get-Date) -lt $deadline) {
        try {
            $payload = Invoke-RestMethod -Uri "$BackendUrl/api/readiness" -TimeoutSec 5
            if ($payload.status -eq "ok" -and $payload.database.connected -eq $true) {
                return $payload
            }
            $lastError = "readiness status=$($payload.status)"
        }
        catch {
            $lastError = $_.Exception.Message
        }

        Start-Sleep -Seconds 1
    }

    throw "Timed out waiting for backend readiness. Last error: $lastError"
}

function Test-CorsPreflight {
    $headers = @{
        Origin = $FrontendOrigin
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type"
    }

    $response = Invoke-WebRequest `
        -UseBasicParsing `
        -Method OPTIONS `
        -Uri "$BackendUrl/api/auth/login" `
        -Headers $headers `
        -TimeoutSec 10

    $allowOrigin = $response.Headers["Access-Control-Allow-Origin"]
    if ($allowOrigin -ne $FrontendOrigin) {
        throw "CORS allow-origin mismatch. Expected $FrontendOrigin, got $allowOrigin"
    }
}

function Test-AuthEndpoint {
    try {
        Invoke-WebRequest `
            -UseBasicParsing `
            -Method POST `
            -Uri "$BackendUrl/api/auth/login" `
            -ContentType "application/json" `
            -Headers @{ Origin = $FrontendOrigin } `
            -Body '{"identifier":"admin","password":"wrong-password-for-check"}' `
            -TimeoutSec 10 | Out-Null
    }
    catch {
        $response = $_.Exception.Response
        if ($response -and [int]$response.StatusCode -lt 500) {
            return
        }
        throw
    }
}

Write-Step "[1/7] Checking backend port $BackendPort..."
Import-EnvFile -Path (Join-Path $Root $BackendEnvFile)
$env:PORT = [string]$BackendPort

if (Test-PortListening -Port $BackendPort) {
    Write-Ok "[1/7] Checking backend port $BackendPort... OK"
}
else {
    Write-Host "Backend port $BackendPort is not listening. Starting backend..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        npx tsc
        if ($LASTEXITCODE -ne 0) {
            throw "Backend TypeScript compile failed."
        }
    }
    finally {
        Pop-Location
    }

    Start-Process `
        -FilePath "node" `
        -ArgumentList "dist/server.js" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden | Out-Null
}

Write-Step "[2/7] Checking backend readiness..."
$readiness = Wait-Readiness -Timeout $TimeoutSeconds
Write-Ok "[2/7] Checking backend readiness... OK"

Write-Step "[3/7] Checking database connection..."
Write-Ok "[3/7] Checking database connection... OK: $($readiness.database.name)"

Write-Step "[4/7] Checking CORS from $FrontendOrigin..."
Test-CorsPreflight
Write-Ok "[4/7] Checking CORS from $FrontendOrigin... OK"

Write-Step "[5/7] Checking frontend port $FrontendPort..."
if (Test-PortListening -Port $FrontendPort) {
    Write-Ok "[5/7] Checking frontend port $FrontendPort... OK"
}
else {
    Write-Host "Frontend port $FrontendPort is not listening. Starting frontend..." -ForegroundColor Yellow
    $env:NEXT_PUBLIC_API_BASE_URL = $BackendUrl
    $env:NEXT_PUBLIC_WS_URL = "ws://localhost:$BackendPort/ws"
    $npmCommandInfo = Get-Command npm.cmd -ErrorAction SilentlyContinue
    $npmCommand = if ($npmCommandInfo) { $npmCommandInfo.Source } else { $null }
    if (-not $npmCommand) {
        $npmCommand = (Get-Command npm -ErrorAction Stop).Source
    }
    Start-Process `
        -FilePath $npmCommand `
        -ArgumentList "--prefix", $FrontendDir, "run", "dev", "--", "-p", "$FrontendPort" `
        -WorkingDirectory $Root `
        -WindowStyle Hidden | Out-Null
}

Wait-HttpOk -Url $FrontendUrl -Timeout $TimeoutSeconds | Out-Null
Write-Ok "[5/7] Checking frontend port $FrontendPort... OK"

Write-Step "[6/7] Checking auth endpoint..."
Test-AuthEndpoint
Write-Ok "[6/7] Checking auth endpoint... OK"

Write-Step "[7/7] Session ready."
Write-Ok "[7/7] Session ready."
Write-Host ""
Write-Host "Frontend: $FrontendUrl"
Write-Host "Backend : $BackendUrl"
Write-Host "Database: $($readiness.database.name)"
