import { Router, Request, Response } from 'express';
import { WhatsAppManager } from '../services/WhatsAppManager';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer to preserve file extensions
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Preserve original filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow all file types
    cb(null, true);
  }
});

export const routes = (whatsappManager: WhatsAppManager) => {
  const router = Router();

  // Create a new WhatsApp session
  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      const { sessionId, sessionName } = req.body;
      
      if (!sessionId || !sessionName) {
        return res.status(400).json({ 
          error: 'sessionId and sessionName are required' 
        });
      }

      const session = await whatsappManager.createSession(sessionId, sessionName);
      res.json({ 
        success: true, 
        session: {
          id: session.id,
          name: session.name,
          status: session.status,
          isReady: session.isReady
        }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Start a WhatsApp session (fire-and-forget; progress via Socket.IO)
  router.post('/sessions/:sessionId/start', (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Quick validation to fail fast
    const session = whatsappManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // If already in progress or connected, just acknowledge
    if (session.status === 'connecting' || session.status === 'authenticated' || session.status === 'connected') {
      return res.json({ success: true, message: 'Session is already starting or running' });
    }

    // Kick off asynchronously and return immediately
    setImmediate(() => {
      whatsappManager.startSession(sessionId).catch((err: any) => {
        console.error(`Async start failed for session ${sessionId}:`, err?.message || err);
        // Errors will be surfaced to clients via Socket.IO events if needed
      });
    });

    return res.status(202).json({ success: true, message: 'Starting session' });
  });

  // Stop a WhatsApp session
  router.post('/sessions/:sessionId/stop', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      await whatsappManager.stopSession(sessionId);
      res.json({ success: true, message: 'Session stopped' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Restart a WhatsApp session
  router.post('/sessions/:sessionId/restart', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      // Run restart in background to avoid timeout
      whatsappManager.restartSession(sessionId).catch(error => {
        console.error(`Background restart failed for session ${sessionId}:`, error);
      });
      
      // Return immediately with 202 status
      res.status(202).json({ success: true, message: 'Session restart initiated' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Check session health
  router.get('/sessions/:sessionId/health', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const isHealthy = await whatsappManager.validateSessionHealth(sessionId);
      
      res.json({ 
        success: true,
        sessionId,
        isHealthy,
        message: isHealthy ? 'Session is healthy' : 'Session needs attention'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a WhatsApp session
  router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      await whatsappManager.deleteSession(sessionId);
      res.json({ success: true, message: 'Session deleted' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all sessions
  router.get('/sessions', (req: Request, res: Response) => {
    try {
      const sessions = whatsappManager.getAllSessions();
      res.json({ success: true, sessions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific session
  router.get('/sessions/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = whatsappManager.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ 
        success: true, 
        session: {
          id: session.id,
          name: session.name,
          status: session.status,
          isReady: session.isReady,
          qrCode: session.qrCode,
          phoneNumber: session.phoneNumber
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get session info (phone number, etc.)
  router.get('/sessions/:sessionId/info', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const info = await whatsappManager.getSessionInfo(sessionId);
      res.json({ success: true, info });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Send message
  router.post('/sessions/:sessionId/send-message', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({ 
          error: 'to and message are required' 
        });
      }

      const result = await whatsappManager.sendMessage({
        sessionId,
        to,
        message
      });

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Send message with media
  router.post('/sessions/:sessionId/send-media', upload.single('media'), async (req: Request, res: Response) => {
    let uploadedFilePath: string | undefined;
    
    try {
      const { sessionId } = req.params;
      const { to, message } = req.body;
      const file = req.file;

      if (!to) {
        return res.status(400).json({ 
          error: 'to is required' 
        });
      }

      if (!file) {
        return res.status(400).json({ 
          error: 'media file is required' 
        });
      }

      uploadedFilePath = file.path;
      
      console.log('Sending media file:', {
        originalname: file.originalname,
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      });

      const result = await whatsappManager.sendMessage({
        sessionId,
        to,
        message: message || '',
        media: {
          path: file.path,
          filename: file.originalname,
          mimetype: file.mimetype
        }
      });

      // Clean up uploaded file after successful send
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
        console.log('Cleaned up uploaded file:', uploadedFilePath);
      }

      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Error sending media message:', error);
      
      // Clean up uploaded file on error
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
          console.log('Cleaned up uploaded file after error:', uploadedFilePath);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      
      res.status(400).json({ error: error.message });
    }
  });

  // Broadcast message to multiple recipients
  router.post('/sessions/:sessionId/broadcast', upload.single('media'), async (req: Request, res: Response) => {
    let uploadedFilePath: string | undefined;
    
    try {
      const { sessionId } = req.params;
      const { recipients, message, delay } = req.body;
      const file = req.file;

      if (!recipients) {
        return res.status(400).json({ 
          error: 'recipients is required' 
        });
      }

      if (!message && !file) {
        return res.status(400).json({ 
          error: 'message or media is required' 
        });
      }

      const recipientList = JSON.parse(recipients);
      const delayMs = parseInt(delay) || 1000;

      if (!Array.isArray(recipientList) || recipientList.length === 0) {
        return res.status(400).json({ 
          error: 'recipients must be a non-empty array' 
        });
      }

      if (file) {
        uploadedFilePath = file.path;
      }

      console.log(`Starting broadcast to ${recipientList.length} recipients with ${delayMs}ms delay`);

      const results = await whatsappManager.sendBroadcast({
        sessionId,
        recipients: recipientList,
        message: message || '',
        media: file ? {
          path: file.path,
          filename: file.originalname,
          mimetype: file.mimetype
        } : undefined,
        delay: delayMs
      });

      // Clean up uploaded file after broadcast
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
        console.log('Cleaned up uploaded file:', uploadedFilePath);
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      
      // Clean up uploaded file on error
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
          console.log('Cleaned up uploaded file after error:', uploadedFilePath);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      
      res.status(400).json({ error: error.message });
    }
  });

  // ===== EXTERNAL API FOR OTHER SYSTEMS =====
  
  // Middleware for API key authentication
  const authenticateApiKey = (req: Request, res: Response, next: any) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    // Simple API key validation (in production, store this securely)
    const validApiKey = process.env.API_KEY || 'whatsapp-api-key-2024';
    
    if (!apiKey || apiKey !== validApiKey) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or missing API key. Please provide X-API-Key header or Authorization Bearer token.' 
      });
    }
    
    next();
  };

  // External API: Send simple text message
  router.post('/send-message', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { sessionId, to, message } = req.body;

      // Validate required fields
      if (!sessionId) {
        return res.status(400).json({ 
          success: false,
          error: 'sessionId is required' 
        });
      }

      if (!to) {
        return res.status(400).json({ 
          success: false,
          error: 'to (phone number) is required' 
        });
      }

      if (!message) {
        return res.status(400).json({ 
          success: false,
          error: 'message is required' 
        });
      }

      // Check if session exists and is ready
      const session = whatsappManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          success: false,
          error: `Session '${sessionId}' not found` 
        });
      }

      if (!session.isReady) {
        return res.status(400).json({ 
          success: false,
          error: `Session '${sessionId}' is not ready. Current status: ${session.status}` 
        });
      }

      const result = await whatsappManager.sendMessage({
        sessionId,
        to,
        message
      });

      res.json({ 
        success: true, 
        message: 'Message sent successfully',
        data: {
          sessionId,
          to,
          messageId: result.id || null,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('External API error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  });

  // External API: Send message with media (file upload)
  router.post('/send-media', authenticateApiKey, upload.single('file'), async (req: Request, res: Response) => {
    let uploadedFilePath: string | undefined;
    
    try {
      const { sessionId, to, message } = req.body;
      const file = req.file;

      // Validate required fields
      if (!sessionId) {
        return res.status(400).json({ 
          success: false,
          error: 'sessionId is required' 
        });
      }

      if (!to) {
        return res.status(400).json({ 
          success: false,
          error: 'to (phone number) is required' 
        });
      }

      if (!file) {
        return res.status(400).json({ 
          success: false,
          error: 'file is required' 
        });
      }

      // Check if session exists and is ready
      const session = whatsappManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          success: false,
          error: `Session '${sessionId}' not found` 
        });
      }

      if (!session.isReady) {
        return res.status(400).json({ 
          success: false,
          error: `Session '${sessionId}' is not ready. Current status: ${session.status}` 
        });
      }

      uploadedFilePath = file.path;

      const result = await whatsappManager.sendMessage({
        sessionId,
        to,
        message: message || '',
        media: {
          path: file.path,
          filename: file.originalname,
          mimetype: file.mimetype
        }
      });

      // Clean up uploaded file after successful send
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }

      res.json({ 
        success: true, 
        message: 'Media message sent successfully',
        data: {
          sessionId,
          to,
          messageId: result.id || null,
          fileName: file.originalname,
          fileSize: file.size,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('External API media error:', error);
      
      // Clean up uploaded file on error
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to send media message'
      });
    }
  });

  // External API: Send broadcast message
  router.post('/broadcast', authenticateApiKey, upload.single('file'), async (req: Request, res: Response) => {
    let uploadedFilePath: string | undefined;
    
    try {
      const { sessionId, recipients, message, delay } = req.body;
      const file = req.file;

      // Validate required fields
      if (!sessionId) {
        return res.status(400).json({ 
          success: false,
          error: 'sessionId is required' 
        });
      }

      if (!recipients) {
        return res.status(400).json({ 
          success: false,
          error: 'recipients is required (array of phone numbers)' 
        });
      }

      if (!message && !file) {
        return res.status(400).json({ 
          success: false,
          error: 'message or file is required' 
        });
      }

      // Check if session exists and is ready
      const session = whatsappManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          success: false,
          error: `Session '${sessionId}' not found` 
        });
      }

      if (!session.isReady) {
        return res.status(400).json({ 
          success: false,
          error: `Session '${sessionId}' is not ready. Current status: ${session.status}` 
        });
      }

      // Parse recipients if it's a string
      let recipientList;
      try {
        recipientList = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
      } catch (parseError) {
        return res.status(400).json({ 
          success: false,
          error: 'recipients must be a valid JSON array of phone numbers' 
        });
      }

      if (!Array.isArray(recipientList) || recipientList.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'recipients must be a non-empty array of phone numbers' 
        });
      }

      const delayMs = parseInt(delay) || 1000;

      if (file) {
        uploadedFilePath = file.path;
      }

      const results = await whatsappManager.sendBroadcast({
        sessionId,
        recipients: recipientList,
        message: message || '',
        media: file ? {
          path: file.path,
          filename: file.originalname,
          mimetype: file.mimetype
        } : undefined,
        delay: delayMs
      });

      // Clean up uploaded file after broadcast
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }

      // Count successful and failed sends
      const successful = results.filter(r => r.status === 'success').length;
      const failed = results.filter(r => r.status === 'failed').length;

      res.json({ 
        success: true, 
        message: 'Broadcast completed',
        data: {
          sessionId,
          totalRecipients: recipientList.length,
          successful,
          failed,
          delay: delayMs,
          results: results,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('External API broadcast error:', error);
      
      // Clean up uploaded file on error
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to send broadcast'
      });
    }
  });

  // External API: Get session status
  router.get('/session/:sessionId/status', authenticateApiKey, (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = whatsappManager.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ 
          success: false,
          error: `Session '${sessionId}' not found` 
        });
      }

      res.json({ 
        success: true,
        data: {
          sessionId: session.id,
          sessionName: session.name,
          status: session.status,
          isReady: session.isReady,
          phoneNumber: session.phoneNumber || null,
          hasQRCode: !!session.qrCode
        }
      });
    } catch (error: any) {
      console.error('External API status error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to get session status'
      });
    }
  });

  // External API: Get all available sessions (override the internal sessions endpoint for external API)
  router.get('/sessions-external', authenticateApiKey, (req: Request, res: Response) => {
    try {
      const sessions = whatsappManager.getAllSessions();
      const sessionList = sessions.map(session => ({
        sessionId: session.id,
        sessionName: session.name,
        status: session.status,
        isReady: session.isReady,
        phoneNumber: session.phoneNumber || null
      }));

      res.json({ 
        success: true,
        data: {
          totalSessions: sessionList.length,
          sessions: sessionList
        }
      });
    } catch (error: any) {
      console.error('External API sessions error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to get sessions'
      });
    }
  });

  return router;
};