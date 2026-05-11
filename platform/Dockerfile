# LaunchOps Platform — Node.js Dockerfile (Full Server)
#
# Build strategy:
#   1. Install all deps with pnpm (exact version from packageManager field)
#   2. Build the React/Vite client → dist/public/
#   3. Bundle the FULL Express server (server/_core/index.ts) → dist/index.js
#      This includes tRPC, OAuth routes, execution engine, database, etc.
#   4. Copy dist/ + node_modules + agentRunner.py into a lean production image
#
# Ports:  3000 (HTTP, proxied by Caddy)
# Health: GET / → 200

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-slim AS deps
RUN npm install -g pnpm@10.4.1
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --no-frozen-lockfile

# ── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder
RUN npm install -g pnpm@10.4.1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build args for Vite env vars
ARG VITE_AUTH_DISABLED=true
ARG VITE_OAUTH_PORTAL_URL=http://localhost
ARG VITE_APP_ID=docker

# Step 1: Build the React/Vite client → dist/public/
RUN VITE_APP_ID=${VITE_APP_ID} \
    VITE_AUTH_DISABLED=${VITE_AUTH_DISABLED} \
    VITE_FRONTEND_FORGE_API_KEY=docker \
    VITE_FRONTEND_FORGE_API_URL=http://localhost \
    VITE_OAUTH_PORTAL_URL=${VITE_OAUTH_PORTAL_URL} \
    VITE_ANALYTICS_ENDPOINT=http://localhost \
    VITE_ANALYTICS_WEBSITE_ID=docker \
    pnpm exec vite build

# Step 2: Bundle the FULL Express server → dist/index.js
# This bundles server/_core/index.ts which includes tRPC, OAuth, execution engine
RUN pnpm exec esbuild server/_core/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outdir=dist

# Verify the expected outputs exist
RUN test -f dist/index.js || (echo "ERROR: dist/index.js not produced by esbuild" && exit 1)
RUN test -d dist/public   || (echo "ERROR: dist/public not produced by vite build" && exit 1)

# ── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:20-slim AS runtime

# Install Python for the agent runner bridge
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps for agent runner
RUN pip3 install --break-system-packages openai requests

WORKDIR /app

# Copy built artefacts and runtime dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy the Python agent runner script
COPY --from=builder /app/server/agentRunner.py ./dist/agentRunner.py

# Copy drizzle migrations for potential future use
COPY --from=builder /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "const h=require('http');h.get('http://localhost:3000/',r=>{process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
