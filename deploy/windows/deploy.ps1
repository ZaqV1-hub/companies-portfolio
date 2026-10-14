<#
.SYNOPSIS
  Publishes Companies Portfolio on the Windows VM (IIS front + CompaniesPortfolioApi service).

.DESCRIPTION
  Automates the "Atualização futura" steps of docs/DEPLOY.md:
    1. checks paths, the service and Node.js;
    2. backs up the site folder and the API app (code, node_modules and data\seed);
    3. stops ONLY the CompaniesPortfolioApi service, copies server\ and data\seed\, runs
       "npm ci --omit=dev --include=optional" and "npm run migrate" (pending migrations only),
       starts the service and waits for /api/health;
    4. copies the public front (index.html, src, i18n, assets, vendor) to the IIS site,
       keeping the web.config already configured on the site;
    5. checks the public /api/health and removes old automatic backups.
  On any failure in steps 3-5 it restores the backup and starts the service again.
  It never runs the seed or reset-demo, never touches IIS, app pools, bindings, certificates,
  other sites or the environment file.

  Database migrations cannot be undone automatically: if a migration already ran before a
  failure, restore the database manually (see docs/DEPLOY.md).

.EXAMPLE
  # From the root of an up-to-date checkout of main:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\deploy.ps1

.EXAMPLE
  # Only show what would be copied (no backup, no service restart, no copy):
  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\deploy.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [string] $SourceRoot = '',
  [string] $SiteRoot = 'C:\Sites\AzureIIS\companiesportfolio',
  [string] $AppRoot = 'C:\Services\CompaniesPortfolioApi\app',
  [string] $BackupRoot = 'C:\Sites\AzureIIS\backups',
  [string] $ServiceName = 'CompaniesPortfolioApi',
  [string] $NodeExe = 'C:\Lumi\runtime\node-v22.14.0-win-x64\node.exe',
  [string] $NpmCli = 'C:\Lumi\runtime\node-v22.14.0-win-x64\node_modules\npm\bin\npm-cli.js',
  [string] $EnvFile = 'C:\Secrets\companiesportfolio\test.env',
  [string] $LocalHealthUrl = 'http://127.0.0.1:4317/api/health',
  [string] $PublicHealthUrl = 'https://companiesportfolio.brevia.company/api/health',
  [int] $KeepBackups = 10,
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not $SourceRoot) { $SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }

# Public front: only these go to the IIS folder (docs, tools, server, seed and originals stay out).
$FrontDirs = @('src', 'i18n', 'assets', 'vendor')
$FrontFiles = @('index.html')

function Write-Step([string] $Message) {
  Write-Host ''
  Write-Host ('==> ' + $Message)
}

function Invoke-Mirror([string] $From, [string] $To, [string[]] $Extra = @()) {
  $rcArgs = @($From, $To, '/MIR', '/R:2', '/W:2', '/NFL', '/NDL', '/NP', '/NJH') + $Extra
  if ($DryRun) { $rcArgs += '/L' }
  $ErrorActionPreference = 'Continue'   # native tools: judge by exit code, not by stderr
  & robocopy @rcArgs | Out-Host
  $code = $LASTEXITCODE
  $global:LASTEXITCODE = 0
  if ($code -ge 8) { throw "robocopy failed with code $code ($From -> $To)" }
}

function Invoke-Node([string[]] $Arguments, [string] $WorkingDirectory) {
  Push-Location -LiteralPath $WorkingDirectory
  $ErrorActionPreference = 'Continue'   # npm writes warnings to stderr; judge by exit code
  try {
    & $NodeExe @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "node $($Arguments -join ' ') failed with code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

function Wait-Health([string] $Url, [int] $Attempts = 20, [int] $DelaySeconds = 3) {
  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
      if ($response.StatusCode -eq 200) {
        Write-Host "Health OK: $Url"
        return
      }
    } catch {
      Write-Host "Health attempt $i/$Attempts failed: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds $DelaySeconds
  }
  throw "Health check failed: $Url"
}

function Stop-Api {
  $service = Get-Service -Name $ServiceName
  if ($service.Status -ne 'Stopped') {
    Stop-Service -Name $ServiceName
    $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
  }
}

function Start-Api {
  Start-Service -Name $ServiceName
  (Get-Service -Name $ServiceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
}

# ---------------------------------------------------------------- 1. checks
Write-Step 'Checking paths, service and Node.js'
$revision = $env:GITHUB_SHA
if (-not $revision) {
  try { $revision = (& git -C $SourceRoot rev-parse HEAD).Trim() } catch { $revision = 'unknown' }
}
Write-Host "Source:   $SourceRoot"
Write-Host "Revision: $revision"

foreach ($item in @($FrontFiles + $FrontDirs + @('server', 'server\package-lock.json', 'data\seed'))) {
  if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot $item))) { throw "Missing in the checkout: $item" }
}
foreach ($path in @($SiteRoot, $AppRoot, $BackupRoot)) {
  if (-not (Test-Path -LiteralPath $path -PathType Container)) { throw "Folder not found on the VM: $path" }
}
foreach ($file in @($NodeExe, $NpmCli, $EnvFile)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "File not found on the VM: $file" }
}
$null = Get-Service -Name $ServiceName
Write-Host ('Node.js ' + (& $NodeExe --version))

$siteConfig = Join-Path $SiteRoot 'web.config'
$repoConfig = Join-Path $SourceRoot 'web.config'
if ((Test-Path -LiteralPath $repoConfig) -and (Test-Path -LiteralPath $siteConfig)) {
  if ((Get-FileHash -LiteralPath $repoConfig).Hash -ne (Get-FileHash -LiteralPath $siteConfig).Hash) {
    Write-Warning 'web.config in the repository differs from the one on the site. The site version is kept; update it by hand if needed.'
  }
}

if ($DryRun) {
  Write-Step 'DRY RUN: listing what would change (nothing is copied, stopped or backed up)'
  Invoke-Mirror (Join-Path $SourceRoot 'server') (Join-Path $AppRoot 'server') @('/XD', 'node_modules', 'logs', 'uploads', '/XF', '.env', '*.env')
  Invoke-Mirror (Join-Path $SourceRoot 'data\seed') (Join-Path $AppRoot 'data\seed')
  foreach ($dir in $FrontDirs) { Invoke-Mirror (Join-Path $SourceRoot $dir) (Join-Path $SiteRoot $dir) }
  Write-Host 'Dry run finished.'
  return
}

# ---------------------------------------------------------------- 2. backup
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $BackupRoot "companiesportfolio-auto-$stamp"
Write-Step "Backing up to $backup"
New-Item -ItemType Directory -Path $backup | Out-Null
Invoke-Mirror $SiteRoot (Join-Path $backup 'site')
if (Test-Path -LiteralPath (Join-Path $AppRoot 'server')) {
  Invoke-Mirror (Join-Path $AppRoot 'server') (Join-Path $backup 'api-server') @('/XD', 'logs', 'uploads')
}
if (Test-Path -LiteralPath (Join-Path $AppRoot 'data\seed')) {
  Invoke-Mirror (Join-Path $AppRoot 'data\seed') (Join-Path $backup 'api-data-seed')
}
Set-Content -LiteralPath (Join-Path $backup 'previous-revision.txt') -Value ((Get-Content -LiteralPath (Join-Path $AppRoot 'deploy-info.json') -ErrorAction SilentlyContinue) -join "`n")

$apiTouched = $false
$frontTouched = $false
try {
  # ---------------------------------------------------------------- 3. API
  Write-Step "Stopping $ServiceName (only this service)"
  Stop-Api
  $apiTouched = $true

  Write-Step 'Copying server\ and data\seed\'
  Invoke-Mirror (Join-Path $SourceRoot 'server') (Join-Path $AppRoot 'server') @('/XD', 'node_modules', 'logs', 'uploads', '/XF', '.env', '*.env')
  Invoke-Mirror (Join-Path $SourceRoot 'data\seed') (Join-Path $AppRoot 'data\seed')

  Write-Step 'Installing API dependencies (npm ci)'
  Invoke-Node @($NpmCli, 'ci', '--omit=dev', '--include=optional', '--no-audit', '--no-fund') (Join-Path $AppRoot 'server')

  Write-Step 'Applying pending database migrations (npm run migrate)'
  $env:ENV_FILE = $EnvFile
  Invoke-Node @($NpmCli, 'run', 'migrate') (Join-Path $AppRoot 'server')

  Write-Step "Starting $ServiceName"
  Start-Api
  Wait-Health $LocalHealthUrl

  # ---------------------------------------------------------------- 4. front
  Write-Step 'Publishing the front to the IIS site (web.config kept)'
  $frontTouched = $true
  foreach ($dir in $FrontDirs) { Invoke-Mirror (Join-Path $SourceRoot $dir) (Join-Path $SiteRoot $dir) }
  foreach ($file in $FrontFiles) { Copy-Item -LiteralPath (Join-Path $SourceRoot $file) -Destination (Join-Path $SiteRoot $file) -Force }

  # ---------------------------------------------------------------- 5. public check
  Write-Step 'Checking the public site'
  Wait-Health $PublicHealthUrl
  $page = Invoke-WebRequest -Uri ($PublicHealthUrl -replace '/api/health$', '/') -UseBasicParsing -TimeoutSec 15
  if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'src/main.js') { throw 'Public home page did not return the expected index.html' }
} catch {
  $failure = $_
  Write-Warning "Deploy failed: $($failure.Exception.Message)"
  Write-Warning 'Restoring the previous version from the backup...'
  try {
    if ($frontTouched) {
      foreach ($dir in $FrontDirs) { Invoke-Mirror (Join-Path $backup "site\$dir") (Join-Path $SiteRoot $dir) }
      foreach ($file in $FrontFiles) { Copy-Item -LiteralPath (Join-Path $backup "site\$file") -Destination (Join-Path $SiteRoot $file) -Force }
    }
    if ($apiTouched) {
      Stop-Api
      if (Test-Path -LiteralPath (Join-Path $backup 'api-server')) {
        Invoke-Mirror (Join-Path $backup 'api-server') (Join-Path $AppRoot 'server') @('/XD', 'logs', 'uploads', '/XF', '.env', '*.env')
      }
      if (Test-Path -LiteralPath (Join-Path $backup 'api-data-seed')) {
        Invoke-Mirror (Join-Path $backup 'api-data-seed') (Join-Path $AppRoot 'data\seed')
      }
      Start-Api
      Wait-Health $LocalHealthUrl
    }
    Write-Warning 'Previous version restored. Database migrations (if any ran) were NOT undone.'
  } catch {
    Write-Warning "ROLLBACK FAILED: $($_.Exception.Message). Restore manually from $backup."
  }
  throw $failure
}

# ---------------------------------------------------------------- done: record + cleanup
$info = [ordered]@{ revision = $revision; deployed_at = (Get-Date).ToString('o'); backup = $backup; source = $SourceRoot }
($info | ConvertTo-Json) | Set-Content -LiteralPath (Join-Path $AppRoot 'deploy-info.json')

Write-Step "Keeping the last $KeepBackups automatic backups"
Get-ChildItem -LiteralPath $BackupRoot -Directory -Filter 'companiesportfolio-auto-*' |
  Sort-Object Name -Descending | Select-Object -Skip $KeepBackups |
  ForEach-Object { Write-Host "Removing old backup $($_.FullName)"; Remove-Item -LiteralPath $_.FullName -Recurse -Force }

Write-Host ''
Write-Host "Deploy finished: $revision"
