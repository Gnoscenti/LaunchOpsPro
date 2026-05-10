# LaunchOps Platform — Node.js Full-Stack Dockerfile
# Builds the React/Vite frontend and runs the Express/tRPC backend server.
#
# Uses pnpm for fast, reproducible installs.
# Runs as non-root user in production.
#
# Usage (via docker compose):
#   docker compose up -d platform

# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-slim AS deps

# Install pnpm globally
RUN npm install -g pnpm@9

WORKDIR /app

# Copy lockfile and manifest first for layer caching
COPY pnpm-lock.yaml package.json ./
COPY patches/ ./patches/

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN npm install -g pnpm@9

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source
COPY . .

# Build: Vite bundles the React client → dist/public
#        esbuild bundles the Express server → dist/index.js
RUN pnpm run build

# ── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN npm install -g pnpm@9

# Create non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Copy only what's needed to run in production
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

# Copy drizzle config and migrations (needed at runtime for SQLite)
COPY --from=builder --chown=appuser:appgroup /app/drizzle ./drizzle
COPY --from=builder --chown=appuser:appgroup /app/drizzle.config.ts ./drizzle.config.ts

USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
