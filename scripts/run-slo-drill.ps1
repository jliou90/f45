param(
  [string]$BaseUrl = "http://127.0.0.1:8010",
  [string]$OutputFile = "artifacts/slo-drill.json",
  [switch]$SimulateApiRestart
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputFile)) { $OutputFile } else { Join-Path $repoRoot $OutputFile }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutput) | Out-Null

function Invoke-Check([string]$Path) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $resp = Invoke-WebRequest -UseBasicParsing -Method Get -Uri ($BaseUrl.TrimEnd("/") + $Path)
  $sw.Stop()
  return @{
    path = $Path
    status_code = [int]$resp.StatusCode
    latency_ms = [math]::Round($sw.Elapsed.TotalMilliseconds, 2)
  }
}

$checks = @(
  (Invoke-Check "/health"),
  (Invoke-Check "/readyz"),
  (Invoke-Check "/metrics"),
  (Invoke-Check "/api/v1/ops/health")
)

if ($SimulateApiRestart) {
  Push-Location $repoRoot
  try {
    Write-Host "Simulating API restart via docker compose..."
    docker compose restart api | Out-Null
    Start-Sleep -Seconds 4
    $checks += (Invoke-Check "/readyz")
  }
  finally {
    Pop-Location
  }
}

$metrics = Invoke-WebRequest -UseBasicParsing -Method Get -Uri ($BaseUrl.TrimEnd("/") + "/metrics")
if ($metrics.Content -notmatch "kutm_http_requests_total") {
  throw "Metrics payload missing 'kutm_http_requests_total'"
}

$result = @{
  timestamp_utc = (Get-Date).ToUniversalTime().ToString("o")
  base_url = $BaseUrl
  checks = $checks
}

$result | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 $resolvedOutput
Write-Host "SLO drill completed and written to $resolvedOutput"
