param()

$ErrorActionPreference = "Stop"

function Write-Pass {
  param([string]$Message)
  Write-Host "PASS - $Message"
}

function Write-Fail {
  param([string]$Message)
  Write-Host "FAIL - $Message"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  Write-Host "==> docker compose up -d --build"
  docker compose up -d --build
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed"
  }

  Write-Host "==> docker compose ps"
  docker compose ps
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose ps failed"
  }

  Write-Host "==> in-container checks via python urllib"
  docker exec kutm_api sh -lc "cd /app/backend && python - <<'PY'
from urllib.request import urlopen

def get(u):
    r = urlopen(u, timeout=3)
    return r.getcode(), r.read().decode('utf-8')[:500]

for u in ['http://127.0.0.1:8010/livez', 'http://127.0.0.1:8010/readyz', 'http://127.0.0.1:8010/openapi.json']:
    try:
        code, body = get(u)
        print(u, code)
        print(body)
    except Exception as e:
        print(u, 'ERROR', repr(e))
PY"
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "in-container endpoint checks failed"
    exit 1
  }
  Write-Pass "in-container endpoint checks ran"

  Write-Host "==> host direct-port checks"
  $livez = curl.exe -sS http://127.0.0.1:8010/livez
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "host /livez request failed"
    exit 1
  }
  if ($livez -match '"live"\s*:\s*true') {
    Write-Pass "host /livez returned live=true"
  } else {
    Write-Fail "host /livez response did not include live=true"
    Write-Host $livez
    exit 1
  }

  $readyz = curl.exe -sS http://127.0.0.1:8010/readyz
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "host /readyz request failed"
    exit 1
  }
  if ($readyz -match '"ready"\s*:\s*true') {
    Write-Pass "host /readyz returned ready=true"
  } else {
    Write-Fail "host /readyz response did not include ready=true"
    Write-Host $readyz
    exit 1
  }

  Write-Host ""
  Write-Host "All API container checks passed."
}
finally {
  Pop-Location
}
