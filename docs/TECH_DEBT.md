# Technical Debt Register

**Last updated:** 2026-04-11 | **Commit:** `7cf8fd2`

Severity: C = Critical, H = High, M = Medium, L = Low

| ID | Sev | Area | Issue | Fix | Sprint |
|----|-----|------|-------|-----|--------|
| C1 | C | agents/base.py | `shell=True` in `run_command()` -- RCE vector | `shell=False` + `shlex.split()` + `allow_shell` opt-in | 1 |
| C2 | C | api/main.py | CORS `allow_origins=["*"]` + zero API auth | `verify_api_key` dependency + env-driven CORS | 1 |
| C3 | C | core/proofguard.py | `PROOFGUARD_FAIL_OPEN` env var bypasses governance | Delete env-var support; fail-closed only | 1 |
| C4 | C | core/orchestrator.py | CLI path bypasses Phase 2 governance | Route `launchops.py launch` through Phase2Executor | 1 |
| H1 | H | api/routes/command_center.py | In-memory `DEPLOYMENTS` dict dies on restart | SQLite via `core/store.py` | 1 |
| H2 | H | api/state.py | Process-local singletons break multi-worker | Shared state store (SQLite then Redis) | 1 |
| H3 | H | useAgentStream.ts | Unbounded `blocks` array growth | Cap at 500 + sliding window | 2 |
| H4 | H | core/orchestrator.py | Default thread pool can exhaust | Bounded `ThreadPoolExecutor` | 2 |
| H5 | H | -- | No Dockerfile for FastAPI app | Multi-stage Dockerfile + compose entry | 1 |
| H6 | H | api/routes/mcp.py | Only route with auth; non-constant-time comparison | `hmac.compare_digest` + global auth middleware | 1 |
| M1 | M | core/context.py, config.py, credentials.py | Silent `except Exception: pass` on load | Log at WARNING + schema validation | 2 |
| M2 | M | tests/ | No Phase 2/ProofGuard/SSE/MCP tests | pytest integration suite with httpx | 2 |
| M3 | M | agents/* | No shared task_payload schema | Per-agent Pydantic models for task dicts | 3 |
| M4 | M | agents/dynexecutiv.py | Blocking `stripe.Subscription.list` in async | Wrap in `asyncio.to_thread` | 2 |
| M5 | M | -- | No structured logging config | `structlog` JSON logger with run_id context | 1 |
| M6 | M | core/credentials.py | Vault key from env var, not KMS | KMS integration (later) | 4 |
| L1 | L | core/orchestrator.py | `print()` instead of `logger` | Replace with `logger.info()` | 1 |
| L2 | L | launchops.py | Eager 17+ agent imports on every boot | Lazy loading or deferred imports | 3 |
| L3 | L | .env.example | `rk_live_...` placeholder wrong | Change to `sk_live_...` | 1 |
| L4 | L | Dashboard pages | 4 pages not using typed api.ts | Migrate to typed REST helpers | 2 |

**Convention:** Items are resolved by committing the fix and moving the row to a `## Resolved` section at the bottom with the commit hash.
