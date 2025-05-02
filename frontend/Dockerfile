# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
# Use npm install instead of npm ci since there's no package-lock.json
RUN npm install

COPY . .

# Create build info for the frontend
RUN echo "window.BUILD_INFO = {" > src/build-info.js
RUN echo "  buildDate: '$(date -u +'%Y-%m-%dT%H:%M:%SZ')'," >> src/build-info.js
RUN echo "  version: '1.0.0'" >> src/build-info.js
RUN echo "};" >> src/build-info.js

RUN npm run build

# Production stage
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy build info directly to nginx html folder for direct access
RUN echo "{\"build_date\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\", \"version\": \"1.0.0\"}" > /usr/share/nginx/html/build-info.json

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
