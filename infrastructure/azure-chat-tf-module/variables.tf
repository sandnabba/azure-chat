/**
 * Azure Chat Service Infrastructure Module - Variables
 *
 * All configurable variables for the Azure chat service infrastructure.
 * Simplified for testing environment only.
 */

variable "identifier" {
  description = "The identifier used for naming resources"
  type        = string
  default     = "azure-chat"
}

variable "location" {
  description = "The Azure region for all resources"
  type        = string
  default     = "westeurope"
}

variable "resource_group_name" {
  description = "The name of the resource group where all resources will be created"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Container Registry Configuration
variable "container_registry_login_server" {
  description = "The login server URL for the container registry"
  type        = string
}

variable "container_registry_admin_username" {
  description = "The admin username for the container registry"
  type        = string
}

variable "container_registry_admin_password" {
  description = "The admin password for the container registry"
  type        = string
  sensitive   = true
}

# Cosmos DB Configuration
variable "cosmos_db_name" {
  description = "Name of the Cosmos DB database"
  type        = string
  default     = "ChatDatabase"
}

variable "cosmos_db_container" {
  description = "Name of the Cosmos DB container for chat messages"
  type        = string
  default     = "ChatMessages"
}

variable "message_ttl_seconds" {
  description = "Time to live in seconds for chat messages (null means no expiration)"
  type        = number
  default     = 2592000 # 30 days
}

# App Service Configuration
variable "app_service_sku" {
  description = "The SKU name for the App Service Plan"
  type        = string
  default     = "B1"
}

# Backend App Configuration
variable "backend_app_name" {
  description = "Name of the backend app service"
  type        = string
  default     = "azure-chat-backend"
}

variable "backend_image_name" {
  description = "Name of the backend container image"
  type        = string
  default     = "azure-chat-backend"
}

variable "backend_image_tag" {
  description = "Tag of the backend container image"
  type        = string
  default     = "latest"
}

# Frontend App Configuration
variable "frontend_app_name" {
  description = "Name of the frontend app service"
  type        = string
  default     = "azure-chat-frontend"
}

variable "frontend_image_name" {
  description = "Name of the frontend container image"
  type        = string
  default     = "azure-chat-frontend"
}

variable "frontend_image_tag" {
  description = "Tag of the frontend container image"
  type        = string
  default     = "latest"
}

# CORS Configuration
variable "additional_allowed_origins" {
  description = "Additional origins to allow for CORS"
  type        = list(string)
  default     = ["http://localhost:5173", "http://localhost:8000"]
}

# Communication Service Configuration
variable "communication_service_name" {
  description = "Name of the Azure Communication Service resource"
  type        = string
  default     = "azure-chat-comm"
}

# Email Service Configuration
variable "email_service_name" {
  description = "Name of the Azure Communication Email Service resource"
  type        = string
  default     = "azure-chat-email"
}

# Front Door Configuration
variable "front_door_hostname" {
  description = "The custom hostname for the Front Door endpoint. If not specified, the default Azure Front Door hostname will be used."
  type        = string
  default     = ""
}
