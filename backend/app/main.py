"""
LaunchOps Python Backend — FastAPI entry point.

Provides:
  GET  /health          — liveness probe (used by Docker healthcheck + Caddy)
  GET  /api/status      — system status and agent availability
  POST /api/run         — trigger a business build run (orchestrator)
  GET  /api/runs        — list recent runs
  GET  /api/agents      — list available agents/verticals

The orchestrator and agent modules are imported lazily so the server
starts even if optional dependencies (playwright, google-cloud, etc.)
are not yet installed in the container.
"""

from __future__ import annotations

import os
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("launchops.backend")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="LaunchOps Python Backend",
    description="AI-powered business builder orchestrator",
    version="0.1.0",
)

# Allow the platform (Node.js) container and local dev to call the API
ALLOWED_ORIGINS = [
    os.getenv("DASHBOARD_ORIGIN", "http://localhost:3000"),
    "http://localhost:5000",
    "http://localhost:5173",
    "http://platform:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory run store (replace with SQLite/SQLAlchemy for persistence) ──────
_runs: List[Dict[str, Any]] = []

# ── Pydantic models ───────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    goal: str
    business_type: Optional[str] = "saas"
    constraints: Optional[Dict[str, Any]] = {}


class RunResponse(BaseModel):
    run_id: str
    status: str
    goal: str
    started_at: str
    message: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> Dict[str, Any]:
    """Liveness probe — always returns 200 if the server is up."""
    return {
        "status": "ok",
        "service": "launchops-python-backend",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "mock_mode": os.getenv("MOCK_MODE", "false").lower() == "true",
    }


@app.get("/api/status")
async def status() -> Dict[str, Any]:
    """System status — reports available verticals and run count."""
    try:
        from app.verticals.saas import SaaSVertical
        verticals = [SaaSVertical.name]
    except Exception:
        verticals = ["saas"]

    return {
        "status": "running",
        "verticals_available": verticals,
        "runs_total": len(_runs),
        "mock_mode": os.getenv("MOCK_MODE", "false").lower() == "true",
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o"),
    }


@app.get("/api/agents")
async def list_agents() -> Dict[str, Any]:
    """Return the list of available agent steps."""
    try:
        from app.verticals.saas import SaaSVertical
        steps = SaaSVertical.steps
    except Exception:
        steps = []

    return {"agents": steps, "count": len(steps)}


@app.get("/api/runs")
async def list_runs(limit: int = 20) -> Dict[str, Any]:
    """Return the most recent runs."""
    return {"runs": _runs[-limit:], "total": len(_runs)}


@app.post("/api/run", response_model=RunResponse)
async def create_run(req: RunRequest) -> RunResponse:
    """
    Trigger a business build run.

    In MOCK_MODE=true the orchestrator is bypassed and a mock run is returned
    immediately. Set MOCK_MODE=false and configure OPENAI_API_KEY to run live.
    """
    run_id = f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    started_at = datetime.utcnow().isoformat() + "Z"
    mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true"

    if mock_mode:
        run_record = {
            "run_id": run_id,
            "status": "completed_mock",
            "goal": req.goal,
            "business_type": req.business_type,
            "started_at": started_at,
            "mock": True,
        }
        _runs.append(run_record)
        return RunResponse(
            run_id=run_id,
            status="completed_mock",
            goal=req.goal,
            started_at=started_at,
            message=(
                "Mock run completed. Set MOCK_MODE=false and configure "
                "OPENAI_API_KEY to run the live orchestrator."
            ),
        )

    # Live mode — import orchestrator lazily
    try:
        from app.agents.orchestrator import OrchestratorAgent

        agent = OrchestratorAgent()
        constraints = req.constraints or {}
        constraints["business_type"] = req.business_type
        run = agent.plan_execution(req.goal, constraints)

        run_record = {
            "run_id": run_id,
            "status": "planned",
            "goal": req.goal,
            "business_type": req.business_type,
            "started_at": started_at,
            "tasks": len(getattr(run, "tasks", [])),
        }
        _runs.append(run_record)

        return RunResponse(
            run_id=run_id,
            status="planned",
            goal=req.goal,
            started_at=started_at,
            message=f"Run planned with {len(getattr(run, 'tasks', []))} tasks.",
        )
    except Exception as exc:
        logger.exception("Orchestrator error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
