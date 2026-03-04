param(
  [switch]$SkipComposeUp,
  [switch]$SkipSmoke,
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 8010
)

$ErrorActionPreference = "Stop"

function Get-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*)\s*$'
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#') { continue }
    if ($line -match $pattern) {
      $value = $Matches[1].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        return $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }
  return $null
}

function Test-TcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$TimeoutMs = 1000
  )

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $ok) {
      $client.Close()
      return $false
    }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  }
  catch {
    return $false
  }
}

function Wait-ForHttp {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$Attempts = 60,
    [int]$DelayMs = 1000
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
$backendDir = Join-Path $repoRoot "backend"
$envFile = Join-Path $backendDir ".env"
$envExample = Join-Path $backendDir ".env.example"
$venvDir = Join-Path $backendDir ".venv"
$pythonExe = Join-Path $venvDir "Scripts\python.exe"
$pipExe = Join-Path $venvDir "Scripts\pip.exe"
$alembicExe = Join-Path $venvDir "Scripts\alembic.exe"
$uvicornExe = Join-Path $venvDir "Scripts\uvicorn.exe"
$smokeScript = Join-Path $backendDir "tools\smoke_api.ps1"

Write-Host "=== KUTM canonical dev boot ==="

if (-not (Test-Path $envFile)) {
  Copy-Item $envExample $envFile
  Write-Host "Created backend/.env from .env.example"
}

if (-not (Test-Path $venvDir)) {
  Write-Host "Creating virtualenv in backend/.venv"
  if (Get-Command py -ErrorAction SilentlyContinue) {
    py -3.12 -m venv $venvDir
  }
  else {
    python -m venv $venvDir
  }
}

& $pythonExe -m pip install --upgrade pip
& $pipExe install -r (Join-Path $backendDir "requirements.txt")

$dbHost = Get-DotEnvValue -Path $envFile -Key "DB_HOST"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "127.0.0.1" }
$dbPortRaw = Get-DotEnvValue -Path $envFile -Key "DB_PORT"
$dbPort = 5432
if (-not [string]::IsNullOrWhiteSpace($dbPortRaw)) { $dbPort = [int]$dbPortRaw }

& (Join-Path $repoRoot "scripts\ensure-postgres.ps1") `
  -HostName $dbHost `
  -Port $dbPort `
  -SkipComposeUp:$SkipComposeUp

Push-Location $backendDir
try {
  & $alembicExe upgrade head
  & $pythonExe seed_admin.py
}
finally {
  Pop-Location
}

$uvicornArgs = @(
  "app.main:app",
  "--host", $BindHost,
  "--port", "$Port",
  "--reload"
)

Write-Host "Starting API on http://${BindHost}:$Port (background)"
$apiProcess = Start-Process -FilePath $uvicornExe -ArgumentList $uvicornArgs -WorkingDirectory $backendDir -PassThru

if (-not (Wait-ForHttp -Url "http://${BindHost}:$Port/health" -Attempts 90 -DelayMs 500)) {
  try { Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
  throw "API did not become healthy on /health in time."
}

if (-not $SkipSmoke) {
  Write-Host "Running smoke checks"
  $env:KUTM_BASE_URL = "http://${BindHost}:$Port"
  if ([string]::IsNullOrWhiteSpace($env:KUTM_EMAIL)) { $env:KUTM_EMAIL = $env:KUTM_SEED_EMAIL }
  if ([string]::IsNullOrWhiteSpace($env:KUTM_PASSWORD)) { $env:KUTM_PASSWORD = $env:KUTM_SEED_PASSWORD }
  if ([string]::IsNullOrWhiteSpace($env:KUTM_EMAIL)) { $env:KUTM_EMAIL = "you@example.com" }
  if ([string]::IsNullOrWhiteSpace($env:KUTM_PASSWORD)) { $env:KUTM_PASSWORD = "Password123!" }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $smokeScript
}

Write-Host "Dev boot complete. API PID: $($apiProcess.Id)"
Write-Host "To stop API: Stop-Process -Id $($apiProcess.Id)"
