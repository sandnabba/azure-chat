# Storage Account for Azure Chat Services
resource "azurerm_storage_account" "chat_storage" {
  name                     = "${replace(var.identifier, "-", "")}storage"
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"  # Required for static website hosting
  tags                     = var.tags

  # Enable blob public access
  allow_nested_items_to_be_public = true

  # CORS configuration for the static website
  blob_properties {
    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "HEAD", "OPTIONS"]
      allowed_origins    = concat(["https://${var.frontend_app_name}.azurewebsites.net"], var.additional_allowed_origins)
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Static Website Configuration - using the new recommended resource
resource "azurerm_storage_account_static_website" "static_website" {
  storage_account_id = azurerm_storage_account.chat_storage.id
  
  index_document     = "index.html"
  error_404_document = "404.html"  # Now using a dedicated 404 page
}

# Public Blob Container with 1-day retention
resource "azurerm_storage_container" "public_files" {
  name                  = "public-files"
  storage_account_id    = azurerm_storage_account.chat_storage.id
  container_access_type = "blob" # Allows public read access for blobs
}

# Function packages container for Azure Functions deployments
resource "azurerm_storage_container" "function_packages" {
  name                  = "function-packages"
  storage_account_id    = azurerm_storage_account.chat_storage.id
  container_access_type = "private" # Private access for function packages
}

# Lifecycle policy for the public files (1-day retention)
resource "azurerm_storage_management_policy" "public_files_lifecycle" {
  storage_account_id = azurerm_storage_account.chat_storage.id

  rule {
    name    = "DeleteAfter1Day"
    enabled = true
    filters {
      prefix_match = ["public-files/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 1
      }
    }
  }
}
