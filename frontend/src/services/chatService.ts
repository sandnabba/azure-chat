import { ChatMessage } from '../types/chat';
import { getApiBaseUrl, getWebSocketBaseUrl, logApiConfig } from '../utils/apiUrls';

export class ChatService {
  private connection: WebSocket | null = null;
  private readonly apiBaseUrl: string;
  private readonly wsBaseUrl: string;
  private messageCallbacks: ((message: ChatMessage) => void)[] = [];
  private userJoinedRoomCallbacks: ((event: { roomId: string; userId: string; username: string }) => void)[] = [];
  private userWentOfflineCallbacks: ((event: { roomId: string; userId: string; username: string }) => void)[] = [];
  private disconnectedCallbacks: (() => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimeoutId: number | null = null; // Explicitly number for window.setTimeout
  private currentUsername: string = '';
  private currentUserId: string = '';

  constructor() {
    this.apiBaseUrl = getApiBaseUrl();
    this.wsBaseUrl = getWebSocketBaseUrl();
    logApiConfig();
  }

  public getUserId(): string | null {
    return this.currentUserId;
  }

  public getCurrentUsername(): string | null {
    return this.currentUsername;
  }

  public isConnected(): boolean {
    return this.connection !== null && this.connection.readyState === WebSocket.OPEN;
  }

  public async startConnection(userId: string, username: string): Promise<void> {
    this.reconnectAttempts = 0;
    this.currentUserId = userId;
    this.currentUsername = username;

    try {
      await this.cleanupExistingConnection();

      const wsUrl = `${this.wsBaseUrl}/ws/${userId}`;
      console.log(`Connecting to WebSocket at: ${wsUrl} (User ID: ${userId}, Username: ${username})`);

      // Create WebSocket with custom headers to authenticate the user
      this.connection = new WebSocket(wsUrl);
      
      // Store these values for reference during the connection
      this.currentUserId = userId;
      this.currentUsername = username;
      
      // Set up event handlers
      this.connection.onopen = this.handleOpen.bind(this);
      this.connection.onclose = this.handleClose.bind(this);
      this.connection.onerror = this.handleError.bind(this);
      this.connection.onmessage = this.handleMessage.bind(this);

      return new Promise((resolve, reject) => {
        if (!this.connection) {
          return reject(new Error('Connection not initialized'));
        }

        const openHandler = () => {
          console.log('WebSocket connection established successfully');
          this.connection?.removeEventListener('open', openHandler);
          this.connection?.removeEventListener('error', errorHandler);
          resolve();
        };

        const errorHandler = (event: Event) => {
          console.error('WebSocket connection failed', event);
          this.connection?.removeEventListener('open', openHandler);
          this.connection?.removeEventListener('error', errorHandler);
          reject(new Error('WebSocket connection failed'));
        };

        this.connection.addEventListener('open', openHandler);
        this.connection.addEventListener('error', errorHandler);

        setTimeout(() => {
          if (this.connection?.readyState !== WebSocket.OPEN) {
            this.connection?.removeEventListener('open', openHandler);
            this.connection?.removeEventListener('error', errorHandler);
            reject(new Error('WebSocket connection timed out'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  private async cleanupExistingConnection(): Promise<void> {
    if (this.connection) {
      console.log('Cleaning up existing connection before creating a new one');
      
      // Remove event handlers to prevent duplicate handlers
      this.connection.onopen = null;
      this.connection.onclose = null;
      this.connection.onerror = null;
      this.connection.onmessage = null;
      
      try {
        if (this.connection.readyState === WebSocket.OPEN || this.connection.readyState === WebSocket.CONNECTING) {
          // Close the connection gracefully if possible
          this.connection.close(1000, 'Normal closure, replacing connection');
        }
      } catch (e) {
        console.warn('Error closing existing connection:', e);
      }
      
      // Clear the reference
      this.connection = null;
      
      // Give the browser a moment to clean up the old connection
      // without delaying too much
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  public async stopConnection(): Promise<void> {
    if (this.reconnectTimeoutId !== null) {
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    // If we have an open connection, gracefully close it
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      console.log('Sending explicit logout notification before closing');
      
      // Send a clean closure frame after a small delay to ensure the frame gets sent
      try {
        this.connection.close(1000, "User logged out");
      } catch (e) {
        console.warn('Error during explicit connection close:', e);
      }
    }
    
    await this.cleanupExistingConnection();
    console.log('WebSocket connection stopped');
  }

  public async sendMessage(
    roomId: string, 
    content: string, 
    userId: string, 
    username: string,
    file?: File
  ): Promise<void> {
    if (!this.isConnected()) {
      console.error('Cannot send message, WebSocket not connected');
      throw new Error('WebSocket not connected');
    }

    if (file) {
      // Use HTTP POST for messages with attachments
      const formData = new FormData();
      formData.append('content', content);
      formData.append('senderId', userId);
      formData.append('senderName', username);
      formData.append('file', file);

      try {
        const response = await fetch(`${this.apiBaseUrl}/api/rooms/${roomId}/messages`, {
          method: 'POST',
          headers: {
            // Add user ID as header for authentication
            'X-User-Id': userId
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error occurred' }));
          throw new Error(`Failed to send message: ${errorData.detail || response.statusText}`);
        }
      } catch (error) {
        console.error('Error sending message with file:', error);
        throw error;
      }
    } else {
      // Use WebSocket for text-only messages
      try {
        const messageData = {
          type: 'message',
          data: {
            chatId: roomId,
            senderId: userId,
            senderName: username,
            content: content
          }
        };
        
        this.connection?.send(JSON.stringify(messageData));
      } catch (error) {
        console.error('Error sending message:', error);
        throw error;
      }
    }
  }

  public async fetchChatHistory(roomId: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/rooms/${roomId}/history`);
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }
      const history = await response.json();
      console.log(`Fetched ${history.length} messages for room ${roomId}`);
      return history;
    } catch (error) {
      console.error(`Error fetching history for ${roomId}:`, error);
      throw error;
    }
  }

  // Register callbacks
  public onReceiveMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Register a callback function to be called when a user comes online
   * With the global presence model, this is called for any user that connects to the chat
   */
  public onUserCameOnline(callback: (event: { roomId: string; userId: string; username: string }) => void): void {
    // Register callback for global user presence
    this.userJoinedRoomCallbacks.push(callback);
  }

  // Keeping the old method name for backward compatibility
  public onUserJoinedRoom(callback: (event: { roomId: string; userId: string; username: string }) => void): void {
    return this.onUserCameOnline(callback);
  }

  /**
   * Register a callback function to be called when a user leaves the chat
   * With the global presence model, this is called for any user that goes offline
   */
  public onUserWentOffline(callback: (event: { roomId: string; userId: string; username: string }) => void): void {
    // Register callback for user presence (global)
    this.userWentOfflineCallbacks.push(callback);
  }

  public onDisconnected(callback: () => void): void {
    this.disconnectedCallbacks.push(callback);
  }

  // Event handlers
  private handleOpen(event: Event): void {
    console.log('WebSocket connection opened:', event);
    this.reconnectAttempts = 0;
  }

  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} - ${event.reason || 'No reason provided'}`);
    
    // Handle authentication failures - 4001 is our custom code for unauthorized users
    if (event.code === 4001) {
      console.error('Authentication failed:', event.reason);
      // Clear local storage to force re-login
      localStorage.removeItem('chatUsername');
      localStorage.removeItem('chatUserId');
      // Don't try to reconnect for auth failures
      window.location.reload(); // Force page reload to show login screen
      return;
    }
    
    // Notify all disconnect listeners
    this.disconnectedCallbacks.forEach(callback => {
      try {
        callback();
      } catch (e) {
        console.error('Error in disconnect callback:', e);
      }
    });
    
    // Try to reconnect for abnormal closures
    if (event.code !== 1000 && event.code !== 1001) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    // Connection errors will also trigger onclose, so we'll handle reconnection there
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message:', data);
      
      if (data.type === 'message') {
        // Notify message listeners
        this.messageCallbacks.forEach(callback => {
          try {
            callback(data.data);
          } catch (e) {
            console.error('Error in message callback:', e);
          }
        });
      } else if (data.type === 'user_online') {
        // User came online in the global chat system
        const joinEvent = {
          roomId: 'global',  // Using 'global' as an identifier for global presence
          userId: data.userId,
          username: data.username
        };
        
        this.userJoinedRoomCallbacks.forEach(callback => {
          try {
            callback(joinEvent);
          } catch (e) {
            console.error('Error in user online callback:', e);
          }
        });
      } else if (data.type === 'user_offline') {
        // User went offline from the global chat system
        const leaveEvent = {
          roomId: 'global',  // Using 'global' as an identifier for global presence
          userId: data.userId,
          username: data.username
        };
        
        this.userWentOfflineCallbacks.forEach(callback => {
          try {
            callback(leaveEvent);
          } catch (e) {
            console.error('Error in user offline callback:', e);
          }
        });
      } else if (data.type === 'user_joined_room') {
        // Legacy event - map to global user presence for compatibility
        const userEvent = {
          roomId: 'global',
          userId: data.userId,
          username: data.username
        };
        
        this.userJoinedRoomCallbacks.forEach(callback => {
          try {
            callback(userEvent);
          } catch (e) {
            console.error('Error in user joined callback:', e);
          }
        });
      } else if (data.type === 'user_left_room') {
        // Legacy event - map to global user presence for compatibility
        const userEvent = {
          roomId: 'global',
          userId: data.userId,
          username: data.username
        };
        
        this.userWentOfflineCallbacks.forEach(callback => {
          try {
            callback(userEvent);
          } catch (e) {
            console.error('Error in user left callback:', e);
          }
        });
      } else if (data.type === 'error') {
        console.error('Received error from server:', data.message);
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e, 'Raw message:', event.data);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId !== null) {
      window.clearTimeout(this.reconnectTimeoutId);
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnect attempts reached. Giving up.');
      return;
    }
    
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts})...`);
      
      this.startConnection(this.currentUserId, this.currentUsername)
        .then(() => {
          console.log('Reconnection successful');
          this.reconnectAttempts = 0;
        })
        .catch(err => {
          console.error('Reconnection failed:', err);
          this.scheduleReconnect();
        });
    }, delay);
  }
}

export const chatService = new ChatService();
export default chatService;
