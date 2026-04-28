@echo off
echo This command must be run in an Administrator terminal.
netsh advfirewall firewall add rule name="chezolive Local 3101" dir=in action=allow protocol=TCP localport=3101 profile=private
netsh advfirewall firewall show rule name="chezolive Local 3101"

