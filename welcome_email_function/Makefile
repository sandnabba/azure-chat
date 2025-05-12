# Email Function Makefile
.PHONY: install prepare-build build deploy run-local clean

# Source environment variables from root local.env file if it exists
ifneq (,$(wildcard ../local.env))
include ../local.env
export
endif

# Variables
PACKAGE_NAME := function_package.zip
IDENTIFIER ?= dev
RESOURCE_GROUP ?= $(IDENTIFIER)-chat-rg
FUNCTION_APP_NAME ?= $(IDENTIFIER)-chat-welcome-email-func
BUILD_DIR := build

# Install dependencies
install:
	@echo "Installing dependencies..."
	python -m pip install --upgrade pip
	pip install -r requirements.txt

# Prepare the build directory with all necessary files
prepare-build:
	@echo "Preparing build directory..."
	@mkdir -p $(BUILD_DIR)
	@cp function_app.py $(BUILD_DIR)/
	@cp host.json $(BUILD_DIR)/
	@cp requirements.txt $(BUILD_DIR)/
	
	@# Install dependencies into the build directory
	@echo "Installing dependencies to build directory..."
	python3 -m pip install --target $(BUILD_DIR) --upgrade -r requirements.txt
	
	@# Set proper permissions for Azure Function App (files: 644, directories: 755)
	@echo "Setting proper permissions for Azure Function App deployment..."
	@find $(BUILD_DIR) -type f -exec chmod 644 {} \;
	@find $(BUILD_DIR) -type d -exec chmod 755 {} \;

# Build the function package
build: clean prepare-build
	@echo "Building function package..."
	cd $(BUILD_DIR) && zip -r ../$(PACKAGE_NAME) . && cd ..
	@echo "Package created: $(PACKAGE_NAME)"

# Deploy function using Azure CLI
deploy: build
	@echo "Deploying function to Azure using Azure CLI..."
	az functionapp deployment source config-zip \
		--resource-group $(RESOURCE_GROUP) \
		--name $(FUNCTION_APP_NAME) \
		--src $(PACKAGE_NAME)
	@echo "Function deployed to: $(FUNCTION_APP_NAME)"

# Run the function locally for testing
run-local:
	@echo "Running function locally..."
	func start

# Clean up build artifacts
clean:
	@echo "Cleaning up..."
	@rm -f $(PACKAGE_NAME)
	@echo "Cleaning build directory..."
	@rm -rf $(BUILD_DIR)/*

# Help target
help:
	@echo "Azure Welcome Email Function Makefile"
	@echo ""
	@echo "Targets:"
	@echo "  install         Install required dependencies globally"
	@echo "  prepare-build   Copy function files and install dependencies to build directory"
	@echo "  build           Prepare build directory and create function package"
	@echo "  deploy          Build and deploy function to Azure using Azure CLI"
	@echo "  run-local       Run the function locally (requires Azure Functions Core Tools)"
	@echo "  clean           Remove build artifacts and clean build directory"
	@echo ""
	@echo "Usage:"
	@echo "  make install                                  # Install dependencies"
	@echo "  make deploy                                   # Deploy function to Azure"
	@echo "  IDENTIFIER=myprefix make deploy               # Deploy with a custom identifier"
	@echo "  RESOURCE_GROUP=my-rg FUNCTION_APP_NAME=my-func make deploy  # Deploy with custom resource group and function name"