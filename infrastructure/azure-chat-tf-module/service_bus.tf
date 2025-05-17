# Azure Service Bus Namespace
resource "azurerm_servicebus_namespace" "chat_servicebus" {
  name                = "${var.identifier}-bus"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Standard" # Use Standard tier to support topics and subscriptions
  tags                = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Azure Service Bus Topic for chat messages
resource "azurerm_servicebus_topic" "chat_messages_topic" {
  name                  = "chat-messages"
  namespace_id          = azurerm_servicebus_namespace.chat_servicebus.id
  default_message_ttl   = "PT1H" # 1 hour TTL for messages
}
