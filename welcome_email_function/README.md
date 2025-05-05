# Email Verification Azure Function

This Azure Function automatically sends a verification email to new users when they are added to the Users container in Azure Cosmos DB.

## Overview

When a new user is created in the application and stored in the Cosmos DB Users container, this function is triggered automatically through Cosmos DB's Change Feed. It retrieves the user's information and sends a personalized verification email using Azure Communication Service.

## Technical Details

### Trigger Mechanism

The function is triggered by Cosmos DB's Change Feed feature:

- **Trigger Type**: Cosmos DB Trigger (monitors changes to the Users container)
- **Trigger Frequency**: Polls for new user documents
- **Lease Collection**: Uses a separate "leases" container to track processed documents

### Function Components

- `function_app.py`: Contains the main function code for sending verification emails
- `host.json`: Defines the function app configuration
- `requirements.txt`: Lists the Python dependencies
- `local.settings.json`: Contains local development settings (not used in production)

## Building and Deploying

This function can be built and deployed using the included Makefile:

### Prerequisites

- Azure CLI installed and logged in
- Access to the Azure Storage account used by the function app
- Python 3.12 or later (matching the runtime version in infrastructure)

### Deployment Steps

1. **Install dependencies**:
   ```
   make install
   ```

2. **Package and deploy the function**:
   ```
   make deploy
   ```
   This will:
   - Package the function code into a zip file
   - Upload it to your Azure Function App using Azure CLI

### Local Development

1. **Set up local.settings.json** with your connection strings:
   - CosmosDBConnectionString
   - ACSConnectionString
   - FRONTEND_URL
   - SenderEmail

2. **Install Azure Functions Core Tools**

3. **Run the function locally**:
   ```
   make run-local
   ```

## Environment Variables

The function uses the following environment variables:
- `CosmosDBConnectionString`: Connection string for the Cosmos DB account
- `ACSConnectionString`: Connection string for Azure Communication Service
- `FRONTEND_URL`: Base URL for the frontend (used to construct verification links)
- `SenderEmail`: Email address used as the sender

## Infrastructure

The infrastructure for this function is defined in Terraform:
- `welcome_email_function.tf`: Contains the Azure Function App and related resources
- Deployed as a Function App Flex Consumption (FC1 SKU) with Python 3.12 runtime
- Uses Application Insights for monitoring