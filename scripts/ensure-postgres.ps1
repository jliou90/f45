param(
  [string]$ComposeFile = "infra/docker-compose.yml",
  [string]$ComposeService = "postgres",
  [string]$HostName = "127.0.0.1",
  [int]$Port = 5440,
  [int]$WaitSeconds = 60,
  [switch]$SkipComposeUp
)

$ErrorActionPreference = "Stop"

function Test-TcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$PortNumber,
    [int]$TimeoutMs = 1000
  )
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($HostName, $PortNumber, $null, $null)
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

function Assert-DockerHealthy {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker CLI not found on PATH. Install Docker Desktop or run against a managed Postgres."
  }

  $null = docker version 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "docker engine is unhealthy/unreachable. Start Docker Desktop and verify `docker version` succeeds."
  }
}

if (Test-TcpPort -HostName $HostName -PortNumber $Port) {
  Write-Host "Postgres is already reachable at ${HostName}:$Port"
  exit 0
}

if ($SkipComposeUp) {
  throw "Postgres is not reachable at ${HostName}:$Port and -SkipComposeUp was provided."
}

Assert-DockerHealthy

if (-not (Test-Path $ComposeFile)) {
  throw "Compose file not found: $ComposeFile"
}

docker compose -f $ComposeFile up -d $ComposeService | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "Failed to start compose service '$ComposeService' from '$ComposeFile'."
}

$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
  if (Test-TcpPort -HostName $HostName -PortNumber $Port) {
    Write-Host "Postgres is reachable at ${HostName}:$Port"
    exit 0
  }
  Start-Sleep -Seconds 1
}

throw "Timed out waiting for Postgres at ${HostName}:$Port"
