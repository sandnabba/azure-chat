"""
Chat message endpoints for the Azure Chat application.
This module handles sending and retrieving messages in chat rooms.
"""
from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
import uuid
import logging
from typing import List, Optional
from datetime import datetime

from src.models import ChatMessage
from src.state import db, active_users, active_connections, user_subscriptions, storage_service

# Get logger for this module
logger = logging.getLogger("azure-chat.messages")

# Create router for message endpoints
router = APIRouter(tags=["messages"])

@router.get("/api/rooms/{room_id}/messages", response_model=List[ChatMessage])
async def get_chat_messages(room_id: str, limit: int = 50):
    """Get recent messages for a specific chat room."""
    messages = await db.get_messages_by_room(room_id, limit)
    return messages

@router.get("/api/rooms/{room_id}/history", response_model=List[ChatMessage])
async def get_chat_history(room_id: str, limit: int = 50):
    """Fetch the chat history for a specific room."""
    try:
        messages = await db.get_messages_by_room(room_id, limit)
        return messages
    except Exception as e:
        logger.error(f"Error fetching chat history for room {room_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")

@router.post("/api/rooms/{room_id}/messages", response_model=ChatMessage)
async def send_message(
    room_id: str, 
    senderId: str = Form(...),
    senderName: str = Form(...),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user_id: str = Header(None),
    x_user_id: str = Header(None)
):
    """Send a message to a chat room."""
    # Enhanced auth check - try both header formats
    # First check x_user_id header (FastAPI converts X-User-Id to x_user_id)
    effective_user_id = x_user_id if x_user_id else user_id
    
    if not effective_user_id:
        logger.warning("Auth failed: No user ID header found (tried both user_id and X-User-Id)")
        raise HTTPException(status_code=401, detail="Missing user_id header")
    
    # For debugging
    logger.debug(f"Received headers - user_id: {user_id}, X-User-Id: {x_user_id}")
    logger.debug(f"Using effective user ID: {effective_user_id}")
    logger.debug(f"Form data senderId: {senderId}")
    
    # Verify the user exists - check database if not in active_users
    if effective_user_id not in active_users:
        # Try to find user in database
        logger.debug(f"User {effective_user_id} not found in active_users, checking database...")
        db_user = await db.get_user_by_id(effective_user_id)
        
        if db_user:
            # User found in database, add to active_users
            logger.info(f"User {effective_user_id} found in database: {db_user.username}")
            active_users[effective_user_id] = db_user
        else:
            # User not found in database either, reject request
            logger.warning(f"HTTP request rejected: User {effective_user_id} not registered")
            raise HTTPException(status_code=401, detail="Unauthorized: User not registered")
    
    # Check if senderId matches the effective_user_id header
    if effective_user_id != senderId:
        logger.warning(f"Warning: user_id in header ({effective_user_id}) doesn't match senderId in form data ({senderId})")
        raise HTTPException(status_code=401, detail="Unauthorized or senderId mismatch")

    attachment_url = None
    attachment_filename = None

    if file:
        if not storage_service.blob_service_client:
            raise HTTPException(status_code=500, detail="Azure Storage not configured")
        
        # Read file content
        file_content = await file.read()
        # Upload file
        attachment_url = await storage_service.upload_file(file_content, file.filename)
        
        if not attachment_url:
            raise HTTPException(status_code=500, detail="Failed to upload file")
        attachment_filename = file.filename
        logger.info(f"Uploaded file {attachment_filename} to {attachment_url}")

    # Ensure either content or a file is provided
    if not content and not attachment_url:
        raise HTTPException(status_code=400, detail="Message must have content or an attachment.")

    # Use the sender's username from active_users, not what was submitted in the form
    user_info = active_users.get(effective_user_id)
    if not user_info:
        raise HTTPException(status_code=401, detail="User not found in active users")
    
    message = ChatMessage(
        id=str(uuid.uuid4()),
        chatId=room_id,
        senderId=senderId,
        senderName=user_info.username,  # Use username from active_users
        content=content,
        timestamp=datetime.utcnow().isoformat(),
        type="file" if attachment_url else "text",
        attachmentUrl=attachment_url,
        attachmentFilename=attachment_filename
    )
    
    # Save to database
    saved_message = await db.create_message(message)
    
    # Broadcast message via WebSocket to subscribed users
    logger.debug(f"Broadcasting HTTP message to room {room_id}")
    broadcast_payload = {
        "type": "message",
        "data": saved_message.dict()
    }
    for user_id_in_room, subscribed_rooms in user_subscriptions.items():
        if room_id in subscribed_rooms and user_id_in_room in active_connections:
            try:
                await active_connections[user_id_in_room].send_json(broadcast_payload)
                logger.debug(f"Sent HTTP message to client {user_id_in_room} for room {room_id}")
            except Exception as e:
                logger.error(f"Error sending HTTP message to client {user_id_in_room}: {e}")

    return saved_message
