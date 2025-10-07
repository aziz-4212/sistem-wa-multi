import React, { useState } from 'react';
import { Plus, Play, Square, Trash2, QrCode, Phone, RefreshCw, Send } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { WhatsAppSession } from '../types';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { sessions, loading, refreshSessions, createSession, startSession, stopSession, deleteSession } = useSession();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionId, setNewSessionId] = useState('');
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionId.trim() || !newSessionName.trim()) return;

    setIsCreating(true);
    try {
      await createSession(newSessionId.trim(), newSessionName.trim());
      setNewSessionId('');
      setNewSessionName('');
      setShowCreateModal(false);
    } catch (error) {
      // Error is handled in context
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusColor = (status: WhatsAppSession['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800';
      case 'authenticated':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusIcon = (status: WhatsAppSession['status']) => {
    switch (status) {
      case 'connected':
        return <Phone className="h-4 w-4" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'authenticated':
        return <Phone className="h-4 w-4" />;
      default:
        return <QrCode className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Sessions</h1>
          <p className="text-gray-600">Manage your WhatsApp multi-session connections</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={refreshSessions}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-whatsapp-green disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-whatsapp-green hover:bg-whatsapp-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-whatsapp-green"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Session
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-whatsapp-green" />
          <span className="ml-2 text-gray-600">Loading sessions...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <QrCode className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new WhatsApp session.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-whatsapp-green hover:bg-whatsapp-green-dark"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Session
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div key={session.id} className="session-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{session.name}</h3>
                  <p className="text-sm text-gray-500">ID: {session.id}</p>
                </div>
                <div className={`status-badge ${getStatusColor(session.status)}`}>
                  {getStatusIcon(session.status)}
                  <span className="ml-1">{session.status}</span>
                </div>
              </div>

              {session.phoneNumber && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    <Phone className="inline h-4 w-4 mr-1" />
                    {session.phoneNumber}
                  </p>
                </div>
              )}

              {session.qrCode && (
                <div className="mb-4">
                  <div className="qr-code-container">
                    <p className="text-sm text-gray-600 mb-2">Scan QR Code with WhatsApp:</p>
                    <img 
                      src={session.qrCode} 
                      alt="QR Code" 
                      className="w-full max-w-xs mx-auto"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                {session.status === 'disconnected' ? (
                  <button
                    onClick={() => startSession(session.id)}
                    className="flex-1 btn-primary flex items-center justify-center"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </button>
                ) : (
                  <button
                    onClick={() => stopSession(session.id)}
                    className="flex-1 btn-secondary flex items-center justify-center"
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </button>
                )}
                
                {/* Send Message Button - only show if session is ready */}
                {session.isReady && session.status === 'connected' && (
                  <Link
                    to="/send-message"
                    className="btn-success flex items-center justify-center px-3"
                    title="Send Message"
                  >
                    <Send className="h-4 w-4" />
                  </Link>
                )}
                
                <button
                  onClick={() => deleteSession(session.id)}
                  className="btn-danger flex items-center justify-center px-3"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Session</h3>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session ID
                  </label>
                  <input
                    type="text"
                    value={newSessionId}
                    onChange={(e) => setNewSessionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                    placeholder="e.g., session1, my-whatsapp"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Name
                  </label>
                  <input
                    type="text"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                    placeholder="e.g., Personal WhatsApp, Business Account"
                    required
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 btn-secondary"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;