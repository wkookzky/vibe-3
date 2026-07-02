$ErrorActionPreference = "SilentlyContinue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot ".cloudflared-runtime"
$pidFiles = @("cloudflared.pid", "backend.pid")

foreach ($pidFile in $pidFiles) {
    $path = Join-Path $runtimeDir $pidFile
    if (Test-Path $path) {
        $pidValue = Get-Content -Raw $path
        if ($pidValue) {
            Stop-Process -Id ([int]$pidValue.Trim()) -Force
        }
        Remove-Item -Force $path
    }
}

Write-Output "Requested backend/tunnel process stop."
