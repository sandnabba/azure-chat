import os
from azure.storage.blob.aio import BlobServiceClient, ContainerClient
from dotenv import load_dotenv
import uuid

load_dotenv()

class AzureStorageService:
    def __init__(self):
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        self.container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "public-files") # Using the container created by Terraform
        
        if not self.connection_string:
            print("Warning: AZURE_STORAGE_CONNECTION_STRING not set. File uploads will not work.")
            self.blob_service_client = None
        else:
            try:
                self.blob_service_client = BlobServiceClient.from_connection_string(self.connection_string)
                print(f"Azure Storage Service initialized for container: {self.container_name}")
            except Exception as e:
                print(f"Error initializing Azure Blob Service Client: {e}")
                self.blob_service_client = None

    async def _get_container_client(self) -> ContainerClient | None:
        if not self.blob_service_client:
            return None
        try:
            container_client = self.blob_service_client.get_container_client(self.container_name)
            # Container is already created by Terraform, just return the client
            return container_client
        except Exception as e:
            print(f"Error getting container client for '{self.container_name}': {e}")
            return None

    async def upload_file(self, file_content: bytes, file_name: str) -> str | None:
        if not self.blob_service_client:
            print("Cannot upload file: Azure Storage Service not initialized.")
            return None

        container_client = await self._get_container_client()
        if not container_client:
            print(f"Cannot upload file: Failed to get container client for '{self.container_name}'.")
            return None

        # Generate a unique blob name to avoid overwrites
        blob_name = f"{uuid.uuid4()}-{file_name}"
        
        try:
            blob_client = container_client.get_blob_client(blob_name)
            await blob_client.upload_blob(file_content, overwrite=True)
            print(f"Successfully uploaded '{file_name}' as blob '{blob_name}'")
            return blob_client.url
        except Exception as e:
            print(f"Error uploading file '{file_name}' to blob '{blob_name}': {e}")
            return None
        finally:
            # It's important to close the container client if you opened it specifically here
            # However, the SDK manages connections, so explicit closing might not be needed
            # await container_client.close() # Consider if needed based on SDK version/usage
            pass

# Example usage (optional, for testing)
# async def main():
#     storage_service = AzureStorageService()
#     if storage_service.blob_service_client:
#         # Example: Upload a dummy file
#         dummy_content = b"This is a test file."
#         file_url = await storage_service.upload_file(dummy_content, "test.txt")
#         if file_url:
#             print(f"File uploaded to: {file_url}")
#         else:
#             print("File upload failed.")

# if __name__ == "__main__":
#     import asyncio
#     asyncio.run(main())

