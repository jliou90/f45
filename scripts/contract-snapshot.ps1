param(
  [string]$EnvFile = ".env",
  [string]$OutFile = "contracts/openapi.baseline.json"
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param([string]$Path, [string]$Key)
  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*)\s*$'
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#') { continue }
    if ($line -match $pattern) {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot $EnvFile
if (-not (Test-Path $envPath)) { throw "Missing $EnvFile" }

$host = Get-EnvValue -Path $envPath -Key "KUTM_HOSTNAME"
if ([string]::IsNullOrWhiteSpace($host)) { $host = "kutm.local" }
$url = "https://$host/openapi.json"

$tmp = Join-Path $env:TEMP ("kutm_openapi_{0}.json" -f [guid]::NewGuid())
$target = Join-Path $repoRoot $OutFile
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null

try {
  Invoke-WebRequest -UseBasicParsing -Uri $url -Method Get -TimeoutSec 15 | Select-Object -ExpandProperty Content | Set-Content -Encoding UTF8 $tmp
  python -c "import json,sys,pathlib; p=pathlib.Path(sys.argv[1]); data=json.loads(p.read_text(encoding='utf-8')); p.write_text(json.dumps(data, indent=2, sort_keys=True)+chr(10), encoding='utf-8')" $tmp
  Move-Item -Force $tmp $target
}
finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}

Write-Host "Wrote OpenAPI baseline: $target"
