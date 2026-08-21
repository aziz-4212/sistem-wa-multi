import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './contexts/SocketContext';
import { SessionProvider } from './contexts/SessionContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SessionDetail from './pages/SessionDetail';
import SendMessage from './pages/SendMessage';
import BroadcastMessage from './pages/BroadcastMessage';
import BroadcastCustomTemplateMessage from './pages/BroadcastCustomTemplateMessage';

function App() {
  return (
    <Router>
      <SocketProvider>
        <SessionProvider>
          <div className="App">
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/session/:sessionId" element={<SessionDetail />} />
                <Route path="/send-message" element={<SendMessage />} />
                <Route path="/broadcast" element={<BroadcastMessage />} />
                <Route path="/broadcast-custom-template" element={<BroadcastCustomTemplateMessage />} />
              </Routes>
            </Layout>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </div>
        </SessionProvider>
      </SocketProvider>
    </Router>
  );
}

export default App;
