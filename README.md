# LaunchOps Founder Edition v3.0

**The AI-Powered Business Operating System for Founders.**

LaunchOps Founder Edition is a Tier 3, no-guardrails personal execution engine that launches production-ready businesses with MBA-grade intelligence. It combines 17 specialized agents, a 10-stage Atlas pipeline, a full infrastructure stack, and a daily operating system — all wired to produce real revenue from day one.

This is the **canonical repo** for the Dynexis Systems founder launch. The founder's own business launch IS the product demo, documented live on YouTube.

---

## Architecture

The system operates across 5 layers:

| Layer | Purpose | Key Components |
|-------|---------|----------------|
| **1. LaunchOps Stack** | Infrastructure substrate | Docker Compose, WordPress, SuiteCRM, Mautic, Matomo, Vaultwarden |
| **2. Founder OS** | Daily operating system | Morning agenda, midday check, evening review, weekly sprint |
| **3. DynExecutiv** | Decision engine | Daily "What Matters Now", weekly executive brief, risk flags |
| **4. Content Engine** | Lead generation | 30-day content calendar, post templates, UTM tracking |
| **5. Metrics Enforcement** | Financial auditor | MRR, CAC, LTV, conversion funnel, automated cut rules |

### File Layout

```
launchops-founder-edition/
├── launchops.py                    # CLI entrypoint
├── AGENTS.md                       # Operator standard
├── AGENTS_ARCHITECT.md             # Systems architect standard
├── AGENTS_LAUNCH_OPERATOR.md       # Launch operator standard
├── PIPELINE_STATUS.md              # What's ready, what needs work
├── LAUNCH_SEQUENCE.md              # Day-by-day launch playbook
├── ROADMAP.md                      # Prioritized implementation plan
│
├── core/                           # Engine internals
│   ├── orchestrator.py             # Atlas orchestrator — stage pipeline
│   ├── stage_handlers.py           # Wires agents to pipeline stages
│   ├── config.py                   # LaunchOpsConfig dataclass + env loading
│   ├── context.py                  # Shared context for all agents
│   ├── credentials.py              # Fernet-encrypted credential vault
│   ├── workflow_engine.py          # Workflow execution engine
│   ├── task_graph.py               # Task graph model
│   ├── permissions.py              # Human approval layer (feature-flagged)
│   └── audit_log.py                # Structured audit logging
│
├── agents/                         # 17 specialized agents
│   ├── base.py                     # BaseAgent with LLM integration
│   ├── founder_os.py               # Layer 2: Daily operating system
│   ├── dynexecutiv.py              # Layer 3: Decision engine
│   ├── content_engine.py           # Layer 4: Content/lead gen
│   ├── metrics_agent.py            # Layer 5: Metrics enforcement
│   ├── execai_coach.py             # ExecAI Strategic Catalyst (HBS frameworks)
│   ├── business_builder.py         # Build Spec intake, BMC, GTM, pricing
│   ├── funding_intelligence.py     # VC/grant/SBIR funding engine
│   ├── paperwork_agent.py          # IP protection + legal doc generation
│   ├── documentary_tracker.py      # Solopreneur documentary engine
│   ├── security_agent.py           # Server hardening + Bitwarden
│   ├── wordpress_agent.py          # WordPress + WooCommerce deployment
│   ├── stripe_agent.py             # Stripe payment configuration
│   ├── mautic_agent.py             # Marketing automation
│   ├── paralegal_bot.py            # Formation checklist + compliance
│   ├── growth_agent.py             # Growth strategy
│   ├── analytics_agent.py          # Analytics integration
│   └── email_agent.py              # Email automation
│
├── tools/                          # Shared tooling
│   ├── llm_client.py               # Unified OpenAI/Anthropic client
│   └── web_navigator.py            # Playwright browser automation
│
├── workflows/                      # Pipeline definitions
│   └── launch_pipeline.py          # 10-stage master launch pipeline
│
├── templates/                      # Output templates
│   ├── daily_brief.md              # Founder OS daily template
│   ├── weekly_brief.md             # DynExecutiv weekly brief template
│   ├── weekly_sprint.md            # Weekly sprint plan template
│   └── content_calendar.md         # 30-day content calendar template
│
├── verticals/                      # Industry vertical configs
│   ├── saas.py
│   ├── ecommerce.py
│   ├── agency.py
│   └── marketplace.py
│
├── api/                            # FastAPI operator API (Phase 2)
│   ├── main.py                     # API server with Atlas integration
│   ├── routes/                     # Modular route handlers
│   └── models/                     # Pydantic models
│
├── dashboard/                      # React/Vite founder dashboard (Phase 3)
│   └── src/
│       ├── pages/
│       ├── components/
│       └── lib/
│
├── docs/                           # Documentation
│   ├── ARCHITECTURE_V2.md          # Detailed architecture docs
│   ├── HETZNER_SETUP.md            # VPS deployment guide
│   ├── FOUNDER_AUTOPILOT_ALIGNMENT.md
│   └── checklist.md                # Deployment verification checklist
│
├── docker-compose.yml              # Full LaunchOps infrastructure stack
├── install.sh                      # One-command stack deployment
├── healthcheck.sh                  # Service health verification
├── nginx/conf.d/                   # Reverse proxy configuration
├── .env.example                    # Environment variable template
├── requirements.txt                # Python dependencies
└── tests/                          # Test suite
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Docker and Docker Compose
- At least one LLM API key (OpenAI or Anthropic)
- 4GB RAM minimum, 8GB recommended

### Installation

```bash
# Clone
git clone https://github.com/MicroAIStudios-DAO/launchops-founder-edition.git
cd launchops-founder-edition

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set OPENAI_API_KEY

# Verify installation
python launchops.py health
```

### Deploy Infrastructure

```bash
# Deploy the full LaunchOps stack (WordPress, SuiteCRM, Mautic, Matomo, Vaultwarden)
chmod +x install.sh && ./install.sh

# Verify all services are running
chmod +x healthcheck.sh && ./healthcheck.sh
```

### Launch the Pipeline

```bash
# Run the full 10-stage pipeline (agents execute real work)
python launchops.py launch

# Or run individual stages
python launchops.py stage init
python launchops.py stage formation
python launchops.py stage payments
python launchops.py stage growth
```

---

## The 10-Stage Atlas Pipeline

Every stage is wired to real agents that execute real work:

| Stage | Agents Involved | What Happens |
|-------|----------------|--------------|
| **init** | ExecAI Coach | System initialization, business config validation |
| **intake** | Business Builder, DynExecutiv | Business spec analysis, revenue-first prioritization |
| **formation** | Paralegal Bot, Paperwork Agent | Entity formation docs, compliance checks |
| **infrastructure** | WordPress Agent, Security Agent | WordPress deployment, security audit |
| **legal** | Paperwork Agent, Paralegal Bot | Legal document generation, IP audit |
| **payments** | Stripe Agent | Stripe products, pricing, webhook setup |
| **funding** | Funding Intelligence | Funding readiness report across all avenues |
| **coaching** | ExecAI Coach, Founder OS | Strategic coaching session, daily plan generation |
| **growth** | Growth Agent, Content Engine, Mautic Agent | Growth strategy, content calendar, email campaigns |
| **done** | Documentary Tracker, Metrics Agent | Documentary narrative, metrics snapshot, final report |

---

## The 17 Agents

| Agent | Role |
|-------|------|
| **ExecAI Coach** | Harvard Business School coaching methodology (Porter's, Blue Ocean, JTBD) |
| **Business Builder** | Build Spec intake, BMC, GTM, pricing, 90-day ops plan |
| **Funding Intelligence** | VC, SBIR/STTR, grants, angel, formation optimizer |
| **Paperwork Agent** | IP protection, NDA, CIIA, Privacy Policy, ToS generation |
| **Founder OS** | Daily operating system — morning agenda, midday check, evening review |
| **DynExecutiv** | Decision engine — daily/weekly briefs from live Stripe/CRM/Matomo data |
| **Content Engine** | 30-day content calendar, post templates, UTM tracking |
| **Metrics Agent** | MRR, CAC, LTV, conversion funnel, automated cut enforcement |
| **Documentary Tracker** | Milestone logging, narrative generation, chapter export |
| **Security Agent** | Server hardening, Bitwarden/Vaultwarden setup |
| **WordPress Agent** | WordPress + WooCommerce deployment and configuration |
| **Stripe Agent** | Payment processing, subscription, webhook configuration |
| **Mautic Agent** | Marketing automation, email campaigns, lead scoring |
| **Growth Agent** | Growth strategy, channel analysis, scaling playbook |
| **Analytics Agent** | Matomo analytics integration and reporting |
| **Email Agent** | Transactional and marketing email automation |
| **Paralegal Bot** | Formation checklist, compliance verification |

---

## Commands

| Command | Description |
|---------|-------------|
| `launch` | Run the full 10-stage pipeline with all agents |
| `stage <name>` | Run a single pipeline stage |
| `status` | Show pipeline progress |
| `health` | Check system health (LLM providers, agents, services) |
| `coach` | Start an ExecAI coaching session |
| `funding` | Run funding readiness report |
| `formation` | Run formation structure optimizer |
| `paperwork` | Generate all legal documents |
| `ip-audit` | Run IP protection audit |
| `security` | Run security audit |
| `documentary` | Generate documentary narrative |
| `deploy` | Deploy Docker infrastructure |
| `stop` | Stop all Docker services |
| `reset` | Reset pipeline state |
| `config` | Show business configuration |

---

## Operator Standards

This repo is governed by three AGENTS.md files:

| File | Scope |
|------|-------|
| `AGENTS.md` | General operator standard — founder-grade, revenue-first, zero-fluff |
| `AGENTS_ARCHITECT.md` | Systems architect standard — orchestrator integrity, agent development, security |
| `AGENTS_LAUNCH_OPERATOR.md` | Launch operator standard — launch readiness, monetization bias, deployment rules |

---

## Cost Savings

| Traditional Stack | LaunchOps Stack | Savings |
|-------------------|-----------------|---------|
| MBA Consultant: $5,000+ | ExecAI Coach: $0 | **$5,000** |
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
- Human approval layer available via `ENABLE_HUMAN_APPROVAL=true` feature flag

---

## Links

- **Canonical Repo**: [MicroAIStudios-DAO/launchops-founder-edition](https://github.com/MicroAIStudios-DAO/launchops-founder-edition)
- **LaunchOps Stack**: [Gnoscenti/launchops-stack](https://github.com/Gnoscenti/launchops-stack)
- **Dynexis Core**: [Gnoscenti/dynexis-core](https://github.com/Gnoscenti/dynexis-core)

---

**Built by Gnoscenti. Co-created with AI. The Canonical Integrated Founder-Grade Execution Engine.**
