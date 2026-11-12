@echo off
setlocal
set "TALOS_UZ_MODE=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='%~f0'; iex ((Get-Content -LiteralPath $f -Raw -Encoding UTF8) -split '#\s*POWERSHELL')[1]"
echo.
pause
exit /b
# POWERSHELL
$ErrorActionPreference = 'Stop'
$pakName = 'pakchunk99-Windows_UzbekLocalization_P.pak'
$here = Split-Path -LiteralPath $f
$uninstall = $env:TALOS_UZ_MODE -eq '/uninstall'

function Find-Paks {
    $libs = @()
    foreach ($key in 'HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam') {
        $p = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        foreach ($v in $p.SteamPath, $p.InstallPath) { if ($v) { $libs += $v } }
    }
    foreach ($steam in @($libs)) {
        $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
        if (Test-Path -LiteralPath $vdf) {
            foreach ($m in [regex]::Matches((Get-Content -LiteralPath $vdf -Raw), '"path"\s+"([^"]+)"')) {
                $libs += $m.Groups[1].Value -replace '\\\\', '\'
            }
        }
    }
    foreach ($lib in $libs | Select-Object -Unique) {
        $paks = Join-Path $lib 'steamapps\common\The Talos Principle 2\Talos2\Content\Paks'
        if (Test-Path -LiteralPath $paks) { return (Resolve-Path -LiteralPath $paks).Path }
    }
    return $null
}

function Resolve-UserPath([string]$p) {
    $p = $p.Trim().Trim('"')
    foreach ($c in $p, (Join-Path $p 'Talos2\Content\Paks'), (Join-Path $p 'Content\Paks')) {
        if ($c -and (Test-Path -LiteralPath $c) -and (Get-ChildItem -LiteralPath $c -Filter 'pakchunk0-*.pak' -ErrorAction SilentlyContinue)) { return $c }
    }
    return $null
}

try {
    Write-Host 'The Talos Principle 2 - O''zbekcha tarjima' -ForegroundColor Cyan
    Write-Host ''

    $src = Join-Path $here $pakName
    if (-not $uninstall -and -not (Test-Path -LiteralPath $src)) {
        Write-Host "$pakName topilmadi." -ForegroundColor Red
        Write-Host 'Arxivni avval papkaga chiqaring (Extract All), keyin install.bat ni o''sha papkadan ishga tushiring.'
        return
    }

    $paks = Find-Paks
    if (-not $paks) {
        Write-Host 'O''yin papkasi avtomatik topilmadi.' -ForegroundColor Yellow
        while (-not $paks) {
            $answer = Read-Host 'O''yin papkasining yo''lini kiriting (masalan D:\Games\The Talos Principle 2), chiqish uchun bo''sh qoldiring'
            if (-not $answer) { return }
            $paks = Resolve-UserPath $answer
            if (-not $paks) { Write-Host 'Bu papkada The Talos Principle 2 topilmadi.' -ForegroundColor Red }
        }
    }
    $dest = Join-Path $paks $pakName

    if ($uninstall) {
        if (Test-Path -LiteralPath $dest) {
            Remove-Item -LiteralPath $dest -Force
            Write-Host 'Tarjima o''chirildi.' -ForegroundColor Green
        } else {
            Write-Host 'Tarjima o''rnatilmagan ekan.'
        }
        return
    }

    Copy-Item -LiteralPath $src -Destination $dest -Force
    Write-Host 'Tarjima o''rnatildi:' -ForegroundColor Green
    Write-Host "  $dest"
    Write-Host ''
    Write-Host 'O''yinda Options -> Gameplay -> Language bo''limidan "uz" ni tanlang.'
} catch {
    Write-Host "Xato: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Agar o''yin ishlab turgan bo''lsa, uni yopib qayta urinib ko''ring.'
}
