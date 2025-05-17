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

# Static Website
output "static_website_url" {
  description = "The URL of the static website hosted in Blob Storage"
  value       = azurerm_storage_account.chat_storage.primary_web_endpoint
}

output "static_website_hostname" {
  description = "The hostname of the static website (without protocol) for DNS configuration"
  value       = azurerm_storage_account.chat_storage.primary_web_host
}

# Communication Service
output "communication_service_name" {
  description = "The name of the Azure Communication Service"
  value       = azurerm_communication_service.chat_comm.name
}

output "communication_service_connection_string" {
  description = "The connection string for the Azure Communication Service"
  value       = azurerm_communication_service.chat_comm.primary_connection_string
  sensitive   = true
}

# Email Service
output "email_service_name" {
  description = "The name of the Azure Communication Email Service"
  value       = azurerm_email_communication_service.chat_email.name
}

output "email_service_id" {
  description = "The resource ID of the Azure Communication Email Service"
  value       = azurerm_email_communication_service.chat_email.id
}

# Service Bus Outputs
output "servicebus_connection_string" {
  description = "The primary connection string for the Service Bus namespace"
  value       = azurerm_servicebus_namespace.chat_servicebus.default_primary_connection_string
  sensitive   = true
}

output "servicebus_messages_topic_name" {
  description = "The name of the Service Bus topic for chat messages"
  value       = azurerm_servicebus_topic.chat_messages_topic.name
}

# Front Door Outputs
output "front_door_endpoint_url" {
  description = "The URL of the Front Door endpoint"
  value       = "https://${azurerm_cdn_frontdoor_endpoint.chat_fd_endpoint.host_name}"
}

output "front_door_cname_target" {
  description = "The DNS target to use for a CNAME record"
  value       = azurerm_cdn_frontdoor_endpoint.chat_fd_endpoint.host_name
}

output "front_door_custom_domain_validation_token" {
  description = "The validation token required for the custom domain TXT record (only available when front_door_hostname is set)"
  value       = var.front_door_hostname != "" ? azurerm_cdn_frontdoor_custom_domain.chat_custom_domain[0].validation_token : null
}

output "front_door_endpoint_name" {
  description = "The name of the Front Door endpoint"
  value       = azurerm_cdn_frontdoor_endpoint.chat_fd_endpoint.name
}