# Storage Account for Azure Chat Services
resource "azurerm_storage_account" "chat_storage" {
  name                     = "${replace(var.identifier, "-", "")}func"
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = var.tags

  # Enable blob public access
  allow_nested_items_to_be_public = true

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Public Blob Container with 1-day retention
resource "azurerm_storage_container" "public_files" {
  name                  = "public-files"
  storage_account_id    = azurerm_storage_account.chat_storage.id
  container_access_type = "blob"  # Allows public read access for blobs
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