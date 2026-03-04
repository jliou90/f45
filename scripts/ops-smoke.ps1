param(
  [string]$BaseUrl = "http://127.0.0.1:8010"
)

$ErrorActionPreference = "Stop"

function Invoke-Json($Url) {
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method Get
    return [pscustomobject]@{
      Url = $Url
      Status = $resp.StatusCode
      Body = ($resp.Content | ConvertFrom-Json)
    }
  }
  catch {
    return [pscustomobject]@{
      Url = $Url
      Status = 0
      Body = $_.Exception.Message
    }
  }
}

$ready = Invoke-Json "$BaseUrl/readyz"
$openapi = Invoke-Json "$BaseUrl/openapi.json"
$status = Invoke-Json "$BaseUrl/api/v1/ops/status"

Write-Host "=== Ops Smoke ==="
Write-Host "readyz: $($ready.Status)"
Write-Host "openapi: $($openapi.Status)"
Write-Host "ops/status: $($status.Status)"

if ($ready.Status -eq 200) {
  Write-Host "readyz.ready: $($ready.Body.ready)"
}

if ($status.Status -eq 200) {
  Write-Host "ops.service: $($status.Body.service)"
  Write-Host "ops.version: $($status.Body.version)"
  Write-Host "ops.db.ok: $($status.Body.db.ok)"
}
