/**
 * Azure Chat Service Infrastructure Module - Event Grid
 *
 * This file defines the Event Grid resources needed for the chat service.
 */

# Event Grid Topic for Azure Chat events
resource "azurerm_eventgrid_topic" "chat_events" {
  name                = "${var.identifier}-events"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Event Grid System Topic for Azure Chat system events
# Disabled due to unrecognized topic type error
/*
resource "azurerm_eventgrid_system_topic" "chat_system_events" {
  name                   = "${var.identifier}-system-events"
  location               = var.location
  resource_group_name    = var.resource_group_name
  source_arm_resource_id = azurerm_cosmosdb_account.chat_db.id
  topic_type             = "Microsoft.DocumentDB.Accounts"
  tags                   = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}
*/