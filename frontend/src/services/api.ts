import axios from 'axios';
import { WhatsAppSession, MessageData, SessionInfo } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export const sessionService = {
  // Create a new session
  createSession: async (sessionId: string, sessionName: string): Promise<{ session: WhatsAppSession }> => {
    const response = await api.post('/sessions', { sessionId, sessionName });
    return response.data;
  },

  // Get all sessions
  getAllSessions: async (): Promise<{ sessions: WhatsAppSession[] }> => {
    const response = await api.get('/sessions');
    return response.data;
  },

  // Get specific session
  getSession: async (sessionId: string): Promise<{ session: WhatsAppSession }> => {
    const response = await api.get(`/sessions/${sessionId}`);
    return response.data;
  },

  // Start session
  startSession: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/sessions/${sessionId}/start`);
    return response.data;
  },

  // Stop session
  stopSession: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/sessions/${sessionId}/stop`);
    return response.data;
  },

  // Delete session
  deleteSession: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  },

  // Get session info
  getSessionInfo: async (sessionId: string): Promise<{ info: SessionInfo }> => {
    const response = await api.get(`/sessions/${sessionId}/info`);
    return response.data;
  },

  // Send message
  sendMessage: async (messageData: MessageData): Promise<{ success: boolean; result: any }> => {
    const response = await api.post(`/sessions/${messageData.sessionId}/send-message`, {
      to: messageData.to,
      message: messageData.message,
    });
    return response.data;
  },

  // Send message with media
  sendMediaMessage: async (messageData: MessageData): Promise<{ success: boolean; result: any }> => {
    const formData = new FormData();
    formData.append('to', messageData.to);
    formData.append('message', messageData.message);
    if (messageData.media) {
      formData.append('media', messageData.media);
    }

    const response = await api.post(`/sessions/${messageData.sessionId}/send-media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;