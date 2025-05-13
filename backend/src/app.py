from fastapi import FastAPI, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import uuid
from datetime import datetime
import os
from typing import Dict, List, Optional
import json
import secrets
from pydantic import BaseModel

# Change absolute imports to relative imports for better container compatibility
from src.database import CosmosDBConnection
from src.models import ChatMessage, ChatRoom, User
from src.storage import AzureStorageService  # Import the storage service
from src.auth_utils import hash_password, verify_password  # Import the password utilities

app = FastAPI(title="Azure Chat Service API")

# Add CORS middleware with more permissive settings for WebSockets
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Initialize database connection
db = CosmosDBConnection()

# Initialize Azure Storage Service
storage_service = AzureStorageService()

# Store active connections
active_connections: Dict[str, WebSocket] = {}  # userId -> websocket
user_subscriptions: Dict[str, List[str]] = {}  # userId -> List[roomId]
active_users: Dict[str, User] = {}  # userId -> User

# Authentication models
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

# Add a debug endpoint to see environment variables
@app.get("/debug")
async def debug():
    """Debug endpoint to view environment variables and connection status."""
    environment = {}
    for key, value in os.environ.items():
        # Mask sensitive values
        if 'key' in key.lower() or 'password' in key.lower() or 'secret' in key.lower() or 'connection' in key.lower():
            environment[key] = "***MASKED***"
        else:
            environment[key] = value
            
    # Add information about dev mode
    cosmos_info = {
        "dev_mode": db.dev_mode,
        "cosmos_endpoint_set": bool(os.getenv("COSMOS_ENDPOINT")),
        "cosmos_key_set": bool(os.getenv("COSMOS_KEY")),
        "database_name": db.database_name,
        "message_container": db.message_container,
    }
    
    return {
        "status": "debugging",
        "environment": environment,
        "cosmos_info": cosmos_info,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/")
async def root():
    return {"message": "Azure Chat Service API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/version")
async def get_version():
    """Return build timestamp and version information"""
    build_info = {"timestamp": datetime.utcnow().isoformat()}
    
    # Try to read build info file if it exists
    build_info_path = "/app/build_info.txt"
    if os.path.exists(build_info_path):
        try:
            with open(build_info_path, "r") as f:
                build_info_content = f.read()
                lines = build_info_content.strip().split("\n")
                for line in lines:
                    if ":" in line:
                        key, value = line.split(":", 1)
                        build_info[key.strip()] = value.strip()
        except Exception as e:
            build_info["error"] = f"Error reading build info: {str(e)}"
    else:
        build_info["build_info_available"] = False
    
    # Add Git commit info if available as environment variable
    if "GIT_COMMIT" in os.environ:
        build_info["git_commit"] = os.environ.get("GIT_COMMIT")
        
    return build_info

@app.post("/api/users", response_model=User)
async def create_user(user: User):
    # Check if username is taken
    for existing_user in active_users.values():
        if existing_user.username.lower() == user.username.lower():
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Generate user ID if not provided
    if not user.id:
        user.id = str(uuid.uuid4())
    
    active_users[user.id] = user
    return user

@app.get("/api/rooms", response_model=List[ChatRoom])
async def get_chat_rooms():
    # In a production environment, fetch from Cosmos DB
    # For now, return a default general room if none exist
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

@app.post("/api/rooms", response_model=ChatRoom)
async def create_chat_room(room: ChatRoom):
    # Generate room ID if not provided
    if not room.id:
        room.id = str(uuid.uuid4())
    
    # Save to database
    created_room = await db.create_chat_room(room)
    return created_room

@app.delete("/api/rooms/{room_id}", response_model=dict)
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

@app.get("/api/rooms/{room_id}/messages", response_model=List[ChatMessage])
async def get_chat_messages(room_id: str, limit: int = 50):
    messages = await db.get_messages_by_room(room_id, limit)
    return messages

@app.get("/api/rooms/{room_id}/history", response_model=List[ChatMessage])
async def get_chat_history(room_id: str, limit: int = 50):
    """Fetch the chat history for a specific room."""
    try:
        messages = await db.get_messages_by_room(room_id, limit)
        return messages
    except Exception as e:
        print(f"Error fetching chat history for room {room_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")

@app.post("/api/rooms/{room_id}/messages", response_model=ChatMessage)
async def send_message(
    room_id: str, 
    senderId: str = Form(...),
    senderName: str = Form(...),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user_id: str = Header(None),
    x_user_id: str = Header(None)
):
    # Enhanced auth check - try both header formats
    # First check x_user_id header (FastAPI converts X-User-Id to x_user_id)
    effective_user_id = x_user_id if x_user_id else user_id
    
    if not effective_user_id:
        print("Auth failed: No user ID header found (tried both user_id and X-User-Id)")
        raise HTTPException(status_code=401, detail="Missing user_id header")
    
    # For debugging
    print(f"Received headers - user_id: {user_id}, X-User-Id: {x_user_id}")
    print(f"Using effective user ID: {effective_user_id}")
    print(f"Form data senderId: {senderId}")
    
    # Auto-register the user if they don't exist yet
    if effective_user_id not in active_users:
        active_users[effective_user_id] = User(
            id=effective_user_id,
            username=effective_user_id
        )
        print(f"Auto-registered user from HTTP request: {effective_user_id}")
    
    # Check if senderId matches the effective_user_id header
    if effective_user_id != senderId:
        print(f"Warning: user_id in header ({effective_user_id}) doesn't match senderId in form data ({senderId})")
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
        print(f"Uploaded file {attachment_filename} to {attachment_url}")

    # Ensure either content or a file is provided
    if not content and not attachment_url:
        raise HTTPException(status_code=400, detail="Message must have content or an attachment.")

    # Create message object
    message = ChatMessage(
        id=str(uuid.uuid4()),
        chatId=room_id,
        senderId=senderId,
        senderName=senderName,
        content=content,
        timestamp=datetime.utcnow().isoformat(),
        type="file" if attachment_url else "text",
        attachmentUrl=attachment_url,
        attachmentFilename=attachment_filename
    )
    
    # Save to database
    saved_message = await db.create_message(message)
    
    # Broadcast message via WebSocket to subscribed users
    print(f"Broadcasting HTTP message to room {room_id}")
    broadcast_payload = {
        "type": "message",
        "data": saved_message.dict()
    }
    for user_id_in_room, subscribed_rooms in user_subscriptions.items():
        if room_id in subscribed_rooms and user_id_in_room in active_connections:
            try:
                await active_connections[user_id_in_room].send_json(broadcast_payload)
                print(f"Sent HTTP message to client {user_id_in_room} for room {room_id}")
            except Exception as e:
                print(f"Error sending HTTP message to client {user_id_in_room}: {e}")

    return saved_message

@app.post("/api/auth/register", response_model=UserResponse)
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

@app.post("/api/auth/login", response_model=UserResponse)
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
    
    # Return user data (excluding password)
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        last_login=user.last_login
    )

@app.get("/api/auth/verify-email/{token}")
async def verify_email(token: str):
    """Verify a user's email using the provided verification token."""
    if not token:
        raise HTTPException(status_code=400, detail="Verification token is required")
    
    # Verify the token
    verification_result = await db.verify_email(token)
    
    if not verification_result["success"]:
        # Instead of immediately raising an error, check if the user exists but is already verified
        user = None
        # Try to find user first by checking all users - this is a bit inefficient but necessary
        if db.dev_mode:
            # In dev mode, check mock users
            for mock_user in db._mock_users:
                if mock_user.email_confirmed and mock_user.email_verification_token is None:
                    # This user might have already been verified
                    user = mock_user
                    break
        else:
            # In production mode, we can't efficiently find a user whose token has already been used
            # We'll have to rely on the verification_success flag only
            pass
            
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    else:
        # Log the successful account activation
        print(f"INFO: Activating user account: {verification_result['user_id']} (email: {verification_result['email']})")
    
    return {"success": True, "message": "Email verified successfully"}

@app.get("/api/auth/verify-email-redirect/{token}")
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
        import socket
        for port in [3000, 5173, 8080, 4200]:  # Common ports for React, Vite, Vue, Angular
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            if result == 0:  # Port is open
                frontend_url = f"http://localhost:{port}"
                print(f"Detected frontend running at {frontend_url}")
                break
    else:
        # Production fallback
        frontend_url = "https://chat.azure.sandnabba.se"
    
    print(f"Using frontend URL for redirect: {frontend_url}")
    
    if not token:
        # If no token is provided, redirect to frontend with error parameter
        return RedirectResponse(f"{frontend_url}/?verification=error&reason=missing-token")
    
    try:
        # Verify the token using the same logic as the regular endpoint
        verification_result = await db.verify_email(token)
        
        if verification_result["success"]:
            # Log the successful account activation
            print(f"INFO: Activating user account: {verification_result['user_id']} (email: {verification_result['email']})")
            # Redirect to frontend with success parameter
            return RedirectResponse(f"{frontend_url}/?verification=success")
        else:
            # Redirect to frontend with error parameter
            return RedirectResponse(f"{frontend_url}/?verification=error&reason=invalid-token")
    except Exception as e:
        print(f"Error during email verification redirect: {e}")
        # Redirect to frontend with error parameter
        return RedirectResponse(f"{frontend_url}/?verification=error&reason=server-error")

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    # Auto-register the user if they don't exist yet (e.g., anonymous users)
    if user_id not in active_users:
        active_users[user_id] = User(
            id=user_id,
            username=user_id, # Use user_id as username for anonymous/guest users
            email=f"{user_id}@temporary.chat",
            password="temp_not_usable_password", # Placeholder, not for actual login
            email_confirmed=True # Assume confirmed for WebSocket-only users
        )
        print(f"Auto-registered temporary user for WebSocket: {user_id}")

    await websocket.accept()
    print(f"WebSocket connection accepted for user: {user_id}")
    active_connections[user_id] = websocket
    
    # Initialize user subscriptions if not existing
    if user_id not in user_subscriptions:
        user_subscriptions[user_id] = []
    
    # Auto-subscribe the user to all existing rooms
    try:
        rooms = await db.get_chat_rooms()
        if not rooms:
            # Ensure there's at least a general room
            general_room = ChatRoom(
                id="general",
                name="General",
                description="Public chat room for everyone"
            )
            await db.create_chat_room(general_room)
            rooms = [general_room]
            
        # Subscribe to all rooms automatically
        for room in rooms:
            if room.id not in user_subscriptions[user_id]:
                user_subscriptions[user_id].append(room.id)
                print(f"Auto-subscribed user {user_id} to room {room.id}")
                
                # Send join notification to other users in this room
                user_info = active_users[user_id]
                join_notification = {
                    "type": "user_joined_room",
                    "roomId": room.id,
                    "userId": user_id,
                    "username": user_info.username
                }
                
                # Send to all other connected users
                for other_user_id, other_ws in active_connections.items():
                    if other_user_id != user_id:
                        try:
                            await other_ws.send_json(join_notification)
                        except Exception as e:
                            print(f"Error notifying {other_user_id} about {user_id} joining {room.id}: {e}")
                
        # Send subscription acknowledgement for all rooms at once
        await websocket.send_json({
            "type": "subscriptions_ack", 
            "rooms": [room.id for room in rooms],
            "status": "subscribed"
        })
    except Exception as e:
        print(f"Error auto-subscribing user {user_id} to rooms: {e}")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received raw data from {user_id}: {data}")
            message_data = json.loads(data)
            msg_type = message_data.get("type")

            if msg_type == "message":
                msg_content_data = message_data.get("data", {})
                room_id = msg_content_data.get("chatId")

                if not room_id:
                    await websocket.send_json({"type": "error", "message": "chatId missing in message data"})
                    continue
                
                # Ensure senderName is correctly fetched
                sender_user_info = active_users.get(user_id, User(id=user_id, username=user_id, email=f"{user_id}@temporary.chat", password="temp_not_usable_password"))
                sender_name = sender_user_info.username

                # Process only text messages via WebSocket, attachments should go via HTTP
                if msg_content_data.get("content") and not msg_content_data.get("attachmentUrl"):
                    message = ChatMessage(
                        id=str(uuid.uuid4()),
                        chatId=room_id,
                        senderId=user_id,
                        senderName=sender_name, # Use fetched sender_name
                        content=msg_content_data.get("content"),
                        timestamp=datetime.utcnow().isoformat(),
                        type="text"
                    )
                    await db.create_message(message)
                    
                    broadcast_payload = {"type": "message", "data": message.dict()}
                    # Send to all connected users (they will filter by room in frontend)
                    for conn_user_id, conn in active_connections.items():
                        try:
                            await conn.send_json(broadcast_payload)
                        except Exception as e:
                            print(f"Error broadcasting WS message to {conn_user_id} in room {room_id}: {e}")
                else:
                    print(f"Received WS message from {user_id} for room {room_id} without content or with attachment, ignoring.")
                    await websocket.send_json({"type": "error", "message": "WebSocket messages should be text-only; use HTTP POST for attachments."})
            
            else:
                print(f"Received unknown message type '{msg_type}' from {user_id}")
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        print(f"WebSocket connection closed for user: {user_id}")
    except json.JSONDecodeError:
        print(f"Invalid JSON received from {user_id}, closing connection.")
        if user_id in active_connections: # Ensure connection exists before trying to close
             await active_connections[user_id].close(code=1003) # 1003: unsupported data
    except Exception as e:
        print(f"Error in WebSocket handler for {user_id}: {e}")
        if user_id in active_connections: # Ensure connection exists
            try:
                await active_connections[user_id].close(code=1011) # 1011: internal server error
            except Exception as close_e:
                print(f"Error trying to close WebSocket for {user_id} after an error: {close_e}")
    finally:
        if user_id in active_connections:
            del active_connections[user_id]
        
        disconnected_user_info = active_users.get(user_id)
        if not disconnected_user_info:
            # Create a default User object with required fields if not found
            print(f"User {user_id} not found in active_users during disconnect cleanup. Creating temporary info.")
            disconnected_user_info = User(
                id=user_id,
                username=user_id,  # Or a more generic "Disconnected User"
                email=f"{user_id}@temporary.chat",  # Placeholder email
                password="temp_not_usable_password",  # Placeholder password
                email_confirmed=True  # Assume confirmed for this context
            )

        if user_id in user_subscriptions:
            # Notify other users about this user leaving all rooms
            for room_id in list(user_subscriptions[user_id]): # Iterate over a copy
                print(f"User {user_id} is leaving room {room_id} due to disconnect.")
                # Notify all other connected users
                leave_notification = {
                    "type": "user_left_room",
                    "roomId": room_id,
                    "userId": user_id,
                    "username": disconnected_user_info.username
                }
                for other_user_id, other_ws in active_connections.items():
                    try:
                        await other_ws.send_json(leave_notification)
                    except Exception as e:
                        print(f"Error notifying {other_user_id} about {user_id} leaving {room_id} (during disconnect): {e}")
            del user_subscriptions[user_id]
        print(f"Cleaned up resources for disconnected user {user_id}")

@app.on_event("startup")
async def startup_event():
    """Verify and create necessary containers at startup"""
    print("Starting application...")
    
    if not db.dev_mode:
        print("Verifying database and containers...")
        
        rooms_container = await db._get_container(db.room_container)
        if not rooms_container:
            print(f"WARNING: Failed to get/create {db.room_container} container")
        else:
            print(f"Successfully verified {db.room_container} container")
            
        messages_container = await db._get_container(db.message_container)
        if not messages_container:
            print(f"WARNING: Failed to get/create {db.message_container} container")
        else:
            print(f"Successfully verified {db.message_container} container")
            
        users_container = await db._get_container(db.user_container)
        if not users_container:
            print(f"WARNING: Failed to get/create {db.user_container} container")
        else:
            print(f"Successfully verified {db.user_container} container")
            
        general_room = ChatRoom(
            id="general",
            name="General",
            description="Public chat room for everyone"
        )
        await db.create_chat_room(general_room)
    else:
        print("Running in development mode with mock data")

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down application...")
    await db.close()

def generate_verification_token() -> str:
    """Generate a secure verification token for email verification."""
    return secrets.token_urlsafe(32)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)