import { Router, Request, Response } from 'express';
import { WhatsAppManager } from '../services/WhatsAppManager';
import multer from 'multer';
import path from 'path';

const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
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

  // Start a WhatsApp session
  router.post('/sessions/:sessionId/start', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      await whatsappManager.startSession(sessionId);
      res.json({ success: true, message: 'Session started' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
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

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
};