# Start FastAPI (port 8000) and Next.js (port 3000) together — Windows PowerShell.
# Cross-platform alternative from repo root: npm run setup && npm run dev
# Prerequisites: MySQL running, backend/.env configured, Node.js on PATH.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path $backend)) {
  Write-Error "backend folder not found at $backend"
}

Write-Host "Starting FleetOpt API (uvicorn) on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$job = Start-Job -Name FleetOptApi -ArgumentList $root -ScriptBlock {
  param($repoRoot)
  Set-Location $repoRoot
  node .\scripts\run-uvicorn.mjs 2>&1
}

$healthOk = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) {
      $healthOk = $true
      break
    }
  } catch {
    # still starting or DB misconfigured
  }
  Start-Sleep -Milliseconds 500
}

if (-not $healthOk) {
  Write-Host "API did not respond at /health. Recent backend output:" -ForegroundColor Red
  Receive-Job -Job $job -ErrorAction SilentlyContinue | Write-Host
  Stop-Job -Job $job -ErrorAction SilentlyContinue
  Remove-Job -Job $job -ErrorAction SilentlyContinue
  Write-Host "`nCheck: XAMPP/MySQL, backend/.env DATABASE_URL, and: npm run install:backend" -ForegroundColor Yellow
  exit 1
}

Write-Host "API is up. Starting Next.js on http://localhost:3000 ..." -ForegroundColor Green
try {
  Push-Location $frontend
  npm run dev
} finally {
  Write-Host "`nStopping API job ..." -ForegroundColor Cyan
  Stop-Job -Job $job -ErrorAction SilentlyContinue
  Remove-Job -Job $job -ErrorAction SilentlyContinue
}
