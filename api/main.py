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

from api.routes import health, pipeline, config, artifacts, services

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
app.include_router(pipeline.router)
app.include_router(config.router)
app.include_router(artifacts.router)
app.include_router(services.router)

# ── Entrypoint ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("LAUNCHOPS_API_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
