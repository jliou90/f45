param(
  [Parameter(Mandatory = $true)]
  [string]$ConfirmDbName,
  [switch]$SkipComposeUp
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

if ($SkipComposeUp) {
  & "$repoRoot\scripts\verify-fresh-db-migrations.ps1" -ConfirmDbName $ConfirmDbName -SkipComposeUp
}
else {
  & "$repoRoot\scripts\verify-fresh-db-migrations.ps1" -ConfirmDbName $ConfirmDbName
}

Push-Location "$repoRoot\backend"
try {
  python tools/prove_constraints.py
}
finally {
  Pop-Location
}

Write-Host "Fresh DB smoke complete."
