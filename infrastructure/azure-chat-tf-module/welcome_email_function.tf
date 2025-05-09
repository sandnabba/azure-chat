# App Service Plan for Function App (Basic tier instead of Consumption)
resource "azurerm_service_plan" "welcome_email_func" {
  name                = "${var.identifier}-welcome-email-plan"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  sku_name            = "FC1"

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

resource "azurerm_log_analytics_workspace" "logAnalyticsWorkspace" {
  name                = "${var.identifier}-log-analytics"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

resource "azurerm_application_insights" "appInsights" {
  name                = "${var.identifier}-app-insights"
  location            = var.location
  resource_group_name = var.resource_group_name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.logAnalyticsWorkspace.id

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

locals {
  blobStorageAndContainer = "${azurerm_storage_account.chat_storage.primary_blob_endpoint}function-packages"
}

# Azure Function App for Welcome Email (using the newer azurerm_linux_function_app resource)
resource "azurerm_function_app_flex_consumption" "welcome_email" {
  name                        = "${var.identifier}-welcome-email-func"
  location                    = var.location
  resource_group_name         = var.resource_group_name
  storage_container_type      = "blobContainer"
  storage_container_endpoint  = local.blobStorageAndContainer
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = azurerm_storage_account.chat_storage.primary_access_key
  runtime_name                = "python"
  runtime_version             = "3.12"
  instance_memory_in_mb       = 512
  service_plan_id             = azurerm_service_plan.welcome_email_func.id

  client_certificate_mode                        = "Required"
  webdeploy_publish_basic_authentication_enabled = false

  site_config {
    application_insights_connection_string = azurerm_application_insights.appInsights.connection_string
    application_insights_key               = azurerm_application_insights.appInsights.instrumentation_key
  }

  app_settings = {
    AzureWebJobsStorage = "" //workaround until https://github.com/hashicorp/terraform-provider-azurerm/pull/29099 gets released

    # Use existing Cosmos DB connection
    CosmosDBConnectionString = azurerm_cosmosdb_account.chat_db.primary_sql_connection_string

    # Use existing Communication Service connection
    ACSConnectionString = azurerm_communication_service.chat_comm.primary_connection_string

    # Use a default sender email or make it configurable
    SenderEmail = "DoNotReply@${azurerm_email_communication_service_domain.chat_email_domain.mail_from_sender_domain}"

    # Full URL including https:// protocol for the frontend
    FRONTEND_URL = var.front_door_hostname != "" ? "https://${var.front_door_hostname}" : "https://${azurerm_cdn_frontdoor_endpoint.chat_fd_endpoint.host_name}"
  }

  lifecycle {
    ignore_changes = [
      tags,
      sticky_settings,
      #    storage_access_key, 
      app_settings["AzureWebJobsStorage"]
    ]
  }
}
