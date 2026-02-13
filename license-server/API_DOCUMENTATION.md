# EyeSee License Server API Documentation

Base URL: `http://localhost:3000`

---

## 🟢 Public Endpoints
Digunakan oleh aplikasi klien (BMS, BLM, VComm, EyeSee) untuk aktivasi dan validasi lisensi. Tidak memerlukan otentikasi admin.

### 1. Check Server Status
Memeriksa apakah server berjalan dan mendapatkan konfigurasi dasar.
- **URL**: `/api/license/status`
- **Method**: `GET`
- **Body**: _None_
- **Response**:
  ```json
  {
    "online": true,
    "serverTime": "2024-02-06T06:00:00.000Z",
    "offlineToleranceHours": 24,
    "products": ["BM01", "BL01", "VC01", "ES01"]
  }
  ```

### 2. Activate License
Mengaktifkan lisensi baru dan mengikatnya ke Hardware ID perangkat.
- **URL**: `/api/license/activate`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "licenseKey": "GJBM-01EZ-V049-DNPM",
    "hardwareId": "C20EC14202D5FCFFCB2C2F2CD31F04E1",
    "deviceName": "PC-ADMIN-01"  // Opsional
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "Lisensi berhasil diaktifkan!",
    "license": {
      "hardwareId": "C20EC14202D5FCFFCB2C2F2CD31F04E1",
      "productCode": "BM01",
      "productName": "BMS",
      "activatedAt": "2024-02-06T06:05:00.000Z"
    }
  }
  ```
- **Response (Error)**:
  ```json
  {
    "success": false,
    "error": "License key sudah digunakan oleh perangkat lain"
  }
  ```

### 3. Validate License
Memvalidasi status lisensi berdasarkan Hardware ID. Digunakan setiap kali aplikasi dijalankan.
- **URL**: `/api/license/validate/:hardwareId`
- **Method**: `GET`
- **Params**: `hardwareId` (32 chars hex string)
- **Response (Valid)**:
  ```json
  {
    "valid": true,
    "activated": true,
    "revoked": false,
    "license": {
       "hardwareId": "C20EC14202D5FCFFCB2C2F2CD31F04E1",
       "productCode": "BM01",
       "activatedAt": "2024-02-06T06:05:00.000Z"
    },
    "serverTime": "2024-02-06T06:10:00.000Z",
    "offlineToleranceHours": 24
  }
  ```
- **Response (Revoked/Invalid)**:
  ```json
  {
    "valid": false,
    "activated": true,
    "revoked": true,
    "reason": "Pembayaran tertunda",
    "revokedAt": "2024-02-06T08:00:00.000Z"
  }
  ```

### 4. Check Key Info (Without Activating)
Mengecek informasi lisensi tanpa melakukan aktivasi.
- **URL**: `/api/license/check-key`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "licenseKey": "GJBM-01EZ-V049-DNPM"
  }
  ```
- **Response**:
  ```json
  {
    "valid": true,
    "productCode": "BM01",
    "productName": "BMS",
    "isUsed": true,
    "usedByHardwareId": "C20EC..." // Null jika belum digunakan
  }
  ```

---

## 🔒 Admin Endpoints
Memerlukan Authentication Header: `Authorization: Bearer admin123` (Token default).
Gunakan ini untuk tool generator atau dashboard admin.

### 1. Generate License Keys
Membuat key baru untuk produk tertentu.
- **URL**: `/api/admin/generate-keys`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer admin123`
- **Body**:
  ```json
  {
    "productCode": "BM01", // BM01 (BMS), BL01 (BLM), VC01 (VComm), ES01 (EyeSee)
    "count": 5
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "count": 5,
    "keys": [
      {
        "key": "GJBM-01EZ-V049-DNPM",
        "productCode": "BM01",
        "productName": "BMS"
      },
      ...
    ]
  }
  ```

### 2. List All Generated Keys
Melihat daftar semua key yang pernah dibuat.
- **URL**: `/api/admin/generated-keys`
- **Method**: `GET`
- **Query Params**: `?status=unused` (opsional: all, unused, used)
- **Headers**: `Authorization: Bearer admin123`
- **Response**:
  ```json
  {
    "success": true,
    "count": 10,
    "keys": [...]
  }
  ```

### 3. Revoke License (Block Access)
Memblokir akses lisensi yang sudah aktif. App akan menolak akses pada validasi berikutnya.
- **URL**: `/api/admin/revoke`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer admin123`
- **Body**:
  ```json
  {
    "hardwareId": "C20EC14202D5FCFFCB2C2F2CD31F04E1",
    "reason": "Langganan habis" // Opsional
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "License revoked"
  }
  ```

### 4. Reactivate License (Unblock)
Mengembalikan akses lisensi yang di-revoke.
- **URL**: `/api/admin/reactivate`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer admin123`
- **Body**:
  ```json
  {
    "hardwareId": "C20EC14202D5FCFFCB2C2F2CD31F04E1"
  }
  ```

### 5. List Active Licenses
Melihat daftar perangkat yang sedang aktif menggunakan lisensi.
- **URL**: `/api/admin/licenses`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer admin123`

### 6. Delete License (Reset)
Menghapus data aktivasi dari server. Key akan dianggap belum pernah dipakai dan bisa diaktivasi ulang di perangkat lain/sama.
- **URL**: `/api/admin/licenses/:hardwareId`
- **Method**: `DELETE`
- **Headers**: `Authorization: Bearer admin123`
