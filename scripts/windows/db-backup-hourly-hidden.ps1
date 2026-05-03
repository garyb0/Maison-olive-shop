$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$LogDir = if ($env:CHEZOLIVE_LOG_DIR) {
  Resolve-Path $env:CHEZOLIVE_LOG_DIR -ErrorAction SilentlyContinue
} else {
  $null
}

if (-not $LogDir) {
  $LogDir = Join-Path $Root "..\maison-olive-data\logs"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutLog = Join-Path $LogDir "db-backup-hourly-$Stamp.out.log"
$ErrLog = Join-Path $LogDir "db-backup-hourly-$Stamp.err.log"

$Process = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList @("run", "db:backup:hourly", "--", "--env=production") `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -Wait `
  -PassThru

exit $Process.ExitCode
