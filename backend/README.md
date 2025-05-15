# Backend Service

The backend for Azure Chat is built with FastAPI and Python.

## Recommended Setup (Docker)

Docker is the recommended method for both development and deployment.

### Development with Docker

```bash
# Build the development container
make build

# Run the development container
make run
```

Or manually:
```bash
docker build -t azure-chat-backend .
docker run -p 8000:8000 azure-chat-backend
```

### Deployment

This application is designed to be deployed as a custom container on Azure App Service. The Dockerfile is optimized for this deployment target.

## Alternative Setup (Local Development)

### Prerequisites

- Python 3.9+

### Steps

1. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:
   ```bash
   python src/app.py
   ```

## Environment Variables

The application uses the following environment variables:

- `LOG_LEVEL` - Logging level (default: "INFO")
- `COSMOS_ENDPOINT` - Azure Cosmos DB endpoint
- `COSMOS_KEY` - Azure Cosmos DB key
- `AZURE_STORAGE_CONNECTION_STRING` - Azure Blob Storage connection string
- `AZURE_STORAGE_CONTAINER_NAME` - Azure Blob Storage container name
- `FRONTEND_URL` - URL of the frontend application (for redirects)

## File structure

The project is organized as follows:

- `src/main.py` - Main entry point for the application
- `src/logging_config.py` - Logging configuration with colored output
- `src/state.py` - Shared application state and service instances
- `src/routes/` - Directory containing all API route modules:
  - `src/routes/auth.py` - Authentication routes (login, register, verification)
  - `src/routes/rooms.py` - Chat room management
  - `src/routes/messages.py` - Message handling
  - `src/routes/websocket.py` - WebSocket endpoint for real-time chat
  - `src/routes/debug.py` - Debug endpoints
  - `src/routes/users.py` - User management endpoints
- `src/models.py` - Data models used throughout the application
- `src/database.py` - Database connection and operations
- `src/storage.py` - Azure Blob Storage service for file uploads
- `src/auth_utils.py` - Utilities for password hashing and verification