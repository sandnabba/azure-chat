import os
from typing import List, Optional
import logging
from azure.cosmos import exceptions
from azure.cosmos.aio import CosmosClient as AsyncCosmosClient
from dotenv import load_dotenv
import uuid
from datetime import datetime

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
        self.user_container = os.getenv("COSMOS_USERS_CONTAINER", "Users")
        
        # Initialize in-memory storage regardless of mode to avoid AttributeError
        self._mock_messages = []
        self._mock_rooms = [
            ChatRoom(
                id="general",
                name="General",
                description="Public chat room for everyone"
            )
        ]
        self._mock_users = []
        
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

    async def create_user(self, user: User) -> Optional[User]:
        """Create a new user in the database."""
        if not user.id:
            user.id = str(uuid.uuid4())
            
        if self.dev_mode:
            # Check if username or email already exists
            for existing_user in self._mock_users:
                if existing_user.username.lower() == user.username.lower():
                    logging.warning(f"Username {user.username} already exists")
                    return None
                if existing_user.email.lower() == user.email.lower():
                    logging.warning(f"Email {user.email} already exists")
                    return None
            
            self._mock_users.append(user)
            return user
            
        try:
            container = await self._get_container(self.user_container)
            if not container:
                logging.error(f"Failed to get user container, user not saved: {user.id}")
                return None
                
            # Check if username already exists
            query = "SELECT * FROM c WHERE c.username = @username"
            parameters = [{"name": "@username", "value": user.username}]
            
            exists = False
            items = container.query_items(query=query, parameters=parameters)
            
            async for _ in items:
                exists = True
                break
                
            if exists:
                logging.warning(f"Username {user.username} already exists")
                return None
                
            # Check if email already exists
            query = "SELECT * FROM c WHERE c.email = @email"
            parameters = [{"name": "@email", "value": user.email}]
            
            exists = False
            items = container.query_items(query=query, parameters=parameters)
            
            async for _ in items:
                exists = True
                break
                
            if exists:
                logging.warning(f"Email {user.email} already exists")
                return None
                
            # Create the user
            user_dict = user.dict()
            await container.create_item(body=user_dict)
            logging.info(f"Created new user: {user.id} - {user.username}")
            return user
            
        except Exception as e:
            logging.error(f"Error creating user: {e}")
            return None
            
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get a user by ID."""
        if self.dev_mode:
            for user in self._mock_users:
                if user.id == user_id:
                    return user
            return None
            
        try:
            container = await self._get_container(self.user_container)
            if not container:
                logging.error(f"Failed to get user container for user {user_id}")
                return None
                
            query = "SELECT * FROM c WHERE c.id = @userId"
            parameters = [{"name": "@userId", "value": user_id}]
            
            items = container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            )
            
            async for item in items:
                return User(**item)
                
            return None
        except Exception as e:
            logging.error(f"Error retrieving user {user_id}: {e}")
            return None
            
    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get a user by username."""
        if self.dev_mode:
            for user in self._mock_users:
                if user.username.lower() == username.lower():
                    return user
            return None
            
        try:
            container = await self._get_container(self.user_container)
            if not container:
                logging.error(f"Failed to get user container for username {username}")
                return None
                
            query = "SELECT * FROM c WHERE LOWER(c.username) = LOWER(@username)"
            parameters = [{"name": "@username", "value": username}]
            
            items = container.query_items(query=query, parameters=parameters)
            
            async for item in items:
                return User(**item)
                
            return None
        except Exception as e:
            logging.error(f"Error retrieving user by username {username}: {e}")
            return None
            
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get a user by email."""
        if self.dev_mode:
            for user in self._mock_users:
                if user.email.lower() == email.lower():
                    return user
            return None
            
        try:
            container = await self._get_container(self.user_container)
            if not container:
                logging.error(f"Failed to get user container for email {email}")
                return None
                
            query = "SELECT * FROM c WHERE LOWER(c.email) = LOWER(@email)"
            parameters = [{"name": "@email", "value": email}]
            
            items = container.query_items(query=query, parameters=parameters)
            
            async for item in items:
                return User(**item)
                
            return None
        except Exception as e:
            logging.error(f"Error retrieving user by email {email}: {e}")
            return None
            
    async def update_user_last_login(self, user_id: str) -> bool:
        """Update user's last login timestamp."""
        if self.dev_mode:
            for user in self._mock_users:
                if user.id == user_id:
                    user.last_login = datetime.utcnow().isoformat()
                    return True
            return False
            
        try:
            container = await self._get_container(self.user_container)
            if not container:
                logging.error(f"Failed to get user container for updating last login for user {user_id}")
                return False
                
            # Get the user first
            query = "SELECT * FROM c WHERE c.id = @userId"
            parameters = [{"name": "@userId", "value": user_id}]
            
            items = container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id
            )
            
            user_item = None
            async for item in items:
                user_item = item
                break
                
            if not user_item:
                logging.warning(f"User with ID {user_id} not found for last login update")
                return False
                
            # Update the last login timestamp
            user_item['last_login'] = datetime.utcnow().isoformat()
            
            # Update the item in Cosmos DB
            await container.replace_item(item=user_item['id'], body=user_item)
            logging.info(f"Updated last login for user: {user_id}")
            return True
        except Exception as e:
            logging.error(f"Error updating last login for user {user_id}: {e}")
            return False

    async def verify_email(self, verification_token: str) -> dict:
        """Verify a user's email using the verification token."""
        result = {"success": False, "user_id": None, "email": None}
        
        if self.dev_mode:
            # First check if user is already verified (token used)
            for user in self._mock_users:
                if (user.email_verification_token == verification_token and not user.email_confirmed):
                    user.email_confirmed = True
                    user.previous_token = verification_token  # Store for reference
                    user.email_verification_token = None
                    logging.info(f"Email verified for mock user: {user.id}")
                    result["success"] = True
                    result["user_id"] = user.id
                    result["email"] = user.email
                    return result
                elif (user.email_verification_token is None and user.email_confirmed and 
                      getattr(user, 'previous_token', None) == verification_token):
                    # Token was already used, but verification was successful
                    logging.info(f"Email already verified for mock user: {user.id}")
                    result["success"] = True
                    result["user_id"] = user.id
                    result["email"] = user.email
                    return result
            logging.warning(f"No user found with verification token: {verification_token}")
            return result
            
        try:
            container = await self._get_container(self.user_container)
            if not container:
                logging.error("Failed to get user container for email verification")
                return result
                
            # Find user with matching verification token
            query = "SELECT * FROM c WHERE c.email_verification_token = @token"
            parameters = [{"name": "@token", "value": verification_token}]
            
            items = container.query_items(query=query, parameters=parameters)
            
            user_item = None
            async for item in items:
                user_item = item
                break
                
            if not user_item:
                # Check if a user might have already been verified with this token
                # This is less efficient but helps prevent false negatives
                query = "SELECT * FROM c WHERE c.email_confirmed = true AND c.email_verification_token_history = @token"
                parameters = [{"name": "@token", "value": verification_token}]
                
                items = container.query_items(query=query, parameters=parameters)
                
                async for item in items:
                    logging.info(f"Email already verified for user: {item['id']}")
                    result["success"] = True
                    result["user_id"] = item['id']
                    result["email"] = item['email']
                    return result
                    
                logging.warning(f"No user found with verification token: {verification_token}")
                return result
                
            # Store the previous token for reference
            user_item['email_verification_token_history'] = verification_token
                
            # Update the user to confirm their email
            user_item['email_confirmed'] = True
            user_item['email_verification_token'] = None
            
            # Update the item in Cosmos DB
            await container.replace_item(item=user_item['id'], body=user_item)
            logging.info(f"Email verified for user: {user_item['id']}")
            
            result["success"] = True
            result["user_id"] = user_item['id']
            result["email"] = user_item['email']
            return result
        except Exception as e:
            logging.error(f"Error verifying email: {e}")
            return result

    async def close(self):
        """Close the AsyncCosmosClient instance to release resources."""
        if not self.dev_mode and self._client is not None:
            try:
                await self._client.__aexit__(None, None, None)
                self._client = None
                logging.info("AsyncCosmosClient closed successfully.")
            except Exception as e:
                logging.error(f"Error closing AsyncCosmosClient: {e}")
                # Reset the client reference even if there was an error
                self._client = None