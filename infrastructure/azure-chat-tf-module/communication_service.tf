// Azure Communication Service
resource "azurerm_communication_service" "chat_comm" {
  name                = "${var.identifier}-chat-communication-service"
  resource_group_name = var.resource_group_name
  data_location       = "Europe"
  tags                = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Azure Communication Email Service
resource "azurerm_email_communication_service" "chat_email" {
  name                = "${var.identifier}-chat-email-service"
  resource_group_name = var.resource_group_name
  data_location       = "Europe"
  tags                = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Email Communication Service Domain
resource "azurerm_email_communication_service_domain" "chat_email_domain" {
  name             = "AzureManagedDomain"
  email_service_id = azurerm_email_communication_service.chat_email.id

  domain_management = "AzureManaged"

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

resource "azurerm_communication_service_email_domain_association" "chat_email_domain_association" {
  communication_service_id = azurerm_communication_service.chat_comm.id
  email_service_domain_id  = azurerm_email_communication_service_domain.chat_email_domain.id
}