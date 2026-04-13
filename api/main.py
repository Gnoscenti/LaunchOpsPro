"""
Dynexis LaunchOps — FastAPI Operator API (v3.1)

Unified execution surface: CLI and UI share the same Atlas orchestrator.
Routes are split into separate modules. Auth enforced on all write routes.

Start:
    cd launchops-founder-edition
    python -m api.main

Environment:
    LAUNCHOPS_API_PORT      API port (default 8001)
    LAUNCHOPS_API_KEYS      Comma-separated API keys for auth
    LAUNCHOPS_DEV_MODE      If "true", disables auth (local dev only)
    DASHBOARD_ORIGIN        Allowed CORS origin (default http://localhost:5173)
"""

import os
import sys
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure repo root is importable
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from core.auth import require_auth, is_dev_mode
from core.logging_config import configure_logging

# Initialize structured logging before anything else runs
configure_logging()

from api.routes import (
    health,
    pipeline,
    config,
    artifacts,
    services,
    execute_v2,
    dynexecutiv,
    mcp as mcp_routes,
    command_center,
    onboarding,
)

app = FastAPI(
    title="Dynexis LaunchOps",
    version="3.1.0",
    description="Governed agentic execution API — ProofGuard + MCP + Generative UI.",
)

# ── CORS ───────────────────────────────────────────────────────────────────
# Defaults to localhost:5173 (Vite dev server). Set DASHBOARD_ORIGIN in
# production to your actual frontend URL. Never use "*" in production.

_dashboard_origin = os.getenv("DASHBOARD_ORIGIN", "http://localhost:5173")
_cors_origins = [o.strip() for o in _dashboard_origin.split(",") if o.strip()]
if is_dev_mode():
    _cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routes (no auth required) ──────────────────────────────────────
# Health check and basic read-only informational endpoints. These are
# always accessible so load balancers, uptime monitors, and the
# dashboard's initial fetch can work without a key.
app.include_router(health.router)

# ── Protected routes (require API key) ────────────────────────────────────
# All execution, configuration, and data-access routes require auth.
# In DEV_MODE the dependency is still mounted but short-circuits (returns
# immediately), so route signatures don't change per environment.

_auth = [Depends(require_auth)]

app.include_router(pipeline.router, dependencies=_auth)
app.include_router(execute_v2.router, dependencies=_auth)
app.include_router(dynexecutiv.router, dependencies=_auth)
app.include_router(mcp_routes.router, dependencies=_auth)
app.include_router(command_center.router, dependencies=_auth)
app.include_router(onboarding.router, dependencies=_auth)
app.include_router(config.router, dependencies=_auth)
app.include_router(artifacts.router, dependencies=_auth)
app.include_router(services.router, dependencies=_auth)

# ── Entrypoint ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("LAUNCHOPS_API_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
