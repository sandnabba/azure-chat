"""
Main entry point for the Azure Chat application.
This module initializes the FastAPI application and includes all routes.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime
import uuid
import signal
import sys
import asyncio
from contextlib import asynccontextmanager

# Import the logging configuration
from src.logging_config import configure_logging

# Configure logging for the application
app_logger = configure_logging()

from src.models import ChatRoom
from src.state import db, logger
from src.state import force_cleanup

# Import route modules
from src.routes.debug import router as debug_router
from src.routes.auth import router as auth_router
from src.routes.rooms import router as rooms_router
from src.routes.messages import router as messages_router
from src.routes.websocket import router as websocket_router, set_shutdown_flag
from src.routes.users import router as users_router
from src.routes.shutdown_debug import router as shutdown_debug_router

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
    
    # Shutdown code (previously in the shutdown_event)
    import threading
    import os
    from src.state import active_connections
    from src.routes.websocket import close_all_connections, force_close_all_websockets
    
    # First, set the shutdown flag to notify all websocket handlers
    set_shutdown_flag()
    
    logger.info("Shutting down application...")
    
    # Schedule forced application exit after a very short timeout
    # This will be our safety net if normal cleanup hangs
    threading.Timer(1.0, lambda: os._exit(0)).start()
    logger.info("Safety timer set: Forcing exit in 1 second regardless of cleanup status")
    
    # Clear connections immediately - don't wait
    active_connections.clear()
    
    # Use the most aggressive close method
    try:
        # Very short timeout
        await asyncio.wait_for(force_close_all_websockets(), 0.5)
    except asyncio.TimeoutError:
        logger.warning("WebSocket closure timed out")
    except Exception as e:
        logger.error(f"Error during WebSocket cleanup: {e}")
    
    # Now close the database connection with short timeout
    logger.info("Closing database connection...")
    try:
        await asyncio.wait_for(db.close(), 0.5)
    except asyncio.TimeoutError:
        logger.warning("Database connection close timed out")
    except Exception as e:
        logger.error(f"Error during database closure: {e}")
        
    logger.info("Shutdown complete - application will force exit shortly")


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
    """Handle shutdown signals by forcibly cleaning up resources"""
    logger.warning(f"Received shutdown signal {sig.name}, initiating forced cleanup")
    # Set the websocket shutdown flag first
    set_shutdown_flag()
    # Then perform a forced cleanup of resources
    await force_cleanup()

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
    app.include_router(shutdown_debug_router)

    return app

# Custom signal handler
def handle_signal(signal_number, frame):
    """Handle termination signals for graceful shutdown."""
    import threading
    import os
    
    logger.info(f"Received signal {signal_number}, initiating immediate shutdown...")
    
    # Set the websocket shutdown flag
    set_shutdown_flag()
    
    # Force application exit almost immediately - give just enough time for the flag to be set
    threading.Timer(0.1, lambda: os._exit(0)).start()
    logger.info("Forcing immediate application exit...")

# Register signal handlers
signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

# Initialize application
app = create_app()

if __name__ == "__main__":
    """Run the application when executed directly."""
    import os
    
    app_logger.info("Running application directly with uvicorn")
    # Simple development server configuration
    
    # Set up a handler for SIGTERM and SIGINT to ensure clean shutdown
    def handle_signal(sig, frame):
        app_logger.warning(f"Received signal {sig}, forcing immediate exit")
        # Set the websocket shutdown flag
        set_shutdown_flag()
        # Force immediate exit to avoid hanging
        os._exit(0)
        
    # Register signal handlers
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
