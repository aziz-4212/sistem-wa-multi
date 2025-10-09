# WhatsApp API Postman Collection

Collection ini berisi semua endpoint untuk testing WhatsApp Multi-Session API menggunakan Postman.

## Files yang Diperlukan

1. **WhatsApp-API-Collection.postman_collection.json** - Collection utama dengan semua endpoint
2. **WhatsApp-API-Environment.postman_environment.json** - Environment variables untuk testing

## Cara Import ke Postman

### 1. Import Collection

1. Buka Postman
2. Klik **Import** di kiri atas
3. Pilih **Upload Files**
4. Select file `WhatsApp-API-Collection.postman_collection.json`
5. Klik **Import**

### 2. Import Environment

1. Klik **Import** lagi
2. Select file `WhatsApp-API-Environment.postman_environment.json`
3. Klik **Import**
4. Pilih environment "WhatsApp API Environment" di dropdown kanan atas

## Environment Variables

Pastikan untuk mengatur environment variables berikut:

| Variable          | Default Value                     | Description                              |
| ----------------- | --------------------------------- | ---------------------------------------- |
| `base_url`        | http://localhost:5000             | Base URL server API                      |
| `api_key`         | whatsapp-api-key-2024             | API Key untuk authentication             |
| `session_id`      | session1                          | Default session ID                       |
| `phone_number`    | 6281234567890                     | Nomor test (format: kode negara + nomor) |
| `test_recipients` | ["6281234567890","6281234567891"] | Array nomor untuk broadcast              |
| `broadcast_delay` | 2000                              | Delay antar pesan broadcast (ms)         |

## Collection Structure

### 1. Authentication

-   **Test API Key** - Test apakah API key valid

### 2. Sessions Management

-   **Get All Sessions** - Mendapatkan semua session yang tersedia
-   **Get Session Status** - Cek status session tertentu

### 3. Send Messages

-   **Send Text Message** - Kirim pesan teks
-   **Send Media Message** - Kirim file media (gambar, dokumen, dll)

### 4. Broadcast Messages

-   **Broadcast Text Message** - Kirim pesan teks ke multiple nomor
-   **Broadcast Media Message** - Kirim file media ke multiple nomor

## Cara Penggunaan

### 1. Persiapan

1. Pastikan server WhatsApp API sudah running di `http://localhost:5000`
2. Pastikan ada minimal 1 session yang sudah authenticated
3. Set environment ke "WhatsApp API Environment"

### 2. Testing Authentication

1. Jalankan "Test API Key" untuk memastikan API key bekerja
2. Jika error 401, periksa API key di environment variables

### 3. Cek Sessions

1. Jalankan "Get All Sessions" untuk melihat session yang tersedia
2. Update `session_id` di environment jika perlu
3. Jalankan "Get Session Status" untuk cek status session tertentu

### 4. Kirim Pesan

1. Update `phone_number` di environment dengan nomor tujuan
2. Jalankan "Send Text Message" untuk test kirim pesan teks
3. Untuk media message, upload file di form-data body

### 5. Broadcast

1. Update `test_recipients` dengan array nomor tujuan
2. Jalankan "Broadcast Text Message"
3. Untuk broadcast media, upload file di form-data

## Tips Testing

### 1. Format Nomor

-   Gunakan format: kode negara + nomor tanpa `+`
-   Contoh: `6281234567890` untuk nomor Indonesia

### 2. Testing Media Upload

-   Di "Send Media Message" atau "Broadcast Media Message"
-   Klik pada field "file" di form-data
-   Pilih file dari komputer Anda
-   Supported: JPG, PNG, PDF, DOC, MP4, dll (max 10MB)

### 3. Testing Broadcast

-   Recipients harus dalam format JSON array string
-   Contoh: `["6281234567890","6281234567891"]`
-   Delay minimal 500ms untuk mencegah spam

### 4. Error Handling

-   Periksa response body untuk error details
-   Status codes:
    -   200: Success
    -   400: Bad request
    -   401: Invalid API key
    -   404: Session not found
    -   500: Server error

## Global Tests

Collection ini sudah include global tests yang akan check:

-   Response time < 10 detik
-   Response memiliki field `success`
-   Status code 200 untuk request yang berhasil

## Customization

### Mengganti API Key

1. Buka environment "WhatsApp API Environment"
2. Edit variable `api_key`
3. Ganti dengan API key production Anda

### Mengganti Base URL

1. Edit variable `base_url`
2. Ganti dengan URL server production
3. Contoh: `https://api.yourdomain.com`

### Menambah Headers

Jika perlu header tambahan:

1. Buka request yang ingin dimodifikasi
2. Go to Headers tab
3. Tambah header baru

## Production Notes

⚠️ **Sebelum menggunakan di production:**

1. **Ganti API Key default**
2. **Gunakan HTTPS**
3. **Implementasi rate limiting**
4. **Monitor logs untuk abuse detection**
5. **Whitelist IP jika diperlukan**

## Troubleshooting

### Connection Error

-   Pastikan server running di port yang benar
-   Check firewall settings
-   Verify base_url di environment

### Authentication Error

-   Verify API key di environment
-   Check header format (X-API-Key atau Authorization)
-   Pastikan API key sama dengan server

### Session Error

-   Check session_id di environment
-   Verify session sudah authenticated
-   Jalankan "Get All Sessions" untuk cek status

### Media Upload Error

-   Check file size (max 10MB)
-   Verify file format supported
-   Ensure form-data content-type

## Contact

Jika ada issues atau pertanyaan terkait collection ini, silakan check dokumentasi API lengkap di `EXTERNAL_API_DOCUMENTATION.md`.
