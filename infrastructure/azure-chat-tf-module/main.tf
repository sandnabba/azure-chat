/**
 * Azure Chat Service Infrastructure Module
 * 
 * This module provisions all the required Azure services for the real-time chat application:
 * - Azure Cosmos DB for storing chat messages and rooms
 * - Azure SignalR Service for real-time messaging (defined in signalr.tf)
 * - Azure Functions for processing Cosmos DB Change Feed
 * - App Services for hosting the frontend and backend
 * - Application Insights for monitoring
 * 
 * Uses external modules:
 * - Container Registry (referenced from existing module)
 * - Resource Group (referenced from parent module)
 */


# Function App for Cosmos DB Change Feed processing
# TODO: Investigate if needed
resource "azurerm_linux_function_app" "chat_functions" {
  name                       = "${var.identifier}-functions"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  service_plan_id            = azurerm_service_plan.chat_app_service_plan.id
  storage_account_name       = azurerm_storage_account.chat_storage.name
  storage_account_access_key = azurerm_storage_account.chat_storage.primary_access_key

  site_config {
    application_stack {
      python_version = "3.9"
    }
  }

  app_settings = {
    "COSMOS_DB_CONNECTION_STRING"           = azurerm_cosmosdb_account.chat_db.primary_sql_connection_string
    "COSMOS_DB_DATABASE"                    = azurerm_cosmosdb_sql_database.chat_database.name
    "COSMOS_DB_CONTAINER"                   = azurerm_cosmosdb_sql_container.messages_container.name
    "SIGNALR_CONNECTION_STRING"             = azurerm_signalr_service.chat_signalr.primary_connection_string
    "APPINSIGHTS_INSTRUMENTATIONKEY"        = azurerm_application_insights.chat_app_insights.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.chat_app_insights.connection_string
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [
      app_settings["APPINSIGHTS_INSTRUMENTATIONKEY"],
      app_settings["APPLICATIONINSIGHTS_CONNECTION_STRING"],
      site_config[0].application_insights_key,
      site_config[0].application_insights_connection_string,
      tags["Cost Center"]
    ]
  }
}
