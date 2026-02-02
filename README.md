# LaunchOps Founder Edition

**Complete business automation with zero guardrails.**

LaunchOps Founder Edition is a personal automation system that launches production-ready businesses in under 2 hours. It combines AI-powered agents with open-source tools to eliminate the manual work of business setup.

## 🎯 What It Does

LaunchOps automates the entire business launch process:

1. **Security Setup** - Deploys Bitwarden password manager
2. **Legal Formation** - Generates formation documents and compliance calendar
3. **Website Deployment** - Launches WordPress with themes and plugins
4. **Payment Processing** - Configures Stripe for subscriptions
5. **Marketing Automation** - Deploys Mautic for email campaigns
6. **File Storage** - Sets up Nextcloud for documents
7. **Customer Support** - Deploys Chatwoot for live chat
8. **Analytics** - Installs Matomo for privacy-friendly tracking

## 💰 Cost Savings

| Traditional Stack | LaunchOps Stack | Savings |
|-------------------|-----------------|---------|
| $12,000/year | $315/year | **$11,685/year (97%)** |

## 🚀 Quick Start

### Prerequisites

- Linux machine (Ubuntu 22.04+ recommended)
- Docker and Docker Compose installed
- Python 3.8+ installed
- 4GB RAM minimum, 8GB recommended
- 50GB disk space

### Installation

```bash
# Clone repository
git clone https://github.com/MicroAIStudios-DAO/launchops-founder-edition.git
cd launchops-founder-edition

# Install Python dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# Edit .env and set your passwords

# Deploy all services
./launchops.py deploy
```

### Launch Your First Business

```bash
./launchops.py launch \\
  --name "My Startup" \\
  --email "founder@example.com" \\
  --domain "mystartup.com" \\
  --state "Delaware" \\
  --entity "LLC" \\
  --type "saas"
```

This single command will:
- ✅ Deploy password manager
- ✅ Generate legal formation documents
- ✅ Setup WordPress website
- ✅ Configure Stripe payments
- ✅ Deploy marketing automation
- ✅ Create compliance calendar
- ✅ Store all credentials securely

**Total time: < 2 hours** (vs. 40-80 hours manually)

## 📦 Included Services

### Core Stack

| Service | Purpose | Port | Open Source |
|---------|---------|------|-------------|
| **Bitwarden** | Password Manager | 8000 | ✅ MIT |
| **WordPress** | Website & CMS | 8080 | ✅ GPL |
| **Nextcloud** | File Storage | 8082 | ✅ AGPL |
| **Chatwoot** | Customer Support | 8083 | ✅ MIT |
| **Mautic** | Marketing Automation | 8081 | ✅ GPL |
| **Matomo** | Analytics | 8084 | ✅ GPL |

### External Services

| Service | Purpose | Cost | Setup |
|---------|---------|------|-------|
| **Stripe** | Payments | 2.9% + 30¢ | Automated guidance |
| **Zoho Mail** | Email | Free tier | DNS configuration |
| **Vercel** | Hosting (optional) | Free tier | CLI integration |

## 🤖 AI Agents

LaunchOps includes 5 specialized agents:

### 1. Security Agent
- Deploys Bitwarden password manager
- Generates secure passwords
- Configures 2FA policies
- Manages credential vault

### 2. WordPress Agent
- Deploys WordPress with Docker
- Installs themes and plugins
- Configures SSL certificates
- Optimizes performance
- Sets up SEO basics

### 3. Stripe Agent
- Guides through account creation
- Configures webhooks
- Creates subscription tiers
- Sets up payment links
- Handles billing automation

### 4. Mautic Agent
- Deploys marketing automation
- Configures email sending (SMTP)
- Creates email templates
- Sets up lead scoring
- Builds campaign workflows
- Installs website tracking

### 5. Paralegal Bot
- Generates formation checklist
- Creates legal documents
- Tracks compliance deadlines
- Guides through EIN application
- Manages license renewals
- Monitors filing requirements

## 📋 Commands

### Service Management

```bash
# Deploy all services
./launchops.py deploy

# Check service status
./launchops.py status

# Stop all services
./launchops.py stop

# Restart all services
./launchops.py restart
```

### Business Launch

```bash
# Launch new business
./launchops.py launch --name "Business Name" --email "email@example.com"

# Launch with custom domain
./launchops.py launch --name "My SaaS" --email "founder@example.com" --domain "mysaas.com"

# Launch in specific state
./launchops.py launch --name "My LLC" --email "founder@example.com" --state "Wyoming"
```

## 🔧 Configuration

### Environment Variables

Create `.env` file with these variables:

```bash
# WordPress
WORDPRESS_DB_PASSWORD=<secure_password>
WORDPRESS_DB_ROOT_PASSWORD=<secure_password>

# Mautic
MAUTIC_DB_PASSWORD=<secure_password>
MAUTIC_DB_ROOT_PASSWORD=<secure_password>

# Nextcloud
NEXTCLOUD_DB_PASSWORD=<secure_password>
NEXTCLOUD_DB_ROOT_PASSWORD=<secure_password>
NEXTCLOUD_ADMIN_PASSWORD=<secure_password>

# Chatwoot
CHATWOOT_DB_PASSWORD=<secure_password>
CHATWOOT_SECRET_KEY=<secure_random_string>

# Matomo
MATOMO_DB_PASSWORD=<secure_password>
MATOMO_DB_ROOT_PASSWORD=<secure_password>
```

### Data Storage

All data is stored in `./data/` directory:

```
data/
├── bitwarden/          # Password vault
├── wordpress/          # Website files
├── wordpress_db/       # Website database
├── mautic/            # Marketing automation
├── mautic_db/         # Marketing database
├── nextcloud/         # File storage
├── nextcloud_db/      # Files database
├── chatwoot/          # Support data
├── chatwoot_db/       # Support database
├── matomo/            # Analytics data
└── matomo_db/         # Analytics database
```

## 🎓 Usage Guide

### 1. Initial Setup

1. Deploy all services: `./launchops.py deploy`
2. Wait 2-3 minutes for services to start
3. Access each service and complete initial setup:
   - Bitwarden: http://localhost:8000
   - WordPress: http://localhost:8080
   - Mautic: http://localhost:8081
   - Nextcloud: http://localhost:8082
   - Chatwoot: http://localhost:8083
   - Matomo: http://localhost:8084

### 2. Launch Business

Run the launch command with your business details. LaunchOps will:
- Generate all necessary documents
- Deploy services
- Create compliance calendar
- Store credentials
- Provide next steps

### 3. Manual Steps

Some steps require manual completion:
- **EIN Application**: Visit IRS website (free, online, immediate)
- **State Filing**: Submit formation documents to Secretary of State
- **Bank Account**: Open business bank account with EIN
- **Stripe Account**: Complete KYC verification
- **Domain Setup**: Configure DNS records

### 4. Ongoing Compliance

LaunchOps generates a compliance calendar with:
- Annual report deadlines
- License renewal dates
- Tax filing deadlines
- Meeting requirements
- Beneficial ownership updates

## 🔒 Security

### Founder Edition vs. Public Edition

**Founder Edition (This Version)**
- ✅ Full automation, zero guardrails
- ✅ Credentials stored in encrypted vault
- ✅ New accounts per business (isolation)
- ✅ For personal use only

**Public Edition (Future)**
- ⚠️ Approval gates for sensitive operations
- ⚠️ User provides credentials
- ⚠️ Trust boundaries and consent flows
- ⚠️ EPI governance enforcement

### Security Best Practices

1. **Credential Management**
   - All credentials stored in Bitwarden
   - Unique passwords per service
   - 2FA enabled where possible

2. **Data Isolation**
   - Each business = separate accounts
   - No credential reuse
   - Easy to revoke/destroy

3. **Access Control**
   - Bitwarden master password required
   - Docker containers isolated
   - Network segmentation

4. **Backups**
   - Backup `./data/` directory regularly
   - Export Bitwarden vault
   - Store backups securely off-site

## 🛠️ Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
sudo systemctl status docker

# Check logs
docker-compose logs <service_name>

# Restart services
./launchops.py restart
```

### Port Conflicts

If ports 8000-8084 are in use, edit `docker-compose.yml` to change port mappings.

### Database Connection Errors

```bash
# Reset database
docker-compose down -v
docker-compose up -d
```

### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./data
```

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Tool Stack Details](docs/TOOL_STACK.md)
- [Agent Development Guide](docs/AGENT_DEVELOPMENT.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Compliance Guide](docs/COMPLIANCE.md)

## 🤝 Contributing

This is a personal automation system. For the public version with governance, see [LaunchOps Public Edition](https://github.com/MicroAIStudios-DAO/launchops).

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [Vaultwarden](https://github.com/dani-garcia/vaultwarden) - Bitwarden-compatible server
- [WordPress](https://wordpress.org/) - Content management system
- [Mautic](https://www.mautic.org/) - Marketing automation
- [Nextcloud](https://nextcloud.com/) - File storage
- [Chatwoot](https://www.chatwoot.com/) - Customer support
- [Matomo](https://matomo.org/) - Web analytics

## 🔗 Links

- **GitHub**: https://github.com/MicroAIStudios-DAO/launchops-founder-edition
- **MicroAI Studios**: https://github.com/MicroAIStudios-DAO
- **Documentation**: https://docs.microaistudios.com

---

**Built with ❤️ by MicroAI Studios**

*Empowering founders to build faster with AI automation and open-source tools.*
