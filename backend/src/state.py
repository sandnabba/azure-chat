"""
Shared state and database connections for the Azure Chat application.
This module provides access to shared resources like database connections and
active user information across different parts of the application.
"""
from typing import Dict, List
from fastapi import WebSocket
import logging

from src.database import CosmosDBConnection
from src.models import User
from src.storage import AzureStorageService

# Get logger for this module - it will be properly configured by the time this is used
logger = logging.getLogger("azure-chat.state")

# Initialize database connection
db = CosmosDBConnection()

# Initialize Azure Storage Service
storage_service = AzureStorageService()

# Shared application state
# Store active connections
active_connections: Dict[str, WebSocket] = {}  # userId -> websocket
user_subscriptions: Dict[str, List[str]] = {}  # userId -> List[roomId]
active_users: Dict[str, User] = {}  # userId -> User

# Function to forcibly clean up resources during shutdown
# Flag to track if server is shutting down
is_shutting_down = False

def set_shutdown_flag():
    """
    Set the global shutdown flag. This should be called at the beginning 
    of the shutdown process to prevent new connections and operations.
    """
    global is_shutting_down
    logger.info("Setting global shutdown flag")
    is_shutting_down = True
    
    # Also update the websocket module's flag to maintain compatibility
    from src.routes.websocket import set_shutdown_flag as set_ws_flag
    set_ws_flag()

async def perform_shutdown():
    """
    Unified shutdown function that handles all cleanup tasks.
    Call this during shutdown to ensure the application can terminate properly.
    """
    import asyncio
    import threading
    import os
    
    # Set the flag first to prevent new operations
    set_shutdown_flag()
    
    logger.info("Shutting down application...")
    logger.info(f"Closing {len(active_connections)} active WebSocket connections...")
    
    # Schedule forced application exit after a short timeout as a safety net
    threading.Timer(1.5, lambda: os._exit(0)).start()
    logger.info("Safety timer set: Forcing exit in 1.5 seconds regardless of cleanup status")
    
    # Clear dictionaries to prevent new operations
    active_connections.clear()
    user_subscriptions.clear()
    logger.info("Cleared connection dictionaries")
    
    try:
        # Import here to avoid circular import
        from src.routes.websocket import force_close_all_websockets
        # Use a short timeout so we don't block shutdown
        await asyncio.wait_for(force_close_all_websockets(), 0.5)
    except asyncio.TimeoutError:
        logger.warning("WebSocket closure timed out, continuing with shutdown")
    except Exception as e:
        logger.error(f"Error force-closing WebSockets: {e}")
    
    # Close database connection with short timeout
    logger.info("Closing database connection...")
    try:
        await asyncio.wait_for(db.close(), 0.5)
        logger.info("Database connection closed successfully.")
    except asyncio.TimeoutError:
        logger.warning("Database connection close timed out")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")
        
    logger.info("Shutdown complete - application will exit shortly")

# Keep the original name for backward compatibility
async def force_cleanup():
    """Legacy alias for perform_shutdown."""
    await perform_shutdown()
