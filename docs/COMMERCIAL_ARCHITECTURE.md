# Dynexis LaunchOps — Commercial Architecture Brief

**Author:** Sentinel Architect (co-creator)
**Date:** 2026-04-13
**Target:** $1M ARR in 18 months (by October 2027)
**Baseline:** Commit `b22978c` (Security Phase A complete)

---

## 1. Executive Summary: Why This Architecture Gets to $1M ARR

Dynexis LaunchOps is positioned at the intersection of three converging market trends:

1. **Solo founder explosion** — 10M+ new businesses registered annually in the US alone, majority solo/micro. They need ops infrastructure but can't afford a COO.
2. **Agentic AI trust gap** — Every AI company ships agents; almost none ship governance. ProofGuard is a real differentiator in a market where "what did the AI do?" is becoming a regulatory question.
3. **SaaS tool fatigue** — The average founder uses 12+ SaaS tools. Dynexis replaces the stack, not adds to it.

The architecture below is designed for a **specific commercial trajectory:**

| Milestone | Date | Revenue | What's shipping |
|-----------|------|---------|-----------------|
| Alpha launch | June 2026 | $0 | Free tier, 50 design partners |
| Paid launch | August 2026 | $5k MRR | Pro ($49) + Scale ($149) tiers |
| Product-market fit signal | December 2026 | $25k MRR | 170 Pro + 50 Scale |
| Growth mode | April 2027 | $50k MRR | Template marketplace, webhook integrations |
| Scale mode | October 2027 | $83k MRR | Enterprise tier, compliance exports, $1M ARR run rate |

**The math:** $83k MRR = 1,000 Pro ($49) + 200 Scale ($149) + 10 Enterprise ($500) = $49k + $29.8k + $5k = $83.8k MRR = **$1.006M ARR**.

This is achievable with the current codebase + the Sprint 2-4 roadmap + the commercial infrastructure described below.

---

## 2. Current Architecture Assessment (Honest)

### What's solid (ship-ready)

- **10-stage governed pipeline** with ProofGuard attestation — this is the core product loop
- **SSE streaming** with per-agent events — real-time transparency is a selling feature
- **Generative UI** — agents emit widgets, not just text. This is a moat.
- **MCP gateway** — external agent interop is forward-looking and differentiating
- **SaaS vertical onboarding** — 1-click deployment with governance gates
- **Security posture** (post-Sprint 1 + Phase A): PBKDF2 auth, rate limiting, non-root Docker, TLS-enforced nginx, fail-closed governance, no RCE surface

### What blocks commercial launch

| Blocker | Why it blocks revenue | Sprint |
|---------|----------------------|--------|
| No tenant isolation | Can't sell to >1 customer on same instance | 2 |
| No Stripe billing for Dynexis itself | Can't charge customers | 3 |
| No usage metering | Can't enforce tier limits | 2 |
| No onboarding web flow | TAM is ~30 people (CLI users) until web onboarding ships | 3 |
| No admin dashboard for operators | Can't answer "what did my agents do?" | 3 |

### What's good enough for v1 (don't over-engineer)

- SQLite for state (handles 1,000 concurrent users before needing Redis)
- Fernet vault (adequate until enterprise tier requires KMS)
- In-process rate limiting (adequate until multi-worker)
- File-based SharedContext (adequate with per-tenant namespace)
- Single-worker uvicorn (adequate for <100 concurrent SSE streams)

---

## 3. Target Architecture (18-Month View)

```
                          ┌─────────────────────────────────┐
                          │   app.dynexis.io (Vercel/CF)    │
                          │   React dashboard + landing     │
                          │   Stripe Checkout embedded      │
                          └──────────────┬──────────────────┘
                                         │ HTTPS (TLS 1.3)
                                         │ X-API-Key header
                                         ▼
                          ┌─────────────────────────────────┐
                          │   Nginx Reverse Proxy            │
                          │   TLS termination                │
                          │   Rate limiting (10 req/s/IP)    │
                          │   HSTS + security headers        │
                          └──────────────┬──────────────────┘
                                         │
                          ┌──────────────┼──────────────────┐
                          │   FastAPI Application            │
                          │                                  │
                          │   ┌──────────────────────────┐  │
                          │   │  Auth Middleware           │  │
                          │   │  PBKDF2 + rate limit      │  │
                          │   │  Tenant context injection  │  │
                          │   └────────────┬─────────────┘  │
                          │                │                 │
                          │   ┌────────────┼────────────┐   │
                          │   │            │            │   │
                          │   ▼            ▼            ▼   │
                          │  Onboard    Pipeline     MCP    │
                          │  /api/v1    /atlas/v2    /mcp   │
                          │                                  │
                          │   ┌──────────────────────────┐  │
                          │   │  Usage Metering           │  │
                          │   │  (per-tenant counters)    │  │
                          │   └────────────┬─────────────┘  │
                          │                │                 │
                          │   ┌────────────┼────────────┐   │
                          │   │            │            │   │
                          │   ▼            ▼            ▼   │
                          │  Phase2      MCP        Generative
                          │  Executor   Gateway     UI Engine │
                          │   │                        │     │
                          │   ▼                        │     │
                          │  ProofGuard ◄──────────────┘     │
                          │  (control plane)                  │
                          └──────────────┬──────────────────┘
                                         │
                     ┌───────────────────┼────────────────────┐
                     │                   │                    │
                     ▼                   ▼                    ▼
              SQLite Store        SharedContext          Vault
              (deployments,       (per-tenant           (Fernet
               runs, hitl,         namespace)            encrypted)
               usage, tenants)
```

---

## 4. Pricing Architecture (Validated Against Live Site)

The live Dynexis site (dynexisys.manus.space) prices at $49 Pro / $149 Scale. This is the correct strategy for the first 18 months — **optimize for adoption velocity, not ASP.**

| Tier | Price | Gate | Kill Feature (why they upgrade) |
|------|-------|------|-------------------------------|
| **Starter** | Free | 1 deployment, 3 runs/mo, no HITL | "See what it does" |
| **Pro** | $49/mo | 3 deployments, 50 runs/mo, HITL, 7-day audit | "I need this for my real business" |
| **Scale** | $149/mo | 10 deployments, unlimited runs, 30-day audit, webhook integrations | "I'm running multiple projects / clients" |
| **Enterprise** | $499/mo | Unlimited, compliance exports, SSO, dedicated CQS model | "I need this for my company" |

**Revenue model per gate:**

| Billable dimension | Free | Pro | Scale | Enterprise |
|-------------------|------|-----|-------|------------|
| Deployments | 1 | 3 | 10 | Unlimited |
| Pipeline runs / month | 3 | 50 | Unlimited | Unlimited |
| MCP invocations / month | 10 | 500 | 5,000 | Unlimited |
| HITL approvals | No | Yes | Yes | Yes |
| Audit log retention | 24h | 7 days | 30 days | 1 year |
| Governance gates | No | Yes | Yes | Yes |
| Webhook delivery | No | No | Yes | Yes |
| Compliance PDF export | No | No | No | Yes |
| SSO | No | No | No | Yes |

**Implementation priority:** The gates that drive upgrades most (deployment limit + run limit + HITL) are all enforceable with the existing `core/store.py` + `core/auth.py` infrastructure. We just need a `tenants` table with a `plan` column and a middleware that checks counts before executing.

---

## 5. Tenant Model Design

### Schema (SQLite, upgrading to Postgres when hitting 1,000 tenants)

```sql
CREATE TABLE tenants (
    tenant_id       TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    plan            TEXT NOT NULL DEFAULT 'starter',
    stripe_customer_id  TEXT,
    stripe_subscription_id  TEXT,
    api_key_hash    BLOB NOT NULL,          -- PBKDF2 hash
    api_key_salt    BLOB NOT NULL,          -- 16-byte salt
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,

    -- Usage counters (reset monthly)
    usage_deployments   INTEGER DEFAULT 0,
    usage_runs          INTEGER DEFAULT 0,
    usage_mcp_calls     INTEGER DEFAULT 0,
    usage_reset_at      TEXT                -- next monthly reset
);

CREATE TABLE tenant_api_keys (
    key_id          TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
    key_hash        BLOB NOT NULL,
    key_salt        BLOB NOT NULL,
    name            TEXT,                   -- "Production", "Development"
    scopes          TEXT DEFAULT '*',       -- comma-separated: read,write,admin
    created_at      TEXT NOT NULL,
    last_used_at    TEXT,
    revoked         INTEGER DEFAULT 0
);
```

### Tenant-scoped execution flow

```
API request arrives
  → Auth middleware extracts API key
  → Looks up tenant_id from tenant_api_keys
  → Injects tenant_id into request.state
  → Usage middleware checks:
      if tenant.usage_runs >= plan_limit: return 402
  → Route handler executes
  → Usage middleware increments counter
  → Response returned
```

### Data isolation

Each tenant's SharedContext, artifacts, and audit logs live under:
```
~/.launchops/tenants/{tenant_id}/
    context_{run_id}.json
    documents/{stage}/
    audit.log
```

The SQLite database (`launchops.db`) is shared but all queries are filtered by `tenant_id`. This is acceptable for SQLite (single-writer, WAL mode) up to ~1,000 tenants. Beyond that, migrate to Postgres with row-level security.

---

## 6. Threat Model Update (Commercial Multi-Tenant)

### New attack vectors introduced by multi-tenancy

| Vector | Severity | Mitigation |
|--------|----------|------------|
| Tenant A reads Tenant B's context files | CRITICAL | Per-tenant directory namespace + verify `tenant_id` on every file path |
| Tenant A enumerates Tenant B's attestation IDs | HIGH | Attestation IDs include tenant prefix: `att_{tenant_id}_{nanoid}` |
| Tenant A exhausts shared resources (noisy neighbor) | MEDIUM | Per-tenant rate limits + usage counters |
| Stripe webhook spoofing | HIGH | Verify `stripe-signature` header with webhook secret |
| API key rotation leaves orphaned sessions | LOW | Keys are stateless (no server-side sessions to invalidate) |

### Path traversal defense (artifacts)

```python
# core/tenant_context.py
def safe_tenant_path(tenant_id: str, *segments: str) -> Path:
    base = Path(f"~/.launchops/tenants/{tenant_id}").expanduser()
    target = (base / Path(*segments)).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise PermissionError(f"Path traversal blocked: {target}")
    return target
```

---

## 7. Failure Mode Analysis (Commercial)

### What happens when the database is full?

SQLite has a 281 TB theoretical limit. Practically, at 1,000 tenants with 50 runs/month and ~2 KB/run, we're at:
$$1000 \times 50 \times 2\text{KB} = 100\text{MB/month}$$
At this rate, a 10 GB disk fills in ~8 years. **Not a concern for the $1M ARR timeline.**

### What happens when Stripe billing webhook fails?

**Current:** No billing webhooks exist yet.
**Design:** Stripe webhook handler should be idempotent. Use `event.id` as a dedup key in a `stripe_events` table. If the webhook endpoint is down, Stripe retries for up to 3 days. The system should:
1. Process `checkout.session.completed` → create/upgrade tenant
2. Process `customer.subscription.deleted` → downgrade tenant to free
3. Process `invoice.payment_failed` → flag tenant, grace period (7 days)

### What happens when an LLM provider goes down?

**Current:** `LLMClient` has auto-fallback from OpenAI → Anthropic.
**Design is correct.** Add a `LLM_PROVIDER_PRIMARY` env var and explicit fallback chain. Log provider failovers so we can monitor reliability.

### What happens when the ProofGuard control plane goes down?

**Current (post-Sprint 1):** Fail-closed. All pipeline execution blocked.
**Commercial impact:** A 1-hour ProofGuard outage blocks ALL paying customers.
**Mitigation:** Add a `PROOFGUARD_CACHE_TTL=300` — cache the last APPROVED verdict for a given `(agent, stage, action_type)` tuple for 5 minutes. This allows re-runs of recently-approved patterns while blocking novel actions.

---

## 8. What I Will Build Next (Sprint 2 — Commercial Foundation)

The following items are the **minimum viable commercial infrastructure.** Everything else is a nice-to-have until these ship.

### Sprint 2A — Tenant Model + Usage Gating (this sprint)

1. `core/tenant.py` — Tenant dataclass + CRUD via StateStore
2. `core/usage.py` — Per-tenant usage counters with plan-limit enforcement
3. Update `core/auth.py` — resolve `tenant_id` from API key lookup
4. Update `api/main.py` — inject `tenant_id` into `request.state`
5. Update all route handlers — pass `tenant_id` to orchestrator
6. Per-tenant SharedContext namespace

### Sprint 2B — Stripe Billing for Dynexis Itself

1. `api/routes/billing.py` — Stripe Checkout session creation, webhook handler, portal redirect
2. `POST /api/v1/billing/checkout` — creates a Stripe Checkout session for Pro/Scale/Enterprise
3. `POST /api/v1/billing/webhook` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. `GET /api/v1/billing/portal` — redirects to Stripe Customer Portal
5. Stripe product/price IDs stored in env vars (not hardcoded)

### Sprint 2C — Remaining Sprint 2 Items

6. `propose_plan` hooks on remaining 11 agents
7. Split `core/orchestrator.py` into modules
8. Bound dashboard `blocks` array to 500 entries
9. Integration tests (pytest + httpx async, mocked ProofGuard)

---

## 9. Compliance Roadmap (Enterprise Readiness)

| Compliance | When needed | What to build | Effort |
|------------|-------------|---------------|--------|
| SOC2 Type I | Enterprise tier ($499) | Audit log export, access control matrix, incident response plan | 2 weeks |
| SOC2 Type II | 6 months after Type I | Continuous monitoring, evidence collection automation | 6 weeks + auditor |
| GDPR | If EU customers | Data export endpoint, deletion endpoint, consent tracking | 1 week |
| PCI-DSS SAQ-A | If processing cards | Already delegated to Stripe (we never touch card data) | Documentation only |
| AICM/IMDA | Enterprise differentiator | ProofGuard already supports IMDA pillars; need formal report export | 1 week |

**Key insight:** SOC2 Type I is the **single most important compliance milestone** for enterprise sales. It's not a technical problem (the audit trail already exists in ProofGuard + StateStore). It's a documentation + process problem. Budget 2 weeks when the first enterprise prospect asks for it.

---

## 10. Cost Model (Operating Costs vs. Revenue)

### Per-customer COGS at scale

| Cost center | Per-customer/month | At 1,000 customers |
|------------|-------------------|---------------------|
| LLM tokens (avg 50 runs * 4k tokens * $0.003/1k) | $0.60 | $600 |
| Hosting (Hetzner VPS, shared) | $0.50 | $500 |
| Stripe fees (2.9% + $0.30 per $49) | $1.72 | $1,720 |
| ProofGuard (shared instance) | $0.10 | $100 |
| **Total COGS** | **$2.92** | **$2,920** |

**Gross margin at Pro ($49):** ($49 - $2.92) / $49 = **94%**. This is a SaaS-grade margin. The business is commercially viable.

### Infrastructure cost at $1M ARR

At $83k MRR with ~1,400 customers:
- Monthly COGS: ~$4,100
- Hosting: ~$200/mo (2x Hetzner CX41 + 1x CCX33 for ProofGuard)
- Stripe fees: ~$2,400/mo
- LLM costs: ~$1,000/mo (with model routing to cheaper providers for low-risk calls)
- **Total monthly operating cost: ~$7,700**
- **Annual operating cost: ~$92k**
- **Net margin: 91%** ($1M - $92k = $908k)

---

## 11. What Not to Build (18-Month Anti-Roadmap)

| Feature | Why not | When to reconsider |
|---------|---------|-------------------|
| Mobile app | Founders live on laptops | After $2M ARR |
| Kubernetes | Docker Compose handles 1,400 customers | After $5M ARR |
| Real-time collaboration | Solo founders don't collaborate in real-time | After team features ship |
| AI model training | Use OpenAI/Anthropic APIs, don't train | Never (unless moat requires it) |
| International payment processing | Stripe handles this | When EU customers ask |
| Custom LLM fine-tuning | Prompt engineering is sufficient | After $3M ARR |
| Blockchain attestation | ProofGuard HMAC is sufficient proof | Never (avoid Web3 distraction) |

---

## 12. Immediate Actions

I will now execute Sprint 2A (tenant model + usage gating) as the single highest-leverage commercial item. This unblocks:
- Multi-customer deployment
- Usage-based billing enforcement
- Per-tenant data isolation
- The entire Stripe billing integration (Sprint 2B)

Starting now.
