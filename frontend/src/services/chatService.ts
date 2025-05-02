import { ChatMessage } from '../types/chat';

export class ChatService {
  private connection: WebSocket | null = null;
  private readonly apiBaseUrl: string;
  private readonly wsBaseUrl: string;
  private messageCallbacks: ((message: ChatMessage) => void)[] = [];
  private userJoinedCallbacks: ((username: string) => void)[] = [];
  private userLeftCallbacks: ((username: string) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000; // 2 seconds initial delay
  private reconnectTimeoutId: number | null = null;
  private currentRoomId: string = 'general';
  private currentUsername: string = '';
  private currentUserId: string = '';
  private roomChangeInProgress = false;

  constructor(baseUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:8000') {
    // Set API base URL for HTTP requests
    this.apiBaseUrl = baseUrl.replace(/\/$/, '');

    // Set WebSocket base URL for WebSocket connections
    if (baseUrl.includes('azurewebsites.net')) {
      this.wsBaseUrl = baseUrl.replace(/^http:\/\//, 'wss://').replace(/^https:\/\//, 'wss://').replace(/\/$/, '');
    } else {
      this.wsBaseUrl = baseUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://').replace(/\/$/, '');
    }

    console.log('API Base URL:', this.apiBaseUrl);
    console.log('WebSocket Base URL:', this.wsBaseUrl);
  }

  public async startConnection(userId: string, username: string, roomId: string = 'general'): Promise<void> {
    // Reset reconnect attempts on new connection
    this.reconnectAttempts = 0;
    
    // Store current user and room
    this.currentUserId = userId;
    this.currentUsername = username;
    this.currentRoomId = roomId;

    try {
      // Close any existing connection first
      await this.cleanupExistingConnection();

      // Create WebSocket URL with the specified room and userId
      const wsUrl = `${this.wsBaseUrl}/ws/${roomId}/${userId}`;
      console.log(`Connecting to WebSocket at: ${wsUrl} (Username: ${username})`);

      this.connection = new WebSocket(wsUrl);

      // Set up WebSocket event handlers with better error handling
      this.connection.onopen = this.handleOpen.bind(this);
      this.connection.onclose = this.handleClose.bind(this, userId);
      this.connection.onerror = this.handleError.bind(this);
      this.connection.onmessage = this.handleMessage.bind(this);

      // Return a promise that resolves when the connection is open or rejects on error
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

        // Add a timeout to prevent hanging if connection never establishes
        setTimeout(() => {
          if (this.connection?.readyState !== WebSocket.OPEN) {
            this.connection?.removeEventListener('open', openHandler);
            this.connection?.removeEventListener('error', errorHandler);
            reject(new Error('WebSocket connection timed out'));
          }
        }, 10000); // 10 second timeout
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      throw error;
    }
  }

  /**
   * Update the current room ID - for this backend implementation we need to reconnect
   * to properly join a different room's WebSocket.
   */
  public async updateCurrentRoom(roomId: string): Promise<void> {
    if (roomId === this.currentRoomId) {
      return; // No change needed
    }
    
    if (this.roomChangeInProgress) {
      console.log('Room change already in progress, skipping');
      return;
    }

    try {
      this.roomChangeInProgress = true;
      console.log(`Switching WebSocket connection from room ${this.currentRoomId} to ${roomId}`);
      
      // With the current backend implementation, we need to reconnect to a new WebSocket
      // for each room to ensure messages are properly routed
      await this.startConnection(this.currentUserId, this.currentUsername, roomId);
      
      console.log(`Successfully connected to new room: ${roomId}`);
    } catch (error) {
      console.error(`Error switching to room ${roomId}:`, error);
      
      // If reconnection fails, keep the current room
      this.currentRoomId = roomId;
    } finally {
      this.roomChangeInProgress = false;
    }
  }

  public async switchRoom(roomId: string): Promise<void> {
    return this.updateCurrentRoom(roomId);
  }

  private handleOpen(event: Event) {
    console.log(`Connected to WebSocket for room ${this.currentRoomId}!`, event);
    // Reset reconnect attempts on successful connection
    this.reconnectAttempts = 0;
  }

  private handleClose(userId: string, event: CloseEvent) {
    console.log(`Disconnected from WebSocket service. Code: ${event.code} Reason: ${event.reason}`);

    // Only try to reconnect on abnormal closure and if we haven't exceeded max attempts
    if (event.code === 1006 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect(userId);
    }
  }

  private handleError(event: Event) {
    console.error('WebSocket Error:', event);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      console.log('Received WebSocket message:', message);

      // Handle different message types
      if (message.type === 'message' && message.data) {
        // Ensure the message has the correct room ID
        if (message.data.chatId && message.data.chatId !== this.currentRoomId) {
          console.log(`Warning: Received message for room ${message.data.chatId} but we're in ${this.currentRoomId}`);
        }
        
        this.messageCallbacks.forEach(callback => callback(message.data));
      } else if (message.type === 'user_joined') {
        this.userJoinedCallbacks.forEach(callback => callback(message.username));
      } else if (message.type === 'user_left') {
        this.userLeftCallbacks.forEach(callback => callback(message.username));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }

  private async cleanupExistingConnection(): Promise<void> {
    // Clear any pending reconnect attempts
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    // Close existing connection if any
    if (this.connection) {
      // Remove all event listeners to prevent potential memory leaks
      this.connection.onopen = null;
      this.connection.onclose = null;
      this.connection.onerror = null;
      this.connection.onmessage = null;

      // Only close if not already closed
      if (this.connection.readyState !== WebSocket.CLOSED &&
          this.connection.readyState !== WebSocket.CLOSING) {
        try {
          this.connection.close();
        } catch (e) {
          console.error('Error closing existing connection:', e);
        }
      }
      this.connection = null;
    }
  }

  private scheduleReconnect(userId: string): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms...`);

    this.reconnectTimeoutId = window.setTimeout(async () => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      try {
        await this.startConnection(userId, this.currentUsername, this.currentRoomId);
        console.log('Reconnection successful!');
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }

  public async stopConnection(): Promise<void> {
    await this.cleanupExistingConnection();
    console.log('Connection stopped');
  }

  public onReceiveMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  public onUserJoined(callback: (username: string) => void): void {
    this.userJoinedCallbacks.push(callback);
  }

  public onUserLeft(callback: (username: string) => void): void {
    this.userLeftCallbacks.push(callback);
  }

  public async sendMessage(content: string, senderId: string, senderName: string, file?: File | null): Promise<ChatMessage> {
    if (!this.currentRoomId) {
      throw new Error('Cannot send message: No active room selected.');
    }
    if (!senderId || !senderName) {
      throw new Error('Cannot send message: Sender information missing.');
    }
    if (!content && !file) {
      throw new Error('Cannot send message: Message must have content or a file.');
    }

    const formData = new FormData();
    // Make sure sender ID is clean (trimmed, no extra spaces)
    const cleanSenderId = senderId.trim();
    
    formData.append('senderId', cleanSenderId);
    formData.append('senderName', senderName);
    // Only append content if it's not empty
    if (content) {
      formData.append('content', content);
    }
    // Append file if it exists
    if (file) {
      formData.append('file', file, file.name);
    }

    const url = `${this.apiBaseUrl}/api/rooms/${this.currentRoomId}/messages`;
    console.log(`Sending message via POST to ${url}`);

    try {
      // Ensure WebSocket is connected before sending HTTP request
      if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
        console.log("WebSocket connection not established, attempting to reconnect");
        try {
          await this.startConnection(this.currentUserId, senderName, this.currentRoomId);
          console.log("Successfully established WebSocket connection before sending message");
        } catch (wsError) {
          console.warn("Failed to establish WebSocket connection, attempting to send message anyway", wsError);
        }
      }
      
      // Use the X-User-Id header format which is more likely to be properly handled by browsers
      console.log(`Setting X-User-Id header to: "${cleanSenderId}"`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          // Use standardized X- prefix header to avoid browser restrictions
          'X-User-Id': cleanSenderId
        },
        body: formData,
      });

      if (!response.ok) {
        let errorDetail = 'Unknown error';
        try {
          const errorText = await response.text();
          console.error('Error response text:', errorText);
          errorDetail = errorText;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(`Failed to send message: ${response.statusText} - ${errorDetail}`);
      }

      const savedMessage: ChatMessage = await response.json();
      console.log('Message sent successfully via HTTP:', savedMessage);
      
      return savedMessage;

    } catch (error) {
      console.error('Error sending message via HTTP:', error);
      throw error; // Re-throw the error to be caught by the component
    }
  }

  public async fetchChatHistory(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/rooms/${roomId}/history?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch chat history: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return []; // Return empty array on error instead of throwing
    }
  }
}

export const chatService = new ChatService();
export default chatService;
