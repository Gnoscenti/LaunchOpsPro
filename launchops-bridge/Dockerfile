FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Environment variables
ENV BRIDGE_PORT=8002
ENV FOUNDER_EDITION_DIR=/opt/launchops/launchops-founder-edition
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8002

# Run the bridge server
CMD ["python", "-m", "src.server"]
