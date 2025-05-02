/**
 * Azure Chat Service Infrastructure Module - Outputs
 *
 * Outputs for the Azure chat service infrastructure.
 */

# Cosmos DB
output "cosmos_db_endpoint" {
  description = "The endpoint of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.chat_db.endpoint
}

output "cosmos_db_primary_key" {
  description = "The primary key for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.chat_db.primary_key
  sensitive   = true
}

output "cosmos_db_connection_string" {
  description = "The connection string for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.chat_db.primary_sql_connection_string
  sensitive   = true
}

output "cosmos_db_name" {
  description = "The name of the Cosmos DB database"
  value       = azurerm_cosmosdb_sql_database.chat_database.name
}

output "cosmos_db_container" {
  description = "The name of the Cosmos DB container"
  value       = azurerm_cosmosdb_sql_container.messages_container.name
}

output "cosmos_db_uri" {
  description = "The URI endpoint for the Cosmos DB account."
  value       = azurerm_cosmosdb_account.chat_db.endpoint
}

# SignalR
output "signalr_service_name" {
  description = "The name of the SignalR service"
  value       = azurerm_signalr_service.chat_signalr.name
}

output "signalr_connection_string" {
  description = "The primary connection string for the Azure SignalR Service."
  value       = azurerm_signalr_service.chat_signalr.primary_connection_string
  sensitive   = true
}

# App Service
output "app_service_plan_id" {
  description = "The ID of the App Service Plan"
  value       = azurerm_service_plan.chat_app_service_plan.id
}

# Backend App
output "backend_app_name" {
  description = "The name of the backend App Service"
  value       = azurerm_linux_web_app.backend.name
}

output "backend_app_url" {
  description = "The URL of the backend App Service"
  value       = "https://${azurerm_linux_web_app.backend.default_hostname}"
}

output "backend_app_id" {
  description = "The ID of the backend App Service"
  value       = azurerm_linux_web_app.backend.id
}

# Frontend App
output "frontend_app_name" {
  description = "The name of the frontend App Service"
  value       = azurerm_linux_web_app.frontend.name
}

output "frontend_app_url" {
  description = "The URL of the frontend App Service"
  value       = "https://${azurerm_linux_web_app.frontend.default_hostname}"
}

output "frontend_app_id" {
  description = "The ID of the frontend App Service"
  value       = azurerm_linux_web_app.frontend.id
}

# Functions
output "function_app_name" {
  description = "The name of the Azure Function App"
  value       = azurerm_linux_function_app.chat_functions.name
}

output "function_app_id" {
  description = "The ID of the Azure Function App"
  value       = azurerm_linux_function_app.chat_functions.id
}

output "function_app_url" {
  description = "The URL of the Azure Function App"
  value       = "https://${azurerm_linux_function_app.chat_functions.default_hostname}"
}

# Application Insights
output "application_insights_instrumentation_key" {
  description = "The instrumentation key for Application Insights"
  value       = azurerm_application_insights.chat_app_insights.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "The connection string for Application Insights"
  value       = azurerm_application_insights.chat_app_insights.connection_string
  sensitive   = true
}

# Event Grid
output "eventgrid_topic_endpoint" {
  description = "The endpoint of the Event Grid topic"
  value       = azurerm_eventgrid_topic.chat_events.endpoint
}

output "eventgrid_topic_key" {
  description = "The primary access key for the Event Grid topic"
  value       = azurerm_eventgrid_topic.chat_events.primary_access_key
  sensitive   = true
}

output "eventgrid_topic_name" {
  description = "The name of the Event Grid topic"
  value       = azurerm_eventgrid_topic.chat_events.name
}

# Removed output for system topic since resource is commented out
# output "eventgrid_system_topic_name" {
#   description = "The name of the Event Grid system topic"
#   value       = azurerm_eventgrid_system_topic.chat_system_events.name
# }

# Storage
output "storage_account_name" {
  description = "The name of the Storage account"
  value       = azurerm_storage_account.chat_storage.name
}

output "storage_connection_string" {
  description = "The connection string for the Storage account"
  value       = azurerm_storage_account.chat_storage.primary_connection_string
  sensitive   = true
}