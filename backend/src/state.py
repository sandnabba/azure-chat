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
async def force_cleanup():
    """
    Force cleanup of all resources, especially WebSocket connections.
    Call this during shutdown to ensure the application can terminate properly.
    """
    import asyncio
    
    logger.info("Shutting down application...")
    logger.info(f"Closing {len(active_connections)} active WebSocket connections...")
    
    # Clear dictionaries FIRST to prevent new operations
    active_connections.clear()
    user_subscriptions.clear()
    logger.info("Cleared connection dictionaries")
    
    try:
        # Import here to avoid circular import
        from src.routes.websocket import force_close_all_websockets
        # Use a very short timeout so we don't block shutdown
        await asyncio.wait_for(force_close_all_websockets(), 0.5)
    except asyncio.TimeoutError:
        logger.warning("WebSocket closure timed out, continuing with shutdown")
    except Exception as e:
        logger.error(f"Error force-closing WebSockets: {e}")
    
    # Close database connection with very short timeout
    logger.info("Closing database connection...")
    try:
        await asyncio.wait_for(db.close(), 0.5)
        logger.info("Database connection closed successfully.")
    except asyncio.TimeoutError:
        logger.warning("Database connection close timed out")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")
        
    logger.info("Shutdown complete.")
