import { ChatMessage } from '../types/chat';
import { getApiBaseUrl, getWebSocketBaseUrl, logApiConfig } from '../utils/apiUrls';

export class ChatService {
  private connection: WebSocket | null = null;
  private readonly apiBaseUrl: string;
  private readonly wsBaseUrl: string;
  private messageCallbacks: ((message: ChatMessage) => void)[] = [];
  private userJoinedRoomCallbacks: ((event: { roomId: string; userId: string; username: string }) => void)[] = [];
  private userLeftRoomCallbacks: ((event: { roomId: string; userId: string; username: string }) => void)[] = [];
  private subscribedCallbacks: ((roomId: string) => void)[] = [];
  private unsubscribedCallbacks: ((roomId: string) => void)[] = [];
  private disconnectedCallbacks: (() => void)[] = [];
  private subscriptionErrorCallbacks: ((roomId: string, error: Error) => void)[] = []; // Added for subscription errors
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimeoutId: number | null = null; // Explicitly number for window.setTimeout
  private currentRoomId: string | null = null;
  private currentUsername: string = '';
  private currentUserId: string = '';
  private subscribedRooms: Set<string> = new Set();
  private pendingSubscriptions: Map<string, { resolve: () => void; reject: (reason?: any) => void; timeoutId: number }> = new Map();
  private roomsToResubscribe: Set<string> = new Set(); // Added for tracking rooms to resubscribe

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

  public isSubscribedTo(roomId: string): boolean {
    return this.subscribedRooms.has(roomId);
  }

  public async startConnection(userId: string, username: string): Promise<void> {
    this.reconnectAttempts = 0;
    this.currentUserId = userId;
    this.currentUsername = username;

    try {
      await this.cleanupExistingConnection();

      const wsUrl = `${this.wsBaseUrl}/ws/${userId}`;
      console.log(`Connecting to WebSocket at: ${wsUrl} (User ID: ${userId}, Username: ${username})`);

      this.connection = new WebSocket(wsUrl);

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

  public subscribeToRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
        console.error("[ChatService] WebSocket not connected. Cannot subscribe to room:", roomId);
        return reject(new Error("WebSocket not connected"));
      }

      const existingPendingSubscription = this.pendingSubscriptions.get(roomId);
      if (existingPendingSubscription) {
        console.warn(`[ChatService] Re-requesting subscription for ${roomId} while one is already pending. Clearing previous timeout. The previous request will not be resolved/rejected by this service.`);
        window.clearTimeout(existingPendingSubscription.timeoutId);
      }

      console.log(`[ChatService] Sending subscribe request for room: ${roomId}`);
      this.connection.send(JSON.stringify({ type: "subscribe", roomId }));

      const timeoutId = window.setTimeout(() => {
        console.error(`[ChatService] Subscription acknowledgement timeout for room ${roomId}.`);
        const currentPending = this.pendingSubscriptions.get(roomId);
        if (currentPending && currentPending.timeoutId === timeoutId) {
          this.pendingSubscriptions.delete(roomId);
        }
        reject(new Error(`Subscription acknowledgement timeout for room ${roomId}`));
      }, 5000);

      this.pendingSubscriptions.set(roomId, { resolve, reject, timeoutId });
    });
  }

  public unsubscribeFromRoom(roomId: string): void {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected. Cannot unsubscribe from room.');
      return;
    }
    if (!this.subscribedRooms.has(roomId)) {
      console.log(`Not subscribed to room ${roomId}, cannot unsubscribe.`);
      return;
    }
    console.log(`Unsubscribing from room: ${roomId}`);
    this.connection.send(JSON.stringify({ type: 'unsubscribe', roomId }));
  }

  public async switchRoom(newRoomId: string): Promise<void> {
    if (newRoomId === this.currentRoomId && this.subscribedRooms.has(newRoomId)) {
      console.log(`Already in room ${newRoomId} and subscribed.`);
      return;
    }

    console.log(`Switching room from ${this.currentRoomId || 'none'} to ${newRoomId}`);

    if (this.currentRoomId && this.subscribedRooms.has(this.currentRoomId)) {
      this.unsubscribeFromRoom(this.currentRoomId);
    }

    this.subscribeToRoom(newRoomId);
    this.currentRoomId = newRoomId;
  }

  private handleOpen(event: Event) {
    console.log(`WebSocket connection opened for user ${this.currentUserId}!`, event);
    this.reconnectAttempts = 0;
    if (this.reconnectTimeoutId !== null) {
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.subscribedRooms.forEach(roomId => {
      console.log(`Re-subscribing to ${roomId} after connection re-established.`);
      this.subscribeToRoom(roomId);
    });
    if (this.currentRoomId && !this.subscribedRooms.has(this.currentRoomId)) {
      this.subscribeToRoom(this.currentRoomId);
    } else if (!this.currentRoomId && this.subscribedRooms.size === 0) {
      console.log('No current room or subscriptions, defaulting to subscribe to "general"');
      this.subscribeToRoom('general');
    }
    this.roomsToResubscribe.forEach(roomId => {
      if (!this.isSubscribedTo(roomId)) {
        console.log(`[ChatService] Resubscribing to room ${roomId} after connection opened.`);
        this.subscribeToRoom(roomId)
          .catch(error => {
            console.error(`[ChatService] Error resubscribing to room ${roomId} via handleOpen:`, error);
            if (this.onSubscriptionErrorCallback) {
              this.onSubscriptionErrorCallback(roomId, new Error(`Resubscription failed for ${roomId}: ${error.message}`));
            }
          });
      }
    });
  }

  private handleClose(event: CloseEvent) {
    console.log(`Disconnected from WebSocket service. User: ${this.currentUserId}, Code: ${event.code}, Reason: ${event.reason}`);
    this.disconnectedCallbacks.forEach(callback => callback());
    if (event.code !== 1000 && event.code !== 1005 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (event.code === 1000) {
      console.log("WebSocket closed normally.");
    } else {
      console.log("WebSocket closed. Max reconnect attempts reached or normal closure without status.");
    }
  }

  private handleError(event: Event) {
    console.error('WebSocket Error:', event);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      console.log('Received WebSocket message:', message);

      switch (message.type) {
        case 'message':
          if (message.data && message.data.chatId) {
            this.messageCallbacks.forEach(callback => callback(message.data as ChatMessage));
          } else {
            console.warn('Received message without data or chatId:', message);
          }
          break;
        case 'user_joined_room':
          if (message.roomId && message.userId && message.username) {
            this.userJoinedRoomCallbacks.forEach(callback => callback(message));
          } else {
            console.warn('Received user_joined_room without complete data:', message);
          }
          break;
        case 'user_left_room':
          if (message.roomId && message.userId && message.username) {
            this.userLeftRoomCallbacks.forEach(callback => callback(message));
          } else {
            console.warn('Received user_left_room without complete data:', message);
          }
          break;
        case 'subscription_ack': {
          const ackMessage = message as { roomId: string; status: string; details?: string };
          const subAckDetails = this.pendingSubscriptions.get(ackMessage.roomId);
          if (subAckDetails) {
            window.clearTimeout(subAckDetails.timeoutId);
            if (ackMessage.status === "subscribed") {
              console.log(`[ChatService] Subscription to ${ackMessage.roomId} acknowledged.`);
              this.subscribedRooms.add(ackMessage.roomId);
              subAckDetails.resolve();
              this.subscribedCallbacks.forEach(callback => callback(ackMessage.roomId));
            } else {
              const errorMessage = ackMessage.details || `Subscription to ${ackMessage.roomId} failed`;
              const error = new Error(errorMessage);
              console.error(`[ChatService] Subscription to ${ackMessage.roomId} failed or denied:`, errorMessage);
              subAckDetails.reject(error);
              // Invoke subscription error callbacks
              this.subscriptionErrorCallbacks.forEach(callback => callback(ackMessage.roomId, error));
            }
            this.pendingSubscriptions.delete(ackMessage.roomId);
          } else {
            console.warn(`[ChatService] Received subscription_ack for ${ackMessage.roomId}, but no pending subscription found. Might be a late ack or a re-subscription confirmation.`);
            if (ackMessage.status === "subscribed") {
              this.subscribedRooms.add(ackMessage.roomId);
              this.subscribedCallbacks.forEach(callback => callback(ackMessage.roomId));
            }
          }
          break;
        }
        case 'unsubscription_ack': {
          const unSubAckMessage = message as { roomId: string };
          this.subscribedRooms.delete(unSubAckMessage.roomId);
          console.log(`[ChatService] Unsubscription from ${unSubAckMessage.roomId} acknowledged.`);
          this.unsubscribedCallbacks.forEach(callback => callback(unSubAckMessage.roomId));
          break;
        }
        case 'error':
          console.error('Received error message from WebSocket server:', message.message);
          break;
        default:
          console.log('Received unhandled WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }

  private async cleanupExistingConnection(): Promise<void> {
    if (this.reconnectTimeoutId !== null) {
      window.clearTimeout(this.reconnectTimeoutId); // Explicitly use window.clearTimeout
      this.reconnectTimeoutId = null;
    }

    if (this.connection) {
      this.connection.onopen = null;
      this.connection.onclose = null;
      this.connection.onerror = null;
      this.connection.onmessage = null;

      if (this.connection.readyState !== WebSocket.CLOSED &&
          this.connection.readyState !== WebSocket.CLOSING) {
        try {
          console.log("Closing existing WebSocket connection.");
          this.connection.close(1000, "Client initiated new connection");
        } catch (e) {
          console.error('Error closing existing connection:', e);
        }
      }
      this.connection = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.currentUserId) {
      console.error("Cannot schedule reconnect: currentUserId is not set.");
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} for user ${this.currentUserId} in ${delay}ms...`);

    this.reconnectTimeoutId = window.setTimeout(async () => { // Explicitly use window.setTimeout
      console.log(`Attempting to reconnect user ${this.currentUserId} (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      try {
        await this.startConnection(this.currentUserId, this.currentUsername);
        console.log('Reconnection successful!');
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }

  public async stopConnection(): Promise<void> {
    if (this.reconnectTimeoutId !== null) { // Clear any pending reconnect timeout
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.subscribedRooms.forEach(roomId => {
      if (this.connection && this.connection.readyState === WebSocket.OPEN) {
        console.log(`Explicitly unsubscribing from ${roomId} during stopConnection.`);
        this.connection.send(JSON.stringify({ type: 'unsubscribe', roomId }));
      }
    });
    this.subscribedRooms.clear();
    await this.cleanupExistingConnection();
    console.log('Connection stopped and rooms unsubscribed');
    if (!this.connection) {
      this.disconnectedCallbacks.forEach(callback => callback());
    }
  }

  public onReceiveMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  public onUserJoinedRoom(callback: (event: { roomId: string; userId: string; username: string }) => void): void {
    this.userJoinedRoomCallbacks.push(callback);
  }

  public onUserLeftRoom(callback: (event: { roomId: string; userId: string; username: string }) => void): void {
    this.userLeftRoomCallbacks.push(callback);
  }

  public onSubscribed(callback: (roomId: string) => void): void {
    this.subscribedCallbacks.push(callback);
  }

  public onUnsubscribed(callback: (roomId: string) => void): void {
    this.unsubscribedCallbacks.push(callback);
  }

  public onSubscriptionError(callback: (roomId: string, error: Error) => void): void { // Added method
    this.subscriptionErrorCallbacks.push(callback);
  }

  public onDisconnected(callback: () => void): void {
    this.disconnectedCallbacks.push(callback);
  }

  public async sendMessage(roomId: string, content: string, senderId: string, senderName: string, file?: File | null): Promise<ChatMessage> {
    if (!roomId) { // Check the passed roomId
      throw new Error('Cannot send message: No active room selected. Please select a room first.');
    }
    if (!senderId || !senderName) {
      throw new Error('Cannot send message: Sender information missing.');
    }
    if (!content && !file) {
      throw new Error('Cannot send message: Message must have content or a file.');
    }

    const formData = new FormData();
    const cleanSenderId = senderId.trim();
    
    formData.append('senderId', cleanSenderId);
    formData.append('senderName', senderName);
    if (content) {
      formData.append('content', content);
    }
    if (file) {
      formData.append('file', file, file.name);
    }

    const url = `${this.apiBaseUrl}/api/rooms/${roomId}/messages`; // Use passed roomId
    console.log(`Sending message via POST to ${url} for room ${roomId}`);

    try {
      console.log(`Setting X-User-Id header to: "${cleanSenderId}"`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
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
      throw error;
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
      return [];
    }
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  public getSubscribedRooms(): Set<string> {
    return this.subscribedRooms;
  }
}

export const chatService = new ChatService();
export default chatService;
