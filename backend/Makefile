# Makefile for azure-chat/backend

# Include local environment variables if file exists (not committed to Git)
-include ../local.env

# Configuration variables - customize these or set via environment variables
# Default values are used only if no value is provided in local.env
IDENTIFIER?=dev
RESOURCE_GROUP?=$(RESOURCE_GROUP_NAME)
CONTAINER_REGISTRY_SERVER?=localhost:5000
CONTAINER_REGISTRY?=$(CONTAINER_REGISTRY_SERVER)
IMAGE_NAME=$(CONTAINER_REGISTRY)/azure-chat-backend:latest
CONTAINER_NAME=azure-chat-backend-dev
DEV_CONTAINER_NAME=azure-chat-backend-dev-live
PORT?=8000
BACKEND_APP_NAME?=chat-api-$(IDENTIFIER)

.PHONY: build push run shell clean dev webapp-restart webapp-log webapp-http-log webapp-version acr-login

acr-login:
	@echo "Logging into Azure Container Registry..."
	@az acr login --name $$(echo $(CONTAINER_REGISTRY) | cut -d '.' -f1)

build:
	docker build -t $(IMAGE_NAME) .

push: acr-login build
	docker push $(IMAGE_NAME)

run:
	docker run --rm -it \
	  -e PORT=$(PORT) \
	  -p $(PORT):$(PORT) \
	  --name $(CONTAINER_NAME) \
	  $(IMAGE_NAME)

dev:
	docker run --rm -it \
	  -e PORT=$(PORT) \
	  -e PYTHONPATH=/app \
	  -e LOG_LEVEL=DEBUG \
	  --env-file Docker.env \
	  -p $(PORT):$(PORT) \
	  -v $(PWD)/src:/app/src \
	  --name $(DEV_CONTAINER_NAME) \
	  $(IMAGE_NAME) uvicorn src.main:app --reload --host 0.0.0.0 --port $(PORT)

shell:
	docker exec -it $(CONTAINER_NAME) /bin/sh

clean:
	docker rm -f $(CONTAINER_NAME) || true
	docker rm -f $(DEV_CONTAINER_NAME) || true

webapp-restart:
	az webapp restart --resource-group $(RESOURCE_GROUP) --name $(BACKEND_APP_NAME)

webapp-log:
	az webapp log tail --resource-group $(RESOURCE_GROUP) --name $(BACKEND_APP_NAME)

webapp-http-log:
	az webapp log tail --resource-group $(RESOURCE_GROUP) --name $(BACKEND_APP_NAME) --provider http

webapp-version:
	curl https://$(BACKEND_APP_NAME).azurewebsites.net/api/version