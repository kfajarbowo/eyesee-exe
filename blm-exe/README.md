# BLM Webview Application

Aplikasi desktop berbasis Electron untuk mengakses aplikasi web BLM (Battle Logstic Management) dalam bentuk webview.

## Fitur

- **Webview Integration**: Menampilkan aplikasi web CodeIgniter dalam container webview
- **Navigation Controls**: Tombol navigasi (Home, Back, Forward, Refresh)
- **Print Function**: Tombol print untuk mencetak halaman web
- **Developer Tools**: Tombol untuk membuka developer tools
- **Responsive Design**: Tampilan yang responsif untuk berbagai ukuran layar
- **Keyboard Shortcuts**: Shortcut keyboard untuk navigasi dan fungsi lainnya
- **Security**: Konfigurasi keamanan dengan context isolation dan preload script

## Instalasi

### Prasyarat
- Node.js 16+ 
- npm atau yarn
- Aplikasi web BLM harus berjalan di `http://localhost:8080/`

### Langkah-langkah

```bash
# Clone repository
git clone <repository-url>
cd blm-webview

# Install dependencies
npm install

# Jalankan aplikasi
npm start

# Untuk development dengan auto-reload
npm run dev
```

## Konfigurasi

### URL Aplikasi Web
URL aplikasi web dapat diubah di file [`src/main.js`](src/main.js:19):
```javascript
const webAppURL = 'http://localhost:8080/'; // Ubah sesuai kebutuhan
```

### Window Settings
Pengaturan jendela dapat diubah di file [`src/window.js`](src/window.js:5):
```javascript
const store = {
  width: 1200,  // Lebar jendela
  height: 800,   // Tinggi jendela
};
```

## Build & Packaging

### Windows
```bash
npm run package-win
```

### macOS
```bash
npm run package-mac
npm run create-installer-mac  # Untuk membuat installer .dmg
```

### Linux
```bash
npm run package-linux
```

Hasil build akan berada di folder `release-builds/`.

## Struktur Proyek

```
blm-webview/
├── src/
│   ├── main.js          # Main process Electron
│   ├── window.js        # Konfigurasi jendela
│   ├── menu.js          # Template menu aplikasi
│   ├── print.js         # Fungsi print
│   └── preload.js       # Preload script untuk IPC
├── assets/
│   ├── css/
│   │   ├── topbar.css    # Styles untuk controls
│   │   └── webview.css   # Styles utama webview
│   ├── js/
│   │   └── renderer.js   # Renderer process script
│   └── icons/
│       └── png/
│           └── blm-logo.png  # Logo aplikasi
├── index.html            # HTML utama dengan webview
├── preload.js            # Preload script (root level)
└── package.json          # Konfigurasi proyek
```

## Keyboard Shortcuts

- **Ctrl+R / Cmd+R**: Refresh halaman
- **Ctrl+P / Cmd+P**: Print halaman
- **Alt+Left**: Navigasi kembali
- **Alt+Right**: Navigasi maju
- **Alt+Home**: Navigasi ke home
- **F12**: Toggle Developer Tools

## Keamanan

- Context isolation diaktifkan untuk mencegah akses langsung ke Node.js
- Preload script digunakan untuk komunikasi yang aman antara main dan renderer process
- WebSecurity diatur untuk mengizinkan konten HTTP di development

## Troubleshooting

### Aplikasi Web Tidak Muncul
1. Pastikan aplikasi web BLM berjalan di `http://localhost:8080/`
2. Cek console developer tools untuk error message
3. Pastikan tidak ada firewall yang memblokir port 8080

### Certificate Error
Aplikasi akan otomatis mengabaikan certificate error untuk localhost development.

## Lisensi

MIT License