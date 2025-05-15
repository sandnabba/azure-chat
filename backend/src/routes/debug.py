"""
Debug endpoints for the Azure Chat application.
This module contains endpoints useful for debugging and monitoring.
"""
from fastapi import APIRouter
import os
from datetime import datetime
import logging

# Import database connection from shared state
from src.state import db

# Get logger for this module
logger = logging.getLogger("azure-chat.debug")

# Create router for debug endpoints
router = APIRouter(tags=["debug"])

@router.get("/debug")
async def debug():
    """Debug endpoint to view environment variables and connection status."""
    environment = {}
    for key, value in os.environ.items():
        # Mask sensitive values
        if 'key' in key.lower() or 'password' in key.lower() or 'secret' in key.lower() or 'connection' in key.lower():
            environment[key] = "***MASKED***"
        else:
            environment[key] = value
            
    # Add information about dev mode
    cosmos_info = {
        "dev_mode": db.dev_mode,
        "cosmos_endpoint_set": bool(os.getenv("COSMOS_ENDPOINT")),
        "cosmos_key_set": bool(os.getenv("COSMOS_KEY")),
        "database_name": db.database_name,
        "message_container": db.message_container,
    }
    
    return {
        "status": "debugging",
        "environment": environment,
        "cosmos_info": cosmos_info,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/")
async def root():
    """Root endpoint returning a welcome message."""
    return {"message": "Azure Chat Service API"}

@router.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@router.get("/api/version")
async def get_version():
    """Return build timestamp and version information."""
    # Get build info from environment variables
    build_time = os.getenv("BUILD_TIMESTAMP", "development")
    version = os.getenv("VERSION", "local")
    commit = os.getenv("COMMIT", "none")
    
    return {
        "version": version,
        "buildTimestamp": build_time,
        "commit": commit
    }
