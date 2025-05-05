import { useState, useEffect } from 'react';
import './App.css';
import ChatRoom from './components/ChatRoom';
import UsernameForm from './components/UsernameForm';
import Sidebar from './components/Sidebar';
import BuildInfo from './components/BuildInfo';
import { useChat } from './contexts/ChatContext';

function App() {
  const [username, setUsername] = useState<string | null>(
    localStorage.getItem('chatUsername')
  );
  const [userId, setUserId] = useState<string | null>(
    localStorage.getItem('chatUserId')
  );
  const [selectedRoom, setSelectedRoom] = useState<string>('general');
  const [showVersionInfo, setShowVersionInfo] = useState(false);
  const { isConnected } = useChat();

  // Get API URL from environment or use default
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (username && userId) {
      localStorage.setItem('chatUsername', username);
      localStorage.setItem('chatUserId', userId);
    }
  }, [username, userId]);

  const handleUserAuthenticated = (username: string, userId: string) => {
    setUsername(username);
    setUserId(userId);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatUsername');
    localStorage.removeItem('chatUserId');
    setUsername(null);
    setUserId(null);
  };

  const toggleVersionInfo = () => {
    setShowVersionInfo(prev => !prev);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Azure Chat</h1>
        <div className="header-controls">
          {username && (
            <div className="user-controls">
              <span>Signed in as: {username}</span>
              {userId && <span className="user-id">(ID: {userId.substring(0, 8)}...)</span>}
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
          <button className="version-button" onClick={toggleVersionInfo}>
            Version Info
          </button>
          <button className={`connection-button ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </button>
        </div>
      </header>

      <div className="app-body">
        {username && userId ? (
          <>
            <Sidebar selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />
            <main>
              <ChatRoom username={username} userId={userId} room={selectedRoom} />
            </main>
          </>
        ) : (
          <div className="login-container">
            <UsernameForm onSelectUsername={handleUserAuthenticated} />
          </div>
        )}
      </div>
      
      {/* Version Info Modal */}
      {showVersionInfo && (
        <BuildInfo 
          backendUrl={backendUrl} 
          isOpen={showVersionInfo} 
          onClose={() => setShowVersionInfo(false)} 
        />
      )}
    </div>
  );
}

export default App;
