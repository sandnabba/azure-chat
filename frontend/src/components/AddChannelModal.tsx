import React, { useState } from 'react';
import './AddChannelModal.css';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChannel: (channelName: string, channelDescription: string) => Promise<void>;
}

const AddChannelModal: React.FC<AddChannelModalProps> = ({ isOpen, onClose, onAddChannel }) => {
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!channelName.trim()) {
      setError('Channel name cannot be empty');
      return;
    }
    
    if (channelName.trim().length < 3) {
      setError('Channel name must be at least 3 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddChannel(channelName.trim(), channelDescription.trim());
      
      // Reset form and close modal on success
      setChannelName('');
      setChannelDescription('');
      setError('');
      onClose();
    } catch (error) {
      console.error('Error adding channel:', error);
      setError('Failed to create channel. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Channel</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="channel-name">Channel Name*</label>
            <input
              id="channel-name"
              type="text"
              value={channelName}
              onChange={(e) => {
                setChannelName(e.target.value);
                setError('');
              }}
              placeholder="Enter channel name"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="channel-description">Description (Optional)</label>
            <textarea
              id="channel-description"
              value={channelDescription}
              onChange={(e) => setChannelDescription(e.target.value)}
              placeholder="Enter channel description"
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddChannelModal;