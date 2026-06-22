[CmdletBinding()]
param(
    [ValidateRange(1, 20)]
    [int]$Runs = 3,

    [ValidateRange(1, 100000)]
    [int]$Iterations = 30,

    [ValidateRange(1, 1000)]
    [int]$VUs = 1,

    [ValidateRange(0, 60)]
    [double]$SleepSeconds = 1,

    [switch]$IncludeExport
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Host ""
    Write-Host "============================================================"
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "============================================================"
}

function Get-RequiredEnvironmentVariable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $value = [Environment]::GetEnvironmentVariable(
        $Name,
        [EnvironmentVariableTarget]::Process
    )

    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Environment variable '$Name' belum diatur."
    }

    return $value.Trim()
}

function Get-NestedPropertyValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$InputObject,

        [Parameter(Mandatory = $true)]
        [string[]]$Path
    )

    $current = $InputObject

    foreach ($segment in $Path) {
        if ($null -eq $current) {
            return $null
        }

        $property = $current.PSObject.Properties[$segment]

        if ($null -eq $property) {
            return $null
        }

        $current = $property.Value
    }

    return $current
}

function Get-AccessToken {
    param(
        [Parameter(Mandatory = $true)]
        [object]$LoginResponse
    )

    $candidatePaths = @(
        @("token"),
        @("accessToken"),
        @("access_token"),
        @("data", "token"),
        @("data", "accessToken"),
        @("data", "access_token"),
        @("auth", "token"),
        @("auth", "accessToken"),
        @("result", "token"),
        @("result", "accessToken")
    )

    foreach ($path in $candidatePaths) {
        $candidate = Get-NestedPropertyValue `
            -InputObject $LoginResponse `
            -Path $path

        if (
            $candidate -is [string] -and
            -not [string]::IsNullOrWhiteSpace($candidate)
        ) {
            return $candidate.Trim()
        }
    }

    return $null
}

function Get-HttpErrorDetails {
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord]$ErrorRecord
    )

    $statusCode = $null
    $responseBody = $null

    try {
        if (
            $null -ne $ErrorRecord.Exception.Response -and
            $null -ne $ErrorRecord.Exception.Response.StatusCode
        ) {
            $statusCode = [int]$ErrorRecord.Exception.Response.StatusCode
        }
    }
    catch {
        $statusCode = $null
    }

    if (
        $null -ne $ErrorRecord.ErrorDetails -and
        -not [string]::IsNullOrWhiteSpace($ErrorRecord.ErrorDetails.Message)
    ) {
        $responseBody = $ErrorRecord.ErrorDetails.Message
    }
    else {
        $responseBody = $ErrorRecord.Exception.Message
    }

    return [PSCustomObject]@{
        StatusCode = $statusCode
        Body       = $responseBody
    }
}

function Invoke-PreflightLogin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseUrl,

        [Parameter(Mandatory = $true)]
        [string]$Username,

        [Parameter(Mandatory = $true)]
        [string]$Password
    )

    $loginBody = @{
        identifier = $Username
        password   = $Password
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "$BaseUrl/api/auth/login" `
            -ContentType "application/json" `
            -Body $loginBody `
            -TimeoutSec 30

        return $response
    }
    catch {
        $details = Get-HttpErrorDetails -ErrorRecord $_

        if ($details.StatusCode -eq 429) {
            throw @"
Login preflight terkena HTTP 429.

Backend masih memblokir percobaan login karena rate limiter.
Restart backend lokal atau tunggu sampai rate-limit window berakhir.

Response:
$($details.Body)
"@
        }

        throw @"
Login preflight gagal.
Status: $($details.StatusCode)
Response: $($details.Body)
"@
    }
}

function Invoke-AuthenticatedPreflight {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseUrl,

        [Parameter(Mandatory = $true)]
        [string]$Token
    )

    try {
        return Invoke-RestMethod `
            -Method Get `
            -Uri "$BaseUrl/api/mwd-sessions" `
            -Headers @{
                Authorization = "Bearer $Token"
            } `
            -TimeoutSec 30
    }
    catch {
        $details = Get-HttpErrorDetails -ErrorRecord $_

        throw @"
Preflight GET /api/mwd-sessions gagal.
Status: $($details.StatusCode)
Response: $($details.Body)

Token login mungkin tidak valid atau user tidak memiliki akses.
"@
    }
}

# ------------------------------------------------------------
# Resolve root project dan file k6
# ------------------------------------------------------------

$projectRoot = (
    Resolve-Path (
        Join-Path $PSScriptRoot "..\.."
    )
).Path

$k6ScriptPath = Join-Path `
    $projectRoot `
    "tests\api\api-endpoint-performance.js"

$resultsDirectory = Join-Path `
    $projectRoot `
    "tests\results\api"

if (-not (Test-Path $k6ScriptPath)) {
    throw "File k6 tidak ditemukan: $k6ScriptPath"
}

New-Item `
    -ItemType Directory `
    -Path $resultsDirectory `
    -Force |
Out-Null

$k6Command = Get-Command k6 -ErrorAction SilentlyContinue

if ($null -eq $k6Command) {
    throw @"
Command 'k6' tidak ditemukan.

Pastikan k6 sudah terinstal dan terminal sudah dibuka ulang.
Periksa dengan:
k6 version
"@
}

# ------------------------------------------------------------
# Validasi environment
# ------------------------------------------------------------

if ([string]::IsNullOrWhiteSpace($env:BASE_URL)) {
    $env:BASE_URL = "http://localhost:5002"
}

if ([string]::IsNullOrWhiteSpace($env:SESSION_ID)) {
    $env:SESSION_ID = "1"
}

if ([string]::IsNullOrWhiteSpace($env:MEASURED_FROM)) {
    $env:MEASURED_FROM = "2026-06-01T00:00:00.000Z"
}

if ([string]::IsNullOrWhiteSpace($env:MEASURED_TO)) {
    $env:MEASURED_TO = "2026-06-30T23:59:59.999Z"
}

$baseUrl = $env:BASE_URL.TrimEnd("/")
$sessionId = Get-RequiredEnvironmentVariable -Name "SESSION_ID"
$username = Get-RequiredEnvironmentVariable -Name "TEST_USERNAME"
$password = Get-RequiredEnvironmentVariable -Name "TEST_PASSWORD"

if ($sessionId -notmatch "^\d+$") {
    throw "SESSION_ID harus berupa angka. Nilai saat ini: '$sessionId'"
}

Write-Section "API PERFORMANCE TEST CONFIGURATION"

Write-Host "Project root     : $projectRoot"
Write-Host "Base URL         : $baseUrl"
Write-Host "Session ID       : $sessionId"
Write-Host "Username         : $username"
Write-Host "Runs             : $Runs"
Write-Host "Iterations/run   : $Iterations"
Write-Host "Virtual users    : $VUs"
Write-Host "Sleep/iteration  : $SleepSeconds second(s)"
Write-Host "Measured from    : $($env:MEASURED_FROM)"
Write-Host "Measured to      : $($env:MEASURED_TO)"
Write-Host "Results directory: $resultsDirectory"

# ------------------------------------------------------------
# Token preflight
# ------------------------------------------------------------

Write-Section "PREFLIGHT TOKEN"

$token = $env:TEST_TOKEN

if (-not [string]::IsNullOrWhiteSpace($token)) {
    $token = $token.Trim()
    Write-Host "Menggunakan pre-issued TEST_TOKEN." -ForegroundColor Green
    Write-Host "Token tidak ditampilkan untuk mencegah kebocoran kredensial."
}
else {
    Write-Host "TEST_TOKEN tidak tersedia; menjalankan login preflight satu kali."

    $loginResponse = Invoke-PreflightLogin `
        -BaseUrl $baseUrl `
        -Username $username `
        -Password $password

    $token = Get-AccessToken -LoginResponse $loginResponse

    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Host "Login response:" -ForegroundColor Yellow
        $loginResponse | ConvertTo-Json -Depth 10

        throw @"
Login berhasil tetapi token tidak ditemukan.

Periksa bentuk response login di atas, kemudian tambahkan lokasi
token ke fungsi Get-AccessToken.
"@
    }

    Write-Host "Login berhasil." -ForegroundColor Green
    Write-Host "Token ditemukan. Panjang token: $($token.Length)"
    Write-Host "Token tidak ditampilkan untuk mencegah kebocoran kredensial."
}

# Token diberikan ke proses k6 melalui environment.
$env:TEST_TOKEN = $token
$env:BASE_URL = $baseUrl
$env:SESSION_ID = $sessionId
$env:ITERATIONS = $Iterations.ToString()
$env:VUS = $VUs.ToString()
$env:SLEEP_SECONDS = $SleepSeconds.ToString(
    [System.Globalization.CultureInfo]::InvariantCulture
)

# Depth tidak diatur secara default karena test data saat ini
# memiliki depthMd dan hole_depth bernilai null.
#
# Ketika sudah memiliki fixture depth valid, atur:
# $env:DEPTH_MIN = "0"
# $env:DEPTH_MAX = "1000"

# ------------------------------------------------------------
# Verifikasi token sebelum menjalankan k6
# ------------------------------------------------------------

Write-Section "AUTHENTICATED PREFLIGHT"

$sessionsPreflight = Invoke-AuthenticatedPreflight `
    -BaseUrl $baseUrl `
    -Token $token

Write-Host "GET /api/mwd-sessions berhasil." -ForegroundColor Green

if ($sessionsPreflight -is [array]) {
    Write-Host "Jumlah session: $($sessionsPreflight.Count)"
}
elseif (
    $null -ne $sessionsPreflight.PSObject.Properties["data"] -and
    $sessionsPreflight.data -is [array]
) {
    Write-Host "Jumlah session: $($sessionsPreflight.data.Count)"
}

# ------------------------------------------------------------
# Endpoint yang akan diuji
# ------------------------------------------------------------

$targets = @(
    "sessions",
    "mwd-data",
    "historical-data"
)

$includeExportFromEnvironment = (
    -not [string]::IsNullOrWhiteSpace($env:INCLUDE_EXPORT) -and
    $env:INCLUDE_EXPORT.Trim().ToLowerInvariant() -eq "true"
)

if ($IncludeExport -or $includeExportFromEnvironment) {
    $targets += "export"
}
else {
    Write-Host ""
    Write-Warning @"
Endpoint export tidak dimasukkan.

Route /api/exports/historical sebelumnya menghasilkan HTTP 404.
Setelah route tersedia, jalankan dengan:

powershell -ExecutionPolicy Bypass -File ".\tests\scripts\run-api-performance.ps1" -IncludeExport
"@
}

# ------------------------------------------------------------
# Jalankan k6
# ------------------------------------------------------------

$failedRuns = New-Object System.Collections.Generic.List[string]
$successfulRuns = New-Object System.Collections.Generic.List[string]

try {
    foreach ($target in $targets) {
        for ($runNumber = 1; $runNumber -le $Runs; $runNumber++) {
            $formattedRun = "{0:D2}" -f $runNumber
            $runName = "$target-run-$formattedRun"

            $rawOutputPath = Join-Path `
                $resultsDirectory `
                "$runName-raw.json"

            $summaryOutputPath = Join-Path `
                $resultsDirectory `
                "$runName-summary.json"

            $env:TARGET_ENDPOINT = $target
            $env:TEST_RUN_NAME = $runName

            Write-Section "RUNNING $target RUN $formattedRun"

            Write-Host "Raw output    : $rawOutputPath"
            Write-Host "Summary output: $summaryOutputPath"

            & $k6Command.Source `
                run `
                --out "json=$rawOutputPath" `
                --summary-export "$summaryOutputPath" `
                "$k6ScriptPath"

            $exitCode = $LASTEXITCODE

            if ($exitCode -eq 0) {
                Write-Host ""
                Write-Host "$runName berhasil." -ForegroundColor Green
                $successfulRuns.Add($runName)
            }
            else {
                Write-Host ""
                Write-Warning "$runName gagal. k6 exit code: $exitCode"
                $failedRuns.Add($runName)
            }
        }
    }
}
finally {
    # Jangan biarkan token berada di process environment setelah runner selesai.
    Remove-Item Env:TEST_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:TARGET_ENDPOINT -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_RUN_NAME -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------
# Ringkasan
# ------------------------------------------------------------

Write-Section "FINAL RESULT"

Write-Host "Successful runs: $($successfulRuns.Count)" -ForegroundColor Green

foreach ($name in $successfulRuns) {
    Write-Host "  PASS $name" -ForegroundColor Green
}

Write-Host ""
Write-Host "Failed runs: $($failedRuns.Count)" -ForegroundColor Yellow

foreach ($name in $failedRuns) {
    Write-Host "  FAIL $name" -ForegroundColor Red
}

Write-Host ""
Write-Host "Result files:"
Write-Host $resultsDirectory

if ($failedRuns.Count -gt 0) {
    Write-Host ""
    Write-Error @"
Satu atau lebih performance test gagal.

Periksa summary JSON dan raw JSON pada:
$resultsDirectory
"@

    exit 1
}

Write-Host ""
Write-Host "Semua performance test selesai tanpa threshold failure." `
    -ForegroundColor Green

exit 0
