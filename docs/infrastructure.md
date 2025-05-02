# Infrastructure Documentation

The Azure Chat service is deployed on Azure using Terraform for infrastructure as code.

## Overview

The service uses the following Azure resources:
- Resource Group
- Azure App Service Plan
- Azure App Service (Frontend and Backend, using custom Docker containers)
- Azure Cosmos DB (NoSQL)
- Azure Blob Storage
- Azure Private DNS
- Virtual Network and Subnet
- (Planned) Azure Queue Storage
- (Planned) Azure Functions

## Limitations

This is a learning project with the following limitations:
- **Minimal Security**: Basic security hardening
- **Basic Networking**: Simple network configurations
- **Manual Deployment**: No CI/CD pipeline
- **Limited Monitoring**: Observability not fully implemented
- **No Backups**: Data resilience not addressed

## Security Considerations

> **Note**: This project uses simplified authentication methods for learning purposes. For production, consider:
- **Managed Identities**: Replace service principals and passwords
- **RBAC**: Use Azure Role-Based Access Control
- **Key Vault**: Store secrets securely
- **Private Endpoints**: Restrict access to private networks
- **NSGs**: Configure Network Security Groups
- **JIT Access**: Enable Just-In-Time access
- **Service Endpoints**: Restrict traffic to virtual networks

## Prerequisites

- Azure CLI
- Terraform 1.0+
- Azure Subscription
- Docker

## Configuration

### Terraform Variables

Set variables in `terraform.tfvars`. Use `terraform.tfvars.example` as a template.

| Variable          | Description                  | Default          |
|-------------------|------------------------------|------------------|
| `subscription_id` | Azure Subscription ID        | (required)       |
| `identifier`      | Unique resource identifier   | (required)       |
| `location`        | Azure deployment region      | `Sweden Central` |

### Resource Naming

Resource names are based on the `identifier` variable:
- Resource Group: `${var.identifier}-chat-rg`
- Virtual Network: `${var.identifier}-chat-vnet`

## Docker Deployment

The backend and frontend are deployed as custom Docker containers:
1. Build Docker images using the provided Dockerfiles.
2. Push images to a container registry (e.g., Azure Container Registry).
3. Deploy containers to Azure App Service.
4. Configure environment variables in App Service settings.

## Deployment Steps

1. Initialize Terraform:
   ```bash
   cd infrastructure
   terraform init
   ```

2. Plan the deployment:
   ```bash
   terraform plan -out=tfplan
   ```

3. Apply the changes:
   ```bash
   terraform apply tfplan
   ```
