Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-RepoSanity {
  Write-Host "[build-release] running repo sanity gate..."
  & (Join-Path $PSScriptRoot "repo-sanity.ps1")
  if ($LASTEXITCODE -ne 0) {
    throw "repo-sanity.ps1 failed"
  }
}

function Invoke-FrontendBuild {
  Write-Host "[build-release] building frontend..."
  Push-Location (Join-Path $repoRoot "frontend")
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

function Invoke-BackendChecks {
  Write-Host "[build-release] running backend checks..."
  Push-Location (Join-Path $repoRoot "backend")
  try {
    $venvPy = Join-Path (Get-Location) ".venv\Scripts\python.exe"
    if (Test-Path $venvPy) {
      & $venvPy -m pytest -q
      return
    }

    $pytestCmd = Get-Command pytest -ErrorAction SilentlyContinue
    if ($pytestCmd) {
      pytest -q
      return
    }

    python -c "import app.main; print('backend import smoke: ok')"
  } finally {
    Pop-Location
  }
}

function New-Manifest([string]$ReleaseRoot) {
  $versionPath = Join-Path $repoRoot "VERSION"
  $version = if (Test-Path $versionPath) { (Get-Content $versionPath -Raw).Trim() } else { "0.0.0" }
  $gitSha = (git rev-parse --short=12 HEAD).Trim()

  $manifest = @{
    product = "KUTM"
    version = $version
    git_sha = $gitSha
    created_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    frontend = "frontend_dist"
  }
  $manifest | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $ReleaseRoot "MANIFEST.json")
}

Invoke-RepoSanity
Invoke-FrontendBuild
Invoke-BackendChecks

$releaseRoot = Join-Path $repoRoot "release_out"
if (Test-Path $releaseRoot) {
  Remove-Item -Recurse -Force $releaseRoot
}
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null

Write-Host "[build-release] assembling release output..."
$frontendOut = Join-Path $releaseRoot "frontend_dist"
New-Item -ItemType Directory -Force -Path $frontendOut | Out-Null
Copy-Item -Recurse -Force (Join-Path $repoRoot "frontend\dist\*") $frontendOut

$composeOut = Join-Path $releaseRoot "compose"
New-Item -ItemType Directory -Force -Path $composeOut | Out-Null
Copy-Item -Force (Join-Path $repoRoot "docker-compose.yml") $composeOut
Copy-Item -Force (Join-Path $repoRoot ".env.example") $composeOut

$docsOut = Join-Path $releaseRoot "docs"
New-Item -ItemType Directory -Force -Path $docsOut | Out-Null
Copy-Item -Force (Join-Path $repoRoot "docs\release\RELEASE_ARTIFACTS.md") $docsOut
Copy-Item -Force (Join-Path $repoRoot "docs\control-plane\README.md") $docsOut
Copy-Item -Force (Join-Path $repoRoot "docs\BACKUP_RESTORE.md") $docsOut
Copy-Item -Force (Join-Path $repoRoot "VERSION") $releaseRoot

New-Manifest -ReleaseRoot $releaseRoot

$leakedDirs = @()
if (Get-ChildItem -Path $releaseRoot -Recurse -Directory -Filter "node_modules" -ErrorAction SilentlyContinue) {
  $leakedDirs += "node_modules"
}
if (Get-ChildItem -Path $releaseRoot -Recurse -Directory -Filter ".venv" -ErrorAction SilentlyContinue) {
  $leakedDirs += ".venv"
}
if ($leakedDirs.Count -gt 0) {
  throw "release_out contains forbidden dependency directories: $($leakedDirs -join ', ')"
}

Write-Host "[build-release] done -> $releaseRoot"
