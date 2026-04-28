$ErrorActionPreference = "Stop"

$auPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
$wuPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate"

New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows" -Name "WindowsUpdate" -Force | Out-Null
New-Item -Path $wuPath -Name "AU" -Force | Out-Null

# AUOptions=2: notify before download/install.
New-ItemProperty -Path $auPath -Name "AUOptions" -Value 2 -PropertyType DWord -Force | Out-Null

# Do not automatically reboot while a user is logged on.
New-ItemProperty -Path $auPath -Name "NoAutoRebootWithLoggedOnUsers" -Value 1 -PropertyType DWord -Force | Out-Null

# Keep broad active hours as a safety net; policy above is the primary protection.
New-ItemProperty -Path $wuPath -Name "SetActiveHours" -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $wuPath -Name "ActiveHoursStart" -Value 7 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $wuPath -Name "ActiveHoursEnd" -Value 1 -PropertyType DWord -Force | Out-Null

Write-Output "Windows Update reboot policy configured:"
Get-ItemProperty -Path $auPath | Select-Object NoAutoRebootWithLoggedOnUsers, AUOptions | Format-List
Get-ItemProperty -Path $wuPath | Select-Object SetActiveHours, ActiveHoursStart, ActiveHoursEnd | Format-List
