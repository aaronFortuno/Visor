# Visor — Start script (PowerShell)
# Loads .env and starts the server

$envFile = Join-Path $PSScriptRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $val, "Process")
        }
    }
    Write-Host "  .env loaded" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  Token: $($env:VISOR_TOKEN.Substring(0,8))..." -ForegroundColor DarkGray
Write-Host ""

node --experimental-strip-types server/src/index.ts
