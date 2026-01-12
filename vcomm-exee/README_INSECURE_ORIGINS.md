# Konfigurasi Insecure Origins untuk WebView Electron

## Masalah
Aplikasi Electron WebView perlu mengakses `http://192.168.204.105:5000/` yang merupakan URL HTTP (insecure). Di browser Chrome, ini biasanya diatasi dengan mengaktifkan flag "Insecure origins treated as secure".

## Solusi
Berikut adalah perubahan yang telah dilakukan untuk mengatasi masalah ini di aplikasi Electron:

### 1. Modifikasi main.js
Menambahkan command line switch untuk memperlakukan origin yang tidak aman sebagai aman:

```javascript
// Tambahkan insecure origins ke daftar secure origins
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://192.168.204.105:5000');
```

### 2. Modifikasi src/window.js
Menambahkan konfigurasi webPreferences untuk mengizinkan konten yang tidak aman:

```javascript
webPreferences: {
  preload: path.join(__dirname, "../preload.js"),
  nodeIntegration: false,
  contextIsolation: true,
  webviewTag: true,
  allowRunningInsecureContent: true, // Allow mixed content
  webSecurity: false, // Disable web security for development
},
```

### 3. Modifikasi index.html
Menambahkan atribut pada webview tag:

```html
<webview
  src="http://192.168.204.105:5000/"
  data-home="http://192.168.204.105:5000/"
  allowpopups
  webpreferences="allowRunningInsecureContent=true,webSecurity=false"
></webview>
```

### 4. Modifikasi assets/js/renderer.js
Menambahkan konfigurasi keamanan untuk webview:

```javascript
webview.addEventListener('dom-ready', () => {
  webview.executeJavaScript(`
    console.log('Webview is ready and configured for insecure origins');
  `);
});
```

## Cara Penggunaan
1. Jalankan aplikasi dengan `npm start`
2. WebView sekarang seharusnya dapat memuat `http://192.168.204.105:5000/` tanpa masalah keamanan

## Catatan Keamanan
- Konfigurasi ini menonaktifkan beberapa fitur keamanan WebView
- Sebaiknya hanya digunakan untuk development atau untuk origin yang benar-benar dipercaya
- Untuk production, pertimbangkan untuk menggunakan HTTPS jika memungkinkan

## Alternatif Lain
Jika Anda memiliki multiple insecure origins, Anda dapat menambahkannya dengan comma-separated:

```javascript
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://192.168.204.105:5000,http://localhost:3000');