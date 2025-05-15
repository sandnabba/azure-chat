"""
Chat room endpoints for the Azure Chat application.
This module handles creating, listing, and deleting chat rooms.
"""
from fastapi import APIRouter, HTTPException
import uuid
import logging
from typing import List

from src.models import ChatRoom
from src.state import db

# Get logger for this module
logger = logging.getLogger("azure-chat.rooms")

# Create router for room endpoints
router = APIRouter(prefix="/api/rooms", tags=["rooms"])

@router.get("", response_model=List[ChatRoom])
async def get_chat_rooms():
    """Get all available chat rooms."""
    rooms = await db.get_chat_rooms()
    if not rooms:
        general_room = ChatRoom(
            id="general",
            name="General",
            description="Public chat room for everyone"
        )
        await db.create_chat_room(general_room)
        rooms = [general_room]
    return rooms

@router.post("", response_model=ChatRoom)
async def create_chat_room(room: ChatRoom):
    """Create a new chat room."""
    # Generate room ID if not provided
    if not room.id:
        room.id = str(uuid.uuid4())
    
    # Save to database
    created_room = await db.create_chat_room(room)
    
    return created_room

@router.delete("/{room_id}", response_model=dict)
async def delete_chat_room(room_id: str):
    """Delete a chat room by ID."""
    # Don't allow deletion of the general room
    if room_id == "general":
        raise HTTPException(status_code=400, detail="Cannot delete the general room")
    
    # Delete the room
    success = await db.delete_chat_room(room_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Room with ID {room_id} not found or couldn't be deleted")
    
    return {"success": True, "message": f"Room {room_id} deleted successfully"}
