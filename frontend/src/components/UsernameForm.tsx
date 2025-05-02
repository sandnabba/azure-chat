import { useState } from 'react';
import './UsernameForm.css';

interface UsernameFormProps {
  onSelectUsername: (username: string) => void;
}

const UsernameForm = ({ onSelectUsername }: UsernameFormProps) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      setError('Username cannot be empty');
      return;
    }
    
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    if (trimmedUsername.length > 15) {
      setError('Username must be less than 15 characters');
      return;
    }
    
    // In a real app, you would check if the username is already taken
    onSelectUsername(trimmedUsername);
  };

  return (
    <div className="username-form-container">
      <h2>Enter a Username to Begin Chatting</h2>
      <form onSubmit={handleSubmit} className="username-form">
        <div className="input-group">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            placeholder="Your username"
            autoFocus
          />
          {error && <p className="error">{error}</p>}
        </div>
        
        <button type="submit" disabled={!username.trim()}>
          Start Chatting
        </button>
      </form>
    </div>
  );
};

export default UsernameForm;
