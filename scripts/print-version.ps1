Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$versionFile = Join-Path $repoRoot "VERSION"
if (-not (Test-Path $versionFile)) {
  throw "VERSION file not found at $versionFile"
}

$canonical = (Get-Content -Raw $versionFile).Trim()
Write-Host "Canonical VERSION: $canonical"

try {
  $resp = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8010/api/v1/ops/version" -TimeoutSec 3
  $apiVersion = [string]$resp.version
  if ($apiVersion -eq $canonical) {
    Write-Host "Backend endpoint version matches canonical VERSION."
  } else {
    Write-Warning "Backend endpoint mismatch. api=$apiVersion canonical=$canonical"
  }
} catch {
  Write-Warning "Backend endpoint unavailable at http://127.0.0.1:8010/api/v1/ops/version (best effort check skipped)."
}
