$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$apiRoot = Join-Path $root 'apps/api'
$logDir = Join-Path $root '.run-logs'
New-Item -ItemType Directory -Force $logDir | Out-Null

$pathValue = [Environment]::GetEnvironmentVariable('Path', 'Process')
[Environment]::SetEnvironmentVariable('PATH', $null, 'Process')
[Environment]::SetEnvironmentVariable('Path', $pathValue, 'Process')

Start-Process `
  -FilePath 'C:\Program Files\nodejs\node.exe' `
  -ArgumentList @('dist\src\main.js') `
  -WorkingDirectory $apiRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir 'api.out.log') `
  -RedirectStandardError (Join-Path $logDir 'api.err.log')

Start-Process `
  -FilePath 'C:\Program Files\nodejs\node.exe' `
  -ArgumentList @('scripts\local-static-server.cjs', '5173', 'dist') `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir 'web.out.log') `
  -RedirectStandardError (Join-Path $logDir 'web.err.log')

Write-Host 'Started local API and frontend launcher processes.'
