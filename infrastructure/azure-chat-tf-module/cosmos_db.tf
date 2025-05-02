# Cosmos DB Account
resource "azurerm_cosmosdb_account" "chat_db" {
  name                = "${var.identifier}-db"
  location            = var.location
  resource_group_name = var.resource_group_name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  capabilities {
    name = "EnableServerless"
  }

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Cosmos DB SQL Database
resource "azurerm_cosmosdb_sql_database" "chat_database" {
  name                = var.cosmos_db_name
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.chat_db.name
}

# Cosmos DB SQL Container for Messages
resource "azurerm_cosmosdb_sql_container" "messages_container" {
  name                = var.cosmos_db_container
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.chat_db.name
  database_name       = azurerm_cosmosdb_sql_database.chat_database.name
  partition_key_paths = ["/chatId"]
  default_ttl         = var.message_ttl_seconds
}

# Cosmos DB SQL Container for Users
resource "azurerm_cosmosdb_sql_container" "users_container" {
  name                = "Users"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.chat_db.name
  database_name       = azurerm_cosmosdb_sql_database.chat_database.name
  partition_key_paths = ["/id"]
}

# Cosmos DB SQL Container for Rooms
resource "azurerm_cosmosdb_sql_container" "rooms_container" {
  name                = "Rooms"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.chat_db.name
  database_name       = azurerm_cosmosdb_sql_database.chat_database.name
  partition_key_paths = ["/id"]
}
