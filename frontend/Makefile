# Makefile for azure-chat/frontend

# Include local environment variables if file exists (not committed to Git)
-include ../local.env

# Configuration variables - customize these or set via environment variables
# Default values are used only if no value is provided in local.env
IDENTIFIER?=dev
RESOURCE_GROUP?=$(IDENTIFIER)-chat-rg
CONTAINER_REGISTRY_SERVER?=localhost:5000
CONTAINER_REGISTRY?=$(CONTAINER_REGISTRY_SERVER)
IMAGE_NAME=$(CONTAINER_REGISTRY)/azure-chat-frontend:latest
CONTAINER_NAME=azure-chat-frontend-dev
DEV_CONTAINER_NAME=azure-chat-frontend-dev-live
PORT?=80
FRONTEND_APP_NAME?=chat-web-$(IDENTIFIER)

.PHONY: build push run shell clean dev webapp-restart webapp-log webapp-http-log acr-login

acr-login:
	@echo "Logging into Azure Container Registry..."
	@az acr login --name $$(echo $(CONTAINER_REGISTRY) | cut -d '.' -f1)

build:
	docker build -t $(IMAGE_NAME) .

push: acr-login build
	docker push $(IMAGE_NAME)

run:
	docker run --rm -it \
	  -p $(PORT):80 \
	  --name $(CONTAINER_NAME) \
	  $(IMAGE_NAME)

dev:
	docker build -t $(IMAGE_NAME)-dev -f Dockerfile.dev .
	mkdir -p $(PWD)/node_modules
	docker run --rm -it \
	  -p 5173:5173 \
	  -v $(PWD):/app \
	  -v $(PWD)/node_modules:/app/node_modules \
	  --name $(DEV_CONTAINER_NAME) \
	  -e VITE_API_URL=http://localhost:8000 \
	  $(IMAGE_NAME)-dev

shell:
	docker exec -it $(CONTAINER_NAME) /bin/sh

clean:
	docker rm -f $(CONTAINER_NAME) || true
	docker rm -f $(DEV_CONTAINER_NAME) || true

webapp-restart:
	az webapp restart --resource-group $(RESOURCE_GROUP) --name $(FRONTEND_APP_NAME)

webapp-log:
	az webapp log tail --resource-group $(RESOURCE_GROUP) --name $(FRONTEND_APP_NAME)

webapp-http-log:
	az webapp log tail --resource-group $(RESOURCE_GROUP) --name $(FRONTEND_APP_NAME) --provider http
