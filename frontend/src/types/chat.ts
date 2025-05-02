export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content?: string; // Make content optional
  timestamp: string;
  type?: 'text' | 'file'; // Type can be text or file
  attachments?: {
    url: string;
    type: string;
    name: string;
  }[];
  attachmentUrl?: string; // Add URL for the uploaded file
  attachmentFilename?: string; // Add original filename
}

export interface ChatUser {
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
