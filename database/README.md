# Database Setup Guide

## MySQL Database Configuration

The WhatsApp Multi-Session system now uses MySQL database for persistent session storage.

### Prerequisites

1. **MySQL Server** installed and running on your system
2. **Database Configuration**:
    - Host: `localhost`
    - Username: `root`
    - Password: `` (empty/no password)
    - Database: `whatsapp_multi_session` (auto-created)

### Automatic Setup

The system will automatically:

1. Create the database `whatsapp_multi_session` if it doesn't exist
2. Create the `sessions` table with proper schema
3. Connect and start loading existing sessions

### Manual Setup (if needed)

If you encounter database connection issues, you can manually run:

```sql
-- Run this in your MySQL client
source database/schema.sql
```

### Environment Variables

The database configuration is stored in `backend/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=whatsapp_multi_session
```

### Database Schema

```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status ENUM('disconnected', 'connecting', 'connected', 'authenticated') DEFAULT 'disconnected',
  is_ready BOOLEAN DEFAULT FALSE,
  phone_number VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Features

-   **Persistent Sessions**: Sessions are now stored in database and survive server restarts
-   **Auto-Reconnect**: Previously connected sessions will automatically reconnect on server start
-   **Status Tracking**: Real-time session status updates in database
-   **Phone Number Storage**: Authenticated phone numbers are stored for reference

### Troubleshooting

1. **Connection Failed**: Ensure MySQL is running and credentials are correct
2. **Database Not Found**: The system will auto-create it, but you can manually create using `schema.sql`
3. **Permission Issues**: Ensure MySQL user has CREATE, INSERT, UPDATE, DELETE privileges

### Database Management

Use the provided SQL scripts in `/database/` folder:

-   `schema.sql`: Create database and tables
-   `queries.sql`: Common management queries

### Session Recovery

When you restart the server:

1. System loads all sessions from database
2. Sessions with existing auth files are restored
3. Previously connected sessions auto-reconnect
4. UI shows all sessions immediately after reload

Now your WhatsApp sessions will persist across server restarts and page reloads! 🎉
