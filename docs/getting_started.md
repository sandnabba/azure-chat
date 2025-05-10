# Azure Chat: Getting Started Guide

This document provides detailed instructions for setting up and deploying the Azure Chat service.

## Prerequisites

Before beginning, ensure you have:

- An Azure account with permissions to create resources
- Azure CLI installed and configured
- Terraform (v1.3.0+) installed
- Docker installed and configured
- Git (to clone this repository)
- An existing Azure Container Registry (ACR)
- An existing Resource Group for your ACR and deployment

## 1. Infrastructure Setup with Terraform

The first step is to provision the required Azure infrastructure using Terraform:

### 1.1 Configure Terraform Variables

1. Navigate to the infrastructure directory:
   ```bash
   cd infrastructure
   ```

2. Create your `terraform.tfvars` file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

3. Edit `terraform.tfvars` with your specific values:
   - `subscription_id`: Your Azure subscription ID
   - `identifier`: A unique identifier for your resources (e.g., your name)
   - `location`: Azure region for deployment (default: westeurope)
   - `container_registry_login_server`: Your ACR login server URL
   - `container_registry_admin_username`: Your ACR admin username
   - `container_registry_admin_password`: Your ACR admin password
   - `front_door_hostname`: (Optional) Custom hostname for the Front Door endpoint

### 1.2 Deploy Infrastructure

1. Initialize Terraform:
   ```bash
   terraform init
   ```

2. Preview the deployment plan:
   ```bash
   terraform plan -out=tfplan
   ```

3. Apply the Terraform configuration:
   ```bash
   terraform apply tfplan
   ```

4. Note the outputs, which include:
   - Resource group name
   - Storage account name
   - Front Door endpoint URL

## 2. Local Environment Setup

Configure your local environment to use the deployed Azure resources:

1. Create your local environment file:
   ```bash
   cp local.env.example local.env
   ```

2. Edit `local.env` with values from your Terraform outputs:
   - ACR details
   - Resource group name
   - Backend app name
   - Storage account name
   - Front Door endpoint URL

## 3. Deploy Application Code

### 3.1 Deploy Backend

The backend is a Python FastAPI application deployed as a Docker container:

```bash
cd backend
make acr-login      # Login to Azure container registry
make build          # Build the Docker image
make push           # Push image to ACR
make webapp-restart # Restart the Azure App Service

# Verify deployment
make webapp-version # Check /api/version endpoint
make webapp-log     # View application logs
```

For more details on backend deployment, see [backend/README.md](../backend/README.md).

### 3.2 Deploy Frontend

The frontend is a React/TypeScript application deployed as a static website:

```bash
cd frontend
make build-static   # Build the webapp
make deploy-static  # Deploy to blob storage
```

For more details on frontend deployment, see [frontend/README.md](../frontend/README.md).

### 3.3 Deploy Welcome Email Function

The welcome email function is a Python Azure Function:

```bash
cd welcome_email_function
make deploy
```

For more details on function deployment, see [welcome_email_function/README.md](../welcome_email_function/README.md).

## 4. Verification

After deployment, verify your application:

1. Access the frontend through the Front Door URL from your Terraform outputs
2. Create a test user account
3. Check your email for the welcome message
4. Verify that messages are being stored in Cosmos DB
5. Confirm file uploads work properly

## 5. Next Steps

1. Use your favorite AI tool to extend some functionality! :)