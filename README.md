# WhatsApp Multi-Session Manager

Sistem manajemen multi-session WhatsApp menggunakan WhatsApp Web.js dengan frontend React TypeScript dan backend Express TypeScript.

## ✨ Fitur

-   🔄 **Multi-Session**: Mendukung unlimited nomor WhatsApp
-   📱 **QR Code Login**: Login menggunakan QR code WhatsApp
-   🌐 **Real-time**: WebSocket untuk komunikasi real-time
-   💻 **Modern UI**: Frontend React dengan TypeScript dan Tailwind CSS
-   🚀 **RESTful API**: Backend Express dengan TypeScript
-   📊 **Session Management**: Create, start, stop, dan delete session
-   💬 **Send Messages**: Kirim pesan teks dan media

## 🏗️ Struktur Proyek

```
sistem-wa-multi/
├── backend/                 # Express TypeScript API
│   ├── src/
│   │   ├── services/       # WhatsApp Manager
│   │   ├── routes/         # API Routes
│   │   └── index.ts        # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React TypeScript App
│   ├── src/
│   │   ├── components/     # React Components
│   │   ├── contexts/       # React Contexts
│   │   ├── pages/          # App Pages
│   │   ├── services/       # API Services
│   │   └── types/          # TypeScript Types
│   ├── package.json
│   └── tsconfig.json
└── package.json           # Root package.json
```

## 🚀 Instalasi

### Prerequisites

-   Node.js (v16 atau lebih tinggi)
-   npm atau yarn
-   Google Chrome (untuk Puppeteer)

### Quick Start

1. **Clone repository**

    ```bash
    git clone <repository-url>
    cd sistem-wa-multi
    ```

2. **Install dependencies**

    ```bash
    npm run install:all
    ```

3. **Setup environment variables**

    ```bash
    # Backend
    cd backend
    cp .env.example .env
    # Edit .env sesuai kebutuhan
    ```

4. **Start development servers**

    ```bash
    # Dari root directory
    npm run dev
    ```

    Atau jalankan secara terpisah:

    ```bash
    # Terminal 1 - Backend
    cd backend
    npm run dev

    # Terminal 2 - Frontend
    cd frontend
    npm start
    ```

5. **Akses aplikasi**
    - Frontend: http://localhost:5003
    - Backend API: http://localhost:5002

## 📖 Cara Penggunaan

### 1. Membuat Session Baru

1. Buka aplikasi di browser
2. Klik tombol "New Session"
3. Masukkan Session ID dan nama session
4. Klik "Create"

### 2. Memulai Session

1. Pada dashboard, cari session yang ingin dimulai
2. Klik tombol "Start"
3. QR Code akan muncul
4. Scan QR Code dengan WhatsApp di HP
5. Session akan terhubung otomatis

### 3. Mengirim Pesan

1. Pastikan session sudah dalam status "connected"
2. Gunakan API endpoint atau interface untuk mengirim pesan
3. Pesan akan terkirim melalui WhatsApp

## 🔧 API Endpoints

### Sessions

-   `GET /api/sessions` - Get all sessions
-   `POST /api/sessions` - Create new session
-   `GET /api/sessions/:id` - Get session by ID
-   `POST /api/sessions/:id/start` - Start session
-   `POST /api/sessions/:id/stop` - Stop session
-   `DELETE /api/sessions/:id` - Delete session

### Messages

-   `POST /api/sessions/:id/send-message` - Send text message
-   `POST /api/sessions/:id/send-media` - Send media message

### WebSocket Events

-   `qr-code` - QR code generated
-   `session-ready` - Session connected
-   `session-authenticated` - Session authenticated
-   `auth-failure` - Authentication failed
-   `session-disconnected` - Session disconnected
-   `new-message` - New message received

## ⚙️ Environment Variables

### Backend (.env)

```env
PORT=5002
FRONTEND_URL=http://localhost:5003
NODE_ENV=development
```

### Frontend

```env
PORT=5003
REACT_APP_API_URL=http://localhost:5002/api
REACT_APP_SOCKET_URL=http://localhost:5002
```

## 🛠️ Development

### Build Production

```bash
# Build semua
npm run build

# Build backend saja
npm run build:backend

# Build frontend saja
npm run build:frontend
```

### Project Scripts

```bash
# Development
npm run dev              # Start both frontend & backend
npm run dev:backend      # Start backend only
npm run dev:frontend     # Start frontend only

# Installation
npm run install:all      # Install all dependencies

# Build
npm run build           # Build for production
npm run build:backend   # Build backend
npm run build:frontend  # Build frontend
```

## 📁 Session Data

Session data WhatsApp disimpan di folder `.wwebjs_auth` di backend. Jangan hapus folder ini jika ingin mempertahankan session yang sudah login.

## 🔒 Security Notes

-   Jangan share session files dengan orang lain
-   Session files berisi data autentikasi WhatsApp
-   Backup session files secara berkala
-   Gunakan HTTPS di production

## 🐛 Troubleshooting

### Session tidak terhubung

-   Pastikan Chrome/Chromium terinstall
-   Check log di terminal backend
-   Restart session jika diperlukan

### QR Code tidak muncul

-   Check koneksi internet
-   Refresh browser
-   Restart backend server

### Dependencies error

-   Hapus node_modules dan package-lock.json
-   Run `npm run install:all` ulang

## 🤝 Contributing

1. Fork project
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - lihat file LICENSE untuk detail.

## 🆘 Support

Jika mengalami masalah:

1. Check logs di terminal
2. Buka browser developer tools
3. Check API responses
4. Restart aplikasi

---

**⚠️ Disclaimer**: Aplikasi ini menggunakan WhatsApp Web.js yang merupakan unofficial library. Gunakan dengan bijak dan ikuti terms of service WhatsApp.
