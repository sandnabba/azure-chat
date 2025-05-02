resource "azurerm_signalr_service" "chat_signalr" {
  name                = "${var.identifier}-signalr"
  location            = var.location
  resource_group_name = var.resource_group_name
  
  sku {
    name     = var.signalr_sku
    capacity = var.signalr_capacity
  }
  
  # Remove circular dependency by adding CORS and upstream endpoint later if needed
  service_mode = "Default"
  
  connectivity_logs_enabled = true
  messaging_logs_enabled = true
  
  tags = var.tags
  
  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}