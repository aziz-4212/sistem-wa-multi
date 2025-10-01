export interface WhatsAppSession {
  id: string;
  name: string;
  isReady: boolean;
  qrCode?: string;
  phoneNumber?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'authenticated';
}

export interface MessageData {
  sessionId: string;
  to: string;
  message: string;
  media?: File;
}

export interface SocketEvents {
  'qr-code': { sessionId: string; qrCode: string };
  'session-ready': { sessionId: string };
  'session-authenticated': { sessionId: string };
  'auth-failure': { sessionId: string; error: string };
  'session-disconnected': { sessionId: string; reason: string };
  'new-message': {
    sessionId: string;
    from: string;
    body: string;
    timestamp: number;
    type: string;
  };
}

export interface SessionInfo {
  sessionId: string;
  phoneNumber?: string;
  name?: string;
  platform?: string;
}