$ErrorActionPreference = 'Stop'

$root    = 'C:\kingunderthemountain'
$compose = Join-Path $root 'infra\docker-compose.yml'
$envFile = Join-Path $root 'backend\.env'
$backend = Join-Path $root 'backend'
$alembic = Join-Path $backend '.venv\Scripts\alembic.exe'

Write-Host '=== KUTM: Ensure Postgres port 5440 + migrate ==='

# 1) Show what's using 5440
Write-Host ''
Write-Host '[1/5] Checking port 5440...'
try {
  $hits = (netstat -aon | findstr ':5440' | Out-String)
  if ($hits.Trim()) { Write-Host "Port 5440 is in use:`n$hits" } else { Write-Host 'Port 5440 appears free.' }
} catch {
  Write-Host 'Could not run netstat/findstr (continuing).'
}

# 2) Ensure backend .env DB_PORT=5440
Write-Host ''
Write-Host '[2/5] Ensuring backend\.env DB_PORT=5440...'
if (-not (Test-Path $envFile)) { throw "Missing: $envFile" }

$envLines = Get-Content $envFile
$foundPort = $false
for ($i = 0; $i -lt $envLines.Count; $i++) {
  if ($envLines[$i] -match '^\s*DB_PORT\s*=') {
    $envLines[$i] = 'DB_PORT=5440'
    $foundPort = $true
  }
}
if (-not $foundPort) { $envLines += 'DB_PORT=5440' }

[System.IO.File]::WriteAllLines($envFile, $envLines, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Updated backend\.env'

# 3) Restart docker compose
Write-Host ''
Write-Host '[3/5] Restarting docker compose...'
Set-Location $root
docker compose -f .\infra\docker-compose.yml down
docker compose -f .\infra\docker-compose.yml up -d

# Wait for Postgres to be ready
Write-Host ''
Write-Host '[3.5/5] Waiting for Postgres readiness...'
$max = 60
for ($i = 1; $i -le $max; $i++) {
  cmd /c "docker exec kutm_postgres pg_isready -U kutm -d kutm >NUL 2>NUL"
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'Postgres is ready.'
    break
  }
  Start-Sleep -Seconds 1
  if ($i -eq $max) { throw 'Postgres did not become ready in time.' }
}

# 4) Run Alembic migrations
Write-Host ''
Write-Host '[4/5] Running Alembic migrations...'
if (-not (Test-Path $alembic)) { throw "Alembic not found at $alembic" }

Set-Location $backend
& $alembic upgrade head
# 5) Seed after migrations (idempotent)
Write-Host ''
Write-Host '[5/5] Seeding default tenant + admin...'
$py = Join-Path $backend '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) { throw "Python not found at $py (venv missing?)" }
& $py .\seed_admin.py

Write-Host ''
Write-Host '✅ DONE'
Write-Host 'Verify:'
Write-Host '  docker ps'
Write-Host '  docker logs kutm_postgres --tail 50'





