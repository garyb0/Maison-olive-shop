param(
  [switch]$ShowPopup,
  [switch]$AlwaysLog
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$logDir = Join-Path $projectRoot "logs"
$logPath = Join-Path $logDir "windows-reboot-required.log"

function Test-RegistryPath {
  param([string]$Path)
  return Test-Path -LiteralPath $Path
}

function Get-PendingFileRenameCount {
  try {
    $value = Get-ItemPropertyValue -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager" -Name "PendingFileRenameOperations" -ErrorAction Stop
    if ($null -eq $value) { return 0 }
    return @($value).Count
  } catch {
    return 0
  }
}

$checks = [ordered]@{
  ComponentBasedServicing = Test-RegistryPath "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending"
  WindowsUpdateAutoUpdate = Test-RegistryPath "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired"
  UpdateExeVolatile = Test-RegistryPath "HKLM:\SOFTWARE\Microsoft\Updates\UpdateExeVolatile"
  PendingFileRenameOperations = (Get-PendingFileRenameCount) -gt 0
}

$pending = $checks.Values -contains $true
$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

if ($pending -or $AlwaysLog) {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $details = ($checks.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "; "
  Add-Content -LiteralPath $logPath -Value "[$timestamp] PendingReboot=$pending; $details"
}

if ($pending -and $ShowPopup) {
  $message = "ATTENTION CHEZ OLIVE: redemarrage Windows requis. Ce PC heberge chezolive.ca. Ne redemarre pas pendant une periode active. Apres reboot, verifie: npx pm2 status et https://chezolive.ca/api/health."
  try {
    & msg.exe $env:USERNAME /TIME:300 $message | Out-Null
  } catch {
    Add-Content -LiteralPath $logPath -Value "[$timestamp] PopupFailed=$($_.Exception.Message)"
  }
}

if ($pending) {
  Write-Output "PENDING_REBOOT"
  exit 2
}

Write-Output "NO_PENDING_REBOOT"
exit 0
