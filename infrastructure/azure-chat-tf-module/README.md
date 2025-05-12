# Azure Chat Service Infrastructure Module

This Terraform module provisions all the necessary Azure resources for running the Azure Chat Service application.

## Architecture

This module creates a complete infrastructure for a real-time chat application using Azure services:

- **Azure Cosmos DB**: Stores chat messages with SQL API and Change Feed enabled
- **Azure SignalR Service**: Provides real-time communication between clients
- **Azure Functions App**: Processes Cosmos DB Change Feed events and pushes to SignalR
- **Azure App Service**: Hosts both frontend and backend applications
- **Azure Storage Account**: Provides blob storage with a public container
- **Application Insights**: Monitors performance and provides logging capabilities

## Usage

```hcl
module "azure_chat" {
  source = "./modules/azure-chat"

  # Project configuration
  project_name = "chat-app"
  environment  = "dev"
  location     = "westeurope"
  
  # Cosmos DB configuration
  cosmos_db_name      = "AzureChatDB"
  cosmos_db_container = "Messages"
  message_ttl_seconds = 2592000  # 30 days
  
  # Backend and frontend app names
  backend_app_name  = "chatapp-api-dev"
  frontend_app_name = "chatapp-web-dev"
  
  # Container images
  backend_image_name  = "chat-backend"
  backend_image_tag   = "latest"
  frontend_image_name = "chat-frontend"
  frontend_image_tag  = "latest"
  
  # Optional: Additional CORS origins
  additional_allowed_origins = ["https://myapp.example.com"]
  
  # Optional: Configure service tiers
  app_service_sku  = "P1v2"
  signalr_sku      = "Standard_S1"
  signalr_capacity = 1
  
  # Tags
  tags = {
    Environment = "Development"
    Project     = "Chat Application"
    Owner       = "DevOps Team"
  }
}
```

## Deployment Process

1. **Set up environment variables**:
   ```bash
   # Copy the example file and edit with your settings
   cp local.env.example local.env
   # Edit the file to set your identifier and container registry
   nano local.env
   ```

2. **Provision Infrastructure**:
   ```bash
   cd infrastructure
   terraform init
   terraform plan
   terraform apply
   ```

3. **Build and Push Container Images**:
   ```bash
   # Backend
   cd ../backend
   make build
   make acr-login
   make push
   
   # Frontend
   cd ../frontend
   make build
   make acr-login
   make push
   ```

4. **Restart the App Services** (if needed):
   ```bash
   # Backend
   cd ../backend
   make webapp-restart
   
   # Frontend
   cd ../frontend
   make webapp-restart
   ```

5. **Monitor logs**:
   ```bash
   # Backend logs
   make webapp-log
   
   # Frontend logs
   cd ../frontend
   make webapp-log
   ```

## Required Input Variables

| Name | Description |
|------|-------------|
| `instance_name` | The base name for all resources |
| `resource_group_name` | The name of the resource group |
| `location` | Azure region for resource deployment |
| `container_registry_login_server` | The login server URL for the container registry |
| `container_registry_admin_username` | The admin username for the container registry |
| `container_registry_admin_password` | The admin password for the container registry |

## Optional Input Variables

| Name | Description | Default |
|------|-------------|---------|
| `cosmos_db_name` | Name of the Cosmos DB database | `"ChatDatabase"` |
| `cosmos_db_container` | Name of the Cosmos DB container | `"ChatMessages"` |
| `message_ttl_seconds` | TTL for chat messages (null = no expiration) | `null` |
| `signalr_sku` | SKU for SignalR service | `"Free_F1"` |
| `signalr_capacity` | Capacity for SignalR service | `1` |
| `app_service_sku` | SKU for App Service Plan | `"B1"` |
| `backend_app_name` | Name of the backend App Service | `"azure-chat-backend"` |
| `backend_image_name` | Name of the backend Docker image | `"azure-chat-backend"` |
| `backend_image_tag` | Tag for the backend Docker image | `"latest"` |
| `frontend_app_name` | Name of the frontend App Service | `"azure-chat-frontend"` |
| `frontend_image_name` | Name of the frontend Docker image | `"azure-chat-frontend"` |
| `frontend_image_tag` | Tag for the frontend Docker image | `"latest"` |
| `additional_allowed_origins` | Additional origins for CORS | `["http://localhost:5173", "http://localhost:8000"]` |
| `tags` | Tags to apply to all resources | `{ Environment = "Development", Project = "Azure Chat", ManagedBy = "Terraform" }` |

## Outputs

| Name | Description |
|------|-------------|
| `resource_group_name` | The name of the resource group |
| `cosmos_db_endpoint` | The endpoint of the Cosmos DB account |
| `cosmos_db_name` | The name of the Cosmos DB database |
| `cosmos_db_container` | The name of the Cosmos DB container |
| `signalr_service_name` | The name of the SignalR service |
| `backend_app_name` | The name of the backend App Service |
| `backend_app_url` | The URL of the backend App Service |
| `frontend_app_name` | The name of the frontend App Service |
| `frontend_app_url` | The URL of the frontend App Service |
| `container_registry_name` | The name of the container registry |
| `container_registry_login_server` | The login server for the container registry |
| `function_app_name` | The name of the Azure Function App |
| `function_app_default_hostname` | The default hostname of the Azure Function App |

Note: Some sensitive outputs like connection strings and keys are marked as `sensitive = true` and won't be displayed in Terraform output, but can be accessed in code via the outputs.

## Security Considerations

This module uses managed identities and RBAC assignments to allow services to securely interact with each other:

- The Functions App is given access to Cosmos DB and SignalR Service
- Both frontend and backend apps have AcrPull access to the Container Registry
- All sensitive values like keys and connection strings are marked as sensitive in outputs

## Notes

- The SignalR Free tier (Free_F1) has limitations and is suitable only for development
- For production, change SKUs to appropriate levels (at least Standard tier for SignalR)
- For high availability, consider using Cosmos DB with multi-region write capabilities and redundant App Service Plans