import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import { Server } from 'socket.io';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

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

  constructor(io: Server) {
    this.io = io;
    this.initializeSessionsFolder();
  }

  private initializeSessionsFolder(): void {
    const sessionsDir = path.join(process.cwd(), '.wwebjs_auth');
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
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
        this.io.emit('qr-code', { sessionId: id, qrCode: qrCodeDataURL });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    });

    client.on('ready', () => {
      console.log(`WhatsApp client ${id} is ready!`);
      session.isReady = true;
      session.status = 'connected';
      session.qrCode = undefined;
      this.io.emit('session-ready', { sessionId: id });
    });

    client.on('authenticated', () => {
      console.log(`WhatsApp client ${id} authenticated!`);
      session.status = 'authenticated';
      this.io.emit('session-authenticated', { sessionId: id });
    });

    client.on('auth_failure', (msg) => {
      console.error(`Authentication failed for session ${id}:`, msg);
      session.status = 'disconnected';
      this.io.emit('auth-failure', { sessionId: id, error: msg });
    });

    client.on('disconnected', (reason) => {
      console.log(`WhatsApp client ${id} disconnected:`, reason);
      session.isReady = false;
      session.status = 'disconnected';
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

    await session.client.destroy();
    session.isReady = false;
    session.status = 'disconnected';
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await this.stopSession(sessionId);
      this.sessions.delete(sessionId);
      
      // Remove session data
      const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${sessionId}`);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    }
  }

  async sendMessage(messageData: MessageData): Promise<any> {
    const session = this.sessions.get(messageData.sessionId);
    if (!session || !session.isReady) {
      throw new Error(`Session ${messageData.sessionId} is not ready`);
    }

    try {
      let chatId = messageData.to;
      if (!chatId.includes('@')) {
        chatId = `${chatId}@c.us`;
      }

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
        
        const result = await session.client.sendMessage(chatId, media, {
          caption: messageData.message || ''
        });

        console.log('Media message sent successfully');
        return result;
      } else {
        console.log('Sending text message:', messageData.message);
        return await session.client.sendMessage(chatId, messageData.message);
      }
    } catch (error) {
      console.error(`Error sending message in session ${messageData.sessionId}:`, error);
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