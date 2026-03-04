param(
  [string]$EnvFile = ".env",
  [string]$OutputDir = "C:\KUTM\Backups"
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

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot $EnvFile
if (-not (Test-Path $envPath)) {
  throw "Missing $EnvFile"
}

$dbName = Get-EnvValue -Path $envPath -Key "POSTGRES_DB"
$dbUser = Get-EnvValue -Path $envPath -Key "POSTGRES_USER"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "kutm" }
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "kutm" }

$outDir = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $repoRoot $OutputDir }
try {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
} catch {
  $fallback = Join-Path $repoRoot "artifacts\backups"
  New-Item -ItemType Directory -Force -Path $fallback | Out-Null
  Write-Warning "Unable to use output directory '$outDir'. Falling back to '$fallback'."
  $outDir = $fallback
}
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $outDir ("kutm_{0}.dump" -f $stamp)

Push-Location $repoRoot
try {
  docker compose exec -T postgres pg_dump -U $dbUser -d $dbName -Fc > $backupFile
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed"
  }
}
finally {
  Pop-Location
}

Write-Host "Backup created: $backupFile"
