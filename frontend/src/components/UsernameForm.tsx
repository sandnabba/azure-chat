import { useState } from 'react';
import './UsernameForm.css';

interface AuthUser {
  id: string;
  username: string;
  email: string;
}

interface UsernameFormProps {
  onSelectUsername: (username: string, userId: string) => void;
}

const UsernameForm = ({ onSelectUsername }: UsernameFormProps) => {
  // Form state
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationSuccessful, setRegistrationSuccessful] = useState(false);
  
  // Get API URL from environment variable
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const validateRegisterForm = () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    if (!trimmedUsername) {
      setError('Username cannot be empty');
      return false;
    }
    
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    
    if (trimmedUsername.length > 15) {
      setError('Username must be less than 15 characters');
      return false;
    }

    if (!trimmedEmail) {
      setError('Email cannot be empty');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    if (!trimmedPassword) {
      setError('Password cannot be empty');
      return false;
    }
    
    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    
    if (trimmedPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const validateLoginForm = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    if (!trimmedEmail) {
      setError('Email cannot be empty');
      return false;
    }
    
    if (!trimmedPassword) {
      setError('Password cannot be empty');
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!validateRegisterForm()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }
      
      // User registration successful, but we don't need the response data
      await response.json();
      setRegistrationSuccessful(true);
      // Don't automatically log in the user now, they need to verify email first
    } catch (err: any) {
      setError(err.message || 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogin = async () => {
    if (!validateLoginForm()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const userData: AuthUser = await response.json();
      onSelectUsername(userData.username, userData.id);
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      await handleLogin();
    } else {
      await handleRegister();
    }
  };

  return (
    <div className="username-form-container">
      <h2>{isLogin ? 'Log In' : 'Create Account'}</h2>
      
      <div className="auth-tabs">
        <button 
          className={`auth-tab ${isLogin ? 'active' : ''}`} 
          onClick={() => {
            setIsLogin(true);
            setRegistrationSuccessful(false);
            setError('');
          }}
          type="button"
        >
          Login
        </button>
        <button 
          className={`auth-tab ${!isLogin ? 'active' : ''}`} 
          onClick={() => {
            setIsLogin(false);
            setError('');
          }}
          type="button"
        >
          Register
        </button>
      </div>
      
      {registrationSuccessful ? (
        <div className="verification-message">
          <p>Registration successful! Please check your email to verify your account before logging in.</p>
          <p className="verification-note">If you don't see the email, check your spam folder.</p>
          <button 
            className="auth-button" 
            onClick={() => {
              setIsLogin(true);
              setRegistrationSuccessful(false);
            }}
          >
            Go to Login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="username-form">
          {!isLogin && (
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="Choose a username"
                disabled={isLoading}
              />
            </div>
          )}
          
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="Your email address"
              disabled={isLoading}
              autoFocus={isLogin}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Your password"
              disabled={isLoading}
            />
          </div>
          
          {!isLogin && (
            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                placeholder="Confirm your password"
                disabled={isLoading}
              />
            </div>
          )}
          
          {error && <p className="error">{error}</p>}
          
          <button 
            type="submit" 
            disabled={isLoading || (isLogin ? !email || !password : !username || !email || !password || !confirmPassword)}
            className="auth-button"
          >
            {isLoading 
              ? 'Please wait...' 
              : isLogin 
                ? 'Log In' 
                : 'Create Account'}
          </button>
        </form>
      )}
    </div>
  );
};

export default UsernameForm;
