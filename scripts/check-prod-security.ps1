param(
  [string]$EnvFile = "backend/.env"
)

$ErrorActionPreference = "Stop"

function Read-DotEnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) {
    throw ".env file not found: $Path"
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
  return ""
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnv = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $repoRoot $EnvFile }

$errors = @()
$warnings = @()

$envMode = (Read-DotEnvValue $resolvedEnv "ENV").ToLowerInvariant()
$appEnv = (Read-DotEnvValue $resolvedEnv "APP_ENV").ToLowerInvariant()
$jwtSecret = Read-DotEnvValue $resolvedEnv "JWT_SECRET"
$bootstrapToken = Read-DotEnvValue $resolvedEnv "BOOTSTRAP_TOKEN"
$dbUser = Read-DotEnvValue $resolvedEnv "DB_USER"
$trustedHosts = Read-DotEnvValue $resolvedEnv "TRUSTED_HOSTS"
$corsOrigins = Read-DotEnvValue $resolvedEnv "CORS_ALLOW_ORIGINS"
$idempotency = Read-DotEnvValue $resolvedEnv "KUTM_IDEMPOTENCY_ENFORCE"

if ($envMode -ne "prod" -or $appEnv -ne "prod") {
  $errors += "ENV and APP_ENV must both be set to 'prod'."
}
if ([string]::IsNullOrWhiteSpace($jwtSecret) -or $jwtSecret.Length -lt 32) {
  $errors += "JWT_SECRET must be at least 32 characters."
}
if (-not [string]::IsNullOrWhiteSpace($bootstrapToken) -and $bootstrapToken.Length -lt 32) {
  $errors += "BOOTSTRAP_TOKEN must be at least 32 characters when set."
}
if ([string]::IsNullOrWhiteSpace($trustedHosts)) {
  $errors += "TRUSTED_HOSTS must be explicitly set in production."
}
if ([string]::IsNullOrWhiteSpace($corsOrigins)) {
  $errors += "CORS_ALLOW_ORIGINS must be explicitly set in production."
}
if ($idempotency -ne "1") {
  $warnings += "KUTM_IDEMPOTENCY_ENFORCE should be set to 1 in production."
}
if ($dbUser.ToLowerInvariant() -eq "postgres") {
  $warnings += "DB_USER should be a least-privilege app user, not 'postgres'."
}
if (-not [string]::IsNullOrWhiteSpace($bootstrapToken)) {
  $warnings += "BOOTSTRAP_TOKEN is set. Rotate/clear it after first install."
}

if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Error $_ }
}
if ($warnings.Count -gt 0) {
  $warnings | ForEach-Object { Write-Warning $_ }
}

if ($errors.Count -gt 0) {
  throw "Production security posture check failed."
}

Write-Host "Production security posture check passed."
