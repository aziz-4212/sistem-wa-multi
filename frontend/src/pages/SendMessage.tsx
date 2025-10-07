import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { sessionService } from '../services/api';
import { WhatsAppSession } from '../types';
import toast from 'react-hot-toast';
import { Send, MessageCircle, Phone, FileImage, Loader2 } from 'lucide-react';

const SendMessage: React.FC = () => {
  const { sessions } = useSession();
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);

  // Filter ready sessions
  const readySessions = sessions.filter(session => session.isReady && session.status === 'connected');

  useEffect(() => {
    if (readySessions.length > 0 && !selectedSession) {
      setSelectedSession(readySessions[0].id);
    }
  }, [readySessions, selectedSession]);

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    
    return cleaned;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSession) {
      toast.error('Please select a session');
      return;
    }
    
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    
    if (!message.trim() && !mediaFile) {
      toast.error('Please enter a message or select a file');
      return;
    }

    setSending(true);
    
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      let result;
      if (mediaFile) {
        // Send media message
        result = await sessionService.sendMediaMessage({
          sessionId: selectedSession,
          to: formattedPhone,
          message: message.trim(),
          media: mediaFile
        });
      } else {
        // Send text message
        result = await sessionService.sendMessage({
          sessionId: selectedSession,
          to: formattedPhone,
          message: message.trim()
        });
      }

      if (result.success) {
        toast.success('Message sent successfully!');
        
        // Add to message history
        const newMessage = {
          id: Date.now(),
          sessionId: selectedSession,
          to: formattedPhone,
          message: message.trim(),
          media: mediaFile ? mediaFile.name : null,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };
        setMessageHistory(prev => [newMessage, ...prev]);
        
        // Clear form
        setMessage('');
        setMediaFile(null);
        const fileInput = document.getElementById('media-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setMediaFile(file);
    }
  };

  const removeFile = () => {
    setMediaFile(null);
    const fileInput = document.getElementById('media-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  if (readySessions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <MessageCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Active Sessions</h2>
          <p className="text-yellow-700">
            You need to have at least one connected WhatsApp session to send messages.
          </p>
          <p className="text-yellow-600 mt-2">
            Go to Dashboard to create and start a session first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Send className="w-8 h-8 mr-3 text-blue-600" />
            Send WhatsApp Message
          </h1>
          <p className="text-gray-600 mt-2">
            Send messages to any WhatsApp number using your connected sessions
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSendMessage} className="space-y-6">
            {/* Session Selection */}
            <div>
              <label htmlFor="session" className="block text-sm font-medium text-gray-700 mb-2">
                Select Session
              </label>
              <select
                id="session"
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {readySessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.id}) - {session.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              <input
                type="text"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 081234567890 or 62812345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter phone number with or without country code (62 will be added automatically)
              </p>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                <MessageCircle className="w-4 h-4 inline mr-1" />
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
            </div>

            {/* Media File */}
            <div>
              <label htmlFor="media-file" className="block text-sm font-medium text-gray-700 mb-2">
                <FileImage className="w-4 h-4 inline mr-1" />
                Media File (Optional)
              </label>
              <input
                type="file"
                id="media-file"
                onChange={handleFileChange}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {mediaFile && (
                <div className="mt-2 flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm text-gray-700">
                    Selected: {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Supported: Images, Videos, Audio, PDF, Documents (Max 10MB)
              </p>
            </div>

            {/* Send Button */}
            <div>
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Message History */}
      {messageHistory.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Messages</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {messageHistory.map((msg) => (
                <div key={msg.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="font-medium text-gray-900">+{msg.to}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {msg.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-2">{msg.message}</p>
                  {msg.media && (
                    <div className="flex items-center text-sm text-gray-500">
                      <FileImage className="w-4 h-4 mr-1" />
                      {msg.media}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    Session: {msg.sessionId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendMessage;