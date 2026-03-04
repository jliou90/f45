Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Assert-PathMissing([string]$PathToCheck, [string]$Hint) {
  if (Test-Path $PathToCheck) {
    Fail "$Hint found: $PathToCheck"
  }
}

function Assert-NoTracked([string[]]$Patterns, [string]$Hint) {
  foreach ($pattern in $Patterns) {
    $tracked = git ls-files -- $pattern
    if ($LASTEXITCODE -ne 0) {
      Fail "git ls-files failed while checking $Hint ($pattern)"
    }
    if (-not [string]::IsNullOrWhiteSpace(($tracked -join "`n"))) {
      Fail "Tracked $Hint found for pattern '$pattern':`n$($tracked -join "`n")"
    }
  }
}

function Assert-HasCommitHistory {
  git rev-parse --verify HEAD *> $null
  if ($LASTEXITCODE -ne 0) {
    Fail "Repository has no commits. Create a baseline commit before release."
  }
}

function Assert-CleanWorktree {
  $status = git status --porcelain=v1
  if ($LASTEXITCODE -ne 0) {
    Fail "git status failed while checking working tree cleanliness"
  }
  if (-not [string]::IsNullOrWhiteSpace(($status -join "`n"))) {
    Fail "Working tree is not clean. Commit or stash changes before release."
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  Assert-HasCommitHistory
  Assert-CleanWorktree

  Assert-PathMissing "backend/.venv" "Disallowed local virtualenv directory"
  Assert-PathMissing "frontend/node_modules" "Disallowed frontend dependency directory"

  $pycacheDirs = Get-ChildItem -Path "backend" -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue
  if ($pycacheDirs.Count -gt 0) {
    $paths = $pycacheDirs | ForEach-Object { $_.FullName }
    Fail "Found __pycache__ directories under backend/:`n$($paths -join "`n")"
  }

  Assert-NoTracked -Patterns @("*.bak*", "*.bak", "*.bak.patch*", "*.bak.*") -Hint "backup files"

  Assert-NoTracked -Patterns @(
    "dist/**",
    "**/dist/**",
    "build/**",
    "**/build/**",
    "release_out/**",
    "artifacts/**"
  ) -Hint "build/release artifacts"

  Write-Host "[repo-sanity] OK"
  exit 0
}
finally {
  Pop-Location
}
