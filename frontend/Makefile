# Makefile for azure-chat/frontend

# Include local environment variables if file exists (not committed to Git)
-include ../local.env

# Configuration variables - customize these or set via environment variables
# Default values are used only if no value is provided in local.env
IDENTIFIER?=dev
RESOURCE_GROUP?=$(RESOURCE_GROUP_NAME)
CONTAINER_REGISTRY_SERVER?=localhost:5000
CONTAINER_REGISTRY?=$(CONTAINER_REGISTRY_SERVER)
IMAGE_NAME=$(CONTAINER_REGISTRY)/azure-chat-frontend:latest
CONTAINER_NAME=azure-chat-frontend-dev
DEV_CONTAINER_NAME=azure-chat-frontend-dev-live
PORT?=80
STATIC_OUTPUT_DIR?=./dist
# Use STORAGE_ACCOUNT_NAME directly from local.env
STORAGE_ACCOUNT_NAME?=

.PHONY: build push run shell clean dev install-deps acr-login build-static deploy-static-web

acr-login:
	@echo "Logging into Azure Container Registry..."
	@az acr login --name $$(echo $(CONTAINER_REGISTRY) | cut -d '.' -f1)

build:
	docker build -t $(IMAGE_NAME) .

# Build static files and export them to a local directory
build-static:
	@echo "Building static website files and exporting to $(STATIC_OUTPUT_DIR)..."
	@mkdir -p $(STATIC_OUTPUT_DIR)
	DOCKER_BUILDKIT=1 docker build \
		--target build-static \
		--output type=local,dest=$(STATIC_OUTPUT_DIR) \
		.

# Deploy static files to Azure Blob Storage static website
deploy-static-web: build-static
	@echo "Deploying static website to Azure Blob Storage..."
	@if [ -z "$(STORAGE_ACCOUNT_NAME)" ]; then \
		echo "Error: STORAGE_ACCOUNT_NAME is not set. Please define it in local.env"; \
		exit 1; \
	fi
	@if [ ! -d "$(STATIC_OUTPUT_DIR)" ]; then \
		echo "Error: Distribution directory $(STATIC_OUTPUT_DIR) does not exist"; \
		exit 1; \
	fi

	@echo "Resource Group: $(RESOURCE_GROUP)"
	@echo "Storage Account: $(STORAGE_ACCOUNT_NAME)"
	@echo "Distribution Directory: $(STATIC_OUTPUT_DIR)"
	
	@echo "Uploading files to $(STORAGE_ACCOUNT_NAME)..."
	az storage blob upload-batch \
		--account-name "$(STORAGE_ACCOUNT_NAME)" \
		--auth-mode key \
		--destination '$$web' \
		--source "$(STATIC_OUTPUT_DIR)" \
		--overwrite \
		--no-progress
	
	@echo "Getting static website URL..."
	$(eval WEBSITE_URL = $(shell az storage account show \
		--name "$(STORAGE_ACCOUNT_NAME)" \
		--resource-group "$(RESOURCE_GROUP)" \
		--query "primaryEndpoints.web" \
		--output tsv))
	@echo "Static website deployment complete!"
	@echo "Website URL: $(WEBSITE_URL)"

push: acr-login build
	docker push $(IMAGE_NAME)

run:
	docker run --rm -it \
	  -p $(PORT):80 \
	  --name $(CONTAINER_NAME) \
	  $(IMAGE_NAME)

install-deps:
	@echo "Installing node dependencies locally..."
	npm install

dev: install-deps
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
	rm -rf $(STATIC_OUTPUT_DIR)
