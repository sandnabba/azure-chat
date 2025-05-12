/**
 * Azure Chat Service Infrastructure
 *
 * This file provisions the Azure Chat Service infrastructure using the azure-chat module.
 * Simplified for testing purposes only.
 */

# Deploy the Azure Chat Service module
module "azure_chat" {
  source = "./azure-chat-tf-module"

  # Project configuration
  identifier          = "${var.identifier}-chat"
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name

  # Container registry information
  container_registry_login_server   = var.container_registry_login_server
  container_registry_admin_username = var.container_registry_admin_username
  container_registry_admin_password = var.container_registry_admin_password

  # App names - must be globally unique
  backend_app_name  = "chat-api-${var.identifier}"
  frontend_app_name = "chat-web-${var.identifier}"

  # Container images 
  backend_image_name  = "azure-chat-backend"
  backend_image_tag   = "latest"
  frontend_image_name = "azure-chat-frontend"
  frontend_image_tag  = "latest"

  # Allow localhost for development
  additional_allowed_origins = ["http://localhost:5173", "http://localhost:8000"]

  # Front Door configuration
  front_door_hostname = var.front_door_hostname

  tags = {}
}

# Add outputs for App Service URLs and names for troubleshooting
output "backend_app_name" {
  description = "The name of the backend App Service"
  value       = module.azure_chat.backend_app_name
}

output "backend_app_url" {
  description = "The URL of the backend App Service"
  value       = module.azure_chat.backend_app_url
}

output "cosmos_db_uri" {
  description = "The URI endpoint for the Cosmos DB account from the azure_chat module."
  value       = module.azure_chat.cosmos_db_uri
}

output "cosmos_db_primary_key" {
  description = "The primary key for the Cosmos DB account."
  value       = module.azure_chat.cosmos_db_primary_key
  sensitive   = true
}
