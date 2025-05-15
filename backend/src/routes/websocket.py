"""
WebSocket endpoint for the Azure Chat application.
This module handles real-time communication between clients.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json
import uuid
from datetime import datetime

from src.models import ChatRoom, ChatMessage
from src.state import db, active_users, active_connections, user_subscriptions

# Get logger for this module
logger = logging.getLogger("azure-chat.websocket")

# Create router for WebSocket endpoints
router = APIRouter(tags=["websocket"])

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint that maintains a persistent connection with the client.
    This implementation uses a single WebSocket connection per user (not per room),
    allowing a user to receive messages from all rooms they're subscribed to.
    """
    # Check if user is registered - first check active_users, then database
    if user_id not in active_users:
        # Try to find user in database
        logger.debug(f"User {user_id} not found in active_users, checking database...")
        db_user = await db.get_user_by_id(user_id)
        
        if db_user:
            # User found in database, add to active_users
            logger.info(f"User {user_id} found in database: {db_user.username}")
            active_users[user_id] = db_user
        else:
            # User not found in database either, reject connection
            logger.warning(f"WebSocket connection rejected for unregistered user: {user_id}")
            return await websocket.close(code=4001, reason="Unauthorized: User not registered")
    
    # Get the user information from active_users
    user_info = active_users[user_id]
    logger.debug(f"User {user_id} found: {user_info.username}")
        
    await websocket.accept()
    logger.info(f"WebSocket connection accepted for user: {user_id}")
    active_connections[user_id] = websocket
    
    # Also send a broadcast of already connected users to the newly connected user
    logger.debug(f"Sending active users list to newly connected user {user_id}")
    
    # Send a simple "user_online" notification to all connected users about this user
    user_info = active_users[user_id]
    user_online_notification = {
        "type": "user_online",
        "userId": user_id,
        "username": user_info.username
    }
    
    # Send to all connected users (including self)
    for connected_user_id, conn in active_connections.items():
        try:
            await conn.send_json(user_online_notification)
            logger.debug(f"Sent online status notification about {user_id} ({user_info.username}) to {connected_user_id}")
        except Exception as e:
            logger.error(f"Error sending online status notification to {connected_user_id}: {e}")
    
    # Send notifications about all existing online users to the newly connected user
    for existing_user_id, existing_user in active_users.items():
        if existing_user_id != user_id and existing_user_id in active_connections:
            # For each existing active user, send an online notification to the new user
            existing_user_online = {
                "type": "user_online",
                "userId": existing_user_id,
                "username": existing_user.username
            }
            try:
                await websocket.send_json(existing_user_online)
                logger.debug(f"Sent existing user online status to {user_id} about {existing_user_id}")
            except Exception as e:
                logger.error(f"Error sending existing user online status to {user_id}: {e}")
    
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
            rooms = [general_room]            # Subscribe to all rooms automatically
        for room in rooms:
            if room.id not in user_subscriptions[user_id]:
                user_subscriptions[user_id].append(room.id)
                logger.debug(f"Auto-subscribed user {user_id} to room {room.id}")
                
                # No need to send per-room join notifications anymore
                # User's online status is already sent with "user_online" notification
                
        # Send subscription acknowledgement for all rooms at once
        await websocket.send_json({
            "type": "subscriptions_ack", 
            "rooms": [room.id for room in rooms],
            "status": "subscribed"
        })
    except Exception as e:
        logger.error(f"Error auto-subscribing user {user_id} to rooms: {e}")

    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received raw data from {user_id}: {data}")
            message_data = json.loads(data)
            msg_type = message_data.get("type")

            if msg_type == "message":
                msg_content_data = message_data.get("data", {})
                room_id = msg_content_data.get("chatId")

                if not room_id:
                    await websocket.send_json({"type": "error", "message": "chatId missing in message data"})
                    continue
                
                # Ensure senderName is correctly fetched
                sender_user_info = active_users.get(user_id)
                if sender_user_info is None:
                    # Try to find user in database
                    logger.warning(f"User {user_id} not found in active_users when sending message, checking database...")
                    db_user = await db.get_user_by_id(user_id)
                    
                    if db_user:
                        # User found in database, add to active_users
                        logger.info(f"User {user_id} found in database when sending message: {db_user.username}")
                        active_users[user_id] = db_user
                        sender_user_info = db_user
                    else:
                        # User not found in database either, reject message
                        error_msg = {"type": "error", "message": "Unauthorized: User not registered"}
                        await websocket.send_json(error_msg)
                        logger.warning(f"Rejected message from unregistered user: {user_id}")
                        continue
                
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
                            logger.error(f"Error broadcasting WS message to {conn_user_id} in room {room_id}: {e}")
                else:
                    logger.warning(f"Received WS message from {user_id} for room {room_id} without content or with attachment, ignoring.")
                    await websocket.send_json({"type": "error", "message": "WebSocket messages should be text-only; use HTTP POST for attachments."})
            
            else:
                logger.warning(f"Received unknown message type '{msg_type}' from {user_id}")
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket connection closed for user: {user_id}")
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON received from {user_id}, closing connection.")
        if user_id in active_connections: # Ensure connection exists before trying to close
             await active_connections[user_id].close(code=1003) # 1003: unsupported data
    except Exception as e:
        logger.error(f"Error in WebSocket handler for {user_id}: {e}")
        if user_id in active_connections: # Ensure connection exists
            try:
                await active_connections[user_id].close(code=1011) # 1011: internal server error
            except Exception as close_e:
                logger.error(f"Error trying to close WebSocket for {user_id} after an error: {close_e}")
    finally:
        if user_id in active_connections:
            del active_connections[user_id]
        
        disconnected_user_info = active_users.get(user_id)
        if not disconnected_user_info:
            # If user not found, skip sending offline notifications
            logger.warning(f"User {user_id} not found in active_users during disconnect cleanup, skipping offline notification.")
            return
        else:
            # Also remove the user from active_users list since they've disconnected
            if user_id in active_users:
                del active_users[user_id]
                logger.info(f"Removed user {user_id} from active_users list")

        # Notify all remaining users about this user going offline
        user_offline_notification = {
            "type": "user_offline",
            "userId": user_id,
            "username": disconnected_user_info.username
        }
        
        for other_user_id, other_ws in active_connections.items():
            try:
                await other_ws.send_json(user_offline_notification)
                logger.debug(f"Sent offline notification to {other_user_id} about {user_id} ({disconnected_user_info.username})")
            except Exception as e:
                logger.error(f"Error sending offline notification to {other_user_id}: {e}")
                
        if user_id in user_subscriptions:
            del user_subscriptions[user_id]
        logger.info(f"Cleaned up resources for disconnected user {user_id}")
