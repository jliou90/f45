#requires -Version 5.1
<#
KUTM API Smoke Script (PowerShell 5 compatible)

Validates:
- /api/v1/auth/login
- /api/v1/auth/me
- /api/v1/tenants/mine
- /api/v1/tenants/current (requires X-Tenant-Id)
- /api/v1/dms/customers list + create + list
- /api/v1/dms/vehicles list
- /api/v1/dms/appointments list
- /api/v1/ops/health + /api/v1/ops/version (optional)

Usage:
  cd C:\kingunderthemountain\backend
  .\.venv\Scripts\Activate.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\smoke_api.ps1

Overrides via env:
  $env:KUTM_BASE_URL="http://127.0.0.1:8010"
  $env:KUTM_EMAIL="you@example.com"
  $env:KUTM_PASSWORD="Password123!"
  $env:KUTM_SEED_EMAIL="you@example.com"        # fallback when KUTM_EMAIL is not set
  $env:KUTM_SEED_PASSWORD="Password123!"         # fallback when KUTM_PASSWORD is not set
#>

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Ok($msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Read-ErrorBody([System.Exception]$ex) {
    try {
        if ($ex.Response -and $ex.Response.GetResponseStream()) {
            $stream = $ex.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            return $body
        }
    } catch {}
    return $null
}

function Invoke-Json($method, $url, $headers=$null, $bodyObj=$null) {
    $params = @{
        Method = $method
        Uri    = $url
    }
    if ($headers) { $params.Headers = $headers }

    if ($null -ne $bodyObj) {
        $params.ContentType = "application/json"
        $params.Body = ($bodyObj | ConvertTo-Json -Depth 10)
    }

    try {
        return Invoke-RestMethod @params
    } catch {
        $body = Read-ErrorBody $_.Exception
        if ($body) {
            Write-Fail "$method $url"
            Write-Host $body
        } else {
            Write-Fail "$method $url ($($_.Exception.Message))"
        }
        throw
    }
}

# --- config ---
$BASE = $env:KUTM_BASE_URL
if ([string]::IsNullOrWhiteSpace($BASE)) { $BASE = "http://127.0.0.1:8010" }

$email = $env:KUTM_EMAIL
if ([string]::IsNullOrWhiteSpace($email)) { $email = $env:KUTM_SEED_EMAIL }
if ([string]::IsNullOrWhiteSpace($email)) { $email = "you@example.com" }

$pass = $env:KUTM_PASSWORD
if ([string]::IsNullOrWhiteSpace($pass)) { $pass = $env:KUTM_SEED_PASSWORD }
if ([string]::IsNullOrWhiteSpace($pass)) { $pass = "Password123!" }

Write-Host "`n== KUTM API Smoke ==" -ForegroundColor Cyan
Write-Host "base: $BASE"
Write-Host "user: $email`n"

# --- ops (optional but nice) ---
try {
    $h = Invoke-Json "GET" "$BASE/api/v1/ops/health"
    if ($h.ok -eq $true) { Write-Ok "/api/v1/ops/health" } else { Write-Warn "/api/v1/ops/health returned unexpected payload" }
} catch {
    Write-Warn "ops/health failed (continuing)"
}

try {
    $v = Invoke-Json "GET" "$BASE/api/v1/ops/version"
    Write-Ok ("/api/v1/ops/version env={0} version={1}" -f $v.env, $v.version)
} catch {
    Write-Warn "ops/version failed (continuing)"
}

# --- auth/login ---
$login = Invoke-Json "POST" "$BASE/api/v1/auth/login" $null @{ email=$email; password=$pass }
if (-not $login.access_token) { throw "Login did not return access_token" }
$token = $login.access_token
Write-Ok "/api/v1/auth/login"

$authHeader = @{ Authorization = "Bearer $token" }

# --- auth/me ---
$me = Invoke-Json "GET" "$BASE/api/v1/auth/me" $authHeader
Write-Ok ("/api/v1/auth/me -> {0}" -f $me.email)

# --- tenants/mine ---
$mine = Invoke-Json "GET" "$BASE/api/v1/tenants/mine?page=1&size=25" $authHeader
if (-not $mine.items -or $mine.items.Count -lt 1) { throw "No tenants found for user; bootstrap or create a tenant first." }
$tenantId = $mine.items[0].id
$tenantName = $mine.items[0].name
Write-Ok ("/api/v1/tenants/mine -> {0} ({1})" -f $tenantName, $tenantId)

# Full header (auth + tenant)
$hTenant = @{
    Authorization = "Bearer $token"
    "X-Tenant-Id" = $tenantId
}
# --- tenants/current ---
try {
    $cur = Invoke-Json "GET" "$BASE/api/v1/tenants/current" $hTenant
    Write-Ok ("/api/v1/tenants/current -> {0} role={1}" -f $cur.name, $cur.role)
} catch {
    Write-Warn "tenants/current failed (do you have it added yet?)"
}

# --- list endpoints (empty ok) ---
$customersBefore = Invoke-Json "GET" "$BASE/api/v1/dms/customers?page=1&size=10" $hTenant
Write-Ok ("/api/v1/dms/customers list -> total={0}" -f $customersBefore.meta.total)

$vehicles = Invoke-Json "GET" "$BASE/api/v1/dms/vehicles?page=1&size=10" $hTenant
Write-Ok ("/api/v1/dms/vehicles list -> total={0}" -f $vehicles.meta.total)

$appts = Invoke-Json "GET" "$BASE/api/v1/dms/appointments?page=1&size=10" $hTenant
Write-Ok ("/api/v1/dms/appointments list -> total={0}" -f $appts.meta.total)

# --- create customer ---
$nonce = Get-Date -Format "yyyyMMdd-HHmmss"
$newCustomer = @{
    first_name = "Smoke"
    last_name  = "Test-$nonce"
    phone      = "555-555-5555"
    email      = "smoke.$nonce@example.com"
}
$hTenantWrite = @{
    Authorization     = "Bearer $token"
    "X-Tenant-Id"     = $tenantId
    "Idempotency-Key" = "smoke-customer-$nonce"
}

$created = Invoke-Json "POST" "$BASE/api/v1/dms/customers" $hTenantWrite $newCustomer
Write-Ok ("/api/v1/dms/customers create -> id={0}" -f $created.id)

# --- list again ---
$customersAfter = Invoke-Json "GET" "$BASE/api/v1/dms/customers?page=1&size=10" $hTenant
Write-Ok ("/api/v1/dms/customers list (after) -> total={0}" -f $customersAfter.meta.total)

Write-Host "`nSmoke completed successfully.`n" -ForegroundColor Green
