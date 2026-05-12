# LaunchOps Founder Edition — Deployment Guide

This document provides step-by-step instructions for deploying the LaunchOps Founder Edition platform from scratch on any VPS or cloud server.

## Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04+ or Debian 12+ |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 40 GB |
| CPU | 1 vCPU | 2 vCPU |
| Docker | 24.0+ | Latest stable |
| Docker Compose | v2.20+ | Latest stable |
| Network | Ports 80, 443, 3000, 8001 open | Same |

You will also need an **OpenAI API key** with access to `gpt-4.1-mini` (or compatible model).

## Step 1: Install Docker

If Docker is not already installed on your server:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in, then verify:

```bash
docker --version
docker compose version
```

## Step 2: Clone the Repository

```bash
cd /opt
git clone https://github.com/Gnoscenti/LaunchOpsPro.git launchops
cd /opt/launchops
```

## Step 3: Configure Environment Variables

Copy the example environment file and edit it:

```bash
cp .env.example .env   # if .env.example exists
# OR create .env manually:
nano .env
```

The `.env` file must contain the following variables:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
FORGE_API_URL=https://api.openai.com

# Database Configuration
DB_HOST=mysql
DB_PORT=3306
DB_USER=launchops
DB_PASSWORD=your-secure-db-password
DB_NAME=launchops
DB_ROOT_PASSWORD=your-secure-root-password
DATABASE_URL=mysql://launchops:your-secure-db-password@mysql:3306/launchops

# Platform Configuration
AUTH_BYPASS_ENABLED=true
VITE_AUTH_DISABLED=true
STRIPE_SECRET_KEY=sk_test_placeholder
NODE_ENV=production

# Python Backend
MOCK_MODE=false
```

Replace the placeholder values with your actual credentials. The `AUTH_BYPASS_ENABLED=true` setting disables the Manus OAuth gate for self-hosted deployments.

## Step 4: Initialize the Database

Create the MySQL initialization directory and SQL file:

```bash
mkdir -p mysql-init
```

The `mysql-init/init.sql` file should already exist in the repository. If not, it will be created automatically from the Drizzle migrations on first run. The database schema includes tables for users, workflows, executions, step executions, templates, credentials, logs, and naming contests.

## Step 5: Build and Start All Services

```bash
docker compose build --no-cache
docker compose up -d
```

This starts four containers:

| Container | Port | Purpose |
|---|---|---|
| `launchops-platform` | 3000 | Frontend + tRPC API server |
| `launchops-python-backend` | 8001 | FastAPI backend with Atlas orchestrator |
| `launchops-mysql` | 3306 | MySQL 8.0 database |
| `launchops-caddy` | 80/443 | Reverse proxy with automatic HTTPS |

Wait approximately 30 seconds for MySQL to initialize and all services to become healthy.

## Step 6: Verify the Deployment

Run these verification checks:

```bash
# Check all containers are running
docker ps

# Verify platform health (should return user JSON)
curl -s http://localhost:3000/api/trpc/auth.me | head -100

# Verify Python backend health
curl -s http://localhost:8001/health

# Verify the dashboard loads
curl -s http://localhost:80 | head -20
```

Expected results:

- All four containers show status `Up` and `(healthy)`
- The `auth.me` endpoint returns a JSON object with `id: 1, name: "Admin", role: "admin"`
- The Python backend returns `{"status": "ok", "mock_mode": false}`
- The dashboard returns HTML content

## Step 7: Seed the Admin User (If Needed)

If the admin user was not created by `init.sql`, insert it manually:

```bash
docker exec launchops-mysql mysql -u root -p"$DB_ROOT_PASSWORD" launchops -e "
INSERT INTO users (open_id, name, email, login_method, role, subscription_tier)
VALUES ('self-hosted-admin', 'Admin', 'admin@launchops.local', 'self-hosted', 'admin', 'enterprise')
ON DUPLICATE KEY UPDATE role='admin';
"
```

## Step 8: Access the Platform

Open your browser and navigate to:

- **Dashboard**: `http://YOUR_SERVER_IP`
- **Launch Pipeline**: `http://YOUR_SERVER_IP/pipeline`

Click "Launch Pipeline" in the sidebar, fill in your business details, and click the gold "Launch Pipeline" button. The Mission Control view will show each of the 6 Atlas agents processing your business in real-time.

## Architecture Overview

```
                    ┌─────────────┐
                    │   Caddy      │ :80/:443
                    │  (reverse    │
                    │   proxy)     │
                    └──────┬───┬──┘
                           │   │
              /api/*       │   │  /*
              ┌────────────┘   └────────────┐
              ▼                             ▼
    ┌─────────────────┐          ┌─────────────────┐
    │  Python Backend  │          │    Platform      │
    │  (FastAPI)       │ :8001    │  (Express+tRPC)  │ :3000
    │  Atlas Pipeline  │          │  React Frontend  │
    └─────────────────┘          └────────┬────────┘
                                          │
                                 ┌────────▼────────┐
                                 │     MySQL 8.0    │ :3306
                                 │   (launchops)    │
                                 └─────────────────┘
```

## Pipeline Stages

The Launch Pipeline executes 6 personalized AI agent stages:

| Stage | Agent | Description |
|---|---|---|
| Business Formation | `formation-advisor` | Entity type, legal structure, state filing |
| Infrastructure | `systems-agent` | Tech stack, tools, domain, hosting |
| Payments | `stripe-agent` | Payment processing, pricing strategy |
| Funding | `funding-intelligence` | Funding sources, investor targeting |
| Coaching | `execai-coach` | 90-day action plan, milestones |
| Growth | `growth-agent` | Marketing strategy, customer acquisition |

Each stage receives the business context from the intake form and produces personalized, actionable output using GPT-4.1-mini.

## Troubleshooting

**Platform container keeps restarting**: Check logs with `docker logs launchops-platform`. Common causes include missing environment variables (especially `DATABASE_URL` and `STRIPE_SECRET_KEY`) or MySQL not being ready yet.

**LLM calls failing**: Verify your `OPENAI_API_KEY` is valid and has access to `gpt-4.1-mini`. Check that `FORGE_API_URL` is set to `https://api.openai.com` (without `/v1` suffix, as the code appends it automatically).

**Database connection errors**: Ensure MySQL is healthy with `docker exec launchops-mysql mysqladmin -u root -p"$DB_ROOT_PASSWORD" ping`. The platform waits for MySQL to be healthy before starting.

**OAuth errors in logs**: The `[OAuth] ERROR: OAUTH_SERVER_URL is not configured` message is expected and harmless when `AUTH_BYPASS_ENABLED=true`. The auth bypass handles all authentication locally.

## Updating

To update to the latest version:

```bash
cd /opt/launchops
git pull origin main
docker compose build --no-cache platform
docker compose up -d
```

## Security Notes

For production deployments, consider the following:

- Change all default passwords in `.env`
- Set up a domain name and let Caddy provision automatic HTTPS certificates
- Restrict port access with a firewall (only expose 80/443)
- Rotate the OpenAI API key periodically
- Back up the MySQL database regularly with `docker exec launchops-mysql mysqldump -u root -p"$DB_ROOT_PASSWORD" launchops > backup.sql`
