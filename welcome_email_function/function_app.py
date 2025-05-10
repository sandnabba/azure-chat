import azure.functions as func
import logging
import os
from azure.communication.email import EmailClient

app = func.FunctionApp()

# Define a new trigger for the Users container
@app.cosmos_db_trigger(arg_name="users", 
                      container_name="Users", 
                      database_name="ChatDB", 
                      connection="CosmosDBConnectionString",
                      lease_container_name="leases",
                      create_lease_container_if_not_exists=True)
def process_new_users(users: func.DocumentList):
    """Process new user registrations and send verification emails."""
    if not users:
        logging.info("No user documents received.")
        return
        
    logging.info(f"Processing {len(users)} user documents")
    
    # Track if any errors occurred during processing
    had_errors = False
    
    # Get ACS connection string from environment
    acs_connection_string = os.environ.get("ACSConnectionString")
    if not acs_connection_string:
        logging.error("Missing ACSConnectionString environment variable")
        # This is a configuration error - we should exit with error
        raise ValueError("Missing ACSConnectionString environment variable")
        
    # Get the frontend URL from environment
    frontend_base_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    # Get the backend URL for direct API access
    backend_base_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    
    # Use the backend URL if available, otherwise fall back to constructed URL
    if not backend_base_url:
        # Try to derive backend URL from frontend URL by replacing the domain
        # This is a best-effort approach that might work in many cases
        if frontend_base_url.startswith("https://chat."):
            # For example, if frontend is https://chat.domain.com, assume backend is https://api.domain.com
            backend_base_url = frontend_base_url.replace("https://chat.", "https://api.")
        else:
            # Just use the frontend URL and assume backend is available at /api path
            backend_base_url = frontend_base_url
    
    sender_email = os.environ.get("SenderEmail", "donotreply@azuremanaged.com")
    
    # Initialize Email client
    try:
        email_client = EmailClient.from_connection_string(acs_connection_string)
    except Exception as e:
        logging.error(f"Failed to initialize Email client: {e}")
        # Critical error - cannot continue
        raise
    
    for user in users:
        try:
            # Check if this is a new user who needs verification
            # Only process users with verification tokens who haven't been verified yet
            if user.get("email_verification_token") and not user.get("email_confirmed", False):
                email = user.get("email")
                username = user.get("username")
                verification_token = user.get("email_verification_token")
                
                if not email or not username or not verification_token:
                    logging.warning("Missing required user fields for verification email")
                    had_errors = True
                    continue
                
                # Create verification links that point directly to the root page with a verification_token parameter
                # This works better with blob storage static website hosting
                verification_link = f"{frontend_base_url}/?verification_token={verification_token}"
                em
                # Create the email message as a dictionary (correct format for this SDK version)
                message = {
                    "content": {
                        "subject": "Verify your Azure Chat account",
                        "html": f"""
                        <html>
                        <body>
                            <h2>Hello {username},</h2>
                            <p>Thank you for registering! Please verify your email address by clicking the link below:</p>
                            <p><a href="{verification_link}">Verify Email</a></p>
                            <p>Or copy and paste this URL into your browser:</p>
                            <p>{verification_link}</p>
                            <p>This link will expire in 24 hours.</p>
                            <p>If you did not register for Azure Chat, please ignore this email.</p>
                        </body>
                        </html>
                        """
                    },
                    "recipients": {
                        "to": [{"address": email}]
                    },
                    "senderAddress": sender_email
                }
                
                # Send the email
                try:
                    poller = email_client.begin_send(message)
                    result = poller.result()  # Wait for completion
                    logging.info(f"Email sent to {email}, message ID: {result}")
                except Exception as email_error:
                    logging.error(f"Failed to send verification email to {email}: {email_error}")
                    had_errors = True
            
        except Exception as e:
            logging.error(f"Error processing user document: {e}")
            had_errors = True
    
    # After processing all users, if we had any errors, consider the function run as failed
    if had_errors:
        logging.error("One or more errors occurred during email sending process")
        raise Exception("One or more errors occurred during email sending process")
