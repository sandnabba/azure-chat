import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { ChatMessage } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';
import chatService from '../services/chatService';

type ChatContextType = {
  messages: ChatMessage[];
  sendMessage: (content: string, username: string, file?: File | null) => Promise<void>;
  activeUsers: string[];
  addActiveUser: (username: string) => void;
  removeActiveUser: (username: string) => void;
  connect: (username: string) => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  currentRoomId: string;
  switchRoom: (roomId: string) => Promise<void>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({
    'general': []
  });
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const [currentRoomId, setCurrentRoomId] = useState<string>('general');
  const currentUsername = useRef<string>('');
  const switchingRoom = useRef(false);
  const connectionInProgress = useRef(false);
  
  const messages = messagesByRoom[currentRoomId] || [];
  const eventHandlersRegistered = useRef(false);

  const loadRoomHistory = useCallback(async (roomId: string) => {
    try {
      console.log(`Loading chat history for room: ${roomId}`);
      const history = await chatService.fetchChatHistory(roomId);
      
      console.log(`Fetched ${history.length} messages for room ${roomId}`);
      
      setMessagesByRoom(prev => ({
        ...prev,
        [roomId]: history
      }));
    } catch (error) {
      console.error(`Failed to fetch chat history for room ${roomId}:`, error);
      setMessagesByRoom(prev => ({
        ...prev,
        [roomId]: []
      }));
    }
  }, []);

  const switchRoom = useCallback(async (roomId: string) => {
    if (!roomId) {
      console.error('Attempted to switch to invalid room ID:', roomId);
      return;
    }
    
    console.log(`switchRoom called with room ID: ${roomId}, current room: ${currentRoomId}`);
    
    if (switchingRoom.current) {
      console.log('Already switching rooms, ignoring request');
      return;
    }

    if (roomId === currentRoomId) {
      console.log(`Already in room ${roomId}, no need to switch`);
      return;
    }
    
    try {
      switchingRoom.current = true;
      console.log(`Switching from room ${currentRoomId} to ${roomId}`);
      
      setCurrentRoomId(roomId);
      
      await chatService.updateCurrentRoom(roomId);
      
      if (!messagesByRoom[roomId]) {
        await loadRoomHistory(roomId);
      }
      
      console.log(`Successfully switched to room ${roomId}`);
    } catch (error) {
      console.error(`Error switching to room ${roomId}:`, error);
    } finally {
      switchingRoom.current = false;
    }
  }, [currentRoomId, loadRoomHistory, messagesByRoom]);

  const connect = useCallback(async (username: string) => {
    if (connectionInProgress.current || isConnected) {
      console.log('Connection already in progress or already connected');
      return;
    }
    
    try {
      connectionInProgress.current = true;
      console.log(`Connecting as user: ${username}, target room: ${currentRoomId}`);
      
      // Store the username in the ref for later use
      currentUsername.current = username;
      
      await chatService.startConnection(username, currentRoomId);
      setIsConnected(true);
      addActiveUser(username);

      if (!messagesByRoom[currentRoomId] || messagesByRoom[currentRoomId].length === 0) {
        await loadRoomHistory(currentRoomId);
      }

      if (!eventHandlersRegistered.current) {
        chatService.onReceiveMessage((message) => {
          console.log(`Received message for room ${message.chatId}:`, message);
          
          setMessagesByRoom(prev => {
            const roomMessages = prev[message.chatId] || [];
            
            if (roomMessages.some(m => m.id === message.id)) {
              console.log(`Message with ID ${message.id} already exists in room ${message.chatId}, ignoring`);
              return prev;
            }
            
            const updatedRoomMessages = [...roomMessages, message];
            
            return {
              ...prev,
              [message.chatId]: updatedRoomMessages
            };
          });
        });

        chatService.onUserJoined((username) => {
          addActiveUser(username);
        });

        chatService.onUserLeft((username) => {
          removeActiveUser(username);
        });

        eventHandlersRegistered.current = true;
      }
    } catch (error) {
      console.error('Failed to connect to chat hub:', error);
      setIsConnected(false);
    } finally {
      connectionInProgress.current = false;
    }
  }, [currentRoomId, loadRoomHistory, isConnected, messagesByRoom]);

  const disconnect = useCallback(async () => {
    if (!isConnected) return;
    
    try {
      await chatService.stopConnection();
      setIsConnected(false);
      eventHandlersRegistered.current = false;
    } catch (error) {
      console.error('Error disconnecting from chat hub:', error);
    }
  }, [isConnected]);

  const sendMessage = useCallback(async (content: string, username: string, file?: File | null) => {
    if (!content && !file) {
      console.warn('Attempted to send an empty message without a file.');
      return;
    }

    // Always use the stored username ref for consistency
    const userId = currentUsername.current;
    
    if (!userId) {
        console.error('Cannot send message: No user ID available. Try reconnecting.');
        return;
    }

    try {
      if (isConnected) {
        console.log(`Sending message/file to room ${currentRoomId} as user ${userId}...`);
        
        // IMPORTANT: Use the same user ID for both senderId and senderName
        // to ensure backend validation passes - they must match exactly
        await chatService.sendMessage(
          content, 
          userId,  // senderId - must match the user_id header
          userId,  // senderName - keep consistent with senderId
          file
        );
        
        console.log(`Message/file sent via HTTP POST as user ${userId}. Waiting for WebSocket broadcast.`);
        
      } else {
        console.error('Cannot send message: Not connected.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [isConnected, currentRoomId]);

  const addActiveUser = useCallback((username: string) => {
    setActiveUsers((prev) => {
      if (!prev.includes(username)) {
        return [...prev, username];
      }
      return prev;
    });
  }, []);

  const removeActiveUser = useCallback((username: string) => {
    setActiveUsers((prev) => prev.filter((user) => user !== username));
  }, []);

  const loggedRoomsRef = useRef<Record<string, boolean>>({});
  
  useEffect(() => {
    if (!loggedRoomsRef.current[currentRoomId]) {
      const availableRooms = Object.keys(messagesByRoom);
      console.log(`Available rooms (${availableRooms.length}):`, availableRooms);
      
      const currentMessages = messagesByRoom[currentRoomId] || [];
      console.log(`Current room ${currentRoomId} has ${currentMessages.length} messages`);
      
      loggedRoomsRef.current[currentRoomId] = true;
      
      setTimeout(() => {
        if (loggedRoomsRef.current[currentRoomId]) {
          loggedRoomsRef.current[currentRoomId] = false;
        }
      }, 5000);
    }
  }, [messagesByRoom, currentRoomId]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <ChatContext.Provider value={{ 
      messages, 
      sendMessage, 
      activeUsers, 
      addActiveUser, 
      removeActiveUser,
      connect,
      disconnect,
      isConnected,
      currentRoomId,
      switchRoom
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
