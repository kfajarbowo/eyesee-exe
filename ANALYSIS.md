# EyeSee WebView — Project Analysis

## 📋 Overview

**EyeSee** adalah aplikasi **Electron WebView** yang membungkus website ke dalam desktop app (Windows/Mac/Linux) dengan sistem **lisensi** dan **performance optimization** terintegrasi.

| Item | Detail |
|------|--------|
| **Nama** | EyeSee (Electron WebView) |
| **Framework** | Electron v33 |
| **Entry Point** | [`main.js`](main.js) |
| **Produk Serupa** | `blm-exe/`, `bms-exe/`, `vcomm-exee/` (varian lain dengan branding berbeda) |

---

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────────┐
│                   main.js                        │
│            (App Lifecycle & IPC Hub)             │
├──────────┬──────────┬──────────┬────────────────┤
│  License │  Window  │   Menu   │  Performance   │
│  System  │  Manager │  Builder │   Monitoring   │
├──────────┴──────────┴──────────┴────────────────┤
│                  preload.js                       │
│           (contextBridge / IPC API)              │
├─────────────────────────────────────────────────┤
│               index.html + renderer.js           │
│          (WebView Tag + UI Controls)             │
└─────────────────────────────────────────────────┘
```

---

## 📂 Struktur File Utama

### Core Application
| File | Fungsi |
|------|--------|
| [`main.js`](main.js) | Entry point — app lifecycle, IPC handlers, DNS config, license validation |
| [`preload.js`](preload.js) | Bridge API — expose `window.electron` & `window.electronAPI` ke renderer |
| [`index.html`](index.html) | UI utama — `<webview>` tag + error screen jika URL belum dikonfigurasi |
| [`assets/js/renderer.js`](assets/js/renderer.js) | Renderer logic — loading screen, navigation, performance modules, cache |
| [`server-config.json`](server-config.json) | Konfigurasi — `serverUrl` (license server) & `webviewUrl` (target website) |

### Window & Menu
| File | Fungsi |
|------|--------|
| [`src/window.js`](src/window.js) | Factory `createBrowserWindow()` — ukuran 1024×768, webviewTag enabled |
| [`src/menu.js`](src/menu.js) | Menu template — Navigate, Edit, View, Help (termasuk License Info) |
| [`src/print.js`](src/print.js) | Print handler |
| [`src/view.js`](src/view.js) | View handler |

### License System (`src/license/`)
| File | Fungsi |
|------|--------|
| [`index.js`](src/license/index.js) | Central export — singleton `licenseManager` |
| [`license-manager.js`](src/license/license-manager.js) | Core logic — activate, validate, deactivate, offline grace period |
| [`license-crypto.js`](src/license/license-crypto.js) | Enkripsi/dekripsi license key |
| [`license-storage.js`](src/license/license-storage.js) | Persistensi license ke disk (electron-store) |
| [`license-server-client.js`](src/license/license-server-client.js) | HTTP client ke license server |
| [`hardware-id.js`](src/license/hardware-id.js) | Machine fingerprint via `node-machine-id` |

### Performance System (`src/performance/`)
| File | Fungsi |
|------|--------|
| [`index.js`](src/performance/index.js) | Controller — orchestrator semua performance modules |
| [`performance-monitor.js`](src/performance/performance-monitor.js) | Metrics — CPU, memory, FPS tracking |
| [`advanced-monitor.js`](src/performance/advanced-monitor.js) | Advanced metrics & alerting |
| [`memory-manager.js`](src/performance/memory-manager.js) | Memory cleanup & GC management |
| [`resource-manager.js`](src/performance/resource-manager.js) | Resource loading & caching strategy |
| [`advanced-cache.js`](src/performance/advanced-cache.js) | LRU/TTL cache implementation |
| [`network-optimizer.js`](src/performance/network-optimizer.js) | Network request optimization |
| [`render-optimizer.js`](src/performance/render-optimizer.js) | Render pipeline optimization |
| [`webview-pool.js`](src/performance/webview-pool.js) | WebView instance pooling |
| [`prerenderer.js`](src/performance/prerenderer.js) | URL prerendering untuk navigasi cepat |

### Build & Config
| File | Fungsi |
|------|--------|
| [`build.js`](build.js) | Build script — packaging untuk multi-platform |
| [`package.json`](package.json) | Dependencies & scripts |
| [`.env`](.env) | Environment variable (WEBVIEW_URL) |

---

## 🔑 Alur Kerja Aplikasi

### 1. Startup Flow
```
App Ready
  → licenseManager.initialize(serverUrl)
  → licenseManager.validateLicense()
  ├─ VALID / OFFLINE_VALID → createMainWindow()
  ├─ REVOKED / OFFLINE_EXPIRED → showError + app.quit()
  └─ NOT_ACTIVATED / INVALID → createLicenseWindow()
```

### 2. License Activation Flow
```
User input license key
  → renderer: window.electron.activateLicense(key)
  → main: licenseManager.activateLicense(key)
  → server: POST /api/license/activate {key, hardwareId}
  ← server: {status, license}
  → licenseStorage.save(license)
  → close licenseWindow → createMainWindow()
```

### 3. WebView Loading Flow
```
index.html loaded
  → renderer: window.electron.getWebviewUrl()
  ← main: reads server-config.json → returns URL
  → webview.src = URL
  → showLoadingScreen()
  → webview "did-stop-loading" → hideLoadingScreen()
```

---

## 🔒 Sistem Lisensi

- **Hardware-bound**: License terikat ke machine ID (`node-machine-id`)
- **Online/Offline**: Mendukung offline validation dengan grace period
- **Status**: `VALID`, `OFFLINE_VALID`, `GRACE_PERIOD`, `EXPIRED`, `REVOKED`, `NOT_ACTIVATED`
- **Server**: REST API di `serverUrl` (default `http://127.0.0.1:3001`)
- **Storage**: License disimpan lokal via `electron-store`
- **Crypto**: License key dienkripsi saat disimpan

---

## ⚡ Performance Features

- **WebView Pooling**: Pre-allocate webview instances untuk navigasi instan
- **Prerendering**: Pre-render URL yang sering diakses di background
- **Advanced Cache**: LRU + TTL cache untuk resource
- **Memory Manager**: Auto cleanup & GC trigger
- **Network Optimizer**: Request deduplication & prefetching
- **Render Optimizer**: Minimize layout thrashing
- **Monitoring**: Real-time metrics (Ctrl+Shift+P), force cleanup (Ctrl+Shift+M)

---

## 🌐 Konfigurasi

[`server-config.json`](server-config.json) adalah file konfigurasi utama:
```json
{
    "serverUrl": "http://blm.id:3001",    // License server
    "webviewUrl": "http://eyesee.id:3000"  // Target website
}
```

Priority: **Env Var** → **Config File** → **Default**

---

## 🖥️ Multi-Product Architecture

Project ini punya **3 varian produk** dengan struktur serupa:

| Produk | Folder | Target |
|--------|--------|--------|
| **EyeSee** | Root (`/`) | eyesee.id:3000 |
| **BLM** | `blm-exe/` | (BLM product) |
| **BMS** | `bms-exe/` | (BMS product) |
| **VComm** | `vcomm-exee/` | (VComm product) |

Masing-masing punya icon, branding, dan `server-config.json` sendiri, tapi **license system dan core logic identik**.

---

## 📡 IPC Communication

| Channel | Direction | Fungsi |
|---------|-----------|--------|
| `activate-license` | Renderer → Main | Aktivasi lisensi |
| `get-license-info` | Renderer → Main | Ambil info lisensi |
| `deactivate-license` | Renderer → Main | Deaktivasi lisensi |
| `license-activated` | Renderer → Main | Notifikasi lisensi aktif |
| `get-webview-url` | Renderer → Main | Ambil URL dari config |
| `get-server-url` | Renderer → Main | Debug: ambil server URL |
| `navigate-webview` | Main → Renderer | Navigasi webview ke URL |
| `webview-go-back` | Main → Renderer | Back |
| `webview-go-forward` | Main → Renderer | Forward |
| `webview-reload` | Main → Renderer | Reload |
| `webview-go-home` | Main → Renderer | Kembali ke home URL |
| `show-url-input-modal` | Main → Renderer | Tampilkan modal input URL |
| `get-performance-metrics` | Renderer → Main | Ambil CPU/memory metrics |
| `force-memory-cleanup` | Renderer → Main | Force GC & cache clear |

---

## 🔧 Tech Stack

- **Electron v33** — Desktop app framework
- **electron-store** — Persistent local storage
- **node-machine-id** — Hardware fingerprinting
- **electron-packager** — Multi-platform packaging
- **Chromium flags** — HEVC/H265 codec, WebRTC, GPU rasterization, autoplay

---

## ⚠️ Catatan Penting

1. **Certificate error bypass** aktif di development mode ([`main.js:628-637`](main.js:628))
2. **DNS resolver rules** diinject untuk WebRTC compatibility ([`main.js:21-42`](main.js:21))
3. **Hardcoded URLs** di [`renderer.js:284-286`](assets/js/renderer.js:284) — `192.168.100.113:3000` untuk prerender, sebaiknya dinamis
4. **`.env` format salah** — menggunakan `const WEBVIEW_URL=...` bukan `WEBVIEW_URL=...`
5. **Performance modules** di-load via dynamic `import()` di renderer — bisa fail silently
