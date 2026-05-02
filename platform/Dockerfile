FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install

# Copy source code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Start the application in dev mode for local testing
CMD ["pnpm", "run", "dev"]
