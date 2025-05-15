"""
Authentication endpoints for the Azure Chat application.
This module handles user registration, login, and email verification.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
import uuid
import secrets
import logging
import socket
import os
from typing import Dict, List, Optional
from fastapi.responses import RedirectResponse

from src.models import User
from src.auth_utils import hash_password, verify_password
from src.state import db, active_users

# Get logger for this module
logger = logging.getLogger("azure-chat.auth")

# Define authentication models
from pydantic import BaseModel

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: Optional[str]
    last_login: Optional[str]

# Create router for auth endpoints
router = APIRouter(prefix="/api/auth", tags=["authentication"])

def generate_verification_token() -> str:
    """Generate a secure verification token for email verification."""
    return secrets.token_urlsafe(32)

@router.post("/register", response_model=UserResponse)
async def register_user(user_data: UserRegister):
    """Register a new user with email, username and password."""
    # Validate input
    if len(user_data.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Generate verification token
    verification_token = generate_verification_token()
    
    # Create user object with hashed password
    user = User(
        id=str(uuid.uuid4()),
        username=user_data.username,
        email=user_data.email,
        password=hash_password(user_data.password),
        created_at=datetime.utcnow().isoformat(),
        email_confirmed=False,
        email_verification_token=verification_token,
        email_verification_sent_at=datetime.utcnow().isoformat()
    )
    
    # Save user to database
    created_user = await db.create_user(user)
    if not created_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Add to active users
    active_users[created_user.id] = created_user
    
    # Email will be sent via the Azure Function triggered by Cosmos DB change feed
    
    # Return user data (excluding password)
    return UserResponse(
        id=created_user.id,
        username=created_user.username,
        email=created_user.email,
        created_at=created_user.created_at,
        last_login=created_user.last_login
    )

@router.post("/login", response_model=UserResponse)
async def login_user(login_data: UserLogin):
    """Authenticate a user with email and password."""
    # Get user by email
    user = await db.get_user_by_email(login_data.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(login_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if email is confirmed
    if not getattr(user, 'email_confirmed', False):
        raise HTTPException(status_code=403, detail="Email not verified. Please check your inbox for verification email.")
    
    # Update last login timestamp
    await db.update_user_last_login(user.id)
    
    # Add to active users
    active_users[user.id] = user
    logger.info(f"👤 USER LOGIN: {user.username} (ID: {user.id})")
    
    # Return user data (excluding password)
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        last_login=user.last_login
    )

@router.get("/verify-email/{token}")
async def verify_email(token: str):
    """Verify a user's email using the provided verification token."""
    verification_result = await db.verify_email(token)
    
    if verification_result["success"]:
        # Log the successful account activation
        logger.info(f"Activating user account: {verification_result['user_id']} (email: {verification_result['email']})")
        
        return {"success": True, "message": "Email verified successfully"}
    else:
        return {"success": False, "message": "Invalid or expired verification token"}

@router.get("/verify-email-redirect/{token}")
async def verify_email_redirect(token: str):
    """Verify a user's email and redirect to the frontend app.
    This endpoint is specifically designed for static website hosting in Azure Blob Storage
    where client-side routing doesn't work for direct URL access.
    """
    # Get frontend URL from environment variable with better local development fallback
    # In local development, check for FRONTEND_URL, then use localhost with common frontend ports
    if os.getenv("FRONTEND_URL"):
        frontend_url = os.getenv("FRONTEND_URL")
    elif db.dev_mode:
        # In dev mode, try common frontend development ports
        frontend_url = "http://localhost:3000"  # Default for React/Next.js
        # Check if we can connect to the frontend at different ports
        for port in [3000, 5173, 8080, 4200]:  # Common ports for React, Vite, Vue, Angular
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            if result == 0:  # Port is open
                frontend_url = f"http://localhost:{port}"
                logger.debug(f"Detected frontend running at {frontend_url}")
                break
    else:
        # Production fallback
        frontend_url = "https://chat.azure.sandnabba.se"
    
    logger.info(f"Using frontend URL for redirect: {frontend_url}")
    
    if not token:
        # If no token is provided, redirect to frontend with error parameter
        return RedirectResponse(f"{frontend_url}/?verification=error&reason=missing-token")
    
    try:
        # Verify the token using the same logic as the regular endpoint
        verification_result = await db.verify_email(token)
        
        if verification_result["success"]:
            # Log the successful account activation
            logger.info(f"Activating user account: {verification_result['user_id']} (email: {verification_result['email']})")
            # Redirect to frontend with success parameter
            return RedirectResponse(f"{frontend_url}/?verification=success")
        else:
            # Redirect to frontend with error parameter
            return RedirectResponse(f"{frontend_url}/?verification=error&reason=invalid-token")
    except Exception as e:
        logger.error(f"Error during email verification redirect: {e}")
        # Redirect to frontend with error parameter
        return RedirectResponse(f"{frontend_url}/?verification=error&reason=server-error")
