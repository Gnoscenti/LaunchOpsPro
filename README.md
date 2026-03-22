# LaunchOps Founder Edition v2.0

**Build a business like an MBA would. AI + Human Co-Creating GREAT Things.**

LaunchOps Founder Edition is a Tier 3, no-guardrails personal automation engine that launches production-ready businesses with MBA-grade intelligence. It combines an Gnosis Coach coaching layer (Harvard Business School frameworks), a funding intelligence engine (VC, grants, SBIR/STTR, angel), comprehensive IP protection, legal document generation, and a full infrastructure stack — all orchestrated by the Atlas engine.

This is the **solopreneur documentary edition**: every milestone, decision, and AI co-creation moment is logged and narrativized. The story writes itself as you build.

---

## What's New in v2.0

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Agents | 5 (security, WordPress, Stripe, Mautic, paralegal) | **9+ agents** with full LLM integration |
| Coaching | None | **Gnosis Coach Strategic Catalyst** — HBS case method, Porter's Five Forces, Blue Ocean |
| Funding | None | **Funding Intelligence Engine** — VC, SBIR/STTR, grants, angel, formation optimizer |
| Legal/IP | Basic paralegal checklist | **Full IP Protection Protocol** — NDA, CIIA, IP Assignment, Trade Secrets, Privacy Policy, ToS |
| Business Planning | None | **Business Builder** — Build Spec intake, BMC, competitive analysis, pricing, 90-day ops plan |
| Documentary | None | **Solopreneur Documentary Tracker** — milestone logging, narrative generation |
| Orchestrator | Simple sequential | **Atlas Orchestrator** — stage-aware pipeline with hooks and error recovery |
| Configuration | Flat env vars | **Dataclass config** with env loading, JSON persistence, encrypted credential vault |
| LLM Support | Optional | **Required** — OpenAI + Anthropic with auto-fallback |
| Pipeline | 5 phases | **20-stage launch pipeline** |

---

## Architecture

```
launchops-founder-edition/
├── launchops.py              # CLI entrypoint — 16 commands
├── core/
│   ├── config.py             # LaunchOpsConfig dataclass + env loading
│   ├── credentials.py        # Fernet-encrypted credential vault
│   ├── context.py            # Shared context for all agents
│   └── orchestrator.py       # Atlas orchestrator — stage pipeline
├── agents/
│   ├── base.py               # BaseAgent with LLM integration
│   ├── execai_coach.py       # Gnosis Coach Strategic Catalyst (HBS frameworks)
│   ├── funding_intelligence.py # VC/grant/SBIR funding engine
│   ├── paperwork_agent.py    # IP protection + legal document generation
│   ├── business_builder.py   # Build Spec, BMC, GTM, pricing, ops plan
│   ├── documentary_tracker.py # Solopreneur documentary engine
│   ├── security_agent.py     # Server hardening + Bitwarden
│   ├── wordpress_agent.py    # WordPress + WooCommerce deployment
│   ├── stripe_agent.py       # Stripe payment configuration
│   ├── mautic_agent.py       # Marketing automation
│   └── paralegal_bot.py      # Formation checklist + compliance
├── tools/
│   ├── llm_client.py         # Unified OpenAI/Anthropic client
│   └── web_navigator.py      # Playwright browser automation
├── workflows/
│   └── launch_pipeline.py    # 20-stage master launch pipeline
├── docs/
│   └── ARCHITECTURE_V2.md    # Detailed architecture documentation
├── docker-compose.yml        # Full infrastructure stack
├── requirements.txt          # Python dependencies
├── setup.py                  # pip install support
└── .env.example              # Environment variable template
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Docker and Docker Compose (for infrastructure services)
- At least one LLM API key (OpenAI or Anthropic)
- 4GB RAM minimum, 8GB recommended

### Installation

```bash
# Clone
git clone https://github.com/GnoscentiStudios-DAO/launchops-founder-edition.git
cd launchops-founder-edition

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set OPENAI_API_KEY or ANTHROPIC_API_KEY

# Verify installation
python launchops.py health
```

### Configure Your Business

```bash
# This creates ~/.launchops/business.json
python launchops.py launch

# Edit the business config with your details
nano ~/.launchops/business.json
```

Fill in your business details:

```json
{
  "business_name": "Your Company Name",
  "business_type": "saas",
  "industry": "technology",
  "description": "What your company does",
  "problem": "The problem you solve",
  "solution": "Your solution",
  "target_customer": "Who you serve",
  "revenue_model": "subscription",
  "founder_name": "Your Name",
  "state": "Delaware",
  "entity_type": "not_formed",
  "has_rd_component": true,
  "seeking_vc": true,
  "seeking_funding": true,
  "has_code": true,
  "has_brand": true,
  "ai_assisted": true
}
```

### Launch

```bash
# Run the full 20-stage pipeline
python launchops.py launch

# Or run individual stages
python launchops.py formation     # Entity structure optimizer
python launchops.py funding       # Funding readiness report
python launchops.py paperwork     # Generate all legal documents
python launchops.py coach         # Gnosis Coach coaching session
python launchops.py ip-audit      # IP protection audit
```

---

## Commands

| Command | Description |
|---------|-------------|
| `launch` | Run the full 20-stage launch pipeline |
| `stage <name>` | Run a single pipeline stage |
| `status` | Show pipeline progress |
| `coach` | Start an Gnosis Coach coaching session |
| `funding` | Run funding readiness report |
| `formation` | Run formation structure optimizer |
| `paperwork` | Generate all legal documents |
| `ip-audit` | Run IP protection audit |
| `security` | Run security audit |
| `documentary` | Generate documentary narrative |
| `health` | Check system health (LLM providers, agents) |
| `reset` | Reset pipeline state |
| `config` | Show business configuration |
| `deploy` | Deploy Docker infrastructure |
| `stop` | Stop all Docker services |

---

## The 20-Stage Launch Pipeline

| # | Stage | Agent | Description |
|---|-------|-------|-------------|
| 1 | Build Spec Intake | Business Builder | Define your business — problem, solution, customer |
| 2 | Business Model Canvas | Business Builder | Full BMC generation |
| 3 | Formation Analysis | Funding Intelligence | Optimal entity type and state for funding |
| 4 | Funding Readiness | Funding Intelligence | Eligibility across all funding avenues |
| 5 | IP Audit | Paperwork Agent | Identify all IP assets and protection strategies |
| 6 | IP Assignment | Paperwork Agent | Founder-to-Entity IP assignment agreement |
| 7 | NDA Generation | Paperwork Agent | Mutual NDA for partner/vendor conversations |
| 8 | Trade Secret Protocol | Paperwork Agent | Document trade secrets and protections |
| 9 | CIIA Agreement | Paperwork Agent | For future employees/contractors |
| 10 | Privacy Policy | Paperwork Agent | GDPR/CCPA compliant |
| 11 | Terms of Service | Paperwork Agent | Product terms of service |
| 12 | Security Audit | Security Agent | Server hardening recommendations |
| 13 | WordPress Deploy | WordPress Agent | Full WordPress + WooCommerce |
| 14 | Stripe Setup | Stripe Agent | Payment processing configuration |
| 15 | Go-to-Market | Business Builder | GTM strategy with first 100 customers plan |
| 16 | Pricing Strategy | Business Builder | Pricing model and tier structure |
| 17 | Competitive Analysis | Business Builder | Landscape analysis and positioning |
| 18 | 90-Day Ops Plan | Business Builder | Week-by-week operational plan |
| 19 | Gnosis Coach Review | Gnosis Coach Coach | Harvard-style strategic review |
| 20 | Documentary | Documentary Tracker | Generate narrative from all milestones |

---

## Agents

### Gnosis Coach Strategic Catalyst

Harvard Business School coaching methodology. Provides strategic guidance using:

- **Porter's Five Forces** — competitive analysis
- **Blue Ocean Strategy** — market creation
- **Jobs-to-Be-Done** — customer insight
- **Lean Startup** — build-measure-learn
- **Business Model Canvas** — business design
- **OKR Framework** — goal setting
- **First Principles** — fundamental reasoning

### Funding Intelligence Engine

Comprehensive funding analysis covering:

- **VC Readiness** — Delaware C-Corp, traction metrics, pitch deck readiness
- **SBIR/STTR** — R&D component validation, agency matching
- **Federal Grants** — NSF, NIH, DOE, DOD eligibility
- **State Grants** — state-specific programs
- **Angel Investment** — network readiness, valuation guidance
- **Revenue-Based Financing** — MRR requirements
- **Formation Optimizer** — entity type and state selection for maximum funding eligibility

### Paperwork Agent (IP Protection)

Full legal document generation using GPT-4o/Claude:

- IP Audit and Protection Strategy
- IP Assignment Agreement (Founder to Entity)
- Mutual NDA
- CIIA (Confidential Information and Inventions Assignment)
- Trade Secret Documentation Protocol
- Privacy Policy (GDPR/CCPA)
- Terms of Service
- Provisional Patent Application Guidance
- Trademark Search Guidance

### Business Builder

MBA-grade business planning:

- Build Spec Intake (YOUR business, not 31 ideas)
- Business Model Canvas
- Go-to-Market Strategy
- Pricing Strategy
- Competitive Analysis
- 90-Day Operational Plan

### Documentary Tracker

Every milestone logged. Every AI co-creation moment captured. The documentary writes itself:

- Milestone logging by category (formation, IP, funding, product, revenue, etc.)
- AI co-creation moment highlighting
- Narrative generation
- Chapter generation by phase
- Full documentary export

---

## Cost Savings

| Traditional Stack | LaunchOps Stack | Savings |
|-------------------|-----------------|---------|
| MBA Consultant: $5,000+ | Gnosis Coach Coach: $0 | **$5,000** |
| Lawyer (formation + IP): $3,000+ | Paperwork Agent: $0 | **$3,000** |
| Funding Consultant: $2,000+ | Funding Intelligence: $0 | **$2,000** |
| SaaS Stack: $12,000/yr | Docker Self-Hosted: $315/yr | **$11,685/yr** |
| **Total Year 1**: $22,000+ | **Total Year 1**: $315 + LLM costs | **97% savings** |

---

## Security

### Founder Edition (This Version)

- Full automation, zero guardrails — Tier 3 personal execution
- Fernet-encrypted credential vault (AES-128-CBC)
- All data stored locally in `~/.launchops/`
- No cloud dependencies for sensitive data
- Credentials never leave the machine

### Public Edition (Future — Founder Autopilot)

- Trust boundary and permission system (Gnosis Coach governance)
- User consent flows for sensitive operations
- Multi-tenant isolation
- Audit logging

---

## Data Storage

All data persists in `~/.launchops/`:

```
~/.launchops/
├── config.json           # System configuration
├── business.json         # Business configuration
├── pipeline_state.json   # Pipeline progress
├── credentials/
│   ├── vault.enc         # Encrypted credential vault
│   └── vault.key         # Encryption key
├── data/                 # Agent data
├── documents/            # Generated legal documents
├── documentary/
│   ├── timeline.json     # All milestones
│   ├── narrative.md      # Generated narrative
│   └── export/           # Documentary export
└── logs/                 # System logs
```

---

## Troubleshooting

### LLM Not Connected

```bash
# Check health
python launchops.py health

# Verify API key is set
echo $OPENAI_API_KEY
```

### Pipeline Stuck

```bash
# Check status
python launchops.py status

# Reset and re-run
python launchops.py reset
python launchops.py launch
```

### Docker Services Won't Start

```bash
sudo systemctl status docker
docker-compose logs <service_name>
python launchops.py deploy
```

---

## Links

- **GitHub**: https://github.com/GnoscentiStudios-DAO/launchops-founder-edition
- **Gnoscenti**: https://github.com/GnoscentiStudios-DAO
- **Founder Autopilot (Public Edition)**: Coming soon

---

**Built by Gnoscenti. Co-created with AI.**

*AI + Human Co-Creating GREAT Things.*
