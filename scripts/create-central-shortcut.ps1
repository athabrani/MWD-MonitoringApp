param(
    [string]$AppUrl = "http://127.0.0.1:3000",
    [string]$ShortcutName = "MWD Monitoring App",
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
    $shortcut.Save()
}

if (!$Desktop -and !$StartMenu) {
    $Desktop = $true
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
