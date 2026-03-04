param(
  [string]$EnvFile = ".env",
  [int]$ReadyTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key
  )

  if (-not (Test-Path $Path)) { return $null }

  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*)\s*$'
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#') { continue }
    if ($line -match $pattern) {
      $value = $Matches[1].Trim()
      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        return $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }
  return $null
}

function Test-StrongSecret {
  param([string]$Secret)

  if ([string]::IsNullOrWhiteSpace($Secret)) { return $false }
  if ($Secret.Trim().Length -lt 32) { return $false }

  $placeholderSet = @(
    "dev_change_me", "change_me", "replace_me", "changeme",
    "your_bootstrap_token_here", "your_jwt_secret_here"
  )
  return -not ($placeholderSet -contains $Secret.Trim().ToLowerInvariant())
}

function Resolve-RepoPath {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [Parameter(Mandatory = $true)][string]$PathValue
  )

  # If it's already absolute, return as-is
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  # Otherwise resolve relative to repo root
  return [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $PathValue))
}

function Wait-Ready {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      # PowerShell 7 supports -SkipCertificateCheck; Windows PowerShell 5.1 does not.
      if ($PSVersionTable.PSVersion.Major -ge 7) {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 10 -SkipCertificateCheck
      } else {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 10
      }

      if ($null -ne $response -and $response.ready -eq $true) {
        return $true
      }
    }
    catch {
      # swallow and retry
    }
    Start-Sleep -Seconds 2
  }

  return $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  $envPath = Join-Path $repoRoot $EnvFile
  if (-not (Test-Path $envPath)) {
    throw "Missing $EnvFile. Copy .env.example to .env and fill required values first."
  }

  # Hostname for the single-origin URL (do NOT use $host / $Host)
  $kutmHost = Get-EnvValue -Path $envPath -Key "KUTM_HOSTNAME"
  if ([string]::IsNullOrWhiteSpace($kutmHost)) { $kutmHost = "kutm.local" }

  $appEnv = Get-EnvValue -Path $envPath -Key "APP_ENV"
  if ([string]::IsNullOrWhiteSpace($appEnv)) { $appEnv = "dev" }

  $jwtSecret = Get-EnvValue -Path $envPath -Key "JWT_SECRET"
  if ($appEnv.Trim().ToLowerInvariant() -eq "prod" -and -not (Test-StrongSecret -Secret $jwtSecret)) {
    throw "APP_ENV=prod requires a strong JWT_SECRET (>=32 chars, non-placeholder)."
  }

  # TLS file paths (default to mkcert output paths)
  $tlsCert = Get-EnvValue -Path $envPath -Key "TLS_CERT_FILE"
  if ([string]::IsNullOrWhiteSpace($tlsCert)) { $tlsCert = "./secrets/tls/kutm.local+3.pem" }

  $tlsKey = Get-EnvValue -Path $envPath -Key "TLS_KEY_FILE"
  if ([string]::IsNullOrWhiteSpace($tlsKey)) { $tlsKey = "./secrets/tls/kutm.local+3-key.pem" }

  $tlsCertPath = Resolve-RepoPath -RepoRoot $repoRoot -PathValue $tlsCert
  $tlsKeyPath  = Resolve-RepoPath -RepoRoot $repoRoot -PathValue $tlsKey

  if (-not (Test-Path $tlsCertPath)) {
    throw "Missing TLS cert file: $tlsCertPath. Run scripts/tls/mkcert-setup.ps1 first."
  }
  if (-not (Test-Path $tlsKeyPath)) {
    throw "Missing TLS key file: $tlsKeyPath. Run scripts/tls/mkcert-setup.ps1 first."
  }

  Write-Host "Starting KUTM LAN stack with docker compose..."
  docker compose up --build -d
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed"
  }

  $readyUrl = "https://$kutmHost/readyz"
  $debugReadyUrl = "http://127.0.0.1:8010/readyz"
  Write-Host "Waiting for readiness: $readyUrl"
  if (-not (Wait-Ready -Url $readyUrl -TimeoutSeconds $ReadyTimeoutSeconds)) {
    throw "Timed out waiting for $readyUrl. Try: docker compose ps; docker compose logs -f web; docker compose logs -f api"
  }

  Write-Host ""
  Write-Host "KUTM is up."
  Write-Host "UI:            https://$kutmHost/"
  Write-Host "Readiness:     https://$kutmHost/readyz"
  Write-Host "Debug API:     $debugReadyUrl"
  Write-Host "Ops health:    https://$kutmHost/api/v1/ops/health"
  Write-Host "OpenAPI:       https://$kutmHost/openapi.json"
  Write-Host ""
  Write-Host "Next: run .\scripts\check-deploy.ps1 for full PASS/FAIL checks."
}
finally {
  Pop-Location
}
