Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command([string]$Name, [string]$InstallHint) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Error "Missing prerequisite: $Name. $InstallHint"
    $script:MissingPrereqs = $true
  }
}

$script:MissingPrereqs = $false

Require-Command "git" "Install Git and retry."
Require-Command "docker" "Install Docker Desktop and ensure it is running."
Require-Command "node" "Install Node.js 20+ and retry."
Require-Command "python" "Install Python 3.11+ and retry."

if (-not $script:MissingPrereqs) {
  docker compose version | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker Compose plugin is required (docker compose)."
    $script:MissingPrereqs = $true
  }
}

if ($script:MissingPrereqs) {
  Write-Host ""
  Write-Host "Resolve missing prerequisites, then rerun:"
  Write-Host "  pwsh -File .\scripts\dev-bootstrap.ps1"
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "[bootstrap] installing frontend deps with npm ci (frontend/)..."
Push-Location (Join-Path $repoRoot "frontend")
try {
  npm ci
} finally {
  Pop-Location
}

$backendDir = Join-Path $repoRoot "backend"
$venvDir = Join-Path $backendDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

Write-Host "[bootstrap] creating backend venv at backend/.venv..."
if (-not (Test-Path $venvPython)) {
  Push-Location $backendDir
  try {
    python -m venv .venv
  } finally {
    Pop-Location
  }
}

Write-Host "[bootstrap] installing backend requirements..."
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $backendDir "requirements.txt")

Write-Host "[bootstrap] backend import smoke check..."
Push-Location $backendDir
try {
  & $venvPython -c "import app.main; print('backend import check: ok')"
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Bootstrap complete."
Write-Host "Next steps:"
Write-Host "  1) docker compose up -d postgres api web supervisor"
Write-Host "  2) cd frontend; npm run dev"
