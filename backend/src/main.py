"""
Main entry point for the Azure Chat application.
This module initializes the FastAPI application and includes all routes.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import signal
import asyncio
import os
import threading
from contextlib import asynccontextmanager

# Import the logging configuration
from src.logging_config import configure_logging

# Configure logging for the application
app_logger = configure_logging()

from src.models import ChatRoom
from src.state import db, logger, set_shutdown_flag, perform_shutdown

# Import route modules
from src.routes.debug import router as debug_router
from src.routes.auth import router as auth_router
from src.routes.rooms import router as rooms_router
from src.routes.messages import router as messages_router
from src.routes.websocket import router as websocket_router
from src.routes.users import router as users_router

# Create lifespan context manager for handling startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for the FastAPI application.
    This replaces the on_event("startup") and on_event("shutdown") handlers.
    """
    # Setup code to run before the application starts (startup event)
    logger.info("Starting application...")
    
    # Set up signal handlers for graceful shutdown
    try:
        setup_signal_handlers()
    except Exception as e:
        logger.error(f"Failed to set up signal handlers: {e}")
        
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

    # Yield control to the application
    yield
    
    # Shutdown code
    logger.info("Shutting down application...")
    
    try:
        await perform_shutdown()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")
        # Force exit as a last resort
        os._exit(1)


# Set up signal handlers for graceful shutdown
def setup_signal_handlers():
    """Set up signal handlers for graceful shutdown"""
    loop = asyncio.get_running_loop()
    
    # Signal handlers for graceful termination
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(
            sig,
            lambda sig=sig: asyncio.create_task(handle_shutdown_signal(sig))
        )
    logger.info("Signal handlers for graceful shutdown have been set up")

async def handle_shutdown_signal(sig):
    """Handle shutdown signals by gracefully shutting down the application"""
    logger.warning(f"Received shutdown signal {sig.name}, initiating shutdown")
    # Use the unified shutdown function that was imported at the top of the file
    await perform_shutdown()

# Create main application
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    # Ensure logging is configured
    app_logger.info("Initializing FastAPI application")
    
    app = FastAPI(
        title="Azure Chat Service API", 
        debug=False,
        lifespan=lifespan  # Use the lifespan context manager instead of on_event handlers
    )

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

    return app

# Note: Main signal handling is done through setup_signal_handlers() function
# which is called during application startup in the lifespan context manager

# Initialize application
app = create_app()

if __name__ == "__main__":
    """Run the application when executed directly."""
    
    app_logger.info("Running application directly with uvicorn")
    # Simple development server configuration
    
    # Set up a handler for SIGTERM and SIGINT to ensure clean shutdown when running with uvicorn
    def handle_signal(sig, frame):
        app_logger.warning(f"Received signal {sig}, initiating shutdown")
        # Call set_shutdown_flag to mark shutdown in progress
        set_shutdown_flag()
        # Force exit after a short delay to ensure clean shutdown
        threading.Timer(1.0, lambda: os._exit(0)).start()
        app_logger.info("Application will exit shortly...")
        
    # Register signal handlers for direct uvicorn execution
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
        timeout_keep_alive=5,     
        timeout_graceful_shutdown=1,  # Even shorter shutdown timeout
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
        log_config=None  # Disable Uvicorn's default logging config to use ours
    )
