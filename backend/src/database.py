import os
from typing import List, Optional
import logging
import asyncio
from azure.cosmos import CosmosClient, exceptions
from azure.cosmos.aio import CosmosClient as AsyncCosmosClient
from dotenv import load_dotenv
import json

from src.models import ChatMessage, ChatRoom, User

# Load environment variables
load_dotenv()

class CosmosDBConnection:
    def __init__(self):
        # Get connection info from environment variables
        self.cosmos_endpoint = os.getenv("COSMOS_ENDPOINT", "")
        self.cosmos_key = os.getenv("COSMOS_KEY", "")
        self.database_name = os.getenv("COSMOS_DATABASE", "AzureChatDB")
        self.message_container = os.getenv("COSMOS_MESSAGES_CONTAINER", "Messages")
        self.room_container = os.getenv("COSMOS_ROOMS_CONTAINER", "Rooms")
        
        # Initialize in-memory storage regardless of mode to avoid AttributeError
        self._mock_messages = []
        self._mock_rooms = [
            ChatRoom(
                id="general",
                name="General",
                description="Public chat room for everyone"
            )
        ]
        
        # Only set dev_mode based on explicit environment variable
        self.dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
        
        # Store client instance to avoid creating multiple connections
        self._client = None
        
        if self.dev_mode:
            logging.warning("Running in development mode with mock data (DEV_MODE=true).")
        elif not (self.cosmos_endpoint and self.cosmos_key):
            logging.error("Missing COSMOS_ENDPOINT or COSMOS_KEY environment variables. Set DEV_MODE=true to run in development mode.")
            
    async def _get_client(self):
        """Get or create the AsyncCosmosClient."""
        if self.dev_mode:
            return None
            
        if self._client is None:
            try:
                self._client = AsyncCosmosClient(self.cosmos_endpoint, credential=self.cosmos_key)
                logging.info("Created new AsyncCosmosClient")
            except Exception as e:
                logging.error(f"Failed to create AsyncCosmosClient: {e}")
                return None
                
        return self._client
            
    async def _get_container(self, container_name):
        """Get a container from Cosmos DB, creating it if it doesn't exist."""
        if self.dev_mode:
            return None
        
        try:
            client = await self._get_client()
            if client is None:
                logging.error("Failed to get Cosmos DB client")
                return None
                
            # Try to get database, create if not exists
            try:
                database = client.get_database_client(self.database_name)
                await database.read()
                logging.info(f"Using existing database: {self.database_name}")
            except exceptions.CosmosResourceNotFoundError:
                try:
                    database = await client.create_database(self.database_name)
                    logging.info(f"Created new database: {self.database_name}")
                except Exception as db_error:
                    logging.error(f"Failed to create database: {db_error}")
                    return None

            # Get or create container with proper error handling
            container = database.get_container_client(container_name)
            try:
                await container.read()
                logging.info(f"Using existing container: {container_name}")
                return container
            except exceptions.CosmosResourceNotFoundError:
                try:
                    # Set appropriate partition key based on container type
                    # Using the proper format for partition key path
                    if container_name == self.message_container:
                        partition_key_path = "/chatId"
                    else:
                        partition_key_path = "/id"
                    
                    # First try creating container without any throughput specification
                    # (compatible with serverless accounts)
                    try:
                        container = await database.create_container(
                            id=container_name,
                            partition_key={"paths": [partition_key_path], "kind": "Hash"}
                        )
                        logging.info(f"Created new container: {container_name} with partition key {partition_key_path}")
                        return container
                    except Exception as e:
                        # If first attempt fails, try simplified creation
                        logging.warning(f"First container creation attempt failed: {str(e)}")
                        container = await database.create_container(
                            id=container_name,
                            partition_key=partition_key_path
                        )
                        logging.info(f"Created new container (simple method): {container_name}")
                        return container
                except Exception as container_error:
                    logging.error(f"Failed to create container: {container_error}")
                    return None
        except Exception as e:
            logging.error(f"Error connecting to Cosmos DB: {e}")
            return None
            
    async def create_message(self, message: ChatMessage) -> ChatMessage:
        """Save a new chat message to the database."""
        if self.dev_mode:
            self._mock_messages.append(message)
            return message
            
        try:
            container = await self._get_container(self.message_container)
            if not container:
                logging.error(f"Failed to get message container, message not saved: {message.id}")
                return message
                
            message_dict = message.dict()
            await container.create_item(body=message_dict)
            return message
        except Exception as e:
            logging.error(f"Failed to create message in Cosmos DB: {e}")
            return message
        
    async def get_messages_by_room(self, room_id: str, limit: int = 50) -> List[ChatMessage]:
        """Get chat messages for a specific chat room."""
        if self.dev_mode:
            room_messages = [msg for msg in self._mock_messages if msg.chatId == room_id]
            return sorted(room_messages, key=lambda x: x.timestamp)[-limit:]
            
        try:
            container = await self._get_container(self.message_container)
            if not container:
                logging.error(f"Failed to get message container for room {room_id}")
                return []
                
            # Use parameterized query to avoid SQL injection
            query = "SELECT * FROM c WHERE c.chatId = @roomId ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit"
            parameters = [
                {"name": "@roomId", "value": room_id},
                {"name": "@limit", "value": limit}
            ]
            
            query_results = container.query_items(
                query=query,
                parameters=parameters,
                partition_key=room_id
            )
            
            messages = []
            async for result in query_results:
                messages.append(ChatMessage(**result))
                
            return sorted(messages, key=lambda x: x.timestamp)
        except Exception as e:
            logging.error(f"Failed to get messages for room {room_id}: {e}")
            return []
        
    async def create_chat_room(self, room: ChatRoom) -> ChatRoom:
        """Create a new chat room."""
        if self.dev_mode:
            # Check if room already exists in mock data
            for existing_room in self._mock_rooms:
                if existing_room.id == room.id:
                    return existing_room
            self._mock_rooms.append(room)
            return room
            
        try:
            container = await self._get_container(self.room_container)
            if not container:
                logging.error(f"Failed to get room container, room not saved: {room.id}")
                return room
            
            # Check if room exists using a parameterized query
            query = "SELECT * FROM c WHERE c.id = @roomId"
            parameters = [{"name": "@roomId", "value": room.id}]
            
            exists = False
            items = container.query_items(
                query=query,
                parameters=parameters,
                partition_key=room.id
            )
            
            async for _ in items:
                exists = True
                break
                
            if exists:
                logging.info(f"Room with ID {room.id} already exists")
                return room
                
            # Create the room
            room_dict = room.dict()
            await container.create_item(body=room_dict)
            logging.info(f"Created new chat room: {room.id} - {room.name}")
            return room
            
        except Exception as e:
            logging.error(f"Error creating chat room: {e}")
            return room
        
    async def get_chat_rooms(self) -> List[ChatRoom]:
        """Get all chat rooms."""
        if self.dev_mode:
            # Always ensure general room exists in mock mode
            if not any(room.id == "general" for room in self._mock_rooms):
                self._mock_rooms.append(
                    ChatRoom(
                        id="general",
                        name="General",
                        description="Public chat room for everyone"
                    )
                )
            return self._mock_rooms
            
        try:
            container = await self._get_container(self.room_container)
            if not container:
                logging.error("Failed to get room container for listing rooms")
                # Return empty list instead of falling back to mock data
                return []
                
            query = "SELECT * FROM c"
            query_results = container.query_items(query=query)
            
            rooms = []
            async for result in query_results:
                rooms.append(ChatRoom(**result))
                
            # Always ensure general room exists
            if not any(room.id == "general" for room in rooms):
                general_room = ChatRoom(
                    id="general",
                    name="General",
                    description="Public chat room for everyone"
                )
                await self.create_chat_room(general_room)
                rooms.append(general_room)
                
            return rooms
        except Exception as e:
            logging.error(f"Error retrieving chat rooms: {e}")
            # Return empty list instead of falling back to mock data
            return []
            
    async def delete_chat_room(self, room_id: str) -> bool:
        """Delete a chat room."""
        # Prevent deletion of general room
        if room_id == "general":
            logging.warning("Cannot delete the general room")
            return False
            
        if self.dev_mode:
            self._mock_rooms = [room for room in self._mock_rooms if room.id != room_id]
            return True
            
        try:
            container = await self._get_container(self.room_container)
            if not container:
                logging.error(f"Failed to get room container for deletion of room {room_id}")
                return False
                
            # Use parameterized query
            query = "SELECT * FROM c WHERE c.id = @roomId"
            parameters = [{"name": "@roomId", "value": room_id}]
            
            items = container.query_items(
                query=query,
                parameters=parameters,
                partition_key=room_id
            )
            
            room_item = None
            async for item in items:
                room_item = item
                break
                
            if not room_item:
                logging.warning(f"Room with ID {room_id} not found for deletion")
                return False
                
            await container.delete_item(item=room_item['id'], partition_key=room_id)
            logging.info(f"Deleted chat room: {room_id}")
            return True
        except Exception as e:
            logging.error(f"Error deleting chat room: {e}")
            return False

    async def close(self):
        """Close the AsyncCosmosClient instance to release resources."""
        if not self.dev_mode and self._client is not None:
            try:
                await self._client.__aexit__(None, None, None)
                self._client = None
                logging.info("AsyncCosmosClient closed successfully.")
            except Exception as e:
                logging.error(f"Error closing AsyncCosmosClient: {e}")