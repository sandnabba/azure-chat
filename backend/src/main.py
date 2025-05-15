"""
Main entry point for the Azure Chat application.
This module initializes the FastAPI application and includes all routes.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime
import uuid

# Import the logging configuration
from src.logging_config import configure_logging

# Configure logging for the application
app_logger = configure_logging()

from src.models import ChatRoom
from src.state import db, logger

# Import route modules
from src.routes.debug import router as debug_router
from src.routes.auth import router as auth_router
from src.routes.rooms import router as rooms_router
from src.routes.messages import router as messages_router
from src.routes.websocket import router as websocket_router
from src.routes.users import router as users_router

# Create main application
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    # Ensure logging is configured
    app_logger.info("Initializing FastAPI application")
    
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

    # Include routers from modules
    app.include_router(debug_router)
    app.include_router(auth_router)
    app.include_router(rooms_router) 
    app.include_router(messages_router)
    app.include_router(websocket_router)
    app.include_router(users_router)

    # Set up lifecycle events
    @app.on_event("startup")
    async def startup_event():
        """Verify and create necessary containers at startup"""
        logger.info("Starting application...")
        
        if not db.dev_mode:
            logger.info("Verifying database and containers...")
            
            rooms_container = await db._get_container(db.room_container)
            if not rooms_container:
                logger.warning(f"Failed to get/create {db.room_container} container")
            else:
                logger.info(f"Successfully verified {db.room_container} container")
                
            messages_container = await db._get_container(db.message_container)
            if not messages_container:
                logger.warning(f"Failed to get/create {db.message_container} container")
            else:
                logger.info(f"Successfully verified {db.message_container} container")
                
            users_container = await db._get_container(db.user_container)
            if not users_container:
                logger.warning(f"Failed to get/create {db.user_container} container")
            else:
                logger.info(f"Successfully verified {db.user_container} container")
                
            general_room = ChatRoom(
                id="general",
                name="General",
                description="Public chat room for everyone"
            )
            await db.create_chat_room(general_room)
        else:
            logger.info("Running in development mode with mock data")

    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Shutting down application...")
        await db.close()

    return app

# Initialize application
app = create_app()

if __name__ == "__main__":
    """Run the application when executed directly."""
    app_logger.info("Running application directly with uvicorn")
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=None  # Disable Uvicorn's default logging config to use ours
    )
