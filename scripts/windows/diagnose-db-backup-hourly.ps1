$ErrorActionPreference = "Stop"

$TaskName = "MaisonOlive-DB-Backup-Hourly"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDir = if ($env:CHEZOLIVE_LOG_DIR) {
  Resolve-Path $env:CHEZOLIVE_LOG_DIR -ErrorAction SilentlyContinue
} else {
  $null
}

if (-not $LogDir) {
  $LogDir = Join-Path $Root "..\maison-olive-data\logs"
}

function Test-HiddenHourlyAction {
  param([Parameter(Mandatory = $true)] $Task)

  $Action = @($Task.Actions)[0]
  if (-not $Action) {
    return $false
  }

  $Execute = [string]$Action.Execute
  $Arguments = [string]$Action.Arguments

  return (
    $Execute -match "(^|\\)powershell(\.exe)?$" -and
    $Arguments -like "*-WindowStyle Hidden*" -and
    $Arguments -like "*db-backup-hourly-hidden.ps1*" -and
    $Arguments -notlike "*.cmd*"
  )
}

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $Task) {
  Write-Host "FAIL task: $TaskName not found"
  exit 1
}

$Info = Get-ScheduledTaskInfo -TaskName $TaskName
$Action = @($Task.Actions)[0]
$IsHidden = Test-HiddenHourlyAction -Task $Task
$Level = if ($Task.State -eq "Disabled" -or $Info.LastTaskResult -ne 0 -or -not $IsHidden) { "WARN" } else { "PASS" }

Write-Host "$Level task: $($Task.TaskName)"
Write-Host "State: $($Task.State)"
Write-Host "LastRunTime: $($Info.LastRunTime)"
Write-Host "LastTaskResult: $($Info.LastTaskResult)"
Write-Host "NextRunTime: $($Info.NextRunTime)"
Write-Host "Execute: $($Action.Execute)"
Write-Host "Arguments: $($Action.Arguments)"
Write-Host "WorkingDirectory: $($Action.WorkingDirectory)"
Write-Host "HiddenWrapper: $IsHidden"
Write-Host "LogDir: $LogDir"

if (Test-Path -LiteralPath $LogDir) {
  $Logs = Get-ChildItem -Path $LogDir -Filter "db-backup-hourly-*.log" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 8

  if ($Logs) {
    Write-Host "RecentLogs:"
    foreach ($Log in $Logs) {
      Write-Host ("- {0} ({1} bytes, {2})" -f $Log.Name, $Log.Length, $Log.LastWriteTime)
    }

    $LatestOut = $Logs | Where-Object { $_.Name -like "*.out.log" } | Select-Object -First 1
    $LatestErr = $Logs | Where-Object { $_.Name -like "*.err.log" } | Select-Object -First 1

    if ($LatestOut) {
      Write-Host "LatestOutTail:"
      Get-Content -LiteralPath $LatestOut.FullName -Tail 4 -ErrorAction SilentlyContinue
    }

    if ($LatestErr -and $LatestErr.Length -gt 0) {
      Write-Host "LatestErrTail:"
      Get-Content -LiteralPath $LatestErr.FullName -Tail 4 -ErrorAction SilentlyContinue
    }
  } else {
    Write-Host "RecentLogs: none"
  }
} else {
  Write-Host "RecentLogs: log directory missing"
}

if ($Level -eq "WARN") {
  exit 1
}
