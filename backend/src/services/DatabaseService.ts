import mysql from 'mysql2/promise';

export interface SessionRecord {
  id: string;
  name: string;
  status: string;
  is_ready: boolean;
  phone_number?: string;
  created_at: Date;
  updated_at: Date;
}

export class DatabaseService {
  private connection: mysql.Connection | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      // Create connection
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_multi_session'
      });

      console.log('Connected to MySQL database');
      
      // Create database if not exists
      await this.createDatabase();
      
      // Create tables
      await this.createTables();
      
      this.isInitialized = true;
      console.log('✅ Database initialization completed');
      
    } catch (error: any) {
      if (error.code === 'ER_BAD_DB_ERROR') {
        // Database doesn't exist, create it
        try {
          const tempConnection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
          });
          
          await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'whatsapp_multi_session'}`);
          await tempConnection.end();
          
          console.log('Database created successfully');
          
          // Reconnect to the new database
          this.connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_multi_session'
          });
          
          await this.createTables();
          
          this.isInitialized = true;
          console.log('✅ Database initialization completed');
          
        } catch (createError) {
          console.error('Error creating database:', createError);
        }
      } else {
        console.error('Database connection error:', error);
      }
    }
  }

  private async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return;
    
    return new Promise((resolve) => {
      const checkInitialized = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
    });
  }

  private async createDatabase() {
    if (!this.connection) return;
    
    try {
      await this.connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'whatsapp_multi_session'}`);
      console.log('Database ensured to exist');
    } catch (error) {
      console.error('Error creating database:', error);
    }
  }

  private async createTables() {
    if (!this.connection) return;

    try {
      // Create sessions table
      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          status ENUM('disconnected', 'connecting', 'connected', 'authenticated') DEFAULT 'disconnected',
          is_ready BOOLEAN DEFAULT FALSE,
          phone_number VARCHAR(50) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;

      await this.connection.execute(createSessionsTable);
      console.log('Sessions table created or verified');

    } catch (error) {
      console.error('Error creating tables:', error);
    }
  }

  async saveSession(sessionData: {
    id: string;
    name: string;
    status: string;
    isReady: boolean;
    phoneNumber?: string;
  }): Promise<void> {
    await this.waitForInitialization();
    if (!this.connection) {
      console.error('Database connection not available');
      return;
    }

    try {
      const query = `
        INSERT INTO sessions (id, name, status, is_ready, phone_number) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        status = VALUES(status),
        is_ready = VALUES(is_ready),
        phone_number = VALUES(phone_number),
        updated_at = CURRENT_TIMESTAMP
      `;

      await this.connection.execute(query, [
        sessionData.id,
        sessionData.name,
        sessionData.status,
        sessionData.isReady,
        sessionData.phoneNumber || null
      ]);

      console.log(`💾 Session ${sessionData.id} saved to database with status: ${sessionData.status}`);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    if (!this.connection) return null;

    try {
      const [rows] = await this.connection.execute(
        'SELECT * FROM sessions WHERE id = ?',
        [sessionId]
      );

      const sessions = rows as SessionRecord[];
      return sessions.length > 0 ? sessions[0] : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    await this.waitForInitialization();
    if (!this.connection) return [];

    try {
      const [rows] = await this.connection.execute('SELECT * FROM sessions ORDER BY created_at DESC');
      console.log(`📊 Retrieved ${(rows as any[]).length} sessions from database`);
      return rows as SessionRecord[];
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
      console.log(`Session ${sessionId} deleted from database`);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  async updateSessionStatus(sessionId: string, status: string, isReady: boolean = false, phoneNumber?: string): Promise<void> {
    await this.waitForInitialization();
    if (!this.connection) return;

    try {
      const query = `
        UPDATE sessions 
        SET status = ?, is_ready = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.connection.execute(query, [status, isReady, phoneNumber || null, sessionId]);
      console.log(`📝 Session ${sessionId} status updated to ${status} (ready: ${isReady})`);
    } catch (error) {
      console.error('Error updating session status:', error);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      console.log('Database connection closed');
    }
  }
}