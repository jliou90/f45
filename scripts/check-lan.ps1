param(
  [string]$EnvFile = ".env"
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

function Invoke-HttpGet {
  param(
    [Parameter(Mandatory = $true)][string]$Url
  )

  if ($PSVersionTable.PSVersion.Major -ge 7 -and $Url.StartsWith("https://")) {
    return Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -TimeoutSec 15 -SkipCertificateCheck
  }
  return Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -TimeoutSec 15
}

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][scriptblock]$Validator
  )

  try {
    $response = Invoke-HttpGet -Url $Url
    if ($response.StatusCode -ne 200) {
      return @{ Name = $Name; Url = $Url; Pass = $false; Message = "HTTP $($response.StatusCode)" }
    }

    $ok = & $Validator $response
    if (-not $ok) {
      return @{ Name = $Name; Url = $Url; Pass = $false; Message = "Validation failed" }
    }

    return @{ Name = $Name; Url = $Url; Pass = $true; Message = "HTTP 200" }
  }
  catch {
    return @{ Name = $Name; Url = $Url; Pass = $false; Message = $_.Exception.Message }
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  $envPath = Join-Path $repoRoot $EnvFile
  $kutmHost = Get-EnvValue -Path $envPath -Key "KUTM_HOSTNAME"
  if ([string]::IsNullOrWhiteSpace($kutmHost)) { $kutmHost = "kutm.local" }

  Write-Host "==> docker compose up -d --build"
  docker compose up -d --build
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed"
  }

  Write-Host "==> docker compose ps"
  docker compose ps
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose ps failed"
  }

  $checks = @(
    @{
      Name = "NGINX readyz"
      Url = "https://$kutmHost/readyz"
      Validator = { param($r) try { ($r.Content | ConvertFrom-Json).ready -eq $true } catch { $false } }
    },
    @{
      Name = "NGINX ops health"
      Url = "https://$kutmHost/api/v1/ops/health"
      Validator = { param($r) try { ($r.Content | ConvertFrom-Json).ok -eq $true } catch { $false } }
    },
    @{
      Name = "Direct API readyz"
      Url = "http://127.0.0.1:8010/readyz"
      Validator = { param($r) try { ($r.Content | ConvertFrom-Json).ready -eq $true } catch { $false } }
    }
  )

  $failed = 0
  foreach ($check in $checks) {
    $result = Test-Url -Name $check.Name -Url $check.Url -Validator $check.Validator
    if ($result.Pass) {
      Write-Host "PASS - $($result.Name): $($result.Url) [$($result.Message)]"
    } else {
      $failed++
      Write-Host "FAIL - $($result.Name): $($result.Url) [$($result.Message)]"
    }
  }

  if ($failed -gt 0) {
    Write-Host ""
    Write-Host "LAN checks FAILED ($failed failing checks)."
    exit 1
  }

  Write-Host ""
  Write-Host "LAN checks PASSED."
}
finally {
  Pop-Location
}
