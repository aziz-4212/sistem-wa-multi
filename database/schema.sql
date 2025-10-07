-- WhatsApp Multi-Session Database Schema
-- Run this script if you need to manually create the database

CREATE DATABASE IF NOT EXISTS whatsapp_multi_session;
USE whatsapp_multi_session;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status ENUM('disconnected', 'connecting', 'connected', 'authenticated') DEFAULT 'disconnected',
  is_ready BOOLEAN DEFAULT FALSE,
  phone_number VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Show tables
SHOW TABLES;

-- Show sessions table structure
DESCRIBE sessions;