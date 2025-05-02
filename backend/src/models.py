from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class User(BaseModel):
    """User model for the chat application."""
    id: Optional[str] = None
    username: str
    email: str
    password: str  # This will store the hashed password
    created_at: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())
    last_login: Optional[str] = None
    
class Attachment(BaseModel):
    """Attachment model for chat messages."""
    url: str
    type: str
    name: str
    
class ChatMessage(BaseModel):
    """Chat message model as described in the README."""
    id: Optional[str] = None
    chatId: str
    senderId: str
    senderName: str
    content: Optional[str] = None # Content can be optional if there's an attachment
    timestamp: Optional[str] = None
    type: Optional[str] = "text"
    attachments: Optional[List[Attachment]] = None # Keep existing attachments field if needed for other metadata
    attachmentUrl: Optional[str] = None # Add field for the direct URL of the uploaded file
    attachmentFilename: Optional[str] = None # Add field for the original filename
    
class ChatRoom(BaseModel):
    """Chat room model."""
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    createdAt: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())
    isPrivate: Optional[bool] = False
    members: Optional[List[str]] = None