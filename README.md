# Azure Chat Service

A simple, real-time chat service built on Azure cloud infrastructure.

<p align="center">
  <a href="docs/interface.png" target="_blank">
    <img src="docs/interface.png" alt="Azure Chat Interface" style="max-width:600px; width:100%; display:block; margin:auto;">
  </a>
</p>

## Overview

The main purpose of this project is to serve as a learning and exploration platform for Azure cloud services such as:

* Cosmos DB (No-SQL database)
  * CosmosDB change feed
* Storage Service
  * Blob storage
  * Static website
* App Service
* Function Apps
* Communication service (email delivery)
* Front Door (CDN and reverse proxy)
* Service Bus (Planned)
* DNS Zones (Optional)


## Structure

| Folder       | Description                                |
|--------------|--------------------------------------------|
| `/backend`   | Python FastAPI backend application         |
| `/docs`      | Project documentation                     |
| `/frontend`  | Node.js/Vite TypeScript frontend           |
| `/infrastructure` | Terraform base + Terraform module for Azure services |
| `/welcome_email_function` | Azure Function for sending welcome emails |

## Getting Started

See the documentation in the respective folders for setup instructions:

- [Getting Started](docs/getting_started.md)
- [Backend Documentation](backend/README.md)
- [Frontend Documentation](frontend/README.md)
- [Infrastructure Documentation](docs/infrastructure.md)
- [Architecture Documentation](docs/architecture.md)
- [Discussion](docs/discussion.md)

## Limitations

As this is a learning project, it has several limitations:

- **No Authentication**: The application uses simple username input without proper authentication.
- **Limited Security**: Security best practices are not fully implemented.
- **No Testing**: The project lacks unit tests, integration tests, and end-to-end tests.
- **Basic Error Handling**: Error handling is minimal and not production-ready.
- **No Role-Based Access**: Since many users lack full user and permission management in Azure, we use connection strings and user/password for authentication. In a production environment, role-based access and SPNs should be used.

## Note on Docker and Container Development

This project does not cover Docker or basic container development. If you are new to these topics, please see the "DevOps Lab Kit" for an introduction:

[DevOps Lab Kit](https://github.com/sandnabba/devops-lab-kit)

## To-Do / Development ideas

* Investigate SignalR service.
* Enable user-to-user messaging.
* Make mobile friendly UI.
* Enable automatic login after email confirmation.