variable "subscription_id" {
  description = "The Azure Subscription ID."
  type        = string
}

variable "identifier" {
  description = "A unique identifier for the resource."
  type        = string
}

variable "location" {
  description = "The Azure region where the main resource group will be created."
  type        = string
  default     = "Sweden Central"
}

# --- Container Registry Variables ---
variable "container_registry_login_server" {
  description = "The login server URL for the Azure Container Registry"
  type        = string
}

variable "container_registry_admin_username" {
  description = "The admin username for the Azure Container Registry"
  type        = string
}

variable "container_registry_admin_password" {
  description = "The admin password for the Azure Container Registry"
  type        = string
  sensitive   = true
}

# --- Network Variables ---
variable "vnet_address_space" {
  description = "The address space for the Virtual Network."
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "subnet_name" {
  description = "The name of the Subnet."
  type        = string
  default     = "default"
}

variable "subnet_address_prefix" {
  description = "The address prefix for the Subnet."
  type        = list(string)
  default     = ["10.0.1.0/24"]
}

variable "dns_zone_name" {
  description = "The name of the DNS zone."
  type        = string
  default     = "example.com"
}