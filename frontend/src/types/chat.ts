export interface ChatMessage {
  id: string;
  roomId: string; // Changed from chatId to roomId for consistency
  senderId: string;
  senderName: string;
  content?: string; 
  timestamp: string;
  type?: 'text' | 'file' | 'user_joined' | 'user_left' | 'system'; // Added more types for clarity
  attachments?: {
    url: string;
    type: string;
    name: string;
  }[];
  attachmentUrl?: string; 
  attachmentFilename?: string; 
}

// Renamed ChatUser to User for consistency with Context
export interface User {
  id: string;
  username: string;
  isActive?: boolean;
  lastSeen?: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  participants: string[];
}
