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

  return router;
};