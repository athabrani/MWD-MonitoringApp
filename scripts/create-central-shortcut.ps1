param(
    [string]$AppUrl = "http://127.0.0.1:3000",
    [string]$ShortcutName = "MWD Monitoring App",
    [ValidateSet("Custom", "LocalOnly", "LanClient")]
    [string]$Mode = "Custom",
    [string]$ServerHost = "192.168.18.75",
    [int]$FrontendPort = 3000,
    [switch]$Desktop,
    [switch]$StartMenu
)

$ErrorActionPreference = "Stop"

function Get-BrowserCommand {
    $edge = Get-Command msedge.exe -ErrorAction SilentlyContinue
    if ($edge) {
        return @{
            Target = $edge.Source
            Arguments = "--app=$AppUrl"
            Name = "Microsoft Edge"
        }
    }

    $edgePaths = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { $_ -and (Test-Path $_) }
    if ($edgePaths.Count -gt 0) {
        return @{
            Target = $edgePaths[0]
            Arguments = "--app=$AppUrl"
            Name = "Microsoft Edge"
        }
    }

    $chrome = Get-Command chrome.exe -ErrorAction SilentlyContinue
    if ($chrome) {
        return @{
            Target = $chrome.Source
            Arguments = "--app=$AppUrl"
            Name = "Google Chrome"
        }
    }

    $chromePaths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { $_ -and (Test-Path $_) }
    if ($chromePaths.Count -gt 0) {
        return @{
            Target = $chromePaths[0]
            Arguments = "--app=$AppUrl"
            Name = "Google Chrome"
        }
    }

    return @{
        Target = $AppUrl
        Arguments = ""
        Name = "Default browser"
    }
}

function New-AppShortcut {
    param(
        [string]$Path,
        [hashtable]$Browser
    )

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $Browser.Target
    $shortcut.Arguments = $Browser.Arguments
    if (Test-Path $Browser.Target) {
        $shortcut.WorkingDirectory = Split-Path -Parent $Browser.Target
    }
    $shortcut.Description = "Open MWD Monitoring App at $AppUrl"
    try {
        $shortcut.Save()
    } catch [System.UnauthorizedAccessException] {
        Write-Host "Access denied while creating shortcut."
        Write-Host ("Target path: {0}" -f $Path)
        Write-Host "Run this command from a normal user PowerShell session, or choose a writable location."
        throw
    }
}

if (!$Desktop -and !$StartMenu) {
    $Desktop = $true
}

if ($Mode -eq "LocalOnly") {
    $AppUrl = "http://127.0.0.1:$FrontendPort"
} elseif ($Mode -eq "LanClient") {
    if ([string]::IsNullOrWhiteSpace($ServerHost)) {
        throw "ServerHost is required for -Mode LanClient."
    }
    $AppUrl = "http://$ServerHost`:$FrontendPort"
}

try {
    [Uri]$AppUrl | Out-Null
} catch {
    throw "AppUrl must be a valid URL. Received: $AppUrl"
}

$browser = Get-BrowserCommand
$created = @()

if ($Desktop) {
    $desktopDir = [Environment]::GetFolderPath("Desktop")
    $path = Join-Path $desktopDir "$ShortcutName.lnk"
    New-AppShortcut -Path $path -Browser $browser
    $created += $path
}

if ($StartMenu) {
    $startMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) "MWD Monitoring App"
    New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
    $path = Join-Path $startMenuDir "$ShortcutName.lnk"
    New-AppShortcut -Path $path -Browser $browser
    $created += $path
}

Write-Host "Central app shortcut created."
Write-Host ("Browser : {0}" -f $browser.Name)
Write-Host ("App URL : {0}" -f $AppUrl)
foreach ($item in $created) {
    Write-Host ("Shortcut: {0}" -f $item)
}
