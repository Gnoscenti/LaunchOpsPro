# LaunchOps Platform — Node.js Dockerfile
#
# Build strategy:
#   1. Install all deps with pnpm (exact version from packageManager field)
#   2. Build the React/Vite client → dist/public/
#   3. Bundle the Express server (server/index.ts) → dist/index.js
#   4. Copy dist/ + node_modules into a lean production image
#
# The server/index.ts entry point is a self-contained Express static server
# that serves the Vite-built client and handles client-side routing.
# It has no Manus-platform-specific dependencies, making it portable.
#
# Ports:  3000 (HTTP, proxied by Caddy)
# Health: GET / → 200

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-slim AS deps

# Install the exact pnpm version declared in package.json#packageManager
RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Copy manifests and lockfile first for layer caching
COPY package.json pnpm-lock.yaml ./
# Copy patches directory (required by pnpm patchedDependencies)
COPY patches/ ./patches/

# Install all deps (dev included — needed for build tools)
# Use --no-frozen-lockfile to tolerate minor lockfile drift on the VPS
RUN pnpm install --no-frozen-lockfile

# ── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Bring in installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source tree
COPY . .

# Step 1: Build the React/Vite client → dist/public/
# Pass dummy env vars so vite-plugin-manus-runtime initialises without error
RUN VITE_APP_ID=docker \
    VITE_FRONTEND_FORGE_API_KEY=docker \
    VITE_FRONTEND_FORGE_API_URL=http://localhost \
    VITE_OAUTH_PORTAL_URL=http://localhost \
    VITE_ANALYTICS_ENDPOINT=http://localhost \
    VITE_ANALYTICS_WEBSITE_ID=docker \
    pnpm exec vite build

# Step 2: Bundle the Express server entry point → dist/index.js
# Uses server/index.ts (pure Express static server, no Manus runtime deps)
RUN pnpm exec esbuild server/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outdir=dist

# Verify the expected outputs exist before proceeding
RUN test -f dist/index.js || (echo "ERROR: dist/index.js not produced by esbuild" && exit 1)
RUN test -d dist/public   || (echo "ERROR: dist/public not produced by vite build" && exit 1)

# ── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:20-slim AS runtime

# Create non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Copy only the built artefacts and runtime dependencies
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json

USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "const h=require('http');h.get('http://localhost:3000/',r=>{process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
