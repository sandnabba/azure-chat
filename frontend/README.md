# Frontend Application

The frontend for Azure Chat is built with React, TypeScript, and Vite.

## Recommended Setup (Docker)

Docker is the recommended method for both development and deployment.

### Development with Docker

```bash
# Run the dev container with hot-reload
make dev
```

Or manually:
```bash
docker build -f Dockerfile.dev -t azure-chat-frontend-dev .
docker run -p 5173:5173 azure-chat-frontend-dev
```

### Production Build and Run

```bash
# Build the production container
make build

# Run the production container
make run
```

Or manually:
```bash
docker build -t azure-chat-frontend .
docker run -p 80:80 azure-chat-frontend
```

### Deployment

This application is designed to be deployed as a custom container on Azure App Service. The production Dockerfile is optimized for this deployment target, with Nginx serving static files.

## Alternative Setup (Local Development)

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Steps

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

2. Start development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

The development server will start at http://localhost:5173

3. For production build:
   ```bash
   npm run build
   # or
   yarn build
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:8000/ws` |

## Component Structure

- `src/components/` - Reusable UI components
- `src/contexts/` - React context providers
- `src/services/` - API services
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks

## Build Information

The application auto-generates build information using `generate-build-info.js` which is displayed in the UI via the `BuildInfo` component.