$ErrorActionPreference = 'SilentlyContinue'
Get-Process -Name 'SwapUp' | Stop-Process -Force
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\SwapUp'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SwapUp!.lnk'
$menuShortcut = Join-Path (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs') 'SwapUp!.lnk'
$startupShortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'SwapUp!.lnk'
Remove-Item -LiteralPath $desktopShortcut,$menuShortcut,$startupShortcut -Force
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SwapUp' -Recurse -Force
Remove-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'SwapUp' -Force
Remove-Item -LiteralPath 'HKCU:\Software\SwapUp' -Recurse -Force
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile -Command Start-Sleep -Seconds 2; if ((Resolve-Path -LiteralPath '$installDir').Path -eq '$installDir') { Remove-Item -LiteralPath '$installDir' -Recurse -Force }"
