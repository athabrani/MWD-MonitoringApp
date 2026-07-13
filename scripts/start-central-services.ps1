$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "manage-central-services.ps1") -Start
