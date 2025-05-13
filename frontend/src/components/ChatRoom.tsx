import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useChat } from '../contexts/ChatContext';
import './ChatRoom.css';

interface ChatRoomProps {
  username: string;
  userId: string;
  room: string;
}

const ChatRoom = ({ username, userId, room }: ChatRoomProps) => {
  const {
    messagesByRoom, // Changed from messages
    sendMessage,
    connect,
    disconnect,
    isConnected,
    currentRoomId,
    markRoomAsRead
  } = useChat();
  const [messageInput, setMessageInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialConnectionMade = useRef(false);

  // Derive messages for the current room this component instance is for
  const currentRoomMessages = messagesByRoom[room] || [];

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
      if (document.visibilityState === 'hidden') {
        // disconnect(); // Decided to keep connection persistent as per requirements
      }
    };
  }, [username, userId, connect, disconnect, isConnected]);

  // Handle room changes: react when this room becomes the active one
  useEffect(() => {
    // This effect runs when this ChatRoom's props (like 'room') or context values change.
    // 'room' is the specific room this instance of ChatRoom is for.
    // 'currentRoomId' is the globally active room ID from context.

    if (isConnected && room === currentRoomId) {
      // If this ChatRoom instance is for the currently active room
      console.log(`ChatRoom (${room}): Is the active room. Marking as read.`);
      markRoomAsRead(room);
      // History loading is primarily handled by ChatContext when currentRoomId changes or on successful subscription.
    }
    // ChatRoom should not fight for who is the currentRoomId.
    // It just reacts to being the currentRoomId.
    // The component initiating the room change (e.g., Sidebar) is responsible for calling context.setCurrentRoomId.
  }, [room, isConnected, currentRoomId, markRoomAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentRoomMessages]); // Changed from messages to currentRoomMessages

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
        // sendMessage in context now infers userId and currentRoomId and takes an object
        await sendMessage({ content: messageInput.trim(), file: selectedFile });
        setMessageInput('');
        clearAttachment();
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  return (
    <div className="chat-room">
      <div className="chat-header">
        <h2>#{room}</h2>
        <div className="room-info">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '●' : '○'}
          </span>
          {isConnected && room !== currentRoomId && (
            <span className="room-status switching">Syncing...</span>
          )}
        </div>
      </div>
      
      <div className="chat-main">
        <div className="message-list">
          {/* Display messages if this room is the active one AND messages for this room exist */}
          {room === currentRoomId && currentRoomMessages.length === 0 ? (
            <div className="empty-chat">
              <p>No messages yet in #{room}. Be the first to say hello!</p>
            </div>
          ) : room === currentRoomId ? (
            currentRoomMessages.map((message) => (
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
          ) : null}
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
          <button type="button" onClick={triggerFileInput} className="attach-btn" title="Attach file" disabled={!isConnected || room !== currentRoomId}>
            📎
          </button>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={`Type a message or attach a file in #${room}...`}
            autoFocus
            disabled={!isConnected || room !== currentRoomId} // Disable if not connected or not the active room
          />
          <button type="submit" disabled={(!messageInput.trim() && !selectedFile) || !isConnected || room !== currentRoomId}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;
