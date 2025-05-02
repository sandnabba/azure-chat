import React, { useState } from 'react';
import './DeleteChannelModal.css';

interface DeleteChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteChannel: (channelId: string) => Promise<void>;
  channelId: string;
  channelName: string;
}

const DeleteChannelModal: React.FC<DeleteChannelModalProps> = ({ 
  isOpen, 
  onClose, 
  onDeleteChannel, 
  channelId,
  channelName
}) => {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError('');
      await onDeleteChannel(channelId);
      onClose();
    } catch (error) {
      console.error('Error deleting channel:', error);
      setError('Failed to delete channel. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Delete Channel</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="delete-confirmation">
            <p>Are you sure you want to delete the channel <strong>#{channelName}</strong>?</p>
            <p className="delete-warning">This action cannot be undone. All messages in this channel will be permanently deleted.</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="delete-button" disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteChannelModal;