# Configure the Azure provider at the root level
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0" # Broader constraint that includes newer versions
    }
  }
  required_version = ">= 1.3.0"
}

# Define the provider configuration with required features block
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}