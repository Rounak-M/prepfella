# Starts PrepFella in this one window: backend on :8000, frontend on :3000, then opens the browser.
# Ctrl+C (or closing the window) stops both. On Rounak's laptop "run prep" (~\.local\bin\run.cmd) calls this.
#   run prep          dev mode (pages compile on first visit)        also: .\start
#   run prep -Prod    production build: faster pages, no Next.js dev badge. Use this for the demo.
#   run prep -Reset   delete backend\prepfella.db first, so the demo accounts are reseeded fresh
param([switch]$Prod, [switch]$Reset)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"
$next = Join-Path $root "frontend\node_modules\next\dist\bin\next"

function Test-Up($url) {
  try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
}
function Wait-Up($url, $name, $proc, $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while (-not (Test-Up $url)) {
    if ($proc.HasExited) { throw "$name exited during startup (see the output above)." }
    if ((Get-Date) -gt $deadline) { throw "$name did not come up within $seconds s." }
    Start-Sleep -Milliseconds 500
  }
}
function Stop-Tree($proc) {
  if ($proc -and -not $proc.HasExited) { taskkill /T /F /PID $proc.Id 2>&1 | Out-Null }
}

if (-not (Test-Path $py)) { throw "No .venv. Run: py -3.12 -m venv .venv; .venv\Scripts\python -m pip install -r backend\requirements.txt" }
if (-not (Test-Path (Join-Path $root ".env"))) { throw "No .env. Copy .env.example to .env and paste your NVIDIA_API_KEY." }

$busy = @(8000, 3000 | Where-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue })
if ($busy.Count -eq 2 -and (Test-Up "http://127.0.0.1:8000/health")) {
  Write-Host "PrepFella is already running. Opening http://localhost:3000" -ForegroundColor Yellow
  Start-Process "http://localhost:3000"
  exit
}
if ($busy.Count) { throw "Port $($busy -join ' and ') already in use. Close whatever is using it and try again." }

if ($Reset) {
  Remove-Item (Join-Path $root "backend\prepfella.db") -ErrorAction SilentlyContinue
  Write-Host "Demo data reset: accounts will be reseeded." -ForegroundColor Yellow
}
if (-not (Test-Path $next)) {
  Write-Host "Installing frontend packages..." -ForegroundColor Cyan
  npm install --prefix (Join-Path $root "frontend")
}

$backend = $null; $frontend = $null
try {
  Write-Host "Starting backend on http://localhost:8000 ..." -ForegroundColor Cyan
  # No --reload, and one worker only: the NVIDIA rate-limit budget lives in this process.
  $backend = Start-Process $py -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8000" `
    -WorkingDirectory (Join-Path $root "backend") -NoNewWindow -PassThru
  Wait-Up "http://127.0.0.1:8000/health" "Backend" $backend 60

  if ($Prod) {
    Write-Host "Building frontend (about 20 s)..." -ForegroundColor Cyan
    Push-Location (Join-Path $root "frontend")
    try { node $next build; if ($LASTEXITCODE) { throw "Frontend build failed." } } finally { Pop-Location }
  }
  Write-Host "Starting frontend on http://localhost:3000 ..." -ForegroundColor Cyan
  $frontend = Start-Process node -ArgumentList "`"$next`"", $(if ($Prod) { "start" } else { "dev" }) `
    -WorkingDirectory (Join-Path $root "frontend") -NoNewWindow -PassThru
  Wait-Up "http://127.0.0.1:3000/login" "Frontend" $frontend 180

  Start-Process "http://localhost:3000"
  Write-Host "`nPrepFella is up at http://localhost:3000  (Ctrl+C to stop)`n" -ForegroundColor Green
  while (-not $backend.HasExited -and -not $frontend.HasExited) { Start-Sleep -Seconds 1 }
  Write-Host "$(if ($backend.HasExited) { 'Backend' } else { 'Frontend' }) stopped; shutting down." -ForegroundColor Yellow
}
finally {
  Stop-Tree $frontend
  Stop-Tree $backend
}
