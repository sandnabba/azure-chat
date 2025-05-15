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
