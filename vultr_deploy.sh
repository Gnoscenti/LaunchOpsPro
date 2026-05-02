#!/bin/bash
# LaunchOpsPro Vultr Deployment Script
# Run this script on your Vultr server to deploy the application

set -e

echo "=================================================="
echo "🚀 LaunchOpsPro Vultr Deployment Script"
echo "=================================================="

# 1. Install Docker and Docker Compose if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 2. Setup Environment Variables
echo "Setting up environment variables..."
if [ ! -f .env.production ]; then
    if [ -f .env.production.example ]; then
        cp .env.production.example .env.production
        echo "Created .env.production from example. Please edit it with your actual keys."
    else
        echo "Creating basic .env.production..."
        cat << 'EOF' > .env.production
# LaunchOpsPro Production Environment
NODE_ENV=production
MOCK_MODE=false

# API Keys
OPENAI_API_KEY=your_openai_api_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here

# URLs
FASTAPI_URL=http://python-backend:8001
DASHBOARD_ORIGIN=https://yourdomain.com
OAUTH_SERVER_URL=https://yourdomain.com

# Database
DATABASE_URL=sqlite:///sqlite.db
SESSION_SECRET=$(openssl rand -hex 32)
EOF
        echo "Created .env.production. Please edit it with your actual keys."
    fi
fi

# 3. Build and Start Services
echo "Building and starting Docker containers..."
docker-compose --env-file .env.production up --build -d

echo "=================================================="
echo "✅ Deployment Complete!"
echo "=================================================="
echo "Your LaunchOpsPro instance is now running."
echo "Platform UI: http://localhost:5000"
echo "Python API: http://localhost:8001"
echo ""
echo "Next steps:"
echo "1. Edit .env.production with your actual API keys"
echo "2. Set up a reverse proxy (like Nginx or Caddy) to expose port 5000 to your domain"
echo "3. Restart the containers: docker-compose --env-file .env.production restart"
echo "=================================================="
