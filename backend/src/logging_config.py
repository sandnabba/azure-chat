"""
Logging configuration for the Azure Chat application.
This module configures logging with colored output and manages log levels for different loggers.
"""
import os
import sys
import logging

def configure_logging():
    """
    Configure logging for the application with colored output and appropriate log levels.
    """
    # Get log level from environment variable
    log_level = os.getenv("LOG_LEVEL", "INFO")

    # Configure colored logging
    class ColoredFormatter(logging.Formatter):
        """Custom formatter with colors and process ID"""
        grey = "\x1b[38;20m"
        green = "\x1b[32;20m"
        yellow = "\x1b[33;20m"
        red = "\x1b[31;20m"
        bold_red = "\x1b[31;1m"
        reset = "\x1b[0m"
        format_str = "%(asctime)s - %(name)s[%(process)d] - %(levelname)s - %(message)s"

        FORMATS = {
            logging.DEBUG: grey + format_str + reset,
            logging.INFO: green + format_str + reset,
            logging.WARNING: yellow + format_str + reset,
            logging.ERROR: red + format_str + reset,
            logging.CRITICAL: bold_red + format_str + reset
        }

        def format(self, record):
            log_fmt = self.FORMATS.get(record.levelno)
            formatter = logging.Formatter(log_fmt)
            return formatter.format(record)

    # Create custom handler with colored formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColoredFormatter())

    # Configure root logger to make all logs consistent with our format
    # Remove existing handlers to avoid duplicated logs
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)

    # Set new configuration
    logging.basicConfig(
        level=getattr(logging, log_level),
        handlers=[console_handler]
    )

    # Configure Uvicorn logger directly
    logging.getLogger("uvicorn").handlers = []
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.error").handlers = []
    logging.getLogger("uvicorn").addHandler(console_handler)
    logging.getLogger("uvicorn.access").addHandler(console_handler)
    logging.getLogger("uvicorn.error").addHandler(console_handler)

    # Set specific loggers to higher levels to reduce verbosity
    # Set Azure SDK loggers to WARNING or higher to avoid the verbose HTTP logs
    azure_logger = logging.getLogger("azure")
    azure_logger.setLevel(logging.WARNING)
    azure_core_logger = logging.getLogger("azure.core")
    azure_core_logger.setLevel(logging.WARNING)
    # Specifically suppress the verbose HTTP logging
    http_policy_logger = logging.getLogger("azure.core.pipeline.policies.http_logging_policy")
    http_policy_logger.setLevel(logging.WARNING)

    # Configure FastAPI logs 
    fastapi_logger = logging.getLogger("fastapi")
    fastapi_logger.handlers = [console_handler]

    # Get the gunicorn logger in case we're running under gunicorn
    gunicorn_logger = logging.getLogger("gunicorn")
    if gunicorn_logger.handlers:
        # If gunicorn is being used, ensure it also uses our formatter
        for handler in gunicorn_logger.handlers:
            handler.setFormatter(ColoredFormatter())

    # Create and return the application logger
    logger = logging.getLogger("azure-chat")
    return logger
