# Fitur Broadcast Message - Multi Nomor WhatsApp

## 📢 Overview

Fitur **Broadcast Message** memungkinkan Anda mengirim pesan ke multiple nomor WhatsApp sekaligus dari satu session. Fitur ini sangat berguna untuk:

-   **Marketing Campaign** - Kirim promosi ke banyak customer
-   **Announcement** - Broadcast pengumuman penting
-   **Notification** - Kirim notifikasi ke grup kontak
-   **Newsletter** - Distribusi konten ke subscriber

## 🎯 Fitur Utama

### ✅ **Multi-Recipient Support**

-   Kirim ke **unlimited nomor** WhatsApp sekaligus
-   Support format nomor **Indonesia (08xxx)** dan **International (628xxx)**
-   **Auto-format** nomor telepon secara otomatis
-   **Bulk import** dari file .txt

### ✅ **Smart Delivery System**

-   **Configurable delay** antar pesan (minimum 500ms)
-   **Anti-spam protection** untuk mencegah blokir WhatsApp
-   **Individual tracking** status sukses/gagal per nomor
-   **Real-time progress** dengan loading indicator

### ✅ **Media Support**

-   **Text + Media** - Kirim pesan dengan gambar/dokumen
-   **File upload** hingga 10MB
-   **Caption support** untuk media messages
-   **Auto cleanup** file setelah broadcast

### ✅ **User Experience**

-   **Dynamic recipient list** - Add/remove nomor dengan mudah
-   **Load from file** - Import nomor dari file .txt
-   **Real-time validation** nomor telepon
-   **Detailed results** dengan status per nomor

## 🚀 Cara Menggunakan

### 1. **Akses Halaman Broadcast**

-   Klik menu **"Broadcast"** di navigation bar
-   Pastikan ada session yang **Connected**

### 2. **Pilih Session**

-   Dropdown akan menampilkan session yang **Ready** dan **Connected**
-   Pilih session yang ingin digunakan untuk broadcast

### 3. **Input Recipients**

-   **Manual Input**: Ketik nomor satu per satu
-   **Bulk Import**: Upload file .txt dengan format:
    ```
    08123456789
    628987654321
    081234567890
    ```
-   **Format Support**:
    -   Indonesia: `08xxxxxxxxxx`
    -   International: `628xxxxxxxxxx`
    -   Auto-convert `08` menjadi `628`

### 4. **Tulis Pesan**

-   Ketik pesan dalam textarea
-   Support **multi-line text**
-   Real-time **character counter**

### 5. **Upload Media (Opsional)**

-   Klik **"Choose File"** untuk upload media
-   Support: **Images, Documents, Videos** (max 10MB)
-   Preview nama file yang dipilih

### 6. **Set Delay**

-   Atur delay antar pesan (default: 1000ms)
-   **Minimum 500ms** untuk menghindari spam detection
-   **Maximum 10000ms** (10 detik)

### 7. **Send Broadcast**

-   Klik **"Send Broadcast"**
-   Monitor progress dengan loading indicator
-   Lihat hasil detail setelah selesai

## 📊 Broadcast Results

Setelah broadcast selesai, Anda akan melihat:

### ✅ **Success Indicators**

-   **Nomor berhasil** dengan ✓ hijau
-   **Total sent count**

### ❌ **Failure Indicators**

-   **Nomor gagal** dengan ⚠️ merah
-   **Error message** spesifik per nomor
-   **Total failed count**

### 📈 **Summary Statistics**

-   **Total recipients** processed
-   **Success rate** percentage
-   **Failed count** dengan alasan

## ⚙️ Technical Features

### 🔒 **Anti-Spam Protection**

```typescript
// Delay antar pesan untuk menghindari blokir
await new Promise((resolve) => setTimeout(resolve, delay));

// Minimum 500ms delay required
const delayMs = Math.max(500, parseInt(delay) || 1000);
```

### 📞 **Phone Number Formatting**

```typescript
// Auto-format nomor Indonesia
const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, ""); // Remove non-numeric

    if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.substring(1); // 08xxx -> 628xxx
    }

    if (!cleaned.startsWith("62")) {
        cleaned = "62" + cleaned; // Add country code
    }

    return cleaned;
};
```

### 🎯 **Individual Message Sending**

```typescript
// Send to each recipient with error handling
for (const phone of recipients) {
    try {
        await session.client.sendMessage(chatId, message);
        results.push({ phone, status: "success" });
    } catch (error) {
        results.push({ phone, status: "failed", error: error.message });
    }

    // Delay before next message
    await new Promise((resolve) => setTimeout(resolve, delay));
}
```

## 📁 File Import Format

### 📝 **Text File (.txt)**

```
# Format nomor per baris
08123456789
628987654321
081234567890
+6285123456789
```

### ✅ **Supported Formats**

-   `08xxxxxxxxxx` (Indonesia)
-   `628xxxxxxxxxx` (International)
-   `+628xxxxxxxxxx` (With plus)
-   `62xxxxxxxxxx` (Without plus)

## 🚨 Best Practices

### ✅ **DO**

-   **Test small batch** dulu sebelum broadcast besar
-   **Use appropriate delay** (1-3 detik) untuk nomor banyak
-   **Verify nomor** sebeluim broadcast
-   **Personal message** untuk engagement yang lebih baik
-   **Monitor results** dan follow up nomor gagal

### ❌ **DON'T**

-   **Spam recipients** dengan broadcast berulang
-   **Use delay < 500ms** (risk of getting blocked)
-   **Send too many** dalam waktu singkat
-   **Ignore failed numbers** - check dan retry manual
-   **Use for unsolicited** marketing (follow WhatsApp ToS)

## 🎛️ Configuration

### ⏱️ **Delay Settings**

-   **Fast**: 500-1000ms (max 100 nomor)
-   **Medium**: 1000-2000ms (max 500 nomor)
-   **Safe**: 2000-5000ms (unlimited nomor)
-   **Ultra Safe**: 5000-10000ms (large campaigns)

### 📊 **Batch Recommendations**

-   **Small batch**: 1-50 nomor (1s delay)
-   **Medium batch**: 50-200 nomor (2s delay)
-   **Large batch**: 200-1000 nomor (3-5s delay)
-   **Mega batch**: 1000+ nomor (5-10s delay)

## 🔧 API Endpoint

### **POST** `/api/sessions/:sessionId/broadcast`

#### **Request Body**

```typescript
{
  recipients: string[],    // Array of phone numbers
  message: string,         // Broadcast message
  delay: number,          // Delay in milliseconds
  media?: File            // Optional media file
}
```

#### **Response**

```typescript
{
  success: boolean,
  results: Array<{
    phone: string,
    status: 'success' | 'failed',
    error?: string
  }>
}
```

## 🚀 Performance

-   **Concurrent sessions** - Multiple broadcasts dari session berbeda
-   **Background processing** - Non-blocking UI during broadcast
-   **Memory efficient** - Stream processing untuk batch besar
-   **Auto cleanup** - File upload otomatis dihapus setelah kirim

## 📈 Use Cases

### 🛒 **E-Commerce**

-   Flash sale notifications
-   Product launch announcements
-   Order confirmations
-   Customer support updates

### 🏢 **Business**

-   Meeting reminders
-   Policy updates
-   Event invitations
-   Newsletter distribution

### 🎓 **Education**

-   Class announcements
-   Assignment reminders
-   Schedule changes
-   Result notifications

### 🏥 **Healthcare**

-   Appointment reminders
-   Health tips
-   Emergency notifications
-   Test results

---

**Fitur Broadcast Message siap digunakan!** 🎉

Akses melalui menu **"Broadcast"** dan mulai kirim pesan ke multiple nomor WhatsApp dengan mudah dan efisien.
