import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ChatService } from '../services/chatService';
import { User, ChatMessage } from '../types/chat';

export interface ChatContextType {
  messagesByRoom: Record<string, ChatMessage[]>;
  activeUsersByRoom: Record<string, User[]>;
  currentRoomId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  subscribedRooms: Set<string>;
  unreadMessages: Record<string, number>;
  error: string | null;
  connect: (userId: string, username: string) => Promise<void>;
  disconnect: () => void;
  sendMessage: (payload: { content: string; file?: File | null }) => Promise<void>;
  setCurrentRoomId: (roomId: string | null) => void;
  markRoomAsRead: (roomId: string) => void;
  loadHistory: (roomId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

const DEFAULT_ROOM_ID = 'general';

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const chatServiceRef = useRef<ChatService | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const messagesByRoomRef = useRef(messagesByRoom);

  const [activeUsersByRoom, setActiveUsersByRoom] = useState<Record<string, User[]>>({});
  const activeUsersByRoomRef = useRef(activeUsersByRoom);

  const [currentRoomId, setCurrentRoomIdInternal] = useState<string | null>(null);
  const currentRoomIdRef = useRef(currentRoomId);

  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(isConnected);

  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const unreadMessagesRef = useRef(unreadMessages);

  const [subscribedRooms, setSubscribedRoomsState] = useState<Set<string>>(new Set());
  const subscribedRoomsRef = useRef(subscribedRooms);

  const loadingHistoryRef = useRef<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef(error);

  const isConnectingRef = useRef(false);
  const currentUsernameRef = useRef<string | null>(null);

  useEffect(() => {
    messagesByRoomRef.current = messagesByRoom;
    activeUsersByRoomRef.current = activeUsersByRoom;
    currentRoomIdRef.current = currentRoomId;
    isConnectedRef.current = isConnected;
    unreadMessagesRef.current = unreadMessages;
    subscribedRoomsRef.current = subscribedRooms;
    errorRef.current = error;
  }, [messagesByRoom, activeUsersByRoom, currentRoomId, isConnected, unreadMessages, subscribedRooms, error]);

  if (!chatServiceRef.current) {
    chatServiceRef.current = new ChatService();
  }

  const setMessagesByRoomRef = useCallback((updater: (prev: Record<string, ChatMessage[]>) => Record<string, ChatMessage[]>) => {
    const newMessages = updater(messagesByRoomRef.current);
    messagesByRoomRef.current = newMessages;
    setMessagesByRoom(newMessages);
  }, []);

  const setActiveUsersByRoomRef = useCallback((updater: (prev: Record<string, User[]>) => Record<string, User[]>) => {
    const newUsers = updater(activeUsersByRoomRef.current);
    activeUsersByRoomRef.current = newUsers;
    setActiveUsersByRoom(newUsers);
  }, []);

  const setUnreadMessagesRef = useCallback((updater: (prev: Record<string, number>) => Record<string, number>) => {
    const newUnread = updater(unreadMessagesRef.current);
    unreadMessagesRef.current = newUnread;
    setUnreadMessages(newUnread);
  }, []);

  const setSubscribedRoomsRef = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const newSubscribedRooms = updater(subscribedRoomsRef.current);
    subscribedRoomsRef.current = newSubscribedRooms;
    setSubscribedRoomsState(newSubscribedRooms);
  }, []);

  const markRoomAsRead = useCallback((roomId: string) => {
    setUnreadMessagesRef(prev => ({ ...prev, [roomId]: 0 }));
  }, [setUnreadMessagesRef]);

  const loadHistory = useCallback(async (roomId: string) => {
    const cs = chatServiceRef.current;
    if (loadingHistoryRef.current[roomId] || !cs) return;
    console.log(`[ChatContext] Loading history for room ${roomId}`);
    loadingHistoryRef.current[roomId] = true;
    try {
      const history = await cs.fetchChatHistory(roomId);
      setMessagesByRoomRef(prev => ({
        ...prev,
        [roomId]: history.sort((a: ChatMessage, b: ChatMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      }));
    } catch (err: any) {
      console.error(`[ChatContext] Failed to load history for room ${roomId}:`, err);
      setError(`Failed to load history for ${roomId}. ${err.message || ''}`);
    } finally {
      loadingHistoryRef.current[roomId] = false;
    }
  }, [setMessagesByRoomRef]);

  const setCurrentRoomId = useCallback((roomId: string | null) => {
    const cs = chatServiceRef.current;
    if (!cs) {
      console.warn("[ChatContext] setCurrentRoomId called before ChatService is initialized.");
      if (roomId !== null) setCurrentRoomIdInternal(roomId);
      return;
    }

    if (roomId === null) {
      setCurrentRoomIdInternal(null);
      currentRoomIdRef.current = null;
      return;
    }

    if (currentRoomIdRef.current === roomId && cs.isSubscribedTo(roomId)) {
      console.log(`[ChatContext] setCurrentRoomId: Already in room ${roomId} and subscribed.`);
      markRoomAsRead(roomId);
      if (messagesByRoomRef.current[roomId] === undefined && !loadingHistoryRef.current[roomId]) {
        loadHistory(roomId);
      }
      return;
    }

    console.log(`[ChatContext] setCurrentRoomId: Switching to room ${roomId}`);
    setCurrentRoomIdInternal(roomId);
    markRoomAsRead(roomId);

    if (isConnectedRef.current) {
      if (!cs.isSubscribedTo(roomId)) {
        console.log(`[ChatContext] setCurrentRoomId: Not subscribed to ${roomId} via ChatService. Subscribing...`);
        cs.subscribeToRoom(roomId)
          .then(() => {
            console.log(`[ChatContext] setCurrentRoomId: Successfully subscribed to ${roomId}.`);
          })
          .catch((err: Error) => {
            console.error(`[ChatContext] setCurrentRoomId: Failed to subscribe to ${roomId}:`, err);
            setError(`Failed to subscribe to room ${roomId}. ${err.message}`);
          });
      } else {
        console.log(`[ChatContext] setCurrentRoomId: Already subscribed to ${roomId} via ChatService. Loading history if needed.`);
        if (messagesByRoomRef.current[roomId] === undefined && !loadingHistoryRef.current[roomId]) {
          loadHistory(roomId);
        }
      }
    } else {
      console.warn(`[ChatContext] setCurrentRoomId: Called for ${roomId} but not connected. Subscription will be attempted on connection.`);
    }
  }, [markRoomAsRead, loadHistory]);

  const handleConnected = useCallback(() => {
    console.log("[ChatContext] WebSocket connected (handleConnected callback).");
    isConnectedRef.current = true;
    setIsConnected(true);
    setError(null);
    isConnectingRef.current = false;

    const roomToActivate = currentRoomIdRef.current || DEFAULT_ROOM_ID;
    console.log(`[ChatContext] handleConnected: Activating room: ${roomToActivate}`);
    setCurrentRoomId(roomToActivate);
  }, [setCurrentRoomId]);

  const handleDisconnected = useCallback((reason?: string) => {
    console.log(`[ChatContext] WebSocket disconnected. Reason: ${reason}`);
    isConnectedRef.current = false;
    setIsConnected(false);
    isConnectingRef.current = false;
  }, []);

  const handleSubscribed = useCallback((roomId: string) => {
    console.log(`[ChatContext] Successfully subscribed to room: ${roomId}`);
    setSubscribedRoomsRef(prev => new Set(prev).add(roomId));
    if (messagesByRoomRef.current[roomId] === undefined && !loadingHistoryRef.current[roomId]) {
      loadHistory(roomId);
    }
    if (currentRoomIdRef.current === roomId) {
      markRoomAsRead(roomId);
    }
  }, [loadHistory, markRoomAsRead, setSubscribedRoomsRef]);

  const handleUnsubscribed = useCallback((roomId: string) => {
    console.log(`[ChatContext] Unsubscribed from room: ${roomId}`);
    setSubscribedRoomsRef(prev => {
      const newSet = new Set(prev);
      newSet.delete(roomId);
      return newSet;
    });
  }, [setSubscribedRoomsRef]);

  const handleSubscriptionError = useCallback((roomId: string, err: Error) => {
    console.error(`[ChatContext] Subscription error for room ${roomId}:`, err);
    setError(`Failed to subscribe to room ${roomId}: ${err.message}`);
  }, []);

  const handleReceiveMessage = useCallback((incomingMessage: ChatMessage | any) => {
    console.log("[ChatContext] Raw incoming message:", incomingMessage);

    const roomIdentifier = incomingMessage.chatId || incomingMessage.roomId;

    if (!roomIdentifier) {
      console.error("[ChatContext] Received message lacks a room identifier (chatId/roomId):", incomingMessage);
      return;
    }

    const conformedMessage: ChatMessage = {
      ...incomingMessage,
      roomId: roomIdentifier,
    };

    if (incomingMessage.chatId && incomingMessage.chatId !== incomingMessage.roomId) {
      delete (conformedMessage as any).chatId;
    }

    console.log("[ChatContext] Processed message for state update:", conformedMessage);

    setMessagesByRoomRef(prev => {
      const existingRoomMessages = prev[roomIdentifier] || [];
      if (existingRoomMessages.some(m => m.id === conformedMessage.id)) {
        console.warn(`[ChatContext] Duplicate message ID ${conformedMessage.id} received for room ${roomIdentifier}. Ignoring.`);
        return prev;
      }
      const updatedRoomMessages = [...existingRoomMessages, conformedMessage]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      return {
        ...prev,
        [roomIdentifier]: updatedRoomMessages,
      };
    });

    if (roomIdentifier !== currentRoomIdRef.current || !document.hasFocus()) {
      setUnreadMessagesRef(prev => ({
        ...prev,
        [roomIdentifier]: (prev[roomIdentifier] || 0) + 1,
      }));
    }
  }, [setMessagesByRoomRef, setUnreadMessagesRef]);

  const handleUserJoinedRoom = useCallback((event: { roomId: string; userId: string; username: string }) => {
    console.log(`[ChatContext] User ${event.username} (${event.userId}) joined room ${event.roomId}`);
    const newUser = { id: event.userId, username: event.username };
    setActiveUsersByRoomRef(prev => {
      const roomUsers = prev[event.roomId] ? [...prev[event.roomId]] : [];
      if (!roomUsers.find(u => u.id === event.userId)) {
        roomUsers.push(newUser);
      }
      return { ...prev, [event.roomId]: roomUsers };
    });
  }, [setActiveUsersByRoomRef]);

  const handleUserLeftRoom = useCallback((event: { roomId: string; userId: string; username: string }) => {
    console.log(`[ChatContext] User ${event.username} (${event.userId}) left room ${event.roomId}`);
    setActiveUsersByRoomRef(prev => ({
      ...prev,
      [event.roomId]: prev[event.roomId]?.filter(user => user.id !== event.userId) || [],
    }));
  }, [setActiveUsersByRoomRef]);

  const connect = useCallback(async (userId: string, username: string) => {
    currentUsernameRef.current = username;

    if (!chatServiceRef.current) {
      console.warn("[ChatContext] ChatService instance was null in connect. Creating new one.");
      chatServiceRef.current = new ChatService();
    }
    const cs = chatServiceRef.current;

    if (!cs) {
      console.error("[ChatContext] ChatService is still null after attempting initialization in connect. Cannot proceed.");
      setError("Chat service could not be initialized.");
      isConnectingRef.current = false;
      return;
    }

    if (isConnectingRef.current) {
      console.log('[ChatContext] Connection attempt already in progress.');
      return;
    }

    if (cs.isConnected() && cs.getUserId() === userId) {
      console.log('[ChatContext] Already connected as the same user.');
      if (currentRoomIdRef.current) {
        setCurrentRoomId(currentRoomIdRef.current); // Ensure setCurrentRoomId is available in scope
      } else {
        setCurrentRoomId(DEFAULT_ROOM_ID);
      }
      return;
    }

    isConnectingRef.current = true;
    setError(null);
    console.log(`[ChatContext] Attempting to connect for user: ${userId}`);

    if (cs.isConnected()) {
      console.log('[ChatContext] Stopping existing connection before starting new one.');
      await cs.stopConnection();
      setIsConnected(false);
      isConnectedRef.current = false;
    }

    cs.onDisconnected(handleDisconnected);
    cs.onSubscribed(handleSubscribed);
    cs.onUnsubscribed(handleUnsubscribed);
    cs.onSubscriptionError(handleSubscriptionError);
    cs.onReceiveMessage(handleReceiveMessage);
    cs.onUserJoinedRoom(handleUserJoinedRoom);
    cs.onUserLeftRoom(handleUserLeftRoom);

    try {
      await cs.startConnection(userId, username);
      handleConnected(); 
      console.log(`[ChatContext] startConnection promise resolved for ${userId}. Connected state set via handleConnected: ${isConnectedRef.current}`);
    } catch (err: any) {
      console.error("[ChatContext] Failed to connect:", err);
      setError(err instanceof Error ? err.message : String(err));
      isConnectedRef.current = false;
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [
    handleConnected, 
    handleDisconnected, 
    handleSubscribed, 
    handleUnsubscribed, 
    handleSubscriptionError, 
    handleReceiveMessage, 
    handleUserJoinedRoom, 
    handleUserLeftRoom, 
    setCurrentRoomId // Added missing dependency
  ]);

  const disconnect = useCallback(async () => {
    console.log("[ChatContext] disconnect called");
    const cs = chatServiceRef.current;
    if (cs) {
      await cs.stopConnection();
      // Reset relevant states after disconnection
      setIsConnected(false);
      isConnectedRef.current = false;
      isConnectingRef.current = false;
      // currentRoomIdRef.current = null; // Optionally reset current room
      // setCurrentRoomIdInternal(null);
      // setSubscribedRoomsState(new Set()); // Clear subscribed rooms
      // messagesByRoomRef.current = {}; // Clear messages
      // setMessagesByRoom({});
      // activeUsersByRoomRef.current = {}; // Clear active users
      // setActiveUsersByRoom({});
    }
  }, []); // No dependencies needed if only interacting with chatServiceRef and setting state

  const sendMessage = useCallback(async (payload: { content: string; file?: File | null }) => {
    const { content, file } = payload;
    const cs = chatServiceRef.current;
    const currentRoom = currentRoomIdRef.current;
    const userId = cs?.getUserId();
    const username = currentUsernameRef.current;

    if (!currentRoom) {
      console.error("[ChatContext] Cannot send message, no current room.");
      setError("No room selected to send message.");
      throw new Error("No room selected to send message.");
    }
    if (!cs?.isConnected()) {
      console.error("[ChatContext] Cannot send message, not connected.");
      setError("Not connected to chat service.");
      throw new Error("Not connected to chat service.");
    }
    if (!userId || !username) {
      console.error("[ChatContext] Cannot send message, user details not available.");
      setError("User details missing for sending message.");
      throw new Error("User details missing for sending message.");
    }
    console.log(`[ChatContext] Sending message to room ${currentRoom}: ${content}, File: ${file?.name}`);
    try {
      await cs.sendMessage(currentRoom, content, userId, username, file || undefined);
    } catch (err) {
      console.error("[ChatContext] Error sending message:", err);
      setError(err instanceof Error ? `Failed to send message: ${err.message}` : "Failed to send message.");
      throw err;
    }
  }, []);

  useEffect(() => {
    const cs = chatServiceRef.current;
    if (currentRoomId && isConnected && cs) {
      console.log(`[ChatContext] useEffect[currentRoomId, isConnected]: Room ${currentRoomId} is active and connected. Marking as read.`);
      markRoomAsRead(currentRoomId);

      if (cs.isSubscribedTo(currentRoomId) &&
          messagesByRoomRef.current[currentRoomId] === undefined &&
          !loadingHistoryRef.current[currentRoomId]) {
        console.log(`[ChatContext] useEffect[currentRoomId, isConnected]: Safeguard: Loading history for ${currentRoomId}`);
        loadHistory(currentRoomId);
      }
    }
  }, [currentRoomId, isConnected, markRoomAsRead, loadHistory]);

  const contextValue: ChatContextType = {
    messagesByRoom,
    activeUsersByRoom,
    currentRoomId,
    isConnected,
    isConnecting: isConnectingRef.current,
    subscribedRooms,
    unreadMessages,
    error,
    connect,
    disconnect,
    sendMessage,
    setCurrentRoomId,
    markRoomAsRead,
    loadHistory,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = React.useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
