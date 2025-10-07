-- Database Management Scripts

-- View all sessions
SELECT * FROM sessions ORDER BY created_at DESC;

-- View only active sessions
SELECT * FROM sessions WHERE status IN ('connected', 'authenticated') ORDER BY created_at DESC;

-- Count sessions by status
SELECT status, COUNT(*) as count FROM sessions GROUP BY status;

-- Clean up old disconnected sessions (optional - run with caution)
-- DELETE FROM sessions WHERE status = 'disconnected' AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Reset all sessions to disconnected (useful for development)
-- UPDATE sessions SET status = 'disconnected', is_ready = FALSE WHERE status != 'disconnected';

-- Drop and recreate table (use only if you want to start fresh)
-- DROP TABLE IF EXISTS sessions;
-- CREATE TABLE sessions (
--   id VARCHAR(255) PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   status ENUM('disconnected', 'connecting', 'connected', 'authenticated') DEFAULT 'disconnected',
--   is_ready BOOLEAN DEFAULT FALSE,
--   phone_number VARCHAR(50) NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );