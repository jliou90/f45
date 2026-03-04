param(
  [string]$Domain = "kutm.local",
  [string]$OutDir = "secrets/tls"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$targetDir = Join-Path $repoRoot $OutDir
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  throw "mkcert is not installed or not in PATH. Install mkcert first: https://github.com/FiloSottile/mkcert"
}

$hostName = $env:COMPUTERNAME
$ipv4 = @()
try {
  $ipv4 = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } |
    Select-Object -ExpandProperty IPAddress -Unique
}
catch {
  $ipv4 = @()
}

$names = @($Domain, "localhost", "127.0.0.1")
if (-not [string]::IsNullOrWhiteSpace($hostName)) { $names += $hostName }
if ($ipv4.Count -gt 0) { $names += $ipv4 }
$names = $names | Select-Object -Unique

$certFile = Join-Path $targetDir "$Domain+3.pem"
$keyFile = Join-Path $targetDir "$Domain+3-key.pem"

Write-Host "Installing local mkcert CA (idempotent)..."
mkcert -install
if ($LASTEXITCODE -ne 0) {
  throw "mkcert -install failed"
}

Write-Host "Generating cert for names: $($names -join ', ')"
mkcert -cert-file $certFile -key-file $keyFile @names
if ($LASTEXITCODE -ne 0) {
  throw "mkcert certificate generation failed"
}

$caroot = mkcert -CAROOT
Write-Host ""
Write-Host "Generated TLS cert: $certFile"
Write-Host "Generated TLS key:  $keyFile"
Write-Host "mkcert CA root:     $caroot"
Write-Host ""
Write-Host "Trust this CA on each workstation before browsing https://$Domain/"
