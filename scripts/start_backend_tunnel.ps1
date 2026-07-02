param(
    [int]$BackendPort = 8000,
    [string]$CloudflaredPath = "$env:USERPROFILE\Downloads\cloudflared.exe"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot ".cloudflared-runtime"
$backendDir = Join-Path $repoRoot "backend"
$uvCacheDir = Join-Path $repoRoot ".uv-cache"
$backendLog = Join-Path $runtimeDir "backend.log"
$backendErrorLog = Join-Path $runtimeDir "backend-error.log"
$tunnelLog = Join-Path $runtimeDir "cloudflared.log"
$tunnelErrorLog = Join-Path $runtimeDir "cloudflared-error.log"
$backendPidFile = Join-Path $runtimeDir "backend.pid"
$tunnelPidFile = Join-Path $runtimeDir "cloudflared.pid"
$corsOrigins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://wkookzky.github.io"

$cleanPath = @(
    [Environment]::GetEnvironmentVariable("Path", "Machine"),
    [Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"
[Environment]::SetEnvironmentVariable("Path", $cleanPath, "Process")
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
$env:ALL_PROXY = ""
$env:CORS_ORIGINS = $corsOrigins
$env:UV_CACHE_DIR = $uvCacheDir

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $uvCacheDir | Out-Null
Remove-Item -Force -ErrorAction SilentlyContinue $backendLog, $backendErrorLog, $tunnelLog, $tunnelErrorLog

if (-not (Test-Path $CloudflaredPath)) {
    throw "cloudflared.exe was not found: $CloudflaredPath"
}

function Resolve-UvCommand {
    $candidatePaths = @(
        (Get-Command uv -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
        (Join-Path $env:USERPROFILE ".local\bin\uv.exe"),
        (Join-Path $env:USERPROFILE "AppData\Roaming\uv\bin\uv.exe")
    ) | Where-Object { $_ -and (Test-Path $_) }

    if ($candidatePaths.Count -gt 0) {
        return $candidatePaths[0]
    }

    throw "uv was not found. Install uv or add it to PATH. Common install location: $env:USERPROFILE\.local\bin\uv.exe"
}

$uvCommand = Resolve-UvCommand
$backendHealthUrl = "http://127.0.0.1:$BackendPort/api/health"
$backendReady = $false
try {
    Invoke-RestMethod -Uri $backendHealthUrl -TimeoutSec 2 | Out-Null
    $backendReady = $true
} catch {
    $backendReady = $false
}

if (-not $backendReady) {
    $backend = Start-Process -FilePath $uvCommand `
        -ArgumentList @("run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$BackendPort") `
        -WorkingDirectory $backendDir `
        -RedirectStandardOutput $backendLog `
        -RedirectStandardError $backendErrorLog `
        -WindowStyle Hidden `
        -PassThru
    Set-Content -Path $backendPidFile -Value $backend.Id

    for ($i = 0; $i -lt 30; $i++) {
        try {
            Invoke-RestMethod -Uri $backendHealthUrl -TimeoutSec 2 | Out-Null
            $backendReady = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
}

if (-not $backendReady) {
    throw "Backend server did not become ready. Check logs: $backendLog / $backendErrorLog"
}

$tunnel = Start-Process -FilePath $CloudflaredPath `
    -ArgumentList @("tunnel", "--url", "http://127.0.0.1:$BackendPort", "--no-autoupdate") `
    -RedirectStandardOutput $tunnelLog `
    -RedirectStandardError $tunnelErrorLog `
    -WindowStyle Hidden `
    -PassThru
Set-Content -Path $tunnelPidFile -Value $tunnel.Id

$tunnelUrl = ""
for ($i = 0; $i -lt 60; $i++) {
    $log = ""
    if (Test-Path $tunnelLog) { $log += Get-Content -Raw -ErrorAction SilentlyContinue $tunnelLog }
    if (Test-Path $tunnelErrorLog) { $log += "`n" + (Get-Content -Raw -ErrorAction SilentlyContinue $tunnelErrorLog) }
    $match = [regex]::Match($log, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    if ($match.Success) {
        $tunnelUrl = $match.Value
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $tunnelUrl) {
    throw "Could not find Cloudflare Tunnel URL. Check logs: $tunnelLog / $tunnelErrorLog"
}

Write-Output "Backend local URL: http://127.0.0.1:$BackendPort"
Write-Output "Backend health: $backendHealthUrl"
Write-Output "Cloudflare Tunnel URL: $tunnelUrl"
Write-Output "Use this value in the GitHub Pages backend URL field:"
Write-Output $tunnelUrl

