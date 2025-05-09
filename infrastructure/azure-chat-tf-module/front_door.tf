/**
 * Azure Chat Service Infrastructure Module - Front Door
 *
 * This file configures Azure Front Door to serve the static website and API.
 */

# Local variables for Front Door configuration
locals {
  front_door_profile_name     = "${var.identifier}-fd-profile"
  front_door_endpoint_name    = "${var.identifier}-endpoint"
  front_door_origin_group     = "${var.identifier}-static-origins"
  front_door_origin_name      = "${var.identifier}-static-origin"
  front_door_route_name       = "${var.identifier}-static-route"
  
  # API origin group and route names
  front_door_api_origin_group = "${var.identifier}-api-origins"
  front_door_api_origin_name  = "${var.identifier}-api-origin"
  front_door_api_route_name   = "${var.identifier}-api-route"
  
  # Use the custom hostname if provided, otherwise use the default Front Door hostname
  front_door_hostname         = var.front_door_hostname != "" ? var.front_door_hostname : "${local.front_door_endpoint_name}.z01.azurefd.net"
}

# Front Door Profile (Required container resource)
resource "azurerm_cdn_frontdoor_profile" "chat_fd_profile" {
  name                = local.front_door_profile_name
  resource_group_name = var.resource_group_name
  sku_name            = "Standard_AzureFrontDoor"
  tags                = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Front Door Endpoint (Required - this is the endpoint users will access)
resource "azurerm_cdn_frontdoor_endpoint" "chat_fd_endpoint" {
  name                     = local.front_door_endpoint_name
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.chat_fd_profile.id
  tags                     = var.tags

  lifecycle {
    ignore_changes = [tags["Cost Center"]]
  }
}

# Custom domain configuration if a hostname is provided
resource "azurerm_cdn_frontdoor_custom_domain" "chat_custom_domain" {
  count                    = var.front_door_hostname != "" ? 1 : 0
  name                     = replace(var.front_door_hostname, ".", "-")
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.chat_fd_profile.id
  host_name                = var.front_door_hostname
  
  tls {
    certificate_type    = "ManagedCertificate"
  }

  # This validation token is needed for domain ownership verification
  # It will be used to create a TXT record in the DNS configuration
}

# Front Door Origin Group (Required - defines how to handle routing to origins)
resource "azurerm_cdn_frontdoor_origin_group" "chat_static_origin_group" {
  name                     = local.front_door_origin_group
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.chat_fd_profile.id
  
  # Simple load balancing configuration
  load_balancing {
    sample_size                 = 1
    successful_samples_required = 1
  }
}

# Front Door Origin (Required - defines where to route traffic)
resource "azurerm_cdn_frontdoor_origin" "chat_static_origin" {
  name                          = local.front_door_origin_name
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.chat_static_origin_group.id
  
  enabled                       = true
  host_name                     = azurerm_storage_account.chat_storage.primary_web_host
  http_port                     = 80
  https_port                    = 443
  origin_host_header            = azurerm_storage_account.chat_storage.primary_web_host
  priority                      = 1
  weight                        = 1000
  certificate_name_check_enabled = true
}

# Front Door Route (Required - defines routing rules)
resource "azurerm_cdn_frontdoor_route" "chat_static_route" {
  name                          = local.front_door_route_name
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.chat_fd_endpoint.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.chat_static_origin_group.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.chat_static_origin.id]
  
  enabled                       = true
  forwarding_protocol           = "HttpsOnly"
  https_redirect_enabled        = true
  patterns_to_match             = ["/*"]
  supported_protocols           = ["Http", "Https"]
  
  # Associate the custom domain with this route if provided
  cdn_frontdoor_custom_domain_ids = var.front_door_hostname != "" ? [azurerm_cdn_frontdoor_custom_domain.chat_custom_domain[0].id] : []
}

# API Origin Group for backend App Service
resource "azurerm_cdn_frontdoor_origin_group" "chat_api_origin_group" {
  name                     = local.front_door_api_origin_group
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.chat_fd_profile.id
  
  load_balancing {
    sample_size                 = 1
    successful_samples_required = 1
  }

  health_probe {
    path                = "/api/health"
    protocol            = "Https"
    interval_in_seconds = 120
  }
}

# API Origin for backend App Service
resource "azurerm_cdn_frontdoor_origin" "chat_api_origin" {
  name                          = local.front_door_api_origin_name
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.chat_api_origin_group.id
  
  enabled                       = true
  host_name                     = azurerm_linux_web_app.backend.default_hostname
  http_port                     = 80
  https_port                    = 443
  origin_host_header            = azurerm_linux_web_app.backend.default_hostname
  priority                      = 1
  weight                        = 1000
  certificate_name_check_enabled = true
}

# Front Door Route for API requests (including WebSockets)
resource "azurerm_cdn_frontdoor_route" "chat_api_route" {
  name                          = local.front_door_api_route_name
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.chat_fd_endpoint.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.chat_api_origin_group.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.chat_api_origin.id]
  
  enabled                       = true
  forwarding_protocol           = "HttpsOnly"
  https_redirect_enabled        = true
  patterns_to_match             = ["/api/*", "/ws/*"]  # Combined patterns to match both API and WebSocket paths
  supported_protocols           = ["Http", "Https"]
  link_to_default_domain        = true
  
  # Associate the custom domain with this route if provided
  cdn_frontdoor_custom_domain_ids = var.front_door_hostname != "" ? [azurerm_cdn_frontdoor_custom_domain.chat_custom_domain[0].id] : []
}