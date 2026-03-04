Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [switch]$IncludeRestore
)

function Assert-Ok($response, [string]$name) {
  if (-not $response.ok) {
    throw "$name failed: $($response.message)"
  }
}

Write-Host "[smoke] checking Docker..."
docker info | Out-Null

Write-Host "[smoke] ensuring supervisor is up..."
docker compose up -d supervisor | Out-Null

$baseUrl = "http://127.0.0.1:7331"

Write-Host "[smoke] GET /status"
$status = Invoke-RestMethod -Method Get -Uri "$baseUrl/status"
Assert-Ok $status "status"

Write-Host "[smoke] POST /backup"
$backup = Invoke-RestMethod -Method Post -Uri "$baseUrl/backup" -ContentType "application/json" -Body "{}"
Assert-Ok $backup "backup"

Write-Host "[smoke] POST /backup/verify"
$verifyBody = @{ path = $backup.data.file } | ConvertTo-Json
$verify = Invoke-RestMethod -Method Post -Uri "$baseUrl/backup/verify" -ContentType "application/json" -Body $verifyBody
Assert-Ok $verify "backup verify"

if ($IncludeRestore) {
  Write-Host "[smoke] POST /restore (dev-only)"
  $restoreBody = @{ path = $backup.data.file; confirm_phrase = "RESTORE_KUTM" } | ConvertTo-Json
  $restore = Invoke-RestMethod -Method Post -Uri "$baseUrl/restore" -ContentType "application/json" -Body $restoreBody
  Assert-Ok $restore "restore"
}

Write-Host "[smoke] POST /diagnostics"
$diag = Invoke-RestMethod -Method Post -Uri "$baseUrl/diagnostics" -ContentType "application/json" -Body "{}"
Assert-Ok $diag "diagnostics"

$backupPath = Join-Path "C:\KUTM\Backups" $backup.data.file
$diagPath = Join-Path "C:\KUTM\Support" $diag.data.file

if (-not (Test-Path $backupPath)) {
  throw "Backup file missing on host path: $backupPath"
}
if (-not (Test-Path $diagPath)) {
  throw "Diagnostics file missing on host path: $diagPath"
}

Write-Host "[smoke] backup file: $backupPath"
Write-Host "[smoke] diagnostics file: $diagPath"
Write-Host "[smoke] complete"
