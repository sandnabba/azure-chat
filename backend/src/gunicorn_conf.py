import logging
import sys
import os

# Standard gunicorn config
bind = "0.0.0.0:8000" 
workers = 2
worker_class = "uvicorn.workers.UvicornWorker"
chdir = "/app"

graceful_timeout = 5
timeout = 30  # Worker silent for more than this many seconds is killed and restarted
keep_alive = 5  # How long to wait for requests on a Keep-Alive connection

# Avoid infinite loops or hanging connections
worker_max_requests = 1000       # Restart workers after this many requests
worker_max_requests_jitter = 50  # Add jitter to avoid restarting all workers at once

# Uvicorn-specific worker config with shorter timeouts
worker_args = [
    "--timeout-graceful-shutdown=4",
    "--timeout-keep-alive=5"
]

# Logging config
# Class for colored logs (same as in app.py)
class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors"""
    grey = "\x1b[38;20m"
    green = "\x1b[32;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    format_str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

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

# Function to initialize loggers
def setup_loggers():
    # Set log level from environment
    log_level = os.getenv("LOG_LEVEL", "INFO")
    
    # Create handler with our custom formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColoredFormatter())
    
    # Configure gunicorn logger
    gunicorn_logger = logging.getLogger("gunicorn.error")
    gunicorn_logger.setLevel(getattr(logging, log_level))
    gunicorn_logger.propagate = False
    for handler in gunicorn_logger.handlers:
        gunicorn_logger.removeHandler(handler)
    gunicorn_logger.addHandler(console_handler)
    
    # Configure uvicorn logger
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.setLevel(getattr(logging, log_level))
    uvicorn_logger.propagate = False
    for handler in uvicorn_logger.handlers:
        uvicorn_logger.removeHandler(handler)
    uvicorn_logger.addHandler(console_handler)
    
    # Configure uvicorn access logger
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.setLevel(getattr(logging, log_level))
    access_logger.propagate = False
    for handler in access_logger.handlers:
        access_logger.removeHandler(handler)
    access_logger.addHandler(console_handler)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level))
    for handler in root_logger.handlers:
        root_logger.removeHandler(handler)
    root_logger.addHandler(console_handler)

# Setup loggers when gunicorn loads this configuration
setup_loggers()

# Custom log format for access logs
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stdout

# Custom settings for Uvicorn workers
# Pass these settings to Uvicorn workers to ensure they use our logging config
logconfig_dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "src.gunicorn_conf.ColoredFormatter",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": "ext://sys.stdout"
        }
    },
    "loggers": {
        "uvicorn": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
        "uvicorn.error": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO"), "propagate": False},
        "uvicorn.access": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO"), "propagate": False},
    }
}
