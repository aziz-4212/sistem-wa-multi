import React, { createContext, useContext, useEffect, useState } from 'react';
import { sessionService } from '../services/api';
import { WhatsAppSession } from '../types';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

interface SessionContextType {
  sessions: WhatsAppSession[];
  loading: boolean;
  refreshSessions: () => Promise<void>;
  createSession: (sessionId: string, sessionName: string) => Promise<void>;
  startSession: (sessionId: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  restartSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();

  const refreshSessions = async () => {
    setLoading(true);
    try {
      const { sessions: sessionList } = await sessionService.getAllSessions();
      setSessions(sessionList);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (sessionId: string, sessionName: string) => {
    try {
      await sessionService.createSession(sessionId, sessionName);
      await refreshSessions();
      toast.success('Session created successfully');
    } catch (error: any) {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.error || 'Failed to create session');
      throw error;
    }
  };

  const startSession = async (sessionId: string) => {
    try {
      await sessionService.startSession(sessionId);
      toast.success('Session started');
      // Update session status locally
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'connecting' }
          : session
      ));
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast.error(error.response?.data?.error || 'Failed to start session');
      throw error;
    }
  };

  const stopSession = async (sessionId: string) => {
    try {
      await sessionService.stopSession(sessionId);
      toast.success('Session stopped');
      // Update session status locally
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'disconnected', isReady: false, qrCode: undefined }
          : session
      ));
    } catch (error: any) {
      console.error('Error stopping session:', error);
      toast.error(error.response?.data?.error || 'Failed to stop session');
      throw error;
    }
  };

  const restartSession = async (sessionId: string) => {
    try {
      await sessionService.restartSession(sessionId);
      toast.success('Session restart initiated');
      // Session status will be updated via socket events
    } catch (error: any) {
      console.error('Error restarting session:', error);
      toast.error(error.response?.data?.error || 'Failed to initiate restart');
      throw error;
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await sessionService.deleteSession(sessionId);
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      toast.success('Session deleted');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(error.response?.data?.error || 'Failed to delete session');
      throw error;
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('qr-code', ({ sessionId, qrCode }) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, qrCode, status: 'connecting' }
          : session
      ));
    });

    socket.on('session-ready', ({ sessionId }) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, isReady: true, status: 'connected', qrCode: undefined }
          : session
      ));
      toast.success(`Session ${sessionId} is ready!`);
    });

    socket.on('session-authenticated', ({ sessionId }) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'authenticated' }
          : session
      ));
    });

    socket.on('auth-failure', ({ sessionId, error }) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'disconnected', qrCode: undefined }
          : session
      ));
      toast.error(`Authentication failed for ${sessionId}: ${error}`);
    });

    socket.on('session-disconnected', ({ sessionId, reason }) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'disconnected', isReady: false, qrCode: undefined }
          : session
      ));
      toast.error(`Session ${sessionId} disconnected: ${reason}`);
    });

    socket.on('session-update', ({ sessionId, status, isReady, message }) => {
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status, isReady, ...(status === 'restarting' ? { qrCode: undefined } : {}) }
          : session
      ));
      
      if (status === 'restarting') {
        toast.loading(`${message}`, { id: `restart-${sessionId}` });
      } else if (message && message.includes('failed')) {
        toast.error(message, { id: `restart-${sessionId}` });
      } else if (message && message.includes('successfully')) {
        toast.success(message, { id: `restart-${sessionId}` });
      }
    });

    socket.on('new-message', ({ sessionId, from, body }) => {
      toast(`New message in ${sessionId} from ${from}: ${body.substring(0, 50)}...`);
    });

    return () => {
      socket.off('qr-code');
      socket.off('session-ready');
      socket.off('session-authenticated');
      socket.off('auth-failure');
      socket.off('session-disconnected');
      socket.off('session-update');
      socket.off('new-message');
    };
  }, [socket]);

  useEffect(() => {
    refreshSessions();
  }, []);

  return (
    <SessionContext.Provider value={{
      sessions,
      loading,
      refreshSessions,
      createSession,
      startSession,
      stopSession,
      restartSession,
      deleteSession,
    }}>
      {children}
    </SessionContext.Provider>
  );
};