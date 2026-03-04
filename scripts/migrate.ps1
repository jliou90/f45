param(
  [string]$BackendDir = "backend"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = if ([System.IO.Path]::IsPathRooted($BackendDir)) { $BackendDir } else { Join-Path $repoRoot $BackendDir }
$venvPython = Join-Path $backendPath ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
  throw "Missing virtualenv python: $venvPython"
}

Push-Location $backendPath
try {
  & $venvPython -m alembic upgrade head
}
finally {
  Pop-Location
}

Write-Host "Migrations applied successfully."
