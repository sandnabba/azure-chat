# App Service Plan for backend, frontend and functions
resource "azurerm_service_plan" "chat_app_service_plan" {
  name                = "${var.identifier}-plan"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  sku_name            = var.app_service_sku
  tags                = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "chat_logs" {
  name                = "${var.identifier}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Application Insights
resource "azurerm_application_insights" "chat_app_insights" {
  name                = "${var.identifier}-insights"
  location            = var.location
  resource_group_name = var.resource_group_name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.chat_logs.id
  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
  tags = var.tags
}

# Backend App Service
resource "azurerm_linux_web_app" "backend" {
  name                = var.backend_app_name
  location            = var.location
  resource_group_name = var.resource_group_name
  service_plan_id     = azurerm_service_plan.chat_app_service_plan.id
  https_only          = true

  site_config {
    always_on           = true
    ftps_state          = "Disabled"
    minimum_tls_version = "1.2"
    websockets_enabled  = true
    #app_command_line    = "gunicorn src.app:app --bind 0.0.0.0:8000 --worker-class uvicorn.workers.UvicornWorker --timeout 120 --log-level info --access-logfile - --error-logfile -"

    application_stack {
      docker_image_name        = "${var.backend_image_name}:${var.backend_image_tag}"
      docker_registry_url      = "https://${var.container_registry_login_server}"
      docker_registry_username = var.container_registry_admin_username
      docker_registry_password = var.container_registry_admin_password
    }

    health_check_path                 = "/api/health"
    health_check_eviction_time_in_min = 5

    cors {
      allowed_origins = concat(
        ["https://${var.frontend_app_name}.azurewebsites.net",
          "http://localhost:5173",
          "http://localhost:3000",
          "http://localhost"
        ],
        var.additional_allowed_origins
      )
      support_credentials = true
    }
  }

  app_settings = {
    "WEBSITES_PORT"                         = "8000"
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"   = "false"
    "WEBSITES_CONTAINER_START_TIME_LIMIT"   = "600"
    "COSMOS_ENDPOINT"                       = azurerm_cosmosdb_account.chat_db.endpoint
    "COSMOS_KEY"                            = azurerm_cosmosdb_account.chat_db.primary_key
    "SERVICEBUS_CONNECTION_STRING"          = azurerm_servicebus_namespace.chat_servicebus.default_primary_connection_string
    "APPINSIGHTS_INSTRUMENTATIONKEY"        = azurerm_application_insights.chat_app_insights.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.chat_app_insights.connection_string
    "AZURE_STORAGE_CONNECTION_STRING"       = azurerm_storage_account.chat_storage.primary_connection_string
    "AZURE_STORAGE_CONTAINER_NAME"          = "chat-attachments"
    "PYTHONDONTWRITEBYTECODE"               = "1"
    "PYTHONUNBUFFERED"                      = "1"
  }

  logs {
    detailed_error_messages = true
    failed_request_tracing  = true

    application_logs {
      file_system_level = "Warning"
    }

    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 100
      }
    }
  }

  identity {
    type = "SystemAssigned"
  }

  lifecycle {
    ignore_changes = [
      tags["Cost Center"],
      tags["hidden-link: /app-insights-conn-string"],
      tags["hidden-link: /app-insights-instrumentation-key"],
      tags["hidden-link: /app-insights-resource-id"]
    ]
  }

  tags = var.tags
}
