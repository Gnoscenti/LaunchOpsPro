# LaunchOps / Dynexis — System Audit

**Date:** 2026-04-11
**Auditor:** Claude (CTO / Principal Architect mode)
**Commit audited:** `7cf8fd2` (Phase 2/3/4 — ProofGuard governance, Generative UI, MCP gateway, Command Center)
**Scope:** Entire `launchops-founder-edition/` repo plus the `_ref/proofguard-ai/` control plane

---

## 1. Executive Summary

LaunchOps is an **architecturally impressive but commercially immature** agentic platform. Over four build phases it has grown from a sync single-process CLI into a multi-layer stack with governed execution, generative UI, a standards-based MCP gateway, and a pomodoro-driven founder operating system. The vision — a ruthless "revenue-first" business OS that deploys itself in hours and runs on evidence — is strong, differentiated, and well-aligned with a $1M-ARR wedge for solo founders and lean operators.

However, the **production-readiness of the system today is roughly that of a late-prototype / early-alpha**. The Phase 2/3/4 layers are stacked additively on top of a Phase 1 codebase whose original trust model was "no guardrails, founder edition, full Tier 3 local execution" — and that trust model is still baked into the shell execution, file I/O, and state management at the lowest levels. The dashboard compiles and builds, per-agent ProofGuard governance works end-to-end in the async path, and 9 MCP capabilities are exposed to external agents. But the CLI path bypasses ProofGuard entirely, there is **no API authentication**, the deployment registry is an in-memory Python dict, the agent base class shells out via `shell=True`, and the multi-process story is nonexistent.

**The foundation is promising.** With ~2 weeks of focused hardening, the system can move from "interesting demo" to "commercial alpha that an early-adopter founder would pay $199/mo for." Without that hardening, the current code is one curl command away from an RCE headline.

**Verdict:** Keep building. Stop adding new surface area. Spend the next sprint making what exists real.

---

## 2. What the Codebase Appears to Already Do

**Does work today (verified via smoke tests, static reads, and running builds):**

- **10-stage launch pipeline** (`init -> intake -> formation -> infrastructure -> legal -> payments -> funding -> coaching -> growth -> done`) with registered handlers in `core/stage_handlers.py` that dispatch to ~17 agents per stage.
- **Phase 1 sync execution path** via `AtlasOrchestrator.run()` and `run_stage()`, exposed at `POST /atlas/execute` with SSE.
- **Phase 2 async governed path** via `Phase2Executor.run_pipeline()`, exposed at `POST /atlas/v2/execute`. Real per-agent `propose -> attest -> hitl -> execute -> audit` flow is implemented in `execute_stage_for_agent()` (lines 310-432 of `core/orchestrator.py`). The stage-level path (`execute_stage()`, lines 436-556) wraps the whole Phase 1 handler in a single attestation.
- **ProofGuard REST contract** exists end-to-end: Python middleware (`core/proofguard.py`) + Express handlers (`_ref/proofguard-ai/server/rest-attest.ts`) + v0 CQS scorer + HITL polling + audit write-back.
- **Generative UI pipeline:** agents build `UIComponentPayload` objects, `Phase2Executor` extracts them from results, SSE emits `ui_component` events, the dashboard dispatches to a component registry with 6 real React components (AnalyticsChart, AlertBanner, KPICard, ActionList, HITLApprovalCard, DailyCommandCenter).
- **MCP gateway** with 10 registered capabilities (9 from `register_launchops_capabilities` + 1 self-registered by StripeAgent). Discover + invoke over HTTP (`/mcp/discover`, `/mcp/invoke`) with ProofGuard-gated external calls.
- **Dynexis Command Center** unification: `POST /api/v1/atlas/launch` + background task + in-memory deployment registry + `GET /api/v1/atlas/stream/{id}` SSE + `GET /api/v1/daily-brief` proxying FounderOS pomodoro agenda.
- **FounderOS + TemporalManager:** ROI-ranked pomodoro sprint generation capped at 3, with tool-gate enforcement (`LOCKED` until MRR > $20k).
- **Native `propose_plan` hooks** on StripeAgent, DynExecutiv, FounderOS, PaperworkAgent, SecurityAgent, GrowthAgent. Other agents fall back to the passthrough adapter in `Phase2Executor`.
- **React dashboard builds cleanly** (1473 modules, 271 kB JS, tsc --noEmit passes). `lib/api.ts` has all 10 REST helpers + both SSE consumers. Dynexis branding applied.
- **49 unit tests** under `tests/test_agents.py` -- shallow mock-based coverage of ~12 agents, no integration or governance tests.

**Does NOT work (or only half-works):**

- **No API authentication on any route.** CORS is `allow_origins=["*"]` with `allow_credentials=True`. Anyone who can reach port 8001 can trigger pipelines and HITL decisions.
- **Phase 1 CLI path bypasses ProofGuard entirely.** `python launchops.py launch` runs the full pipeline with zero governance.
- **In-memory state does not survive restart.** `DEPLOYMENTS`, `run_store`, `_atlas`, `_context`, `hitl_decisions` (in ProofGuard) -- all die on process restart. Multi-worker uvicorn silently shards state per worker.
- **No observability.** No structured logging configuration, no traces, no metrics, no tracing ID propagation through the pipeline.
- **No deployment story for the API itself.** `docker-compose.yml` orchestrates the supporting services (WordPress, SuiteCRM, Mautic, Matomo, Vaultwarden) but there is no Dockerfile for the LaunchOps FastAPI app.
- **Test coverage is shallow.** No test exercises `Phase2Executor`, ProofGuard middleware, the SSE endpoints, the MCP gateway, or the generative UI extraction.

---

## 3. Architecture Review

### Current architecture, ASCII

```
              +------------------------------+
              |   Dynexis React Dashboard    |  Vite + TS + Tailwind
              |   /brief /pipeline /runs ... |  No auth headers sent
              +--------------+---------------+
                             | SSE (POST fetch stream, GET EventSource)
                             v
    +------------------------------------------------+
    |         FastAPI  (single process, no auth)      |
    |                                                 |
    |  /api/v1/atlas/launch        /atlas/execute     |  <-- Phase 1 ungoverned
    |  /api/v1/atlas/stream/:id    /atlas/v2/execute  |  <-- Phase 2 governed
    |  /dynexecutiv/stream         /mcp/discover      |
    |  /mcp/invoke                 /atlas/v2/hitl/*   |
    +--------------+---------------------------------+
                   |
     +-------------+-------------------+--------------+
     v             v                   v              v
 Phase2Executor  MCPGateway      AtlasOrchestrator   In-mem
 (async)         (shim/SDK)      (sync, Phase 1)     deployment
     |             |                   |              registry
     |             |                   v              |
     |             |            stage_handlers.py    dies on restart
     |             |            (17 agents invoked
     |             |             synchronously)
     v             |
 ProofGuardMiddleware             +--- SharedContext (JSON files)
 (httpx REST)                     +--- CredentialVault (Fernet)
     |                            +--- agent_outputs (JSON on disk)
     v
 +----------------------+
 |  proofguard-ai       |  Express + tRPC + REST facade
 |  POST /api/attest    |  + Drizzle ORM (MySQL)
 |  v0 CQS scorer      |  + in-memory hitlDecisions map
 |  /hitl/:id/approve   |
 +----------------------+
```

### Strengths

- **Phase 2 governance composition is elegant.** `Phase2Executor` does NOT replace `AtlasOrchestrator`; it wraps it, letting Phase 1 handlers keep working while adding a governance sandwich. This is how you add security to a legacy system without a rewrite.
- **SSE streaming is properly implemented.** Both backend (`StreamingResponse` + queue drain + SSE frames) and frontend (fetch + ReadableStream decoder) are robust, spec-compliant, and handle keep-alive comment frames.
- **Generative UI architecture is a real moat.** The `ui_component` event -> componentRegistry -> React dispatcher pattern is the same "generative UI" primitive Vercel/Anthropic are shipping as v0-style products, and it's built correctly here.
- **MCP gateway with graceful SDK fallback** means the system ships today even without `pip install mcp`.
- **Stage-handler registration is pluggable.** New stages and handlers can be added without touching the core orchestrator.

### Weaknesses

- **Two parallel execution paths with different security guarantees.** `AtlasOrchestrator.run()` has zero governance. `Phase2Executor.run_pipeline()` has full governance. A founder on the CLI gets path A; the dashboard gets path B. This is a foot-gun.
- **Governance is optional.** `ENABLE_HUMAN_APPROVAL` defaults to `false` and `PROOFGUARD_FAIL_OPEN=true` turns all failed attestations into APPROVED. Both can be set via environment, meaning the security posture is configuration-dependent rather than architecturally enforced.
- **Shared mutable state hidden in module-level singletons.** `api/state.py::_atlas` and `_context` are global. Multi-worker uvicorn silently breaks. There is no mention of this in any doc.
- **No separation between "founder edition" (local, no guardrails) and "commercial edition" (multi-tenant, governed).** The base agent class has `shell=True`, the config loader swallows errors, the API is unauthenticated -- these were all deliberate choices for the original "Tier 3 founder edition" mode, but the code base is now trying to become a commercial product and those choices are actively hostile to that goal.

### Coupling / modularity issues

- `launchops.py::build_system()` couples the CLI entrypoint to every agent, every route, and the MCP gateway. Importing `api.state` transitively imports all 17+ agents, pulls OpenAI and Anthropic SDKs, and instantiates the vault. Cold start is slow and hard to test in isolation.
- `agents/stage_handlers.py` hard-codes agent method calls by string. Refactoring a method name on an agent silently breaks the stage without a type error.
- `core/orchestrator.py` now has **two orchestrator classes** (`AtlasOrchestrator` sync + `Phase2Executor` async) plus `STAGES` list plus adapter functions. The file is 700+ lines and growing. Time to split into `core/orchestrator/atlas.py` + `core/orchestrator/phase2.py`.

### Scalability concerns

- **Single-process design.** Everything runs in one FastAPI worker. The deployment registry, atlas singleton, HITL decision map (in ProofGuard), and all state are in-process dicts.
- **Sync agent calls inside async orchestrator.** `Phase2Executor.execute_stage()` uses `asyncio.to_thread()` to run the sync stage handler. Thread pool default is `min(32, CPU+4)`. Under concurrent pipeline runs, this exhausts and HTTP requests will start stalling.
- **LLM costs are uncapped.** No per-tenant budget, no model routing, no caching. A single runaway prompt loop could cost $100+.

### Reliability concerns

- **No retry logic anywhere.** LLM calls, Stripe calls, ProofGuard calls -- all one-shot with a `try/except` and return-on-error.
- **Silent exception swallowing in state loaders.** `core/context.py:48`, `core/config.py:137`, `core/credentials.py:61-63`. Corrupted state files are indistinguishable from missing state files.
- **Deployment background tasks have no supervision.** If `_run_deployment` in `command_center.py` raises, the queue gets a single error event and then the consumer is stuck waiting on an empty queue until the 30-second keep-alive timeout.

### Maintainability concerns

- **No type check in CI.** `tsc --noEmit` and `py_compile` only run when I explicitly execute them.
- **No linter configured.** No pre-commit hook. No formatter enforced.
- **Docs are out of date.** `AGENTS.md`, `AGENTS_ARCHITECT.md`, `LAUNCH_SEQUENCE.md`, `ROADMAP.md`, `PIPELINE_STATUS.md` all exist but describe earlier architecture states. A new contributor reading the docs will get a wrong mental model.

---

## 4. Debug / Risk Findings

### Critical

| # | File : line | Problem | Why it matters commercially |
|---|---|---|---|
| C1 | `agents/base.py:132-148` | `subprocess.run(command, shell=True)` in `BaseAgent.run_command()` with no validation. `shell=True` means any string goes straight to bash. | RCE. Any agent that forwards a user-supplied `task_payload["command"]` field into `run_command()` turns the API into a remote shell. For a SaaS, this is end-of-company. |
| C2 | `api/main.py:59-65`, all routes | CORS `allow_origins=["*"]` + no bearer token / API key / session auth on any POST. | Unauthenticated pipeline kick-off. Anyone can `POST /api/v1/atlas/launch` or `POST /atlas/v2/execute` from a browser tab. There is literally no multi-tenant story. |
| C3 | `core/proofguard.py:80-84`, `:276-285` | `PROOFGUARD_FAIL_OPEN=true` env var makes unreachable ProofGuard return `APPROVED`. | A crashed control plane silently turns off governance. For a system that markets itself on "cryptographic attestation of agent behavior," this is a compliance violation waiting to happen. |
| C4 | `core/orchestrator.py:66-88` vs `~450` | Two parallel execution paths. CLI bypasses governance entirely. | Governance is opt-in per caller. A developer running the CLI thinks they are using the "real" system but is actually using the ungoverned one. |

### High

| # | File : line | Problem | Why it matters |
|---|---|---|---|
| H1 | `api/routes/command_center.py:82`, `api/state.py:20-24` | `DEPLOYMENTS` and `run_store` are in-memory Python dicts/lists. | Kick off a pipeline, restart the API, lose the deployment entirely. Multi-worker uvicorn silently shards state. |
| H2 | `api/state.py:20-42` | `_atlas`, `_context` module-level globals. | Horizontal scaling impossible without a state store. First actual load test with workers>1 breaks consistency. |
| H3 | `dashboard/src/hooks/useAgentStream.ts:~85` | `blocks` array grows unbounded. | 24-hour run = 86k blocks in React memory = browser slowdown / OOM. |
| H4 | `core/orchestrator.py:~519` | Sync stage handlers run via `asyncio.to_thread()`. Default thread pool has no bounded queue. | Concurrent runs exhaust the default thread pool. No backpressure means requests stall. |
| H5 | No Dockerfile for the FastAPI app | `docker-compose.yml` orchestrates supporting services only. | No one-command deploy for the actual LaunchOps server. Product is impossible to self-host without a manual runbook. |
| H6 | `api/routes/mcp.py:51-58` | Token comparison is not constant-time; `_require_token` is also the ONLY auth on the whole API. | MCP is the only route with ANY auth mechanism, and its token check is bypassed entirely if `EXTERNAL_MCP_TOKEN` is unset. |

### Medium

| # | File : line | Problem | Why it matters |
|---|---|---|---|
| M1 | `core/context.py:43-48`, `core/config.py:137`, `core/credentials.py:61-63` | Silent `except Exception: pass` on state load. | Corrupted files indistinguishable from missing files. |
| M2 | `tests/test_agents.py` only | No tests for Phase 2, ProofGuard, SSE, MCP, generative UI. | Refactoring the core without breaking users is impossible. |
| M3 | `agents/*` -- 17 agents, no shared schema for task_payload | Each agent reads `task.get("type")` and dispatches itself. | No static guarantee that the API contract and the agent contract agree. |
| M4 | `agents/dynexecutiv.py:45-78` | `pull_stripe_data()` is blocking and called from async contexts. | Blocks the event loop under concurrent dashboard refreshes. |
| M5 | No structured logging config | All `logger.info()` calls go to Python's default root logger. | Cannot grep logs for a specific run_id across components. |
| M6 | `core/credentials.py` + disk files | Vault key derived from env var, not KMS. | Rotating keys means rewriting the vault. Not enterprise-ready. |

### Low

| # | File : line | Problem | Why it matters |
|---|---|---|---|
| L1 | `core/orchestrator.py::_execute_stage` | `print(...)` calls in the orchestrator | Noise in stdout; not filterable. |
| L2 | `launchops.py::build_system` | Eagerly imports 17+ agents | Cold start ~3s even for `GET /health`. |
| L3 | `.env.example` | `rk_live_...` placeholder instead of `sk_live_...` | Confuses a new user. |
| L4 | Dashboard pages (Agents, Logs, Prompts, Permissions) | Not migrated to typed `lib/api.ts` contract | May have runtime failures when hitting endpoints. |

---

## 5. What Still Needs to Be Done

### Must do next (this week, non-negotiable for commercial use)

- **Add API authentication.** `Depends(verify_api_key)` on all write routes. Key stored hashed. Dev bypass only via `LAUNCHOPS_DEV_MODE=true`.
- **Restrict CORS to env-driven allow list.** `DASHBOARD_ORIGIN=https://app.dynexis.io`.
- **Fix `BaseAgent.run_command`.** `shell=False` by default with `allow_shell: bool = False` opt-in flag.
- **Make ProofGuard fail-closed.** Remove `PROOFGUARD_FAIL_OPEN` env-var bypass.
- **Collapse Phase 1 CLI into Phase 2 governed path.** `launchops.py launch` must go through `Phase2Executor`.
- **Persist deployment registry** to SQLite. `DEPLOYMENTS` and `run_store` become thin wrappers over a `deployments` table.
- **Write a Dockerfile** for the FastAPI app and extend `docker-compose.yml`.
- **Configure structured logging.** JSON with `run_id`, `deployment_id`, `agent_name`, `stage` on every line.

### Should do soon (next 2 weeks, to reach "commercial alpha")

- **Real test coverage for Phase 2.** pytest + httpx async client against `/atlas/v2/execute`.
- **Bound dashboard event stream.** Cap `blocks` at last N=500 events; virtualize the list.
- **Rate limit + budget control.** Per-API-key rate limit. Per-tenant LLM spend cap.
- **Per-agent `propose_plan()` on remaining 11 agents.**
- **Split `core/orchestrator.py`** into `atlas.py` + `phase2.py` + `adapters.py`.
- **Deprecate duplicated endpoints.** Pick one public path (`/api/v1/atlas/launch`).
- **Replace in-memory HITL registry** in ProofGuard with Drizzle-backed table.
- **Add Sentry** for exception capture.

### Could do later (backlog)

- MetricsGrid + ProgressTracker React components.
- Real LLM judge for CQS scoring.
- Agent-to-agent negotiation flow via MCP.
- Pomodoro persistence.
- Model/provider routing abstraction.
- Multi-tenant namespace.

---

## 6. Product & Monetization Analysis

### Current product shape

This is **"Dynexis -- the revenue-first operating system for solo founders and lean teams."** Not a chatbot. Not a workflow tool. An **opinionated prescriptive system** with three clear value props:

1. **Deploy a complete business infrastructure** (WordPress + Stripe + CRM + email + analytics + password vault) **in hours, not weeks.** This is the LaunchOps wedge.
2. **Run the business on a revenue-first daily rhythm** -- FounderOS pomodoro agenda, DynExecutiv briefs, "cut what doesn't pay" metrics. This is the retention wedge.
3. **Govern every agent action through ProofGuard** so that when the system touches money, legal docs, or infrastructure, the founder has an audit trail and a kill switch. This is the **trust wedge** and the moat vs Zapier / Make / Bardeen.

### Suggested v1 pricing

| Tier | Price | Who it's for | What they get |
|---|---|---|---|
| **Founder** | $99/mo | Solo founder, pre-revenue to $1k MRR | 1 deployment, 10 pipeline runs/mo, 100 MCP invocations, basic ProofGuard |
| **Operator** | $299/mo | Solo or 2-person, $1k-$20k MRR | 3 deployments, unlimited runs, 1000 MCP invocations, full HITL, email support |
| **Studio** | $899/mo | Agency deploying for 5+ clients | 10 deployments, white-label, SSO, 30-day audit retention |
| **Enterprise** | Custom | Mid-market needing AICM/IMDA compliance | Unlimited, dedicated CQS model, compliance reports, SOC2 bundle |

**Path to $1M ARR:** 100 Operator + 20 Studio + 3 Enterprise ~= $73k MRR ~= $876k ARR.

### What is missing to support $1M ARR

1. **Tenant isolation** -- no concept of `tenant_id`.
2. **Admin console** -- no operator-facing analytics dashboard.
3. **Audit log export** -- compliance buyers will ask for CSV/PDF.
4. **Billing integration** -- no customer-facing Stripe billing for Dynexis itself.
5. **Usage metering** -- zero metering code.
6. **Onboarding flow** -- TAM of 30 until web-based `app.dynexis.io/start` exists.
7. **Pause / resume / rollback** -- real operators need deployment lifecycle control.
8. **Retention loops** -- daily brief as email would turn the product into a daily habit.
9. **Differentiation proof** -- ProofGuard CQS radar on the landing page.

---

## 7. Strategic Additions and Hypotheses

### Should add (high leverage, low cost)

- Tenant model (`tenants`, `tenant_api_keys`, `tenant_usage` tables)
- Stripe billing for Dynexis itself (meta-dogfooding)
- ProofGuard compliance report export (signed PDF by IMDA pillar)
- Idempotent deployment IDs + resumable pipeline runs
- Structured logs + read-only Logs page
- Webhook outbound for pipeline events (Slack/Linear/Notion)
- Template marketplace for business configs

### Could add (not now)

- Model routing layer (Groq/Haiku for cheap calls, Opus for expensive)
- On-premise / VPC deployment SKU
- Voice interface on the daily brief
- Multi-agent marketplace
- Offline/local-first mode

### Avoid adding right now

- Mobile app
- "Chat with your business" interface
- Blockchain / Web3 story
- Kubernetes Helm chart
- Agents that don't change revenue

---

## 8. Recommended Next Build Order

### Sprint 1 (this week) -- fragility

1. Kill `shell=True` in `BaseAgent.run_command`
2. Add API key auth on all write routes
3. Restrict CORS via `DASHBOARD_ORIGIN` env var
4. Make ProofGuard fail-closed by default
5. Route CLI through `Phase2Executor`
6. SQLite-backed deployment + run store
7. Dockerfile for the FastAPI app
8. Structured JSON logging
9. Tag `v0.3.0-hardening`

### Sprint 2 -- unlock value

1. Tenant model
2. Per-tenant data namespace
3. Usage metering
4. propose_plan hooks on remaining 11 agents
5. Split `core/orchestrator.py`
6. Integration tests for Phase 2
7. Tag `v0.4.0-multitenant`

### Sprint 3 -- monetization

1. Stripe Checkout for Dynexis itself
2. Admin console page
3. Compliance report export
4. Webhook delivery
5. Landing page
6. Tag `v0.5.0-paid`

### Sprint 4 -- scale

1. Redis-backed state
2. Multi-worker uvicorn
3. Rate limiting
4. LLM cost cap per tenant
5. Sentry + OpenTelemetry
6. Tag `v1.0.0`

---

## 9. Immediate Action Plan

Sprint 1 execution order (committing after each):

1. **RCE kill** -- patch `BaseAgent.run_command` to remove `shell=True` by default
2. **API auth** -- add `core/auth.py` with `verify_api_key` dependency
3. **CORS lockdown** -- read `DASHBOARD_ORIGIN` from env
4. **ProofGuard fail-closed** -- delete `PROOFGUARD_FAIL_OPEN` env-var support
5. **One-path execution** -- route `launchops.py launch` through `Phase2Executor`
6. **SQLite-backed state** -- `core/store.py` with `DeploymentStore` + `RunStore` via `aiosqlite`
7. **Dockerfile + docker-compose** -- multi-stage Python + Node build
8. **Structured logging** -- `core/logging.py` with `structlog` config

---

## Appendix A -- Verified evidence map

| Finding | Verification |
|---|---|
| `shell=True` in base agent | Direct file read of `agents/base.py:135-136` |
| CORS wide open | Direct file read of `api/main.py:59-65` |
| `_require_token` only on MCP routes | Direct file read of `api/routes/mcp.py:51-58` |
| Two-path execution | File reads of `core/orchestrator.py::run` (Phase 1 sync) and `::run_pipeline` (Phase 2 async) |
| In-memory deployment registry | File read of `api/routes/command_center.py:82` |
| Process-local singletons | File read of `api/state.py:20-42` |
| 49 unit tests, no integration | Direct file read of `tests/test_agents.py` class list |
| Dashboard TS + Vite build green | `npx tsc --noEmit` and `npm run build` both pass at commit `7cf8fd2` |
| Python smoke tests green | 5/5 passed (TemporalManager, FounderOSAgent, propose_plan hooks, UI_COMPONENTS, ProofGuardMiddleware) |
