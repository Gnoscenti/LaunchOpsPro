#!/bin/bash

# ==============================================================================
# Founder Autopilot - Production Environment Setup Script
# This script interactively generates a .env.production file.
# ==============================================================================

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ENV_FILE=".env.production"

echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}   Founder Autopilot Production Environment Setup     ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo ""

# Check if file already exists
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Warning: $ENV_FILE already exists.${NC}"
    read -p "Do you want to overwrite it? (y/N): " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        echo "Setup aborted."
        exit 0
    fi
    rm "$ENV_FILE"
fi

echo -e "This script will help you configure your production environment variables."
echo -e "Press Enter to accept the [default] values."
echo ""

# Initialize the file
cat << EOF > $ENV_FILE
# ==========================================
# FOUNDER AUTOPILOT - PRODUCTION ENVIRONMENT
# Generated on: $(date)
# ==========================================

MOCK_MODE=false
DEBUG=false
ENVIRONMENT=production
EOF

# ---------------------------------------------------------
# 1. Security
# ---------------------------------------------------------
echo -e "${YELLOW}--- Security Configuration ---${NC}"
# Generate a random 32-byte hex string for the secret key
DEFAULT_SECRET=$(openssl rand -hex 32)
echo "A secure SECRET_KEY has been automatically generated."
echo "SECRET_KEY=$DEFAULT_SECRET" >> $ENV_FILE
echo ""

# ---------------------------------------------------------
# 2. Database
# ---------------------------------------------------------
echo -e "${YELLOW}--- Database Configuration ---${NC}"
echo "Enter your PostgreSQL connection string (e.g., from Supabase or Neon)."
read -p "DATABASE_URL: " db_url
while [[ -z "$db_url" ]]; do
    echo -e "${RED}DATABASE_URL is required for production.${NC}"
    read -p "DATABASE_URL: " db_url
done
echo "DATABASE_URL=$db_url" >> $ENV_FILE
echo ""

# ---------------------------------------------------------
# 3. LLM Provider
# ---------------------------------------------------------
echo -e "${YELLOW}--- LLM Provider Configuration ---${NC}"
read -p "OPENAI_API_KEY [sk-...]: " openai_key
if [[ -n "$openai_key" ]]; then
    echo "OPENAI_API_KEY=$openai_key" >> $ENV_FILE
    
    read -p "OPENAI_API_BASE [https://api.openai.com/v1]: " openai_base
    openai_base=${openai_base:-https://api.openai.com/v1}
    echo "OPENAI_API_BASE=$openai_base" >> $ENV_FILE
    
    read -p "OPENAI_MODEL [gpt-4-turbo-preview]: " openai_model
    openai_model=${openai_model:-gpt-4-turbo-preview}
    echo "OPENAI_MODEL=$openai_model" >> $ENV_FILE
else
    echo -e "${YELLOW}Skipping LLM configuration. You will need to add this later.${NC}"
fi
echo ""

# ---------------------------------------------------------
# 4. Third-Party Integrations
# ---------------------------------------------------------
echo -e "${YELLOW}--- Third-Party Integrations ---${NC}"

# Stripe
read -p "STRIPE_API_KEY (sk_live_...): " stripe_key
[[ -n "$stripe_key" ]] && echo "STRIPE_API_KEY=$stripe_key" >> $ENV_FILE

read -p "STRIPE_WEBHOOK_SECRET (whsec_...): " stripe_webhook
[[ -n "$stripe_webhook" ]] && echo "STRIPE_WEBHOOK_SECRET=$stripe_webhook" >> $ENV_FILE

# GitHub
read -p "GITHUB_TOKEN (Fine-grained PAT): " github_token
[[ -n "$github_token" ]] && echo "GITHUB_TOKEN=$github_token" >> $ENV_FILE

# Vercel
read -p "VERCEL_API_TOKEN: " vercel_token
[[ -n "$vercel_token" ]] && echo "VERCEL_API_TOKEN=$vercel_token" >> $ENV_FILE

read -p "VERCEL_TEAM_ID (Optional): " vercel_team
[[ -n "$vercel_team" ]] && echo "VERCEL_TEAM_ID=$vercel_team" >> $ENV_FILE

# Google Cloud
read -p "GCLOUD_PROJECT_ID: " gcloud_project
[[ -n "$gcloud_project" ]] && echo "GCLOUD_PROJECT_ID=$gcloud_project" >> $ENV_FILE
echo ""

# ---------------------------------------------------------
# 5. Frontend & CORS
# ---------------------------------------------------------
echo -e "${YELLOW}--- Frontend & Network Configuration ---${NC}"
read -p "VITE_API_URL (URL of your deployed backend) [https://api.yourdomain.com]: " vite_url
vite_url=${vite_url:-https://api.yourdomain.com}
echo "VITE_API_URL=$vite_url" >> $ENV_FILE

read -p "CORS_ORIGINS (Comma-separated allowed frontend URLs) [https://yourdomain.com]: " cors_origins
cors_origins=${cors_origins:-https://yourdomain.com}
echo "CORS_ORIGINS=$cors_origins" >> $ENV_FILE
echo ""

# ---------------------------------------------------------
# Finish
# ---------------------------------------------------------
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "Your production environment variables have been saved to: ${YELLOW}$ENV_FILE${NC}"
echo -e "${RED}IMPORTANT: Never commit $ENV_FILE to version control!${NC}"
echo -e "Ensure it is listed in your .gitignore file."
echo -e "${GREEN}======================================================${NC}"

# Ensure correct permissions (read/write for owner only)
chmod 600 $ENV_FILE
