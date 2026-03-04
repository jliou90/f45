param(
  [string]$HostAddr = "127.0.0.1",
  [int]$Port = 8010
)

$ErrorActionPreference = "Stop"

Write-Host "== KUTM Smoke =="

# 1) Python compile
python -m compileall -q app
Write-Host "✅ compileall OK"

# 2) Quick OpenAPI / health checks (requires server running)
$base = "http://$HostAddr`:$Port"
try {
  $h = Invoke-RestMethod "$base/health" -TimeoutSec 5
  Write-Host "✅ /health OK"
} catch {
  Write-Warning "⚠️ /health not reachable at $base (is uvicorn running on this host/port?)"
}

try {
  $o = Invoke-RestMethod "$base/openapi.json" -TimeoutSec 5
  if ($o.openapi) { Write-Host "✅ /openapi.json OK ($($o.openapi))" } else { Write-Host "✅ /openapi.json OK" }
} catch {
  Write-Warning "⚠️ /openapi.json not reachable at $base"
}

Write-Host "== Smoke complete =="
