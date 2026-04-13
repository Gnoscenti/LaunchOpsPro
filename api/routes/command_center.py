"""
Gnoscenti Command Center routes (/api/v1/*)
============================================

Unification layer connecting the Dynexis React frontend to the LaunchOps
execution stack, per the "Nervous System" architecture.

Endpoints:

    POST /api/v1/atlas/launch              kick off the 10-stage pipeline
    GET  /api/v1/atlas/stream/{id}         stream live SSE events for a run
    GET  /api/v1/atlas/deployments         list active deployments
    GET  /api/v1/daily-brief               FounderOS pomodoro agenda (JSON)

Design:
  * Launch returns a `deployment_id` immediately. The pipeline runs in a
    background asyncio task that writes SSE frames into an async queue.
  * The stream endpoint drains the queue, yielding Server-Sent Events to
    the dashboard's EventSource connection.
  * Events passed through are the full Phase 2 event schema:
      pipeline_start, stage_start, agent_propose, proofguard_verdict,
      hitl_waiting, ui_component, agent_result, stage_complete, …
  * Deployments live in an in-process registry (DEPLOYMENTS dict). For
    multi-worker production, back this with Redis — but for a solo
    founder edition running a single uvicorn process, in-memory is fine.

This route set composes OVER Phase2Executor and does NOT replace the
existing /atlas/execute or /atlas/v2/execute endpoints, so both the
legacy CLI and the new Dynexis dashboard can coexist.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.state import get_atlas
from core.orchestrator import STAGES, Phase2Executor
from core.proofguard import ProofGuardMiddleware

router = APIRouter(prefix="/api/v1", tags=["command-center"])


# ── Deployment registry ─────────────────────────────────────────────────────


class Deployment:
    """In-memory record of a running pipeline deployment."""

    def __init__(self, deployment_id: str, payload: Dict[str, Any]):
        self.id = deployment_id
        self.payload = payload
        self.started_at = datetime.utcnow()
        self.completed_at: Optional[datetime] = None
        self.status: str = "pending"  # pending | running | completed | failed
        self.queue: asyncio.Queue = asyncio.Queue()
        self.task: Optional[asyncio.Task] = None
        self.event_count: int = 0
        self.last_error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "deployment_id": self.id,
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "completed_at": (
                self.completed_at.isoformat() if self.completed_at else None
            ),
            "event_count": self.event_count,
            "last_error": self.last_error,
            "payload": self.payload,
        }


# In-process registry for ACTIVE deployments (the queue + asyncio.Task
# objects can't be serialized to SQLite). Completed deployments are also
# persisted to the SQLite StateStore so they survive restarts.
DEPLOYMENTS: Dict[str, Deployment] = {}

# Lazy import to avoid circular dependency at module load time.
def _persist_deployment(dep: Deployment) -> None:
    """Write-through to SQLite."""
    try:
        from core.store import get_store
        get_store().save_deployment(
            deployment_id=dep.id,
            status=dep.status,
            payload=dep.payload,
            started_at=dep.started_at.isoformat() if dep.started_at else None,
            completed_at=dep.completed_at.isoformat() if dep.completed_at else None,
            event_count=dep.event_count,
            last_error=dep.last_error,
        )
    except Exception:
        pass  # best-effort; in-memory is the primary


# ── Request/response models ─────────────────────────────────────────────────


class LaunchRequest(BaseModel):
    """Body for POST /api/v1/atlas/launch."""

    id: Optional[str] = None  # External id — if omitted, one is generated
    start_stage: Optional[str] = None
    end_stage: Optional[str] = None
    enforce_hitl: Optional[bool] = None
    # Arbitrary tenant-supplied config passed straight through
    config: Optional[Dict[str, Any]] = None


# ── SSE helper ──────────────────────────────────────────────────────────────


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


# ── Background pipeline runner ─────────────────────────────────────────────


async def _run_deployment(deployment: Deployment) -> None:
    """
    Drive a full governed pipeline run and push every SSE event into the
    deployment's async queue so the stream endpoint can fan it out.
    """
    deployment.status = "running"
    _persist_deployment(deployment)

    atlas = get_atlas()
    proofguard = ProofGuardMiddleware(
        hitl_enabled=deployment.payload.get("enforce_hitl")
    )
    executor = Phase2Executor(atlas, proofguard=proofguard)

    try:
        async for event_name, data in executor.run_pipeline(
            start_stage=deployment.payload.get("start_stage"),
            end_stage=deployment.payload.get("end_stage"),
        ):
            await deployment.queue.put((event_name, data))
            deployment.event_count += 1
        deployment.status = "completed"
    except Exception as e:
        deployment.status = "failed"
        deployment.last_error = str(e)
        await deployment.queue.put(
            (
                "pipeline_error",
                {"error": str(e), "timestamp": datetime.utcnow().isoformat()},
            )
        )
    finally:
        deployment.completed_at = datetime.utcnow()
        _persist_deployment(deployment)
        # Signal end-of-stream to any connected consumers
        await deployment.queue.put(("__stream_end__", None))


# ── Routes ──────────────────────────────────────────────────────────────────


@router.post("/atlas/launch")
async def launch_pipeline(request: LaunchRequest) -> Dict[str, Any]:
    """
    Kick off a governed LaunchOps pipeline run in the background and return
    a deployment_id the dashboard can use to connect its EventSource to the
    /api/v1/atlas/stream/{id} endpoint.
    """
    if request.start_stage and request.start_stage not in STAGES:
        raise HTTPException(400, f"Unknown start_stage: {request.start_stage}")
    if request.end_stage and request.end_stage not in STAGES:
        raise HTTPException(400, f"Unknown end_stage: {request.end_stage}")

    deployment_id = request.id or f"dep_{uuid.uuid4().hex[:16]}"

    if deployment_id in DEPLOYMENTS:
        raise HTTPException(409, f"Deployment {deployment_id} already exists")

    deployment = Deployment(
        deployment_id=deployment_id,
        payload=request.model_dump(),
    )
    DEPLOYMENTS[deployment_id] = deployment

    # Spin the run on the existing event loop so the SSE stream can drain
    # the queue without blocking the HTTP response.
    deployment.task = asyncio.create_task(_run_deployment(deployment))

    return {
        "status": "Pipeline Initiated",
        "deployment_id": deployment_id,
        "stream_url": f"/api/v1/atlas/stream/{deployment_id}",
        "started_at": deployment.started_at.isoformat(),
    }


@router.get("/atlas/stream/{deployment_id}")
async def stream_deployment(deployment_id: str) -> StreamingResponse:
    """
    Stream live SSE events for a deployment. Works with browser EventSource
    (GET) since it doesn't require a body.
    """
    deployment = DEPLOYMENTS.get(deployment_id)
    if deployment is None:
        raise HTTPException(404, f"Deployment {deployment_id} not found")

    async def event_stream():
        yield _sse(
            "connected",
            {
                "deployment_id": deployment_id,
                "status": deployment.status,
                "event_count": deployment.event_count,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        while True:
            try:
                event_name, data = await asyncio.wait_for(
                    deployment.queue.get(), timeout=30.0
                )
            except asyncio.TimeoutError:
                # Keep-alive ping every 30s so proxies don't kill the connection
                yield ": keep-alive\n\n"
                continue

            if event_name == "__stream_end__":
                yield _sse(
                    "stream_end",
                    {
                        "deployment_id": deployment_id,
                        "final_status": deployment.status,
                        "event_count": deployment.event_count,
                    },
                )
                return

            yield _sse(event_name, data)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/atlas/deployments")
async def list_deployments(limit: int = 50) -> Dict[str, Any]:
    """
    List deployments. Merges in-memory active deployments with
    historical records from SQLite so restarts don't lose history.
    """
    from core.store import get_store

    # Active in-memory deployments take priority
    active = {d.id: d.to_dict() for d in DEPLOYMENTS.values()}

    # Historical from SQLite (may include completed entries from past runs)
    try:
        for row in get_store().list_deployments(limit=limit):
            dep_id = row.get("deployment_id")
            if dep_id and dep_id not in active:
                active[dep_id] = row
    except Exception:
        pass

    items = sorted(active.values(), key=lambda d: d.get("started_at", ""), reverse=True)
    return {
        "total": len(items),
        "deployments": items[:limit],
    }


@router.get("/daily-brief")
async def get_daily_brief() -> Dict[str, Any]:
    """
    Return the FounderOS daily agenda as a Generative UI payload.
    Wraps FounderOSAgent.generate_daily_agenda() — the same method that
    also flows through /dynexexcutiv/stream and the governed pipeline.
    """
    atlas = get_atlas()
    agent = atlas.agents.get("founder_os")
    if agent is None:
        raise HTTPException(
            503, "FounderOSAgent is not loaded (check OPENAI_API_KEY)"
        )

    # Pull any live context the agent already has in the shared atlas state
    context_data: Dict[str, Any] = {}
    try:
        context_data = {
            "current_mrr": atlas.context._data.get("metrics", {}).get(
                "current_mrr", 0.0
            ),
            "pipeline_deals": atlas.context._data.get("crm_data", {}).get(
                "deals", []
            ),
            "stripe_data": atlas.context._data.get("stripe_data", {}),
        }
    except Exception:
        pass

    generate = getattr(agent, "generate_daily_agenda", None)
    if generate is None:
        raise HTTPException(
            501, "FounderOSAgent.generate_daily_agenda is not available"
        )

    if asyncio.iscoroutinefunction(generate):
        payload = await generate(context=context_data)
    else:
        payload = await asyncio.to_thread(generate, context_data)

    return payload
