# Use official Python image
FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install dependencies
COPY requirements.txt ./
# Ensure pip is up-to-date and install requirements
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Create build info file with timestamp
RUN echo "Build date: $(date -u +'%Y-%m-%dT%H:%M:%SZ')" > /app/build_info.txt
RUN echo "Image version: 1.0.0" >> /app/build_info.txt

# Expose the port
EXPOSE 8000

# Start the app with Gunicorn + Uvicorn workers for FastAPI compatibility
CMD ["gunicorn", "src.app:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "--chdir", "/app"]
