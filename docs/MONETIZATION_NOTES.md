# Monetization Notes — Dynexis LaunchOps

**Date:** 2026-04-11
**Target:** $1M ARR within 18 months of launch

---

## Core Value Props (in order of buying signal strength)

1. **"$22,000 Arbitrage"** — Deploy a complete business infrastructure that would cost $22k+ with consultants and SaaS subscriptions, for $315/yr + LLM costs. This is the **acquisition hook**. It's concrete, provable, and calculator-friendly for landing pages.

2. **Revenue-first daily rhythm** — FounderOS morning agenda + DynExecutiv daily brief + pomodoro sprints. This is the **retention hook**. When the founder's first action every morning is opening Dynexis, you've won. Ship as email to make it a habit.

3. **ProofGuard governance** — Every agent action CQS-scored and IMDA-attested. This is the **trust and differentiation hook**. No competitor (Zapier, Make, Bardeen, n8n, CrewAI) has this. Lead with the CQS radar chart on the landing page and "every action is attested" in the pricing table.

---

## Pricing Tiers (v1 proposal)

| Tier | Price | Target | Gate |
|------|-------|--------|------|
| Founder | $99/mo | Pre-revenue to $1k MRR | 1 deployment, 10 runs/mo, 100 MCP calls, basic CQS |
| Operator | $299/mo | $1k-$20k MRR, 1-2 person | 3 deployments, unlimited runs, 1000 MCP, full HITL |
| Studio | $899/mo | Agencies, 5+ clients | 10 deployments, white-label dashboard, SSO, 30-day audit |
| Enterprise | Custom | Mid-market, compliance-driven | Unlimited, dedicated CQS model, SOC2 bundle |

**ARR math:** 100 Operator + 20 Studio + 3 Enterprise (~$5k/mo) = ~$73k MRR = ~$876k ARR. Add 50 Founder tier ($99) = $5k MRR bump = $936k. Close enough to $1M with a few enterprise upgrades.

---

## Billable Dimensions

| Dimension | Metering point | Free tier cap | Pro cap |
|-----------|---------------|---------------|---------|
| Pipeline runs | `Phase2Executor.run_pipeline()` start event | 10/mo | unlimited |
| MCP invocations | `/mcp/invoke` handler | 100/mo | 1000/mo |
| LLM tokens | `LLMClient.chat()` token count | 100k/mo | 1M/mo |
| HITL decisions | `proofguard.wait_for_hitl()` calls | 5/mo | unlimited |
| Deployments | `POST /api/v1/atlas/launch` unique IDs | 1 | 3/10/unlimited |
| Audit retention | ProofGuard attestation age | 24 hours | 7/30/unlimited days |
| Agents | Agent count in `build_system()` | 5 core | 17 full |

**Zero metering code exists today.** Must instrument all 7 dimensions before billing launch.

---

## What Buyers Will Ask For (in order of sales cycle impact)

1. **"Can I see what the agents actually did?"** -> Admin console with attestation log, CQS scores, stage timelines. **Not built yet.**
2. **"Can I export the audit trail?"** -> CSV/PDF compliance report by date range and IMDA pillar. **Not built yet.**
3. **"Does it work with my existing tools?"** -> MCP gateway is built, but /mcp/discover has no UI and no marketing page. **Half-built.**
4. **"Can I try it without a credit card?"** -> No freemium or trial flow. CLI-only onboarding. **Not built.**
5. **"What if the AI does something wrong?"** -> ProofGuard HITL is built. HITLApprovalCard is in the dashboard. **Built, needs polish.**
6. **"Can I use it for my clients?"** -> No multi-tenant, no white-label. **Not built.**
7. **"Is my data safe?"** -> Fernet vault, local storage, no cloud dependencies. **Built, needs KMS for enterprise.**

---

## Retention Levers (ranked by impact on churn reduction)

1. **Daily brief as email** — "DynExecutiv says today's #1 move is X. Start your first sprint." One SendGrid integration + a cron job. Turns a weekly-use product into a daily-use product. **Highest-leverage retention feature, easiest to build.**

2. **Embedded data gravity** — The more pipeline runs, the richer the SharedContext and attestation history. Switching costs compound over time. **Already happening organically, needs to be surfaced in the UI** ("You've launched 47 stages and generated 12 legal documents. Your ProofGuard audit trail has 312 attestations.").

3. **Pomodoro completion streaks** — "You've completed 5 consecutive sprint days. Your MRR grew 12% this week." Gamification without being cheesy. **Easy to add, TemporalManager is built.**

4. **Webhook integrations** — Once a customer connects Slack notifications for pipeline events, they've woven Dynexis into their team workflow. **Not built, but the event stream is already there.**

---

## Competitive Positioning

| Competitor | What they are | Where Dynexis wins |
|------------|--------------|-------------------|
| Zapier / Make | Linear If-A-then-B automation | Dynexis is **agentic** (goal-driven, not step-driven) |
| CrewAI / AutoGen | Developer-focused agent frameworks | Dynexis is a **product**, not a framework. Founders use it, not build with it. |
| Stripe Atlas | Business formation (entity only) | Dynexis deploys the entire stack, not just the entity |
| Doola / Clerky | Online legal docs | Dynexis generates docs AND deploys infra AND runs the daily business |
| v0 / Cursor | AI coding assistants | Dynexis runs the business, not the code. Orthogonal, not competitive |

**One-line positioning:** "Dynexis is what you use instead of hiring your first ops person."

---

## Missing Commercial Infrastructure (prioritized)

1. Tenant model + API key management -> Sprint 2
2. Stripe billing for Dynexis itself -> Sprint 3
3. Usage metering instrumentation -> Sprint 2
4. Admin console (operator dashboard) -> Sprint 3
5. Web-based onboarding flow (`app.dynexis.io/start`) -> Sprint 3
6. Daily brief email delivery -> Sprint 2
7. Compliance report export (PDF) -> Sprint 3
8. Webhook delivery for pipeline events -> Sprint 3
