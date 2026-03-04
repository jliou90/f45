param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$EnvFile = ".env",
  [switch]$Confirm
)

$ErrorActionPreference = "Stop"

if (-not $Confirm) {
  throw "Restore is destructive. Re-run with -Confirm to proceed."
}

Write-Warning "restore-db.ps1 is for development use only in v1."

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

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot $EnvFile
if (-not (Test-Path $envPath)) {
  throw "Missing $EnvFile"
}

$backupPath = if ([System.IO.Path]::IsPathRooted($BackupFile)) { $BackupFile } else { Join-Path $repoRoot $BackupFile }
if (-not (Test-Path $backupPath)) {
  throw "Backup file not found: $backupPath"
}

$dbName = Get-EnvValue -Path $envPath -Key "POSTGRES_DB"
$dbUser = Get-EnvValue -Path $envPath -Key "POSTGRES_USER"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "kutm" }
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "kutm" }

Write-Host "Restoring backup '$backupPath' into database '$dbName'..."
Push-Location $repoRoot
try {
  Get-Content -Path $backupPath -AsByteStream -ReadCount 0 |
    docker compose exec -T postgres pg_restore -U $dbUser -d $dbName --clean --if-exists --no-owner --no-privileges
  if ($LASTEXITCODE -ne 0) {
    throw "pg_restore failed"
  }
}
finally {
  Pop-Location
}

Write-Host "Restore completed for database '$dbName'."
