# Dynexis LaunchOps — Multi-stage Dockerfile
# Builds both the Python FastAPI backend and the React dashboard,
# then serves the API with the dashboard as static files.
#
# Security: runs as non-root user (appuser). All data directories are
# owned by appuser. No capabilities granted beyond default.
#
# Usage:
#   docker build -t dynexis-launchops .
#   docker run -p 8001:8001 --env-file .env dynexis-launchops

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

# Create non-root user BEFORE copying code
RUN adduser --system --home /home/appuser --shell /bin/false appuser \
    && mkdir -p /home/appuser/.launchops/data /home/appuser/.launchops/documents \
    && chown -R appuser /home/appuser

WORKDIR /app

# Install Python dependencies (as root, then switch)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser . .

# Copy the built dashboard static files
COPY --from=dashboard-build --chown=appuser /app/dashboard/dist /app/dashboard/dist

# Switch to non-root user
USER appuser

# Set data directories under appuser's home
ENV HOME=/home/appuser
ENV LAUNCHOPS_DATA_DIR=/home/appuser/.launchops/data
ENV LAUNCHOPS_DB_PATH=/home/appuser/.launchops/data/launchops.db
ENV ARTIFACTS_PATH=/home/appuser/.launchops/documents

# Health check (curl runs as appuser)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8001"]
