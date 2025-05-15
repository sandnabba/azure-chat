"""
User management endpoints for the Azure Chat application.
This module handles creating and managing users outside of authentication.
"""
from fastapi import APIRouter, HTTPException
import uuid
import logging

from src.models import User
from src.state import active_users, db

# Get logger for this module
logger = logging.getLogger("azure-chat.users")

# Create router for user endpoints
router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("", response_model=User)
async def create_user(user: User):
    """Create a new user (primarily used for debug/testing)."""
    # Check if username is taken
    for existing_user in active_users.values():
        if existing_user.username.lower() == user.username.lower():
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Generate user ID if not provided
    if not user.id:
        user.id = str(uuid.uuid4())
    
    active_users[user.id] = user
    return user
