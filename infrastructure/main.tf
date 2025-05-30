# Shared resources for all Azure infrastructure
# * Resource Group
# * Virtual Network
# * Subnet

# --- Local Values ---
locals {
  resource_group_name = "${var.identifier}-chat-rg"
  vnet_name           = "${var.identifier}-chat-vnet"
  # Front Door endpoint name for shared use across modules
  front_door_endpoint_name = "${var.identifier}-chat-endpoint"
}

# --- Resource Group ---
resource "azurerm_resource_group" "rg" {
  name     = local.resource_group_name
  location = var.location

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# --- Network Resources (Top Level) ---
resource "azurerm_virtual_network" "vnet" {
  name                = local.vnet_name
  address_space       = var.vnet_address_space
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  lifecycle {
    ignore_changes = [tags]
  }
}

resource "azurerm_subnet" "subnet" {
  name                 = var.subnet_name
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = var.subnet_address_prefix

  lifecycle {
    ignore_changes = [delegation]
  }
}

