$ErrorActionPreference = "Stop"

$TaskName = "MaisonOlive-DB-Backup-Hourly"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$HiddenScript = (Resolve-Path (Join-Path $PSScriptRoot "db-backup-hourly-hidden.ps1")).Path
$ActionArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$HiddenScript`""

function New-HourlyTrigger {
  $Now = Get-Date
  $StartAt = Get-Date -Hour $Now.Hour -Minute 8 -Second 58
  if ($StartAt -le $Now) {
    $StartAt = $StartAt.AddHours(1)
  }

  return New-ScheduledTaskTrigger `
    -Once `
    -At $StartAt `
    -RepetitionInterval (New-TimeSpan -Hours 1)
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

$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument $ActionArguments `
  -WorkingDirectory $Root

$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($Existing) {
  $Triggers = @($Existing.Triggers)
  if ($Triggers.Count -lt 1) {
    $Triggers = @(New-HourlyTrigger)
  }

  Set-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Triggers `
    -Settings $Settings | Out-Null
} else {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger (New-HourlyTrigger) `
    -Settings $Settings `
    -Description "Chez Olive hourly SQLite backup, hidden window wrapper." | Out-Null
}

Enable-ScheduledTask -TaskName $TaskName | Out-Null

$Task = Get-ScheduledTask -TaskName $TaskName
$Info = Get-ScheduledTaskInfo -TaskName $TaskName
$InstalledAction = @($Task.Actions)[0]
$IsHidden = Test-HiddenHourlyAction -Task $Task

Write-Host "Task: $($Task.TaskName)"
Write-Host "State: $($Task.State)"
Write-Host "LastTaskResult: $($Info.LastTaskResult)"
Write-Host "NextRunTime: $($Info.NextRunTime)"
Write-Host "Execute: $($InstalledAction.Execute)"
Write-Host "Arguments: $($InstalledAction.Arguments)"
Write-Host "WorkingDirectory: $($InstalledAction.WorkingDirectory)"

if (-not $IsHidden) {
  Write-Error "Hourly backup task is not configured with the hidden PowerShell wrapper."
  exit 1
}

Write-Host "PASS: hourly backup task uses hidden PowerShell wrapper."
