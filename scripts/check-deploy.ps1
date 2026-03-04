param(
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key
  )

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

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [scriptblock]$Validator
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -TimeoutSec 12
    if ($response.StatusCode -ne 200) {
      return @{ Name = $Name; Pass = $false; Message = "HTTP $($response.StatusCode)" }
    }
    if ($Validator) {
      $ok = & $Validator $response
      if (-not $ok) {
        return @{ Name = $Name; Pass = $false; Message = "HTTP 200 but response validation failed" }
      }
    }
    return @{ Name = $Name; Pass = $true; Message = "HTTP 200" }
  }
  catch {
    return @{ Name = $Name; Pass = $false; Message = $_.Exception.Message }
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot $EnvFile
if (-not (Test-Path $envPath)) {
  throw "Missing $EnvFile"
}

$kutmHost = Get-EnvValue -Path $envPath -Key "KUTM_HOSTNAME"
if ([string]::IsNullOrWhiteSpace($kutmHost)) { $kutmHost = "kutm.local" }
$base = "https://$kutmHost"

$checks = @(
  @{ Name = "Frontend index"; Url = "$base/"; Validator = { param($r) $r.Content -match '<html' } },
  @{ Name = "Readiness"; Url = "$base/readyz"; Validator = { param($r) try { ($r.Content | ConvertFrom-Json).ready -eq $true } catch { $false } } },
  @{ Name = "Ops health"; Url = "$base/api/v1/ops/health"; Validator = { param($r) try { ($r.Content | ConvertFrom-Json).ok -eq $true } catch { $false } } },
  @{ Name = "OpenAPI"; Url = "$base/openapi.json"; Validator = { param($r) try { [bool](($r.Content | ConvertFrom-Json).openapi) } catch { $false } } }
)

$failed = 0
foreach ($check in $checks) {
  $result = Test-Url -Name $check.Name -Url $check.Url -Validator $check.Validator
  if ($result.Pass) {
    Write-Host "PASS - $($result.Name): $($check.Url) [$($result.Message)]"
  }
  else {
    $failed++
    Write-Host "FAIL - $($result.Name): $($check.Url) [$($result.Message)]"
  }
}

if ($failed -gt 0) {
  Write-Host ""
  Write-Host "Deployment checks FAILED ($failed failing checks)."
  exit 1
}

Write-Host ""
Write-Host "Deployment checks PASSED."
