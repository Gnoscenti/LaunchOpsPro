# LaunchOpsPro

**Deploy a revenue-ready business in hours. Run it with zero drift. Cut everything that doesn't pay.**

LaunchOpsPro is a governed agentic platform that launches, operates, and scales revenue-generating businesses. 25 specialized AI agents execute a 20-stage pipeline — from entity formation through Stripe payments to go-to-market — while every action is attested through ProofGuard, a real-time cognitive governance layer with human-in-the-loop controls.

This is not a chatbot. This is an execution engine.

**Live Platform**: [brand-architect.manus.space](https://brand-architect.manus.space)

---

## Architecture

The system operates across 7 layers:

| Layer | Purpose | Key Components |
|-------|---------|----------------|
| **1. LaunchOps Stack** | Infrastructure substrate | Docker Compose, WordPress, SuiteCRM, Mautic, Matomo, Vaultwarden |
| **2. Founder OS** | Daily operating rhythm | Morning agenda, midday check, evening review, pomodoro sprints |
| **3. DynExecutiv** | Decision engine | Daily brief, weekly executive report, risk flags from live data |
| **4. Atlas Pipeline** | 10-stage launch engine | 17 agents, stage handlers, governed execution |
| **5. ProofGuard** | Governance control plane | CQS attestation, IMDA compliance, HITL approval, audit trail |
| **6. Generative UI** | Agent-to-dashboard rendering | Agents emit structured UI payloads; dashboard renders charts, KPI cards, alerts inline |
| **7. MCP Gateway** | Agent-to-agent ecosystem | Model Context Protocol; external agents discover and invoke LaunchOps capabilities |

### File Layout

```
LaunchOpsPro/
├── platform/                       # Production UI (React + tRPC + Node.js execution engine)
│   ├── client/                     # Frontend: Dashboard, Workflow Editor, Pipeline, Agents, Metrics
│   ├── server/                     # Backend: tRPC API, execution engine, Python bridge, LLM router
│   ├── drizzle/                    # Database schema & migrations
│   └── shared/                     # Shared types & constants
│
├── launchops.py                    # CLI entrypoint
│
├── core/                           # Engine internals
│   ├── orchestrator.py             # Atlas orchestrator (Phase 1 sync + Phase 2 async governed)
│   ├── proofguard.py               # ProofGuard governance middleware (CQS, HITL, attestation)
│   ├── stage_handlers.py           # Wires agents to pipeline stages
│   ├── generative_ui.py            # Agent → UI component payload system
│   ├── mcp_gateway.py              # Model Context Protocol gateway + SDK shim
│   ├── mcp_capabilities.py         # Central MCP capability registry
│   ├── temporal.py                 # Pomodoro/timeboxing engine (TemporalManager)
│   ├── context.py                  # Shared persistent context
│   ├── credentials.py              # Fernet-encrypted credential vault
│   ├── config.py                   # Configuration management
│   ├── permissions.py              # Permission matrix + HITL flag
│   ├── audit_log.py                # Structured audit logging
│   ├── workflow_engine.py          # Workflow execution engine
│   └── task_graph.py               # Task dependency graph
│
├── agents/                         # 17 specialized agents
│   ├── base.py                     # BaseAgent with LLM + shell + Docker utilities
│   ├── stripe_agent.py             # Stripe payments (MCP self-registering, async propose_plan)
│   ├── paperwork_agent.py          # Legal docs + IP protection (propose_plan with risk classification)
│   ├── security_agent.py           # Server hardening + Vaultwarden (propose_plan with sudo detection)
│   ├── growth_agent.py             # GTM strategy (propose_plan with channel classification)
│   ├── founder_os.py               # Daily OS with pomodoro sprint generation
│   ├── dynexecutiv.py              # Decision engine with Generative UI payloads
│   ├── execai_coach.py             # Harvard Business School coaching frameworks
│   ├── business_builder.py         # Build Spec, BMC, GTM, pricing, 90-day plan
│   ├── funding_intelligence.py     # VC, SBIR/STTR, grants, angel evaluation
│   ├── content_engine.py           # 30-day content calendar, post templates
│   ├── metrics_agent.py            # MRR, CAC, LTV, conversion funnel, cut enforcement
│   ├── documentary_tracker.py      # Milestone logging, narrative export
│   ├── wordpress_agent.py          # WordPress + WooCommerce deployment
│   ├── mautic_agent.py             # Marketing automation, email campaigns
│   ├── analytics_agent.py          # Matomo integration
│   ├── email_agent.py              # Transactional + marketing email
│   └── paralegal_bot.py            # Formation checklist, compliance
│
├── api/                            # FastAPI Operator API
│   ├── main.py                     # App with all route modules mounted
│   ├── state.py                    # Singleton orchestrator + context
│   ├── routes/
│   │   ├── pipeline.py             # Phase 1 /atlas/execute (SSE)
│   │   ├── execute_v2.py           # Phase 2 /atlas/v2/execute (governed SSE) + HITL
│   │   ├── command_center.py       # /api/v1/atlas/launch + /stream + /daily-brief
│   │   ├── dynexecutiv.py          # /dynexecutiv/stream (Generative UI SSE)
│   │   ├── mcp.py                  # /mcp/discover + /mcp/invoke + /mcp/health
│   │   ├── health.py               # /health
│   │   ├── config.py               # /prompts, /permissions, /atlas/context
│   │   ├── artifacts.py            # /artifacts
│   │   └── services.py             # /services (Docker health)
│   └── models/
│       ├── pipeline.py             # Pydantic request/response models
│       └── services.py             # Service health models
│
├── dashboard/                      # Dynexis React Dashboard
│   └── src/
│       ├── App.tsx                  # Router + Dynexis-branded sidebar
│       ├── pages/
│       │   ├── Dashboard.tsx        # Command center overview
│       │   ├── PipelineView.tsx     # Launch (Phase 1) + Launch (Governed) + event stream
│       │   ├── DailyBrief.tsx       # DynExecutiv Generative UI stream
│       │   ├── Runs.tsx             # Execution history
│       │   ├── Agents.tsx           # Agent registry
│       │   ├── Artifacts.tsx        # Generated documents
│       │   ├── Services.tsx         # Docker service health
│       │   ├── Logs.tsx             # Audit log viewer
│       │   ├── Prompts.tsx          # Prompt templates
│       │   └── Permissions.tsx      # Permission matrix
│       ├── components/generative/   # Generative UI components
│       │   ├── AnalyticsChart.tsx    # Bar/line chart (inline SVG)
│       │   ├── AlertBanner.tsx       # Severity-based dismissable alert
│       │   ├── KPICard.tsx           # Big-number KPI with delta + sparkline
│       │   ├── ActionList.tsx        # Interactive task checklist
│       │   ├── HITLApprovalCard.tsx   # ProofGuard approve/reject card
│       │   ├── DailyCommandCenter.tsx # Pomodoro sprint board
│       │   └── GenerativeUIRenderer.tsx # Dynamic dispatcher
│       ├── hooks/
│       │   └── useAgentStream.ts    # Dual-mode SSE consumer (GET/POST)
│       └── lib/
│           ├── api.ts               # REST + SSE client helpers
│           └── componentRegistry.ts  # Component name → React mapping
│
├── tools/                          # Shared tooling
│   ├── llm_client.py               # Unified OpenAI/Anthropic client + MCPGateway re-export
│   └── web_navigator.py            # Playwright browser automation
│
├── docker-compose.yml              # Business infrastructure stack
├── install.sh                      # One-command stack deployment
├── healthcheck.sh                  # Service health verification
├── requirements.txt                # Python dependencies
└── tests/
    └── test_agents.py              # 49 unit tests
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+ (for the dashboard)
- Docker and Docker Compose
- At least one LLM API key (OpenAI or Anthropic)
- 4GB RAM minimum, 8GB recommended

### 1. Install

```bash
git clone https://github.com/Gnoscenti/LaunchOpsPro.git
cd LaunchOpsPro/launchops-founder-edition

# Python dependencies
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Dashboard dependencies
cd dashboard && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env — set at minimum:
#   OPENAI_API_KEY or ANTHROPIC_API_KEY
#   PROOFGUARD_API_URL (default: http://localhost:3000/api/attest)
#   ENABLE_HUMAN_APPROVAL=true (recommended)

# Verify
python launchops.py health
```

### 2. Deploy Business Infrastructure

```bash
# Deploy WordPress, SuiteCRM, Mautic, Matomo, Vaultwarden
chmod +x install.sh && ./install.sh

# Verify all services
chmod +x healthcheck.sh && ./healthcheck.sh
```

### 3. Start the Platform UI (Production)

```bash
# The platform/ directory is the production UI
cd platform
pnpm install
pnpm db:push    # Sync database schema
pnpm dev        # Start dev server (React + Express + tRPC)
# Serves on http://localhost:3000
```

### 3b. Start the Legacy Operator API (Optional)

```bash
# Terminal 1 — FastAPI backend (legacy CLI mode)
python -m api.main
# Serves on http://localhost:8001
```

### 4. Launch the Pipeline

**From the dashboard** (recommended): Navigate to **Pipeline** and click **Launch (Governed)** to run the full pipeline with ProofGuard attestation and per-agent SSE streaming.

**From the API** (programmatic):
```bash
# Kick off a governed pipeline run
curl -X POST http://localhost:8001/api/v1/atlas/launch \
  -H "Content-Type: application/json" \
  -d '{"enforce_hitl": true}'

# Stream live events
curl -N http://localhost:8001/api/v1/atlas/stream/{deployment_id}
```

**From the CLI** (quick runs):
```bash
python launchops.py launch          # Full pipeline
python launchops.py stage formation # Single stage
python launchops.py stage payments
python launchops.py stage growth
```

---

## The 10-Stage Atlas Pipeline

Every stage flows through ProofGuard governance: **propose plan** → **CQS attestation** → **HITL approval (if flagged)** → **execute** → **audit write-back**.

| Stage | Agents | What Happens | Risk Tier |
|-------|--------|--------------|-----------|
| **init** | ExecAI Coach, Metrics Agent | System init, business config, baseline metrics | Low |
| **intake** | Business Builder, DynExecutiv | Business spec analysis, live Stripe/CRM data pull, daily agenda | Low |
| **formation** | Paralegal Bot, Paperwork Agent | Entity formation docs, compliance checks, EIN filing | Medium |
| **infrastructure** | WordPress Agent, Security Agent | WordPress deployment, security audit, analytics setup | Medium |
| **legal** | Paperwork Agent, Paralegal Bot | Legal docs (NDA, CIIA, Privacy, ToS, IP Assignment), IP audit | High |
| **payments** | Stripe Agent | Stripe products, recurring pricing, webhook config | High |
| **funding** | Funding Intelligence | Funding readiness across VC, SBIR, grants, angel | Low |
| **coaching** | ExecAI Coach, Founder OS, DynExecutiv | Strategy session, weekly sprint plan, executive brief | Low |
| **growth** | Growth Agent, Content Engine, Mautic Agent | GTM strategy, 30-day calendar, email campaigns | Medium |
| **done** | Documentary Tracker, Metrics Agent, Founder OS | Final metrics, narrative, evening review | Low |

---

## The 17 Agents

| Agent | Role | ProofGuard Hook |
|-------|------|-----------------|
| **ExecAI Coach** | Harvard Business School coaching (Porter's, Blue Ocean, JTBD) | Passthrough |
| **Business Builder** | Build Spec intake, BMC, GTM, pricing, 90-day ops plan | Passthrough |
| **Funding Intelligence** | VC, SBIR/STTR, grants, angel, formation optimizer | Passthrough |
| **Paperwork Agent** | IP protection, NDA, CIIA, Privacy Policy, ToS, 83(b), SAFE | Native (risk-classified) |
| **Founder OS** | Daily OS with pomodoro sprints; morning agenda, midday check, evening review | Native (async) |
| **DynExecutiv** | Decision engine with Generative UI; daily/weekly briefs from live data | Native (async) |
| **Content Engine** | 30-day content calendar, post templates, UTM tracking | Passthrough |
| **Metrics Agent** | MRR, CAC, LTV, conversion funnel, automated cut enforcement | Passthrough |
| **Documentary Tracker** | Milestone logging, narrative generation, chapter export | Passthrough |
| **Security Agent** | Server hardening, Vaultwarden, SSL, firewall, 2FA | Native (sudo-flagged) |
| **WordPress Agent** | WordPress + WooCommerce deployment and configuration | Passthrough |
| **Stripe Agent** | Payment processing, subscription tiers, webhook configuration | Native (MCP self-registering) |
| **Mautic Agent** | Marketing automation, email campaigns, lead scoring | Passthrough |
| **Growth Agent** | Growth strategy, channel analysis, AARRR framework | Native (channel-classified) |
| **Analytics Agent** | Matomo analytics integration and reporting | Passthrough |
| **Email Agent** | Transactional and marketing email automation | Passthrough |
| **Paralegal Bot** | Formation checklist, compliance verification | Passthrough |

---

## API Endpoints

### Atlas Pipeline

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/atlas/launch` | Kick off governed pipeline (returns `deployment_id`) |
| GET | `/api/v1/atlas/stream/{id}` | Stream live SSE events for a deployment |
| GET | `/api/v1/atlas/deployments` | List active deployments |
| GET | `/api/v1/daily-brief` | FounderOS pomodoro agenda (JSON) |
| POST | `/atlas/v2/execute` | Phase 2 governed execute (SSE stream) |
| POST | `/atlas/v2/execute/stage` | Governed single-stage execution |
| GET | `/atlas/v2/status` | Governance configuration |
| POST | `/atlas/v2/hitl/{id}/approve` | HITL approve an attestation |
| POST | `/atlas/v2/hitl/{id}/reject` | HITL reject an attestation |

### Generative UI

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dynexecutiv/stream` | DynExecutiv Generative UI SSE stream |
| GET | `/dynexecutiv/status` | DynExecutiv agent health |

### MCP Gateway

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/mcp/discover` | List registered MCP capabilities |
| POST | `/mcp/invoke` | Invoke a capability (ProofGuard-gated) |
| GET | `/mcp/health` | Gateway health + registered tool count |

### Observability

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | System health |
| GET | `/atlas/status` | Orchestrator status |
| GET | `/atlas/stages` | Pipeline stage list with status |
| GET | `/atlas/runs` | Execution history |
| GET | `/atlas/logs` | Audit log |
| GET | `/atlas/agents` | Agent registry |
| GET | `/atlas/context` | Full context dump |
| GET | `/artifacts/` | Generated document list |
| GET | `/services/` | Docker service health |

---

## SSE Event Stream

When streaming a governed pipeline via `/api/v1/atlas/stream/{id}` or `/atlas/v2/execute`, the backend emits these Server-Sent Events:

```
pipeline_start  → stage_start  → agent_propose  → proofguard_verdict
             → [hitl_waiting  → hitl_resumed]     (if REQUIRES_HITL)
             → agent_executing → ui_component     (if agent emits widgets)
             → agent_result   → stage_complete
             → pipeline_complete | governance_halt
```

The dashboard renders `ui_component` events inline as live charts, KPI cards, alert banners, action lists, HITL approval cards, and pomodoro sprint boards.

---

## Generative UI Components

Agents emit structured `ui_component` payloads instead of plain text. The dashboard dispatches to a React component registry:

| Component | Emitted By | What It Renders |
|-----------|------------|-----------------|
| `AnalyticsChart` | DynExecutiv | Bar/line chart with optional alert text |
| `AlertBanner` | DynExecutiv | Severity-based alert with CTA button |
| `KPICard` | DynExecutiv | Big-number KPI with delta and sparkline |
| `ActionList` | DynExecutiv, FounderOS | Interactive task checklist with priority badges |
| `HITLApprovalCard` | ProofGuard | Approve/reject card for paused attestations |
| `DailyCommandCenter` | FounderOS | Pomodoro sprint board with 25-min timers |

---

## MCP Capabilities

10 capabilities registered on the shared MCP gateway. External agents discover them via `GET /mcp/discover` and invoke via `POST /mcp/invoke` (every invocation goes through ProofGuard):

| Capability | Agent | Description |
|------------|-------|-------------|
| `create_saas_subscription` | Stripe Agent | Create Stripe Product + recurring Price |
| `generate_formation_package` | Paperwork Agent | Articles, Operating Agreement, Bylaws, EIN filing |
| `generate_operating_agreement` | Paperwork Agent | Full Operating Agreement for LLC/Corp |
| `generate_nda` | Paperwork Agent | Mutual Non-Disclosure Agreement |
| `generate_privacy_policy` | Paperwork Agent | SaaS-ready privacy policy |
| `generate_terms_of_service` | Paperwork Agent | SaaS Terms of Service |
| `run_ip_audit` | Paperwork Agent | IP asset identification + filing priorities |
| `run_security_audit` | Security Agent | Infrastructure security audit |
| `funding_readiness_report` | Funding Intelligence | SAFE, Convertible Note, or Priced Round readiness |
| `generate_growth_strategy` | Growth Agent | GTM strategy with channels + metrics |

---

## ProofGuard Governance

Every agent action in the governed path is attested through the ProofGuard control plane:

1. **Propose** — Agent drafts a plan (what it intends to do, risk tier, IMDA pillar, side effects)
2. **Attest** — ProofGuard scores the plan (CQS 0-100) and returns a verdict (APPROVED / BLOCKED / REQUIRES_HITL)
3. **HITL** — If flagged, execution pauses until a human approves or rejects via the dashboard
4. **Execute** — Agent fires after governance clears
5. **Audit** — Result is written back to ProofGuard for the compliance audit trail

**IMDA Model Governance pillars supported:** Internal Governance, Human Accountability, Technical Robustness, User Enablement.

**Risk tiers:** low, medium, high, critical. Agents self-classify their actions (e.g., PaperworkAgent marks 83(b) elections as `high`, SecurityAgent marks `harden` as `high` with `requires_sudo: true`).

---

## Commands (CLI)

| Command | Description |
|---------|-------------|
| `launch` | Run the full 10-stage governed pipeline |
| `stage <name>` | Run a single pipeline stage |
| `status` | Show pipeline progress |
| `health` | Check system health (LLM, agents, services) |
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

| File | Scope |
|------|-------|
| `AGENTS.md` | General operator standard — founder-grade, revenue-first |
| `AGENTS_ARCHITECT.md` | Systems architect standard — orchestrator integrity, agent development, security |
| `AGENTS_LAUNCH_OPERATOR.md` | Launch operator standard — launch readiness, monetization bias, deployment rules |

---

## Cost Savings

| Traditional Stack | Dynexis LaunchOps | Savings |
|-------------------|-------------------|---------|
| MBA Consultant: $5,000+ | ExecAI Coach: $0 | **$5,000** |
| Lawyer (formation + IP): $3,000+ | Paperwork Agent: $0 | **$3,000** |
| Funding Consultant: $2,000+ | Funding Intelligence: $0 | **$2,000** |
| SaaS Stack: $12,000/yr | Docker Self-Hosted: $315/yr | **$11,685/yr** |
| **Total Year 1**: $22,000+ | **Total Year 1**: $315 + LLM costs | **97% savings** |

---

## Security

- **ProofGuard governance** — every agent action CQS-scored and IMDA-attested before execution
- **Human-in-the-loop** — high-risk actions (payments, legal, hardening) pause for human approval
- **Fernet-encrypted credential vault** (AES-128-CBC)
- **Fail-closed governance** — if ProofGuard is unreachable, execution is blocked (not auto-approved)
- **MCP token authentication** — external agent invocations require `EXTERNAL_MCP_TOKEN`
- **All data stored locally** in `~/.launchops/` — no cloud dependencies for sensitive data

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...                    # or ANTHROPIC_API_KEY

# Governance
PROOFGUARD_API_URL=http://localhost:3000/api/attest
PROOFGUARD_API_KEY=pg_live_...
ENABLE_HUMAN_APPROVAL=true               # Recommended for production

# Payments
STRIPE_SECRET_KEY=sk_live_...

# MCP (external agent auth)
EXTERNAL_MCP_TOKEN=...

# Infrastructure
DOMAIN=yourdomain.com
```

---

## Links

- **LaunchOps Repo**: [Gnoscenti/LaunchOpsPro](https://github.com/Gnoscenti/LaunchOpsPro)
- **ProofGuard AI**: [MicroAIStudios-DAO/proofguard-ai](https://github.com/MicroAIStudios-DAO/proofguard-ai)
- **Dynexis Core**: [Gnoscenti/dynexis-core](https://github.com/Gnoscenti/dynexis-core)
- **LaunchOps Stack**: [Gnoscenti/launchops-stack](https://github.com/Gnoscenti/launchops-stack)
- **Upstream**: [MicroAIStudios-DAO/launchops-founder-edition](https://github.com/MicroAIStudios-DAO/launchops-founder-edition)

---

**Built by Gnoscenti / MicroAI Studios. Revenue-first. Governed. Deployed in hours.**
