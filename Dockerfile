# Dynexis LaunchOps — Multi-stage Dockerfile
# Builds both the Python FastAPI backend and the React dashboard,
# then serves the API with the dashboard as static files.
#
# Usage:
#   docker build -t dynexis-launchops .
#   docker run -p 8001:8001 --env-file .env dynexis-launchops
#
# Or via docker compose (preferred):
#   docker compose up -d

# ── Stage 1: Build the React dashboard ──────────────────────────────────
FROM node:22-alpine AS dashboard-build

WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY dashboard/ ./
RUN npm run build

# ── Stage 2: Python runtime ─────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# System deps for cryptography, playwright, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy the built dashboard static files into a location FastAPI can serve
COPY --from=dashboard-build /app/dashboard/dist /app/dashboard/dist

# Create data directory
RUN mkdir -p /root/.launchops/data /root/.launchops/documents

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

EXPOSE 8001

# Default: run the FastAPI server
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8001"]
