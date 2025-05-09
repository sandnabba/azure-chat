import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './EmailVerification.css';
import { getApiBaseUrl } from '../utils/apiUrls';

const EmailVerification = () => {
  const { token: urlParamToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  // Use a ref to track if the verification has already been attempted
  const verificationAttempted = useRef(false);
  
  // Get API URL using the centralized utility
  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    const verifyEmail = async () => {
      // Skip if verification was already attempted (prevents duplicate API calls in StrictMode)
      if (verificationAttempted.current) return;
      verificationAttempted.current = true;
      
      // Get token from either URL params (old method) or query string (new method)
      const queryParams = new URLSearchParams(location.search);
      const queryToken = queryParams.get('token');
      const token = urlParamToken || queryToken;
      
      if (!token) {
        setStatus('error');
        setErrorMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        // Make the API call to verify the email
        const response = await fetch(`${apiBaseUrl}/api/auth/verify-email/${token}`);
        
        if (response.ok) {
          setStatus('success');
        } else {
          // Special handling for 400 errors - check for specific error messages
          if (response.status === 400) {
            const errorData = await response.json();
            // If the error indicates the token is not found, we should still check
            // if the user can log in, as the token might have been already used successfully
            if (errorData.detail === "Invalid or expired verification token") {
              // Show a more helpful message
              setStatus('error');
              setErrorMessage('This verification link has already been used or has expired. Please try logging in.');
            } else {
              setStatus('error');
              setErrorMessage(errorData.detail || 'Failed to verify email. The link may be expired or invalid.');
            }
          } else {
            const errorData = await response.json();
            setStatus('error');
            setErrorMessage(errorData.detail || 'Failed to verify email. The link may be expired or invalid.');
          }
        }
      } catch (error) {
        console.error('Email verification error:', error);
        
        // Even if verification request failed, the user might already be verified
        // Suggest they try to log in anyway
        setStatus('error');
        setErrorMessage('An error occurred while verifying your email. Your account might already be verified. Please try logging in.');
      }
    };

    verifyEmail();
  }, [urlParamToken, location.search, apiBaseUrl]);

  const goToLogin = () => {
    navigate('/');
  };

  return (
    <div className="email-verification-container">
      <div className="email-verification-card">
        <h2>Email Verification</h2>
        
        {status === 'verifying' && (
          <div className="verification-status verifying">
            <div className="loading-spinner"></div>
            <p>Verifying your email...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="verification-status success">
            <div className="success-icon">✓</div>
            <p>Your email has been successfully verified!</p>
            <button className="login-button" onClick={goToLogin}>
              Go to Login
            </button>
          </div>
        )}
        
        {status === 'error' && (
          <div className="verification-status error">
            <div className="error-icon">✗</div>
            <p className="error-message">{errorMessage}</p>
            <button className="login-button" onClick={goToLogin}>
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerification;