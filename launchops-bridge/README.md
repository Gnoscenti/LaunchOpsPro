# LaunchOps Bridge

**Connecting LaunchOpsPro (the brain) to Founder Edition (the hands)**

The LaunchOps Bridge is a connector service that enables LaunchOpsPro's AI-generated business plans and strategies to be automatically executed by Founder Edition's autonomous agents.

## Architecture

```
┌─────────────────────┐         ┌──────────────────┐         ┌─────────────────────────┐
│   LaunchOpsPro      │         │  LaunchOps       │         │   Founder Edition       │
│   (Brain)           │────────▶│  Bridge          │────────▶│   (Hands)               │
│                     │         │                  │         │                         │
│ • Pipeline stages   │  JSON   │ • Schema valid.  │ Dispatch│ • SecurityAgent         │
│ • GPT-4.1-mini      │ Action  │ • Agent mapping  │         │ • ParalegalBot          │
│ • Context chaining  │ Manifest│ • Exec engine    │         │ • StripeAgent           │
│ • ProofGuard        │         │ • Status track   │         │ • WordPressAgent        │
│ • Artifact persist  │         │ • Callbacks      │         │ • RepoAgent             │
└─────────────────────┘         └──────────────────┘         │ • GrowthAgent           │
                                                              │ • ... 15+ agents        │
                                                              └─────────────────────────┘
```

## Quick Start

```bash
# Clone
git clone https://github.com/Gnoscenti/launchops-bridge.git
cd launchops-bridge

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run standalone
pip install -r requirements.txt
python -m src.server

# Or with Docker
docker-compose up -d
```

## API Endpoints

### Export (LaunchOpsPro → Manifest)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bridge/export` | POST | Generate manifest from execution data |
| `/api/bridge/export/template` | POST | Generate manifest from workflow template |

### Import (Manifest → Founder Edition)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bridge/import` | POST | Import and optionally execute a manifest |
| `/api/bridge/webhook` | POST | Raw webhook receiver (auto-executes) |

### Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bridge/manifests` | GET | List stored manifests |
| `/api/bridge/manifest/:id` | GET | Get specific manifest |
| `/api/bridge/manifest/:id/status` | GET | Get execution status |
| `/api/bridge/manifest/:id/execute` | POST | Execute stored manifest |
| `/api/bridge/manifest/:id/cancel` | POST | Cancel running execution |
| `/api/bridge/manifest/:id/results` | GET | Get detailed results |

### Callback

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bridge/callback/:id` | POST | Receive results from Founder Edition |

## Action Manifest Schema

The Action Manifest is the standardized JSON contract between LaunchOpsPro and Founder Edition. See `src/manifest/schema.json` for the full JSON Schema.

Key fields:
- `manifest_id`: Unique identifier (UUID)
- `source`: Origin system metadata (execution_id, workflow_id)
- `business_context`: Accumulated business context from the pipeline
- `actions[]`: Ordered list of executable actions
- `execution_config`: How to run (sequential, parallel, dependency-graph)

## New Pipeline Agents

This bridge also introduces 8 new agent specifications that extend the LaunchOpsPro pipeline:

1. **Compliance Agent** — Terms of Service, Privacy Policy, GDPR/CCPA
2. **Brand Identity Agent** — Logo brief, color palette, brand voice
3. **Product/MVP Agent** — Feature spec, user stories, wireframes
4. **Hiring/Team Agent** — Job descriptions, org chart, contractor briefs
5. **Financial Modeling Agent** — P&L, unit economics, burn rate
6. **Operations/SOPs Agent** — Standard operating procedures, workflows
7. **IP/Patent Agent** — Patent strategy, trademark search, trade secrets
8. **Customer Success Agent** — Onboarding flows, support playbooks

Agent definitions are in `src/agents/new_agents.py` with full system prompts and output schemas.

## Integration

### Adding to LaunchOpsPro

Copy `src/export/launchops_pro_endpoint.ts` into your LaunchOpsPro platform server and register the routes:

```typescript
import bridgeRoutes from "./bridgeRoutes";
app.route("/api/bridge", bridgeRoutes);
```

### Adding to Founder Edition

The bridge service connects to Founder Edition agents via the `FOUNDER_EDITION_DIR` environment variable. Ensure the Founder Edition repo is accessible at that path.

## License

MIT
