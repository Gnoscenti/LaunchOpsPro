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

# 2. Prompt for Domain and Email
echo ""
echo "Let's set up your domain for automatic HTTPS (SSL)."
echo "Make sure your domain's DNS A record points to this server's IP address."
read -p "Enter your domain name (e.g., launchopspro.yourdomain.com): " DOMAIN_NAME
read -p "Enter your email address (for Let's Encrypt SSL recovery): " CADDY_EMAIL

# 3. Setup Environment Variables
echo "Setting up environment variables..."
if [ ! -f .env.production ]; then
    echo "Creating basic .env.production..."
    cat << EOF > .env.production
# LaunchOpsPro Production Environment
NODE_ENV=production
MOCK_MODE=false

# Domain and SSL
DOMAIN_NAME=$DOMAIN_NAME
CADDY_EMAIL=$CADDY_EMAIL

# API Keys
OPENAI_API_KEY=your_openai_api_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here

# URLs
FASTAPI_URL=http://python-backend:8001
DASHBOARD_ORIGIN=https://$DOMAIN_NAME
OAUTH_SERVER_URL=https://$DOMAIN_NAME

# Database
DATABASE_URL=sqlite:///sqlite.db
SESSION_SECRET=$(openssl rand -hex 32)
EOF
    echo "Created .env.production. Please edit it with your actual keys later."
else
    echo ".env.production already exists. Updating domain and email..."
    # Use sed to update or append DOMAIN_NAME and CADDY_EMAIL
    if grep -q "^DOMAIN_NAME=" .env.production; then
        sed -i "s/^DOMAIN_NAME=.*/DOMAIN_NAME=$DOMAIN_NAME/" .env.production
    else
        echo "DOMAIN_NAME=$DOMAIN_NAME" >> .env.production
    fi
    
    if grep -q "^CADDY_EMAIL=" .env.production; then
        sed -i "s/^CADDY_EMAIL=.*/CADDY_EMAIL=$CADDY_EMAIL/" .env.production
    else
        echo "CADDY_EMAIL=$CADDY_EMAIL" >> .env.production
    fi
    
    if grep -q "^DASHBOARD_ORIGIN=" .env.production; then
        sed -i "s|^DASHBOARD_ORIGIN=.*|DASHBOARD_ORIGIN=https://$DOMAIN_NAME|" .env.production
    else
        echo "DASHBOARD_ORIGIN=https://$DOMAIN_NAME" >> .env.production
    fi
fi

# 4. Build and Start Services
echo "Building and starting Docker containers..."
docker-compose --env-file .env.production up --build -d

echo "=================================================="
echo "✅ Deployment Complete!"
echo "=================================================="
echo "Your LaunchOpsPro instance is now running securely."
echo "Platform UI: https://$DOMAIN_NAME"
echo ""
echo "Next steps:"
echo "1. Edit .env.production with your actual API keys (OpenAI, Stripe)"
echo "2. Restart the containers to apply the keys: docker-compose --env-file .env.production restart"
echo "=================================================="
