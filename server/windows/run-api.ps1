param(
  [Parameter(Mandatory = $true)][string] $AppRoot,
  [Parameter(Mandatory = $true)][string] $NodeExe,
  [Parameter(Mandatory = $true)][string] $EnvFile
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $NodeExe -PathType Leaf)) { throw 'Configured Node.js executable was not found.' }
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw 'Configured environment file was not found.' }
Set-Location -LiteralPath $AppRoot
$env:ENV_FILE = $EnvFile
& $NodeExe 'index.js'
exit $LASTEXITCODE
