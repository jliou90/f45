param(
  [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
  if ($RemoveVolumes) {
    docker compose down -v
  }
  else {
    docker compose down
  }

  if ($LASTEXITCODE -ne 0) {
    throw "docker compose down failed"
  }
}
finally {
  Pop-Location
}
