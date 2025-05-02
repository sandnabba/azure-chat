"""
Event Grid module for Azure Chat Backend.

This module provides functionality to publish events to Azure Event Grid.
"""

import os
import uuid
import json
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional
import aiohttp

logger = logging.getLogger(__name__)

class EventGridPublisher:
    """Client for publishing events to Azure Event Grid."""
    
    def __init__(self):
        """Initialize the EventGrid client using environment variables."""
        self.endpoint = os.getenv("EVENTGRID_TOPIC_ENDPOINT")
        self.key = os.getenv("EVENTGRID_TOPIC_KEY")
        
        if not self.endpoint or not self.key:
            logger.warning("Event Grid configuration missing. Events will not be published.")
            self.enabled = False
        else:
            self.enabled = True
            logger.info(f"Event Grid publisher initialized with endpoint: {self.endpoint}")
    
    async def publish_event(self, 
                     event_type: str, 
                     subject: str, 
                     data: Dict[str, Any], 
                     data_version: str = "1.0") -> bool:
        """
        Publish an event to Azure Event Grid.
        
        Args:
            event_type: Type of the event (e.g., 'ChatMessage.Created')
            subject: Subject of the event (e.g., '/chat/rooms/123')
            data: Event data payload
            data_version: Version of the event data schema
            
        Returns:
            bool: True if the event was published successfully, False otherwise
        """
        if not self.enabled:
            logger.warning(f"Event Grid not configured. Skipping event: {event_type}")
            return False
            
        try:
            event = [{
                "id": str(uuid.uuid4()),
                "eventType": event_type,
                "subject": subject,
                "dataVersion": data_version,
                "eventTime": datetime.utcnow().isoformat(),
                "data": data
            }]
            
            headers = {
                "Content-Type": "application/json",
                "aeg-sas-key": self.key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(self.endpoint, 
                                       headers=headers, 
                                       json=event) as response:
                    if response.status == 200:
                        logger.info(f"Event published successfully: {event_type}")
                        return True
                    else:
                        response_text = await response.text()
                        logger.error(f"Failed to publish event: {response.status} - {response_text}")
                        return False
                        
        except Exception as e:
            logger.exception(f"Error publishing event to Event Grid: {e}")
            return False
    
    async def publish_chat_message(self, message_data: Dict[str, Any]) -> bool:
        """
        Publish a chat message event to Event Grid.
        
        Args:
            message_data: The chat message data
            
        Returns:
            bool: True if published successfully
        """
        return await self.publish_event(
            event_type="ChatMessage.Created",
            subject=f"/chat/rooms/{message_data.get('chatId', 'unknown')}",
            data=message_data
        )

# Global instance for easy import
event_grid = EventGridPublisher()