# EyeSee License Server

Server untuk validasi dan manajemen lisensi aplikasi EyeSee.

## Features

- ✅ License activation dengan hardware binding
- ✅ License validation (check saat app startup)
- ✅ Admin revocation (matikan license remotely)
- ✅ Admin reactivation (aktifkan kembali)
- ✅ Simple password authentication untuk admin
- ✅ JSON database (sudah siap migrasi ke SQLite)

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Or with auto-reload (development)
npm run dev
```

Server akan berjalan di `http://0.0.0.0:3000`

## Configuration

Edit file `.env`:

```env
HOST=0.0.0.0
PORT=3000
ADMIN_PASSWORD=your_secure_password
OFFLINE_TOLERANCE_HOURS=24
```

## API Endpoints

### Device Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/license/activate` | Aktivasi license |
| GET | `/api/license/validate/:hwId` | Validasi license |
| GET | `/api/license/status` | Cek server status |

### Admin Endpoints (Require Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/licenses` | List semua license |
| GET | `/api/admin/licenses/:hwId` | Detail license |
| POST | `/api/admin/revoke` | Revoke (matikan) license |
| POST | `/api/admin/reactivate` | Aktifkan kembali |
| DELETE | `/api/admin/licenses/:hwId` | Hapus license |
| GET | `/api/admin/stats` | Statistik license |

## Authentication

Admin endpoints memerlukan header:

```
Authorization: Bearer <ADMIN_PASSWORD>
```

Contoh dengan curl:

```bash
# List all licenses
curl -H "Authorization: Bearer admin123" http://localhost:3000/api/admin/licenses

# Revoke a license
curl -X POST http://localhost:3000/api/admin/revoke \
  -H "Authorization: Bearer admin123" \
  -H "Content-Type: application/json" \
  -d '{"hardwareId":"C20EC14202D5FCFF","reason":"Device captured"}'

# Reactivate
curl -X POST http://localhost:3000/api/admin/reactivate \
  -H "Authorization: Bearer admin123" \
  -H "Content-Type: application/json" \
  -d '{"hardwareId":"C20EC14202D5FCFF"}'
```

## Testing Activation

```bash
# Activate a license
curl -X POST http://localhost:3000/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "XXXX-XXXX-XXXX-C20E-C142-XXXX",
    "hardwareId": "C20EC14202D5FCFF",
    "deviceName": "Laptop-001"
  }'

# Validate
curl http://localhost:3000/api/license/validate/C20EC14202D5FCFF
```

## Database

Saat ini menggunakan JSON file (`database/database.json`).
Sudah di-design dengan Repository Pattern untuk mudah migrasi ke SQLite.

## Deploy ke Proxmox

1. Copy folder `license-server` ke server
2. Install Node.js 18+
3. Edit `.env` dengan IP dan password yang sesuai
4. Run dengan PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name license-server
   pm2 save
   ```
