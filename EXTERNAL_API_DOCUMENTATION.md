# External API Documentation

API untuk sistem eksternal yang ingin mengirim pesan WhatsApp melalui sistem ini.

## Base URL

```
http://localhost:5000
```

## Authentication

Semua endpoint memerlukan API Key yang dikirim melalui header:

```
X-API-Key: whatsapp-api-key-2024
```

atau

```
Authorization: Bearer whatsapp-api-key-2024
```

> **Catatan:** Ubah API Key default di environment variable `API_KEY` untuk keamanan production.

## Endpoints

### 1. Send Text Message

Mengirim pesan teks ke nomor WhatsApp tertentu.

**Endpoint:** `POST /api/send-message`

**Headers:**

```
Content-Type: application/json
X-API-Key: whatsapp-api-key-2024
```

**Request Body:**

```json
{
    "sessionId": "session1",
    "to": "6281234567890",
    "message": "Hello from external system!"
}
```

**Response Success (200):**

```json
{
    "success": true,
    "message": "Message sent successfully",
    "data": {
        "sessionId": "session1",
        "to": "6281234567890",
        "messageId": "msg_123",
        "timestamp": "2024-10-09T10:30:00.000Z"
    }
}
```

**Response Error (400/404/500):**

```json
{
    "success": false,
    "error": "Error message description"
}
```

---

### 2. Send Media Message

Mengirim pesan dengan file media (gambar, dokumen, video, dll).

**Endpoint:** `POST /api/send-media`

**Headers:**

```
Content-Type: multipart/form-data
X-API-Key: whatsapp-api-key-2024
```

**Request Body (form-data):**

-   `sessionId`: string (required) - ID session WhatsApp
-   `to`: string (required) - Nomor tujuan (format: 6281234567890)
-   `message`: string (optional) - Caption untuk media
-   `file`: file (required) - File media yang akan dikirim

**Example using curl:**

```bash
curl -X POST http://localhost:5000/api/send-media \
  -H "X-API-Key: whatsapp-api-key-2024" \
  -F "sessionId=session1" \
  -F "to=6281234567890" \
  -F "message=Check this file!" \
  -F "file=@/path/to/image.jpg"
```

**Response Success (200):**

```json
{
    "success": true,
    "message": "Media message sent successfully",
    "data": {
        "sessionId": "session1",
        "to": "6281234567890",
        "messageId": "msg_124",
        "fileName": "image.jpg",
        "fileSize": 102400,
        "timestamp": "2024-10-09T10:35:00.000Z"
    }
}
```

---

### 3. Send Broadcast Message

Mengirim pesan ke multiple nomor sekaligus.

**Endpoint:** `POST /api/broadcast`

**Headers:**

```
Content-Type: multipart/form-data
X-API-Key: whatsapp-api-key-2024
```

**Request Body (form-data):**

-   `sessionId`: string (required) - ID session WhatsApp
-   `recipients`: string (required) - JSON array nomor tujuan
-   `message`: string (optional) - Pesan teks
-   `delay`: string (optional) - Delay antar pesan dalam ms (default: 1000)
-   `file`: file (optional) - File media untuk broadcast

**Example using curl:**

```bash
curl -X POST http://localhost:5000/api/broadcast \
  -H "X-API-Key: whatsapp-api-key-2024" \
  -F 'sessionId=session1' \
  -F 'recipients=["6281234567890","6281234567891","6281234567892"]' \
  -F 'message=Broadcast message from external system' \
  -F 'delay=2000'
```

**Response Success (200):**

```json
{
    "success": true,
    "message": "Broadcast completed",
    "data": {
        "sessionId": "session1",
        "totalRecipients": 3,
        "successful": 2,
        "failed": 1,
        "delay": 2000,
        "results": [
            {
                "to": "6281234567890",
                "success": true,
                "messageId": "msg_125"
            },
            {
                "to": "6281234567891",
                "success": true,
                "messageId": "msg_126"
            },
            {
                "to": "6281234567892",
                "success": false,
                "error": "Number not registered"
            }
        ],
        "timestamp": "2024-10-09T10:40:00.000Z"
    }
}
```

---

### 4. Get Session Status

Mengecek status session WhatsApp tertentu.

**Endpoint:** `GET /api/session/{sessionId}/status`

**Headers:**

```
X-API-Key: whatsapp-api-key-2024
```

**Response Success (200):**

```json
{
    "success": true,
    "data": {
        "sessionId": "session1",
        "sessionName": "My WhatsApp Session",
        "status": "authenticated",
        "isReady": true,
        "phoneNumber": "6281234567890",
        "hasQRCode": false
    }
}
```

---

### 5. Get All Sessions

Mendapatkan daftar semua session yang tersedia.

**Endpoint:** `GET /api/sessions`

**Headers:**

```
X-API-Key: whatsapp-api-key-2024
```

**Response Success (200):**

```json
{
    "success": true,
    "data": {
        "totalSessions": 2,
        "sessions": [
            {
                "sessionId": "session1",
                "sessionName": "My WhatsApp Session",
                "status": "authenticated",
                "isReady": true,
                "phoneNumber": "6281234567890"
            },
            {
                "sessionId": "session2",
                "sessionName": "Second Session",
                "status": "qr",
                "isReady": false,
                "phoneNumber": null
            }
        ]
    }
}
```

## Status Session

-   `qr`: Session menunggu scan QR code
-   `authenticated`: Session sudah login dan siap digunakan
-   `disconnected`: Session terputus
-   `destroyed`: Session dihancurkan

## Error Codes

-   `401`: Invalid atau missing API key
-   `400`: Bad request (parameter salah/kurang)
-   `404`: Session tidak ditemukan
-   `500`: Internal server error

## Example Integration

### PHP Example

```php
<?php
function sendWhatsAppMessage($sessionId, $to, $message) {
    $url = 'http://localhost:5000/api/send-message';
    $data = json_encode([
        'sessionId' => $sessionId,
        'to' => $to,
        'message' => $message
    ]);

    $options = [
        'http' => [
            'header' => [
                'Content-Type: application/json',
                'X-API-Key: whatsapp-api-key-2024'
            ],
            'method' => 'POST',
            'content' => $data
        ]
    ];

    $context = stream_context_create($options);
    $result = file_get_contents($url, false, $context);

    return json_decode($result, true);
}

// Usage
$response = sendWhatsAppMessage('session1', '6281234567890', 'Hello from PHP!');
if ($response['success']) {
    echo "Message sent successfully!";
} else {
    echo "Error: " . $response['error'];
}
?>
```

### Python Example

```python
import requests
import json

def send_whatsapp_message(session_id, to, message):
    url = 'http://localhost:5000/api/send-message'
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': 'whatsapp-api-key-2024'
    }
    data = {
        'sessionId': session_id,
        'to': to,
        'message': message
    }

    response = requests.post(url, headers=headers, json=data)
    return response.json()

# Usage
response = send_whatsapp_message('session1', '6281234567890', 'Hello from Python!')
if response['success']:
    print("Message sent successfully!")
else:
    print(f"Error: {response['error']}")
```

### Node.js Example

```javascript
const axios = require("axios");

async function sendWhatsAppMessage(sessionId, to, message) {
    try {
        const response = await axios.post(
            "http://localhost:5000/api/send-message",
            {
                sessionId,
                to,
                message,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": "whatsapp-api-key-2024",
                },
            }
        );

        return response.data;
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.error || error.message,
        };
    }
}

// Usage
sendWhatsAppMessage("session1", "6281234567890", "Hello from Node.js!").then(
    (response) => {
        if (response.success) {
            console.log("Message sent successfully!");
        } else {
            console.log("Error:", response.error);
        }
    }
);
```

## Security Notes

1. **Change Default API Key**: Ubah API key default untuk production
2. **Use HTTPS**: Gunakan HTTPS untuk production
3. **Rate Limiting**: Implementasikan rate limiting untuk mencegah spam
4. **Whitelist IPs**: Batasi akses API hanya untuk IP tertentu jika diperlukan
5. **Log Monitoring**: Monitor log untuk detect abuse

## Rate Limits

Untuk mencegah spam dan overload:

-   Maximum 10 pesan per menit per session
-   Maximum 100 recipients per broadcast
-   Maximum file size: 10MB
-   Delay minimum antar pesan broadcast: 500ms
