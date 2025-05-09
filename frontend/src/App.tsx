import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './App.css';
import ChatRoom from './components/ChatRoom';
import UsernameForm from './components/UsernameForm';
import Sidebar from './components/Sidebar';
import BuildInfo from './components/BuildInfo';
import { useChat } from './contexts/ChatContext';
import { getApiBaseUrl } from './utils/apiUrls';

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
  const location = useLocation();
  const [verificationMessage, setVerificationMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Get API URL using our centralized utility
  const backendUrl = getApiBaseUrl();
  const [verifyingToken, setVerifyingToken] = useState<boolean>(false);

  // Process email verification token if present in URL
  useEffect(() => {
    // Parse query parameters
    const params = new URLSearchParams(location.search);
    const verificationToken = params.get('verification_token');
    
    // If there's a verification token in the URL, verify it directly
    if (verificationToken && !verifyingToken) {
      const verifyEmailToken = async () => {
        setVerifyingToken(true);
        try {
          console.log("Verifying email token:", verificationToken);
          const response = await fetch(`${backendUrl}/api/auth/verify-email/${verificationToken}`);
          
          if (response.ok) {
            setVerificationMessage({
              type: 'success',
              message: 'Your email has been successfully verified! You can now log in.'
            });
            // Clear the token from the URL without a full page reload
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          } else {
            let errorMessage = 'There was a problem verifying your email.';
            // Try to get more specific error message from the API
            try {
              const errorData = await response.json();
              if (errorData.detail) {
                errorMessage = errorData.detail;
              }
            } catch (e) {
              // Ignore JSON parsing error
            }
            
            setVerificationMessage({
              type: 'error',
              message: errorMessage
            });
            // Clear the token from the URL without a full page reload
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }
        } catch (error) {
          console.error("Error verifying email token:", error);
          setVerificationMessage({
            type: 'error',
            message: 'An error occurred while verifying your email. Please try again later.'
          });
          // Clear the token from the URL without a full page reload
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } finally {
          setVerifyingToken(false);
        }
      };
      
      verifyEmailToken();
    }
  }, [location.search, backendUrl]);

  // Handle verification redirect parameters
  useEffect(() => {
    // Parse query parameters
    const params = new URLSearchParams(location.search);
    const verification = params.get('verification');
    const reason = params.get('reason');
    
    if (verification === 'success') {
      setVerificationMessage({
        type: 'success',
        message: 'Your email has been successfully verified! You can now log in.'
      });
    } else if (verification === 'error') {
      let errorMsg = 'There was a problem verifying your email.';
      if (reason === 'invalid-token') {
        errorMsg = 'The verification link is invalid or has expired. Please try logging in or request a new verification email.';
      } else if (reason === 'missing-token') {
        errorMsg = 'No verification token was provided. Please use the full link from your email.';
      } else if (reason === 'server-error') {
        errorMsg = 'A server error occurred during verification. Please try again later.';
      }
      setVerificationMessage({
        type: 'error',
        message: errorMsg
      });
    }
  }, [location.search]);

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
      {/* Banner for verification messages that should always be visible */}
      {verificationMessage && (
        <div className={`verification-banner floating ${verificationMessage.type}`}>
          {verificationMessage.message}
          <button onClick={() => setVerificationMessage(null)} className="close-banner">×</button>
        </div>
      )}
      
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
        {username ? (
          <>
            <Sidebar
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
            />
            <main>
              <ChatRoom 
                username={username} 
                userId={userId || ''}
                room={selectedRoom} 
              />
            </main>
          </>
        ) : (
          <div className="login-container">
            <UsernameForm onSelectUsername={handleUserAuthenticated} />
          </div>
        )}
      </div>
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
