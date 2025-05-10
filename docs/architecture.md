# Architecture Documentation

## Table of Contents

- [Background](#background)
- [System Overview](#system-overview)
- [Azure Data Services Integration](#azure-data-services-integration)
- [Communication Flow](#communication-flow)
- [Component Details](#component-details)
- [Database Design](#database-design)
- [Security Considerations](#security-considerations)
- [Scalability](#scalability)
- [Monitoring and Logging](#monitoring-and-logging)

## Background

This project serves as a **learning exercise** to explore and understand Azure cloud services. It is designed to demonstrate how a relatable application, such as a chat service, can be built using common cloud platform technologies. The focus is on integrating Azure data and storage services, including Cosmos DB and Blob Storage, with plans to incorporate Queue Storage and serverless functions.

> **Important**: This is not a production-ready application. Features like robust security, authentication, and comprehensive testing have been intentionally omitted to prioritize learning and experimentation with Azure services. The goal is to provide a hands-on experience with Azure's capabilities rather than deliver a fully production-grade solution.

## System Overview

Azure Chat is a real-time chat application with a multi-tier architecture leveraging Azure services:

1. **Frontend**: React/TypeScript SPA
2. **Backend**: FastAPI Python API
3. **Data Layer**: Cosmos DB (NoSQL) for messages/channels, Blob Storage for file attachments
4. **Serverless Layer**: Azure Function triggered by Cosmos DB change feed for sending welcome verification emails
5. **Communication Layer**: Azure Communication Service for email delivery
6. **Global Load Balancing**: Azure Front Door for content delivery and traffic routing

```
                    ┌──────────────┐
                    │  Front Door  │
                    │  (Global LB) │
                    └──────────────┘
                           │
                    ┌──────┴───────┐
                    │              │
                    ▼              ▼
         ┌─────────────┐    ┌─────────────┐
         │  Frontend   │    │  Backend    │
         │  (React)    │    │  (FastAPI)  │
         └─────────────┘    └─────────────┘
                                  │
                         ┌────────┴────────┐
                         │                 │
                         ▼                 ▼
                 ┌─────────────┐    ┌─────────────┐
                 │  Storage    │    │  Database   │
                 │  (Blob)     │    │(Cosmos DB)  │
                 └─────────────┘    └─────────────┘
                                          │
                                          │ Change Feed
                                          │ Trigger
                                          ▼
                             ┌──────────────────────┐
                             │ Welcome Email        │
                             │ Function (Serverless)│
                             └──────────────────────┘
                                          │
                                          │
                                          ▼
                             ┌──────────────────────┐
                             │ Azure Communication  │
                             │ Service (Email)      │
                             └──────────────────────┘
```

## Azure Data Services Integration

### Core Services

#### Cosmos DB
- JSON document storage
- Partition key design for efficient queries
- SDK integration with Python/FastAPI

#### Blob Storage
- File upload/download
- URL generation for client access

### Serverless & Communication Services

#### Azure Functions
- Processes welcome emails triggered by Cosmos DB change feed
- Handles asynchronous processing

#### Azure Communication Service
- Email delivery for user verification
- Integration with Azure Functions

### Future Enhancements

#### Queue Storage
- Planned for additional async processing scenarios
- Will enable message queueing for background tasks

## Component Details

### Frontend
- **ChatRoom**: Displays/sends messages
- **Sidebar**: Channel navigation
- **UsernameForm**: User input
- **AddChannelModal**: Create channels

### Backend
- **Messaging**: Message creation/retrieval
- **Channels**: Channel management
- **WebSockets**: Real-time updates
- **File Storage**: File handling

### Serverless Functions
- **Welcome Email Function**: Triggered by Cosmos DB change feed
- Sends verification emails to newly registered users
- Integrates with Azure Communication Service

## Database Design

Collections:
- **messages**: Partitioned by channel ID
- **users**: User data
- **channels**: Channel metadata

## Security Considerations

> **Note**: This is a learning project and lacks production-grade security. Key measures for production:
- Network security (partially implemented)
- Authentication/authorization (not implemented)
- Secure API design (not implemented)
- Data encryption (provided by Azure)

## Scalability

- Frontend: Scales with Azure Front Door
- Backend: Load-balanced instances
- Database: Cosmos DB auto-scaling

## Monitoring and Logging

- Application Insights for telemetry
- Azure Monitor for resource tracking