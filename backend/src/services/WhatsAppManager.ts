import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import { Server } from 'socket.io';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from './DatabaseService';

export interface WhatsAppSession {
  id: string;
  name: string;
  client: Client;
  isReady: boolean;
  qrCode?: string;
  phoneNumber?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'authenticated';
}

export interface MessageData {
  sessionId: string;
  to: string;
  message: string;
  media?: any;
}

export class WhatsAppManager {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private io: Server;
  private database: DatabaseService;

  constructor(io: Server) {
    this.io = io;
    this.database = new DatabaseService();
    this.initializeSessionsFolder();
    // Delay loading sessions to ensure database is fully initialized
    setTimeout(() => {
      this.loadSessionsFromDatabase();
    }, 2000);
  }

  private initializeSessionsFolder(): void {
    const sessionsDir = path.join(process.cwd(), '.wwebjs_auth');
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
  }

  private async loadSessionsFromDatabase(): Promise<void> {
    try {
      console.log('Starting to load sessions from database...');
      const dbSessions = await this.database.getAllSessions();
      console.log(`Found ${dbSessions.length} sessions in database`);

      for (const dbSession of dbSessions) {
        console.log(`Processing session: ${dbSession.id} - Status: ${dbSession.status}`);
        
        // Check if session auth folder exists
        const sessionAuthPath = path.join(process.cwd(), '.wwebjs_auth', `session-${dbSession.id}`);
        console.log(`Checking auth path: ${sessionAuthPath}`);
        
        if (fs.existsSync(sessionAuthPath)) {
          console.log(`✅ Auth found for session: ${dbSession.id} - Restoring...`);
          
          // Create client with existing auth
          const client = new Client({
            authStrategy: new LocalAuth({ clientId: dbSession.id }),
            puppeteer: {
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
              ]
            }
          });

          const session: WhatsAppSession = {
            id: dbSession.id,
            name: dbSession.name,
            client,
            isReady: dbSession.is_ready || false,
            status: dbSession.status as any,
            phoneNumber: dbSession.phone_number || undefined
          };

          this.sessions.set(dbSession.id, session);
          this.setupClientEvents(session);

          console.log(`Session ${dbSession.id} restored to memory with status: ${session.status}`);

          // Auto-start if session was previously connected or authenticated
          if (dbSession.status === 'connected' || dbSession.status === 'authenticated') {
            console.log(`🚀 Auto-starting session: ${dbSession.id}`);
            setTimeout(() => {
              this.startSession(dbSession.id).catch(error => {
                console.error(`❌ Error auto-starting session ${dbSession.id}:`, error);
              });
            }, 1000); // Small delay to ensure everything is set up
          }
        } else {
          console.log(`❌ Session auth not found for ${dbSession.id}, keeping in database but marking as disconnected`);
          await this.database.updateSessionStatus(dbSession.id, 'disconnected', false);
          
          // Still create the session object but without starting it
          const client = new Client({
            authStrategy: new LocalAuth({ clientId: dbSession.id }),
            puppeteer: {
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
              ]
            }
          });

          const session: WhatsAppSession = {
            id: dbSession.id,
            name: dbSession.name,
            client,
            isReady: false,
            status: 'disconnected',
            phoneNumber: dbSession.phone_number || undefined
          };

          this.sessions.set(dbSession.id, session);
          this.setupClientEvents(session);
        }
      }
      
      console.log(`✅ Session loading completed. Total sessions in memory: ${this.sessions.size}`);
    } catch (error) {
      console.error('❌ Error loading sessions from database:', error);
    }
  }

  async createSession(sessionId: string, sessionName: string): Promise<WhatsAppSession> {
    try {
      if (this.sessions.has(sessionId)) {
        throw new Error(`Session ${sessionId} already exists`);
      }

      console.log(`Creating session: ${sessionId} with name: ${sessionName}`);

      const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      });

      const session: WhatsAppSession = {
        id: sessionId,
        name: sessionName,
        client,
        isReady: false,
        status: 'disconnected'
      };

      this.sessions.set(sessionId, session);
      this.setupClientEvents(session);

      // Save to database
      await this.database.saveSession({
        id: sessionId,
        name: sessionName,
        status: 'disconnected',
        isReady: false
      });

      console.log(`Session ${sessionId} created successfully`);
      return session;
    } catch (error) {
      console.error(`Error creating session ${sessionId}:`, error);
      throw error;
    }
  }

  private setupClientEvents(session: WhatsAppSession): void {
    const { client, id } = session;

    client.on('qr', async (qr) => {
      console.log(`QR Code generated for session ${id}`);
      try {
        const qrCodeDataURL = await QRCode.toDataURL(qr);
        session.qrCode = qrCodeDataURL;
        session.status = 'connecting';
        
        // Update database
        await this.database.updateSessionStatus(id, 'connecting', false);
        
        this.io.emit('qr-code', { sessionId: id, qrCode: qrCodeDataURL });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    });

    client.on('ready', async () => {
      console.log(`WhatsApp client ${id} is ready!`);
      session.isReady = true;
      session.status = 'connected';
      session.qrCode = undefined;
      
      // Get phone number info
      try {
        const info = client.info;
        if (info?.wid?.user) {
          session.phoneNumber = info.wid.user;
        }
      } catch (error) {
        console.error('Error getting phone number:', error);
      }
      
      // Update database
      await this.database.updateSessionStatus(id, 'connected', true, session.phoneNumber);
      
      this.io.emit('session-ready', { sessionId: id });
    });

    client.on('authenticated', async () => {
      console.log(`WhatsApp client ${id} authenticated!`);
      session.status = 'authenticated';
      
      // Update database
      await this.database.updateSessionStatus(id, 'authenticated', false);
      
      this.io.emit('session-authenticated', { sessionId: id });
    });

    client.on('auth_failure', (msg) => {
      console.error(`Authentication failed for session ${id}:`, msg);
      session.status = 'disconnected';
      this.io.emit('auth-failure', { sessionId: id, error: msg });
    });

    client.on('disconnected', async (reason) => {
      console.log(`WhatsApp client ${id} disconnected:`, reason);
      session.isReady = false;
      session.status = 'disconnected';
      
      // Update database
      await this.database.updateSessionStatus(id, 'disconnected', false);
      
      this.io.emit('session-disconnected', { sessionId: id, reason });
    });

    client.on('message', async (message) => {
      console.log(`Message received in session ${id}:`, message.body);
      this.io.emit('new-message', {
        sessionId: id,
        from: message.from,
        body: message.body,
        timestamp: message.timestamp,
        type: message.type
      });
    });
  }

  async startSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Prevent duplicate initialization attempts
      // @ts-ignore - pupBrowser is internal; treat as running indicator
      if ((session as any).client?.pupBrowser || session.status === 'connecting' || session.status === 'authenticated' || session.status === 'connected') {
        console.log(`startSession: session ${sessionId} already in state ${session.status}, skipping re-init`);
        return;
      }

      console.log(`Starting session: ${sessionId}`);
      session.status = 'connecting';
      
      await session.client.initialize();
      console.log(`Session ${sessionId} initialization started`);
    } catch (error) {
      console.error(`Error starting session ${sessionId}:`, error);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      await session.client.destroy();
    } catch (error) {
      console.error(`Error destroying session ${sessionId}:`, error);
    }
    
    session.isReady = false;
    session.status = 'disconnected';
    
    // Update database
    await this.database.updateSessionStatus(sessionId, 'disconnected', false);
    
    this.io.emit('session-update', {
      sessionId,
      status: 'disconnected',
      isReady: false,
      message: 'Session stopped'
    });
  }

  async restartSession(sessionId: string): Promise<void> {
    console.log(`🔄 Restarting session: ${sessionId}`);
    
    try {
      // Emit restart started event
      this.io.emit('session-update', {
        sessionId,
        status: 'restarting',
        isReady: false,
        message: 'Restarting session...'
      });
      
      // Stop existing session if it exists
      await this.stopSession(sessionId);
      
      // Wait longer for proper cleanup
      console.log(`⏳ Waiting for cleanup before restart: ${sessionId}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Start new session
      console.log(`🚀 Starting new session: ${sessionId}`);
      await this.startSession(sessionId);
      
      console.log(`✅ Session ${sessionId} restarted successfully`);
    } catch (error) {
      console.error(`❌ Failed to restart session ${sessionId}:`, error);
      
      // Emit restart failed event
      this.io.emit('session-update', {
        sessionId,
        status: 'disconnected',
        isReady: false,
        message: 'Restart failed'
      });
      
      throw error;
    }
  }

  async validateSessionHealth(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      // Check if client exists and is ready
      if (!session.isReady || session.status !== 'connected') {
        return false;
      }

      // @ts-ignore - Check internal browser state
      if (!session.client.pupBrowser || !session.client.pupPage) {
        return false;
      }

      // Verify client state
      const clientState = await session.client.getState();
      return clientState === 'CONNECTED';
    } catch (error) {
      console.error(`Health check failed for session ${sessionId}:`, error);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await this.stopSession(sessionId);
      this.sessions.delete(sessionId);
      
      // Remove session data from filesystem
      const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${sessionId}`);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      
      // Remove from database
      await this.database.deleteSession(sessionId);
    }
  }

  async sendMessage(messageData: MessageData): Promise<any> {
    const session = this.sessions.get(messageData.sessionId);
    if (!session) {
      throw new Error(`Session ${messageData.sessionId} not found`);
    }

    // Enhanced validation for client readiness
    if (!session.isReady || session.status !== 'connected') {
      throw new Error(`Session ${messageData.sessionId} is not ready. Status: ${session.status}, Ready: ${session.isReady}`);
    }

    // Check if client and browser are properly initialized
    try {
      // @ts-ignore - Access internal properties for validation
      if (!session.client.pupBrowser || !session.client.pupPage) {
        throw new Error(`Session ${messageData.sessionId} browser instance is not available`);
      }

      // Verify client state
      const clientState = await session.client.getState();
      if (clientState !== 'CONNECTED') {
        throw new Error(`Session ${messageData.sessionId} client state is ${clientState}, expected CONNECTED`);
      }
    } catch (stateError) {
      console.error(`Client state validation failed for session ${messageData.sessionId}:`, stateError);
      throw new Error(`Session ${messageData.sessionId} is not properly initialized. Please restart the session.`);
    }

    try {
      let chatId = messageData.to;
      if (!chatId.includes('@')) {
        chatId = `${chatId}@c.us`;
      }

      console.log(`Preparing to send message to ${chatId} via session ${messageData.sessionId}`);

      if (messageData.media) {
        console.log('Processing media file:', {
          path: messageData.media.path,
          filename: messageData.media.filename,
          mimetype: messageData.media.mimetype
        });

        // Check if file exists
        if (!fs.existsSync(messageData.media.path)) {
          throw new Error(`Media file not found: ${messageData.media.path}`);
        }

        // Create MessageMedia with proper mimetype and filename
        const media = MessageMedia.fromFilePath(messageData.media.path);
        
        // Preserve original filename and mimetype
        if (messageData.media.filename) {
          media.filename = messageData.media.filename;
        }
        if (messageData.media.mimetype) {
          media.mimetype = messageData.media.mimetype;
        }

        console.log('Sending media with caption:', messageData.message || '');
        
        // Add timeout for media sending
        const result = await Promise.race([
          session.client.sendMessage(chatId, media, {
            caption: messageData.message || ''
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Media send timeout after 30 seconds')), 30000)
          )
        ]);

        console.log('Media message sent successfully');
        return result;
      } else {
        console.log('Sending text message:', messageData.message);
        
        // Add timeout for text message sending
        const result = await Promise.race([
          session.client.sendMessage(chatId, messageData.message),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Text send timeout after 15 seconds')), 15000)
          )
        ]);

        console.log('Text message sent successfully');
        return result;
      }
    } catch (error: any) {
      console.error(`Error sending message in session ${messageData.sessionId}:`, error);
      
      // Handle specific Puppeteer/evaluation errors
      if (error.message && error.message.includes('evaluate')) {
        throw new Error(`Browser evaluation error in session ${messageData.sessionId}. The session may need to be restarted.`);
      }
      
      if (error.message && error.message.includes('null')) {
        throw new Error(`Client connection error in session ${messageData.sessionId}. Please restart the session.`);
      }
      
      throw error;
    }
  }

  getSession(sessionId: string): WhatsAppSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): WhatsAppSession[] {
    return Array.from(this.sessions.values()).map(session => ({
      ...session,
      client: undefined as any // Don't expose the client object
    }));
  }

  // Method to get database instance for cleanup
  getDatabaseService(): DatabaseService {
    return this.database;
  }

  // Method to ensure all sessions are saved before shutdown
  async saveAllSessionsToDatabase(): Promise<void> {
    console.log('💾 Saving all sessions to database before shutdown...');
    for (const [sessionId, session] of this.sessions) {
      try {
        await this.database.saveSession({
          id: session.id,
          name: session.name,
          status: session.status,
          isReady: session.isReady,
          phoneNumber: session.phoneNumber
        });
        console.log(`✅ Session ${sessionId} saved`);
      } catch (error) {
        console.error(`❌ Error saving session ${sessionId}:`, error);
      }
    }
    console.log('💾 All sessions saved to database');
  }

  async getSessionInfo(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isReady) {
      throw new Error(`Session ${sessionId} is not ready`);
    }

    try {
      const info = session.client.info;
      return {
        sessionId,
        phoneNumber: info?.wid?.user,
        name: info?.pushname,
        platform: info?.platform
      };
    } catch (error) {
      console.error(`Error getting session info for ${sessionId}:`, error);
      throw error;
    }
  }
}