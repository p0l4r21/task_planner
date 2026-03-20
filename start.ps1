# start.ps1 — Launch backend and frontend together. Ctrl+C stops both.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$venvPython = Join-Path $root ".venv\Scripts\python.exe"

# Fall back to system Python if no venv
if (Test-Path $venvPython) {
    $python = $venvPython
} else {
    $python = "C:/Users/pglenn/AppData/Local/Programs/Python/Python313/python.exe"
    Write-Host "  [warn] .venv not found, using system Python" -ForegroundColor Yellow
}

Write-Host "Starting Task Planner..." -ForegroundColor Cyan
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor DarkGray
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor DarkGray
Write-Host "  Python   -> $python" -ForegroundColor DarkGray
Write-Host "  Press Ctrl+C to stop both.`n" -ForegroundColor DarkGray

$backendJob = Start-Process -NoNewWindow -PassThru -FilePath $python `
    -ArgumentList "$root\backend\run.py" `
    -WorkingDirectory "$root\backend"

$frontendJob = Start-Process -NoNewWindow -PassThru -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev" `
    -WorkingDirectory "$root\frontend"

try {
    # Wait for either process to exit, or Ctrl+C
    while (!$backendJob.HasExited -and !$frontendJob.HasExited) {
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`nShutting down..." -ForegroundColor Yellow

    if (!$backendJob.HasExited) {
        Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  Backend stopped." -ForegroundColor DarkGray
    }
    if (!$frontendJob.HasExited) {
        # npm spawns a child node process — kill the whole tree
        Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  Frontend stopped." -ForegroundColor DarkGray
    }

    Write-Host "Done." -ForegroundColor Green
}
