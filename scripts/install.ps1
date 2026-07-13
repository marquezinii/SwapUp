$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDotnet = Join-Path $env:LOCALAPPDATA 'Microsoft\dotnet-sdk\dotnet.exe'
$dotnet = if (Test-Path $localDotnet) { $localDotnet } else { (Get-Command dotnet).Source }
$publishDir = Join-Path $projectRoot '.build\publish'
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\SwapUp'

Get-Process -Name 'SwapUp' -ErrorAction SilentlyContinue | Stop-Process -Force
& $dotnet publish (Join-Path $projectRoot 'SwapUp.csproj') -c Release -r win-x64 --self-contained false -o $publishDir
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível compilar o SwapUp!.' }

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -Path (Join-Path $publishDir '*') -Destination $installDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'uninstall.ps1') -Destination (Join-Path $installDir 'uninstall.ps1') -Force

$exe = Join-Path $installDir 'SwapUp.exe'
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
$startup = [Environment]::GetFolderPath('Startup')

function Set-SwapUpShortcut([string]$path, [string]$arguments = '') {
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $exe
  $shortcut.Arguments = $arguments
  $shortcut.WorkingDirectory = $installDir
  $shortcut.IconLocation = "$exe,0"
  $shortcut.Description = 'SwapUp! — Seu calendário pessoal'
  $shortcut.Save()
}

Set-SwapUpShortcut (Join-Path $desktop 'SwapUp!.lnk')
Set-SwapUpShortcut (Join-Path $startMenu 'SwapUp!.lnk')
$autostartPreference = (Get-ItemProperty 'HKCU:\Software\SwapUp' -Name Autostart -ErrorAction SilentlyContinue).Autostart
if ($autostartPreference -ne 0) {
  Set-SwapUpShortcut (Join-Path $startup 'SwapUp!.lnk') '--startup'
}

$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SwapUp'
New-Item -Path $uninstallKey -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name DisplayName -Value 'SwapUp!' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value '1.3.2' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name Publisher -Value 'SwapUp!' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $installDir -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value $exe -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name UninstallString -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $installDir 'uninstall.ps1')`"" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null

Start-Process -FilePath $exe
Write-Host "SwapUp! instalado em $installDir"
