"""
LaunchOps Founder Edition — FastAPI Operator API (v3.0)

Unified execution surface: CLI and UI share the same Atlas orchestrator.
This is the modular version — routes are split into separate modules.

Start:
    cd launchops-founder-edition
    python -m api.main

Endpoints:
    GET  /                          → System info
    GET  /health                    → Health check

    GET  /atlas/status              → Orchestrator status + context summary
    GET  /atlas/stages              → All pipeline stages with status
    POST /atlas/execute             → Execute full pipeline (SSE stream)
    POST /atlas/execute/stage       → Execute a single stage
    GET  /atlas/runs                → Execution history
    POST /atlas/reset               → Reset pipeline state

    [Phase 2 — Governed Execution]
    GET  /atlas/v2/status           → ProofGuard governance configuration
    POST /atlas/v2/execute          → Execute pipeline with ProofGuard + HITL (SSE)
    POST /atlas/v2/execute/stage    → Governed single-stage execution

    GET  /atlas/context             → Full shared context dump
    GET  /atlas/context/{key}       → Dot-notation key lookup
    GET  /atlas/logs                → Audit log
    GET  /atlas/agents              → List agents with methods

    GET  /artifacts/                → List generated artifacts
    GET  /artifacts/{id}            → Artifact metadata
    GET  /artifacts/{id}/download   → Download artifact file

    GET  /services/                 → Docker service health
    GET  /services/{name}           → Single service health

    GET  /prompts                   → List prompt templates
    GET  /prompts/{id}              → Get prompt content
    GET  /permissions               → Permission matrix
"""

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure repo root is importable
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

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
)

app = FastAPI(
    title="LaunchOps Founder Edition",
    version="3.0.0",
    description="Unified Atlas orchestration API — same engine as the CLI.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tier 3 personal edition — no restriction
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount route modules ─────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(pipeline.router)           # Phase 1 sync /atlas/execute
app.include_router(execute_v2.router)         # Phase 2 governed /atlas/v2/execute + /hitl
app.include_router(dynexecutiv.router)        # Phase 3 Generative UI stream
app.include_router(mcp_routes.router)         # Phase 4 /mcp/discover + /mcp/invoke
app.include_router(command_center.router)    # Gnoscenti Command Center /api/v1/*
app.include_router(config.router)
app.include_router(artifacts.router)
app.include_router(services.router)

# ── Entrypoint ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("LAUNCHOPS_API_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
