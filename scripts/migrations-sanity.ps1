Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Normalize-Block([string]$Block) {
  $lines = $Block -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }
  return ($lines -join "`n")
}

function Get-AllowedHeads([string]$RepoRoot) {
  $migDoc = Join-Path $RepoRoot "docs\MIGRATIONS.md"
  if (-not (Test-Path $migDoc)) {
    return @()
  }

  $line = Get-Content $migDoc | Where-Object { $_ -match "^\s*ALLOWED_MIGRATION_HEADS\s*=" } | Select-Object -First 1
  if (-not $line) {
    return @()
  }
  $value = ($line -split "=", 2)[1].Trim()
  if (-not $value) {
    return @()
  }
  return $value.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$versionsDir = Join-Path $repoRoot "backend\migrations\versions"

if (-not (Test-Path $versionsDir)) {
  Fail "Missing migrations versions directory: $versionsDir"
}

$pycache = Get-ChildItem -Path (Join-Path $repoRoot "backend\migrations") -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue
if ($pycache.Count -gt 0) {
  $paths = $pycache | ForEach-Object { $_.FullName }
  Fail "Found __pycache__ under backend/migrations:`n$($paths -join "`n")"
}

$revisionToFile = @{}
$allDownRevisions = New-Object System.Collections.Generic.HashSet[string]
$noopFailures = @()

$files = Get-ChildItem -Path $versionsDir -File -Filter "*.py"
foreach ($file in $files) {
  $content = Get-Content $file.FullName -Raw

  $revisionMatch = [regex]::Match($content, "revision\s*:\s*[^=]+\=\s*['""]([^'""]+)['""]")
  if (-not $revisionMatch.Success) {
    continue
  }
  $revision = $revisionMatch.Groups[1].Value.Trim()
  $revisionToFile[$revision] = $file.Name

  $downMatch = [regex]::Match($content, "down_revision\s*:\s*[^=]+\=\s*(.+)")
  $downRaw = if ($downMatch.Success) { $downMatch.Groups[1].Value.Trim() } else { "" }
  if ($downRaw -match "['""]([^'""]+)['""]") {
    $allDownRevisions.Add($Matches[1]) | Out-Null
  }
  if ($downRaw -match "\((.+)\)") {
    $tupleContent = $Matches[1]
    [regex]::Matches($tupleContent, "['""]([^'""]+)['""]") | ForEach-Object {
      $allDownRevisions.Add($_.Groups[1].Value) | Out-Null
    }
  }

  $upgradeMatch = [regex]::Match($content, "def\s+upgrade\s*\(\)\s*->\s*None:\s*(?<body>.*?)\s*def\s+downgrade\s*\(\)\s*->\s*None:", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $downgradeMatch = [regex]::Match($content, "def\s+downgrade\s*\(\)\s*->\s*None:\s*(?<body>.*)$", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $upgradeMatch.Success -or -not $downgradeMatch.Success) {
    continue
  }

  $upgradeBody = Normalize-Block $upgradeMatch.Groups["body"].Value
  $downgradeBody = Normalize-Block $downgradeMatch.Groups["body"].Value
  $isPassOnly = ($upgradeBody -eq "pass") -and ($downgradeBody -eq "pass")
  $isMergeMigration = ($file.Name -match "merge") -or ($downRaw -match "^\(" -and $downRaw -match ",")
  if ($isPassOnly -and -not $isMergeMigration) {
    $noopFailures += $file.Name
  }
}

if ($noopFailures.Count -gt 0) {
  Fail "Found non-merge pass-only migrations:`n$($noopFailures -join "`n")"
}

$heads = @($revisionToFile.Keys | Where-Object { -not $allDownRevisions.Contains($_) } | Sort-Object)
$allowedHeads = Get-AllowedHeads -RepoRoot $repoRoot
if ($heads.Count -gt 1) {
  if ($allowedHeads.Count -eq 0) {
    Fail "Multiple migration heads detected and none documented in docs/MIGRATIONS.md ALLOWED_MIGRATION_HEADS=: $($heads -join ', ')"
  }

  $missing = @($heads | Where-Object { $_ -notin $allowedHeads })
  if ($missing.Count -gt 0) {
    Fail "Multiple heads present but not fully documented. Missing from ALLOWED_MIGRATION_HEADS: $($missing -join ', ')"
  }
}

Write-Host "[migrations-sanity] OK (heads: $($heads -join ', '))"
exit 0
