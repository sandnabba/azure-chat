"""
Debug endpoints for testing websocket shutdown in the Azure Chat application.
"""
from fastapi import APIRouter
import logging

# Import state functions
from src.state import active_connections, set_shutdown_flag, perform_shutdown
from src.routes.websocket import force_close_all_websockets

# Get logger for this module
logger = logging.getLogger("azure-chat.shutdown_debug")

# Create router for debug endpoints
router = APIRouter(tags=["shutdown_debug"])

@router.get("/api/debug/websocket-status")
async def websocket_status():
    """Get status of all websocket connections."""
    return {
        "active_connections": len(active_connections),
        "connection_ids": list(active_connections.keys())
    }
    
@router.get("/api/debug/force-websocket-cleanup")
async def force_websocket_cleanup():
    """Force cleanup of all websocket connections. Use this for testing shutdown process."""
    logger.warning("Manually triggering websocket cleanup")
    connections_before = len(active_connections)
    
    # Use the centralized shutdown function that handles everything
    await perform_shutdown()
    
    return {
        "success": True,
        "message": "Application shutdown sequence initiated",
        "connections_before": connections_before,
        "connections_after": len(active_connections)
    }
