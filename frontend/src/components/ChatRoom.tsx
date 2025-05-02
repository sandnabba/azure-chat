import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useChat } from '../contexts/ChatContext';
import './ChatRoom.css';

interface ChatRoomProps {
  username: string;
  userId: string;
  room: string;
}

const ChatRoom = ({ username, userId, room }: ChatRoomProps) => {
  const { messages, sendMessage, connect, disconnect, isConnected, switchRoom, currentRoomId } = useChat();
  const [messageInput, setMessageInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialConnectionMade = useRef(false);
  const switchingInProgress = useRef(false);

  // Connect to WebSocket when component mounts - only once
  useEffect(() => {
    const connectToChat = async () => {
      try {
        if (!isConnected && !initialConnectionMade.current) {
          console.log(`Initial connection as ${username} (${userId})`);
          initialConnectionMade.current = true;
          await connect(userId, username);
        }
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    };

    connectToChat();

    // Only disconnect when component unmounts completely
    return () => {
      // We don't want to disconnect on every render or room change
      if (document.visibilityState === 'hidden') {
        disconnect();
      }
    };
  }, [username, userId, connect, disconnect, isConnected]);

  // Handle room changes efficiently
  useEffect(() => {
    if (switchingInProgress.current || !isConnected) return;

    const handleRoomChange = async () => {
      // Only switch rooms if necessary
      if (room !== currentRoomId) {
        console.log(`Room switching needed - prop: ${room}, context: ${currentRoomId}`);
        switchingInProgress.current = true;
        
        try {
          await switchRoom(room);
        } finally {
          switchingInProgress.current = false;
        }
      }
    };

    handleRoomChange();
  }, [room, switchRoom, isConnected, currentRoomId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() || selectedFile) {
      try {
        await sendMessage(messageInput.trim(), selectedFile, userId);
        setMessageInput('');
        clearAttachment();
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  // Only render messages from the selected room
  const filteredMessages = messages.filter(message => message.chatId === room);

  return (
    <div className="chat-room">
      <div className="chat-header">
        <h2>#{room}</h2>
        <div className="room-info">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '●' : '○'}
          </span>
          {room === currentRoomId ? null : 
            <span className="room-status switching">Syncing...</span>
          }
        </div>
      </div>
      
      <div className="chat-main">
        <div className="message-list">
          {filteredMessages.length === 0 ? (
            <div className="empty-chat">
              <p>No messages yet in #{room}. Be the first to say hello!</p>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div 
                key={message.id} 
                className={`message ${message.senderId === userId ? 'own-message' : ''}`}
              >
                <div className="message-header">
                  <span className="sender">{message.senderId === userId ? 'You' : message.senderName}</span>
                  <span className="time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-content">
                  {message.content}
                  {message.attachmentUrl && (
                    <div className="attachment">
                      <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer">
                        📎 {message.attachmentFilename || 'View Attachment'}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {selectedFile && (
          <div className="selected-file-info">
            <span>Selected: {selectedFile.name}</span>
            <button onClick={clearAttachment} className="clear-attachment-btn">×</button>
          </div>
        )}

        <form className="message-form" onSubmit={handleSubmit}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
          <button type="button" onClick={triggerFileInput} className="attach-btn" title="Attach file" disabled={!isConnected}>
            📎
          </button>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={`Type a message or attach a file in #${room}...`}
            autoFocus
            disabled={!isConnected}
          />
          <button type="submit" disabled={(!messageInput.trim() && !selectedFile) || !isConnected}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;
