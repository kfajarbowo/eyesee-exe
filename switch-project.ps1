# ============================================================
# switch-project.ps1
# Script untuk berpindah konfigurasi server antar project
#
# CARA PAKAI:
#   .\switch-project.ps1 -To project2
#   .\switch-project.ps1 -To project1
#
# KONFIGURASI:
#   server-config.json  = Project 1 (22-site lama / 172.27.0.x)
#   server-config2.json = Project 2 (3-site baru / 172.27.100.x)
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("project1", "project2")]
    [string]$To
)

$Root = $PSScriptRoot

# Daftar semua folder app yang punya server-config
$AppFolders = @(
    @{ Path = $Root;                        Name = "eyesee-exe" },
    @{ Path = "$Root\blm-exe";              Name = "blm-exe" },
    @{ Path = "$Root\bms-exe";              Name = "bms-exe" },
    @{ Path = "$Root\vcomm-exee";           Name = "vcomm-exee" },
    @{ Path = "$Root\portal-center";        Name = "portal-center" }
)

# Lokasi electron-store (AppData) untuk setiap app
# Electron menyimpan data di %APPDATA%\<productName>
$ElectronStores = @(
    "$env:APPDATA\Electron webview\site-preferences.json",
    "$env:APPDATA\BLM Webview Application\site-preferences.json",
    "$env:APPDATA\BMS Application\site-preferences.json",
    "$env:APPDATA\VComm Application\site-preferences.json"
)

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Switching ke: $To" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ── STEP 1: Ganti server-config.json ────────────────────────
Write-Host "[1/2] Mengganti server-config.json..." -ForegroundColor White
Write-Host ""

foreach ($app in $AppFolders) {
    $folder = $app.Path
    $appName = $app.Name

    if ($To -eq "project2") {
        $source = "$folder\server-config2.json"
        $dest   = "$folder\server-config.json"
        $backup = "$folder\server-config1.json"

        if (-not (Test-Path $source)) {
            Write-Host "  [SKIP] $appName - server-config2.json tidak ditemukan" -ForegroundColor Yellow
            continue
        }

        # Backup project1 jika belum ada backup
        if ((Test-Path $dest) -and (-not (Test-Path $backup))) {
            Copy-Item $dest $backup
            Write-Host "  [BACKUP] $appName - server-config.json → server-config1.json" -ForegroundColor Gray
        }

        Copy-Item $source $dest -Force
        Write-Host "  [OK] $appName" -ForegroundColor Green

    } elseif ($To -eq "project1") {
        $backup = "$folder\server-config1.json"
        $dest   = "$folder\server-config.json"

        if (-not (Test-Path $backup)) {
            Write-Host "  [SKIP] $appName - server-config1.json (backup) tidak ditemukan" -ForegroundColor Yellow
            continue
        }

        Copy-Item $backup $dest -Force
        Write-Host "  [OK] $appName" -ForegroundColor Green
    }
}

# ── STEP 2: Hapus cached lastSiteIp dari electron-store ─────
Write-Host ""
Write-Host "[2/2] Membersihkan cache lastSiteIp (electron-store)..." -ForegroundColor White
Write-Host ""

foreach ($storePath in $ElectronStores) {
    if (Test-Path $storePath) {
        Remove-Item $storePath -Force
        $appName = Split-Path (Split-Path $storePath -Parent) -Leaf
        Write-Host "  [CLEARED] $appName\site-preferences.json" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Selesai! Sekarang jalankan ulang app." -ForegroundColor Cyan
Write-Host "  App akan otomatis mencari server yang aktif." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
