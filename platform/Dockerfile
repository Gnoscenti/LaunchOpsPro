FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install

# Copy source code
COPY . .

# Pass environment variables for Vite build
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_APP_ID
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL
ENV VITE_APP_ID=$VITE_APP_ID

# Expose the port the app runs on
EXPOSE 3000

# Start the application in dev mode for local testing
CMD ["pnpm", "run", "dev"]
