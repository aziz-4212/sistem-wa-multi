import React, { useState, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import { BroadcastMessageData } from '../types';
import { Send, Upload, X, Plus, Users, Clock, AlertCircle } from 'lucide-react';
import { sessionService } from '../services/api';
import toast from 'react-hot-toast';

const BroadcastMessage: React.FC = () => {
  const { sessions } = useSession();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [file, setFile] = useState<File | null>(null);
  const [delay, setDelay] = useState(1000); // 1 second default delay
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<Array<{phone: string, status: 'success' | 'failed', error?: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter only connected sessions
  const connectedSessions = sessions.filter(session => 
    session.isReady && session.status === 'connected'
  );

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 62
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    
    // If doesn't start with 62, add it
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    
    return cleaned;
  };

  const handleAddRecipient = () => {
    setRecipients([...recipients, '']);
  };

  const handleRemoveRecipient = (index: number) => {
    if (recipients.length > 1) {
      const newRecipients = recipients.filter((_, i) => i !== index);
      setRecipients(newRecipients);
    }
  };

  const handleRecipientChange = (index: number, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = value;
    setRecipients(newRecipients);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadRecipientsFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const numbers = content.split('\\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        if (numbers.length > 0) {
          setRecipients(numbers);
          toast.success(`Loaded ${numbers.length} recipients`);
        }
      };
      reader.readAsText(file);
    } else {
      toast.error('Please select a .txt file');
    }
  };

  const validateRecipients = (): string[] => {
    return recipients
      .filter(phone => phone.trim().length > 0)
      .map(phone => formatPhoneNumber(phone.trim()));
  };

  const handleBroadcast = async () => {
    if (!selectedSessionId) {
      toast.error('Please select a session');
      return;
    }

    if (!message.trim() && !file) {
      toast.error('Please enter a message or select a file');
      return;
    }

    const validRecipients = validateRecipients();
    if (validRecipients.length === 0) {
      toast.error('Please enter at least one valid recipient');
      return;
    }

    setIsSending(true);
    setResults([]);

    try {
      const broadcastData: BroadcastMessageData = {
        sessionId: selectedSessionId,
        recipients: validRecipients,
        message: message.trim(),
        media: file || undefined,
        delay: delay
      };

      toast.loading(`Sending broadcast to ${validRecipients.length} recipients...`, {
        id: 'broadcast'
      });

      const response = await sessionService.sendBroadcastMessage(broadcastData);
      
      setResults(response.results);
      
      const successCount = response.results.filter((r: any) => r.status === 'success').length;
      const failedCount = response.results.filter((r: any) => r.status === 'failed').length;

      if (successCount > 0) {
        toast.success(`Broadcast completed! ${successCount} sent, ${failedCount} failed`, {
          id: 'broadcast'
        });
      } else {
        toast.error(`Broadcast failed! All ${failedCount} messages failed to send`, {
          id: 'broadcast'
        });
      }

    } catch (error: any) {
      console.error('Broadcast error:', error);
      toast.error(error.response?.data?.error || 'Failed to send broadcast', {
        id: 'broadcast'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Users className="h-6 w-6 text-whatsapp-green" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcast Message</h1>
          <p className="text-gray-600">Send message to multiple WhatsApp numbers</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
        {/* Session Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Session
          </label>
          {connectedSessions.length === 0 ? (
            <p className="text-red-600 text-sm">No connected sessions available. Please connect a session first.</p>
          ) : (
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
            >
              <option value="">Choose a session...</option>
              {connectedSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.id}) - {session.phoneNumber || 'Connected'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Recipients Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Recipients ({recipients.filter(r => r.trim()).length})
            </label>
            <div className="flex space-x-2">
              <input
                type="file"
                accept=".txt"
                onChange={loadRecipientsFromFile}
                className="hidden"
                id="recipients-file"
              />
              <label
                htmlFor="recipients-file"
                className="cursor-pointer text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600"
              >
                Load from file
              </label>
              <button
                type="button"
                onClick={handleAddRecipient}
                className="text-xs bg-whatsapp-green text-white px-2 py-1 rounded hover:bg-whatsapp-green-dark"
              >
                <Plus className="h-3 w-3 inline mr-1" />
                Add
              </button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recipients.map((recipient, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => handleRecipientChange(index, e.target.value)}
                  placeholder="08xxxxxxxxxx or 628xxxxxxxxxx"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent text-sm"
                />
                {recipients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <p className="text-xs text-gray-500 mt-1">
            Tip: You can upload a .txt file with one phone number per line
          </p>
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
            placeholder="Type your broadcast message here..."
          />
          <p className="text-sm text-gray-500 mt-1">{message.length} characters</p>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attach File (Optional)
          </label>
          <div className="flex items-center space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              id="media-file"
            />
            <label
              htmlFor="media-file"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </label>
            {file && (
              <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-md">
                <span className="text-sm text-gray-600">{file.name}</span>
                <button onClick={removeFile} className="text-red-500 hover:text-red-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Delay Setting */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock className="h-4 w-4 inline mr-1" />
            Delay Between Messages (milliseconds)
          </label>
          <input
            type="number"
            value={delay}
            onChange={(e) => setDelay(Math.max(500, parseInt(e.target.value) || 1000))}
            min="500"
            max="10000"
            step="100"
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum 500ms to avoid being blocked by WhatsApp
          </p>
        </div>

        {/* Send Button */}
        <div className="flex justify-end">
          <button
            onClick={handleBroadcast}
            disabled={isSending || connectedSessions.length === 0}
            className="inline-flex items-center px-6 py-3 bg-whatsapp-green text-white font-medium rounded-md hover:bg-whatsapp-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-whatsapp-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Broadcast
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Broadcast Results</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((result, index) => (
              <div key={index} className={`flex items-center justify-between p-2 rounded ${
                result.status === 'success' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <span className="text-sm font-mono">{result.phone}</span>
                <div className="flex items-center space-x-2">
                  {result.status === 'success' ? (
                    <span className="text-green-600 text-sm">✓ Sent</span>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600 text-sm">{result.error || 'Failed'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between text-sm">
              <span>Total: {results.length}</span>
              <span className="text-green-600">
                Success: {results.filter(r => r.status === 'success').length}
              </span>
              <span className="text-red-600">
                Failed: {results.filter(r => r.status === 'failed').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastMessage;