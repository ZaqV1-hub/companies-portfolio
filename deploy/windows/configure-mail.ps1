[CmdletBinding()]
param([string] $EnvFile = 'C:\Secrets\companiesportfolio\test.env')

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw 'Companies Portfolio environment file not found.' }

$secret = Read-Host 'Senha SMTP de investment@abiquifi.org.br' -AsSecureString
if (-not $secret -or $secret.Length -eq 0) { throw 'A senha SMTP não pode ficar vazia.' }
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }

$settings = [ordered]@{
  SMTP_HOST = 'smtp.office365.com'
  SMTP_PORT = '587'
  SMTP_FROM = 'investment@abiquifi.org.br'
  SMTP_USER = 'investment@abiquifi.org.br'
  SMTP_PASSWORD = $password
  TEAM_NOTIFICATION_EMAIL = 'investment@abiquifi.org.br'
  EMAIL_TEST_REDIRECT = ''
}
$lines = [System.Collections.Generic.List[string]]::new()
$seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($line in [IO.File]::ReadAllLines($EnvFile)) {
  if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=') {
    $name = $Matches[1]
    if ($settings.Contains($name)) {
      if ($seen.Add($name)) { $lines.Add($name + '=' + $settings[$name]) }
      continue
    }
  }
  $lines.Add($line)
}
foreach ($name in $settings.Keys) {
  if ($seen.Add($name)) { $lines.Add($name + '=' + $settings[$name]) }
}
[IO.File]::WriteAllText($EnvFile, ([string]::Join("`r`n", $lines) + "`r`n"), [Text.UTF8Encoding]::new($false))
$password = $null
$settings['SMTP_PASSWORD'] = $null
Write-Output 'Configuração de e-mail gravada no arquivo protegido do Companies Portfolio.'
Restart-Service -Name CompaniesPortfolioApi
(Get-Service -Name CompaniesPortfolioApi).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
Write-Output 'Serviço CompaniesPortfolioApi reiniciado.'
