output "resource_group_name" {
  description = "The name of the created resource group."
  value       = azurerm_resource_group.rg.name
}

output "resource_group_location" {
  description = "The location of the created resource group."
  value       = azurerm_resource_group.rg.location
}

output "storage_account_name" {
  description = "The name of the Storage account from the azure_chat module."
  value       = module.azure_chat.storage_account_name
}

output "storage_connection_string" {
  description = "The connection string for the Storage account."
  value       = module.azure_chat.storage_connection_string
  sensitive   = true
}

output "communication_service_name" {
  description = "The name of the Azure Communication Service"
  value       = module.azure_chat.communication_service_name
}

output "communication_service_connection_string" {
  description = "The connection string for the Azure Communication Service"
  value       = module.azure_chat.communication_service_connection_string
  sensitive   = true
}

