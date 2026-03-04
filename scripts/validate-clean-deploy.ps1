param(
  [switch]$SkipComposeUp,
  [string]$BackendDir = "backend",
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 8010
)

$ErrorActionPreference = "Stop"

function Wait-ForHttp {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$Attempts = 90,
    [int]$DelayMs = 500
  )
  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get | Out-Null
      return $true
    }
    catch {
      Start-Sleep -Milliseconds $DelayMs
    }
  }
  return $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = if ([System.IO.Path]::IsPathRooted($BackendDir)) { $BackendDir } else { Join-Path $repoRoot $BackendDir }
$venvPython = Join-Path $backendPath ".venv\Scripts\python.exe"
$venvPip = Join-Path $backendPath ".venv\Scripts\pip.exe"
$venvUvicorn = Join-Path $backendPath ".venv\Scripts\uvicorn.exe"

if (-not (Test-Path $venvPython)) {
  if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python launcher 'py' not found; install Python 3.12."
  }
  py -3.12 -m venv (Join-Path $backendPath ".venv")
}

& $venvPython -m pip install --upgrade pip
& $venvPip install -r (Join-Path $backendPath "requirements.txt")

& (Join-Path $repoRoot "scripts\ensure-postgres.ps1") -SkipComposeUp:$SkipComposeUp
& (Join-Path $repoRoot "scripts\migrate.ps1")

Push-Location $backendPath
try {
  & $venvPython seed_admin.py
}
finally {
  Pop-Location
}

$apiProcess = Start-Process -FilePath $venvUvicorn -ArgumentList @("app.main:app", "--host", $BindHost, "--port", "$Port") -WorkingDirectory $backendPath -PassThru
try {
  if (-not (Wait-ForHttp -Url "http://${BindHost}:$Port/health")) {
    throw "API did not become healthy on /health."
  }

  & $venvPython -m pytest -q (Join-Path $backendPath "tests\test_install_smoke.py")
}
finally {
  try { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
}

Write-Host "Clean deployment validation passed."
