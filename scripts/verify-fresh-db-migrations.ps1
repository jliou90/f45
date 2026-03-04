param(
  [string]$ComposeFile = "infra/docker-compose.yml",
  [string]$ComposeService = "postgres",
  [string]$EnvFile = "backend/.env",
  [Parameter(Mandatory = $true)]
  [string]$ConfirmDbName,
  [switch]$SkipComposeUp,
  [switch]$SkipDowngradeCheck
)

$ErrorActionPreference = "Stop"

function Assert-Ident([string]$Value, [string]$Name) {
  if ($Value -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "$Name must match ^[A-Za-z_][A-Za-z0-9_]*$ (got '$Value')."
  }
}

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
  return $null
}

function Test-MigrationDowngradeBodies([string]$VersionsPath) {
  $missing = @()
  foreach ($file in Get-ChildItem -Path $VersionsPath -Filter *.py -File) {
    $text = Get-Content -Path $file.FullName -Raw
    if ($text -notmatch 'def\s+downgrade\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:') {
      $missing += $file.Name
      continue
    }
    $downgradeBlock = [regex]::Match($text, 'def\s+downgrade\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:\s*([\s\S]*)').Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($downgradeBlock)) {
      $missing += $file.Name
      continue
    }
  }
  if ($missing.Count -gt 0) {
    throw "Migrations missing usable downgrade() function: $($missing -join ', ')"
  }
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (exit=$LASTEXITCODE)"
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$resolvedComposeFile = if ([System.IO.Path]::IsPathRooted($ComposeFile)) { $ComposeFile } else { Join-Path $repoRoot $ComposeFile }
$resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $repoRoot $EnvFile }

$database = Read-DotEnvValue -Path $resolvedEnvFile -Key "DB_NAME"
$dbUser = Read-DotEnvValue -Path $resolvedEnvFile -Key "DB_USER"
$dbHost = Read-DotEnvValue -Path $resolvedEnvFile -Key "DB_HOST"
$dbPortRaw = Read-DotEnvValue -Path $resolvedEnvFile -Key "DB_PORT"
$dbPort = 5432
if (-not [string]::IsNullOrWhiteSpace($dbPortRaw)) {
  $dbPort = [int]$dbPortRaw
}
if ([string]::IsNullOrWhiteSpace($dbHost)) {
  $dbHost = "127.0.0.1"
}

if ([string]::IsNullOrWhiteSpace($database)) {
  throw "DB_NAME is missing in $resolvedEnvFile"
}
if ([string]::IsNullOrWhiteSpace($dbUser)) {
  throw "DB_USER is missing in $resolvedEnvFile"
}

Assert-Ident -Value $database -Name "DB_NAME"
Assert-Ident -Value $dbUser -Name "DB_USER"

if ($ConfirmDbName -ne $database) {
  throw "Safety check failed. -ConfirmDbName '$ConfirmDbName' does not match configured DB_NAME '$database' in $resolvedEnvFile"
}
if (-not (Test-Path $resolvedComposeFile)) {
  throw "Compose file not found: $resolvedComposeFile"
}
if (-not (Test-Path $venvPython)) {
  throw "Missing virtualenv python: $venvPython"
}

if (-not $SkipComposeUp) {
  & (Join-Path $repoRoot "scripts\ensure-postgres.ps1") -ComposeFile $resolvedComposeFile -ComposeService $ComposeService -HostName $dbHost -Port $dbPort
}
else {
  & (Join-Path $repoRoot "scripts\ensure-postgres.ps1") -ComposeFile $resolvedComposeFile -ComposeService $ComposeService -HostName $dbHost -Port $dbPort -SkipComposeUp
}

Push-Location $backendDir
try {
  $heads = & $venvPython -m alembic heads
  $headCount = @($heads | Select-String "\(head\)").Count
  if ($headCount -ne 1) {
    throw "Expected exactly 1 alembic head, found $headCount."
  }

  Test-MigrationDowngradeBodies -VersionsPath (Join-Path $backendDir "migrations\versions")

  $resetSql = @"
DROP SCHEMA IF EXISTS "platform" CASCADE;
DROP SCHEMA IF EXISTS "readmodels" CASCADE;
DROP SCHEMA IF EXISTS "events" CASCADE;
DROP SCHEMA IF EXISTS "acct" CASCADE;
DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA "public" AUTHORIZATION "$dbUser";
GRANT ALL ON SCHEMA "public" TO "$dbUser";
GRANT ALL ON SCHEMA "public" TO public;
CREATE SCHEMA "acct" AUTHORIZATION "$dbUser";
CREATE SCHEMA "events" AUTHORIZATION "$dbUser";
CREATE SCHEMA "readmodels" AUTHORIZATION "$dbUser";
CREATE SCHEMA "platform" AUTHORIZATION "$dbUser";
"@

  Write-Host "Resetting schemas in DB_NAME='$database' for fresh migration verification..."
  Invoke-Checked -FailureMessage "Schema reset failed" -Command {
    docker compose -f $resolvedComposeFile exec -T $ComposeService psql -v ON_ERROR_STOP=1 -U $dbUser -d $database -c $resetSql
  }

  $env:DB_NAME = $database
  Invoke-Checked -FailureMessage "alembic upgrade head failed" -Command {
    & $venvPython -m alembic upgrade head
  }

  if (-not $SkipDowngradeCheck) {
    Invoke-Checked -FailureMessage "alembic downgrade -1 failed" -Command {
      & $venvPython -m alembic downgrade -1
    }
    Invoke-Checked -FailureMessage "alembic re-upgrade head failed" -Command {
      & $venvPython -m alembic upgrade head
    }
  }

  $proveScript = Join-Path $backendDir "tools\prove_constraints.py"
  if (Test-Path $proveScript) {
    Invoke-Checked -FailureMessage "Constraint proof script failed" -Command {
      & $venvPython $proveScript
    }
  }
}
finally {
  Pop-Location
}

Write-Host "Fresh migration verification completed for database '$database'."
