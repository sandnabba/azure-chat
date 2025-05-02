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

## API Documentation

Once running, API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COSMOS_ENDPOINT` | Azure Cosmos DB endpoint URL | `` |
| `COSMOS_KEY` | Azure Cosmos DB access key | `` |
| `COSMOS_DATABASE` | Azure Cosmos DB database name | `chat_db` |
| `COSMOS_CONTAINER` | Azure Cosmos DB container name | `messages` |
| `STORAGE_CONNECTION_STRING` | Azure Storage connection string | `` |
| `STORAGE_CONTAINER_NAME` | Azure Blob Storage container name | `attachments` |
| `SIGNALR_CONNECTION_STRING` | Azure SignalR connection string | `` |
| `SIGNALR_SERVICE_MODE` | SignalR service mode | `Default` |
| `EVENTGRID_TOPIC_ENDPOINT` | Azure Event Grid topic endpoint | `` |
| `EVENTGRID_TOPIC_KEY` | Azure Event Grid topic access key | `` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| `LOG_LEVEL` | Application logging level | `INFO` |
| `AUTH_SECRET_KEY` | Secret key for JWT token generation | `your-secret-key` |
| `AUTH_TOKEN_EXPIRE_MINUTES` | JWT token expiration time in minutes | `60` |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `APP_PORT` | Port to run the FastAPI application | `8000` |
| `APP_HOST` | Host to bind the FastAPI application | `0.0.0.0` |
| `ENABLE_METRICS` | Enable Prometheus metrics endpoint | `false` |

## Database

The application uses Azure Cosmos DB (NoSQL) for data persistence. Connection configuration is in `src/database.py`.

## File Storage

File attachments are stored using Azure Blob Storage. Configuration is in `src/storage.py`.