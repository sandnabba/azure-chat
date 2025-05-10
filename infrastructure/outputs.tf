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

# --- Front Door Outputs ---
output "front_door_endpoint_url" {
  description = "The URL of the Front Door endpoint"
  value       = module.azure_chat.front_door_endpoint_url
}

output "front_door_cname_target" {
  description = "The DNS target to use for a CNAME record (e.g., for chat.azure.sandnabba.se)"
  value       = module.azure_chat.front_door_cname_target
}

# Output the domain validation token for creating the required TXT record
output "front_door_custom_domain_validation_token" {
  description = "The validation token required for the custom domain TXT record. Add this as a TXT record with name '_dnsauth.chat' to your DNS zone."
  value       = module.azure_chat.front_door_custom_domain_validation_token
}

