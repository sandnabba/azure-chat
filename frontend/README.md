# Frontend Application

The frontend for Azure Chat is built with React, TypeScript, and Vite.

## Recommended Setup (Docker)

Docker is the recommended method for both development and deployment.

### Development with Docker

```bash
# Run the dev container with hot-reload (installs node modules locally first)
make dev
```

This approach:
- Installs node modules locally in your workspace (for VSCode linting and IntelliSense)
- Mounts your local directory into the container for hot-reloading
- Mounts the node_modules directory for better performance

Or manually:
```bash
# Install dependencies locally first
npm install

# Build and run the development container
docker build -f Dockerfile.dev -t azure-chat-frontend-dev .
docker run -p 5173:5173 -v $(pwd):/app -v $(pwd)/node_modules:/app/node_modules azure-chat-frontend-dev
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

### Static Build Output

To build the static files and export them to a local directory (for hosting in Azure Blob Storage, CDN, etc.):

```bash
# Build and export static files to ./dist
make build-static

# Or specify a custom output directory
make build-static STATIC_OUTPUT_DIR=./my-output-dir
```

This uses Docker BuildKit to extract the built static files without running a container.

### Deployment

This application is designed to be deployed as a custom container on Azure App Service. The production Dockerfile is optimized for this deployment target, with Nginx serving static files.

The static build output can alternatively be deployed to:
- Azure Blob Storage static website hosting
- Azure CDN or Front Door
- Any static web hosting service

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