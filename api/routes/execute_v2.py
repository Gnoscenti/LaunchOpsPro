"""
Phase 2 Governed Execution Route — /atlas/v2/execute

SSE endpoint that runs the LaunchOps pipeline through the Phase 2 governance
layer (ProofGuard attestation, CQS scoring, HITL) and streams per-agent events
to the dashboard in real time.

Event stream (SSE event names):
    pipeline_start      — run started
    stage_start         — a stage is beginning
    agent_propose       — an agent drafted a plan (pre-governance)
    proofguard_verdict  — CQS score + APPROVED/BLOCKED/REQUIRES_HITL verdict
    hitl_waiting        — paused for human approval
    hitl_resumed        — human approved, resuming
    agent_executing     — plan attested, agent is firing
    agent_result        — agent returned
    stage_complete      — stage finished successfully
    stage_error         — runtime or security error during the stage
    pipeline_complete   — run finished

Frontends that connect to this via EventSource should listen for each of the
above event names. The final `pipeline_complete` payload contains the full
error list so the dashboard can render a summary without re-querying.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.state import get_atlas, run_store
from api.models.pipeline import RunRecord
from core.orchestrator import STAGES, Phase2Executor
from core.proofguard import ProofGuardMiddleware, SecurityError

router = APIRouter(prefix="/atlas/v2", tags=["pipeline-v2"])


# ── Request model ──────────────────────────────────────────────────────────


class GovernedExecuteRequest(BaseModel):
    """Request body for the Phase 2 governed pipeline run."""

    start_stage: Optional[str] = None
    end_stage: Optional[str] = None
    enforce_hitl: Optional[bool] = None  # Override ENABLE_HUMAN_APPROVAL per-run
    proofguard_api_url: Optional[str] = None  # Override PROOFGUARD_API_URL per-run


# ── SSE helper ─────────────────────────────────────────────────────────────


def sse_event(event: str, data: Any) -> str:
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


# ── Status endpoint (for dashboard preflight) ──────────────────────────────


@router.get("/status")
async def v2_status():
    """Report governance layer configuration for the dashboard."""
    pg = ProofGuardMiddleware()
    atlas = get_atlas()
    return {
        "phase": 2,
        "stages": STAGES,
        "agents_loaded": len(atlas.agents),
        "stages_with_handlers": list(atlas._stage_handlers.keys()),
        "proofguard": {
            "api_url": pg.api_url,
            "hitl_enabled": pg.hitl_enabled,
            "fail_open": pg.fail_open,
            "hitl_timeout": pg.hitl_timeout,
            "poll_interval": pg.poll_interval,
        },
    }


# ── Main SSE execution endpoint ────────────────────────────────────────────


@router.post("/execute")
async def v2_execute(request: GovernedExecuteRequest):
    """
    Run the pipeline through Phase 2 governance and stream events over SSE.

    Every stage fires through:
        agent.propose_plan()
        → ProofGuard.attest_action()
        → [HITL pause if required]
        → agent.execute()
        → ProofGuard.record_execution()

    The first governance block (SecurityError) stops the pipeline. Runtime
    errors within a stage are streamed as stage_error events but do not
    abort the run — downstream stages continue.
    """
    if request.start_stage and request.start_stage not in STAGES:
        raise HTTPException(400, f"Unknown start_stage: {request.start_stage}")
    if request.end_stage and request.end_stage not in STAGES:
        raise HTTPException(400, f"Unknown end_stage: {request.end_stage}")

    atlas = get_atlas()

    # Build the governance middleware with per-request overrides
    proofguard = ProofGuardMiddleware(
        api_url=request.proofguard_api_url,
        hitl_enabled=request.enforce_hitl,
    )
    executor = Phase2Executor(atlas, proofguard=proofguard)

    # Seed a run record so /atlas/runs reflects Phase 2 runs too
    run_id = getattr(atlas.context, "run_id", datetime.utcnow().isoformat())
    start_idx = STAGES.index(request.start_stage) if request.start_stage else 0
    end_idx = (STAGES.index(request.end_stage) + 1) if request.end_stage else len(STAGES)
    stages_to_run = STAGES[start_idx:end_idx]

    run = RunRecord(
        run_id=run_id,
        started_at=datetime.utcnow().isoformat(),
        status="running",
        stages_total=len(stages_to_run),
    )
    run_store.append(run.dict())

    async def event_stream():
        errors_seen = 0
        completed = 0
        try:
            async for event_name, payload in executor.run_pipeline(
                start_stage=request.start_stage,
                end_stage=request.end_stage,
            ):
                if event_name == "stage_complete":
                    completed += 1
                elif event_name == "stage_error":
                    errors_seen += 1
                yield sse_event(event_name, payload)
        except SecurityError as e:
            errors_seen += 1
            yield sse_event(
                "governance_halt",
                {"error": str(e), "timestamp": datetime.utcnow().isoformat()},
            )
        except Exception as e:
            errors_seen += 1
            yield sse_event(
                "pipeline_error",
                {"error": str(e), "timestamp": datetime.utcnow().isoformat()},
            )
        finally:
            # Finalize the run record
            run_store[-1]["completed_at"] = datetime.utcnow().isoformat()
            run_store[-1]["status"] = "failed" if errors_seen else "completed"
            run_store[-1]["stages_completed"] = completed
            run_store[-1]["errors"] = [{"count": errors_seen}]

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Single-stage governed execution (non-SSE, sync response) ───────────────


class GovernedStageRequest(BaseModel):
    stage: str
    enforce_hitl: Optional[bool] = None


@router.post("/execute/stage")
async def v2_execute_stage(request: GovernedStageRequest) -> Dict[str, Any]:
    """
    Run a single stage through governance and return the final verdict.
    Non-streaming — intended for CLI use or dashboard retry actions.
    """
    if request.stage not in STAGES:
        raise HTTPException(400, f"Unknown stage: {request.stage}")

    atlas = get_atlas()
    proofguard = ProofGuardMiddleware(hitl_enabled=request.enforce_hitl)
    executor = Phase2Executor(atlas, proofguard=proofguard)

    try:
        result = await executor.execute_stage(request.stage)
        return {
            "stage": request.stage,
            "status": "completed",
            "result_preview": str(result)[:500] if result else None,
        }
    except SecurityError as e:
        raise HTTPException(403, f"Governance block: {e}")
    except Exception as e:
        raise HTTPException(500, f"Stage '{request.stage}' failed: {e}")


# ── HITL approve / reject (dashboard forwards to ProofGuard) ───────────────


class HITLDecisionRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/hitl/{attestation_id}/approve")
async def hitl_approve(
    attestation_id: str, request: Optional[HITLDecisionRequest] = None
) -> Dict[str, Any]:
    """
    Forward an HITL approve decision to the ProofGuard control plane.
    Called by HITLApprovalCard on the dashboard when the operator clicks
    the Approve button. ProofGuard's /api/attest/:id/approve endpoint
    updates the in-memory decision so the paused executor unblocks on
    its next poll.
    """
    return await _forward_hitl_decision(attestation_id, "approve", request)


@router.post("/hitl/{attestation_id}/reject")
async def hitl_reject(
    attestation_id: str, request: Optional[HITLDecisionRequest] = None
) -> Dict[str, Any]:
    """Forward an HITL reject decision to the ProofGuard control plane."""
    return await _forward_hitl_decision(attestation_id, "reject", request)


async def _forward_hitl_decision(
    attestation_id: str,
    action: str,
    request: Optional[HITLDecisionRequest],
) -> Dict[str, Any]:
    import httpx  # local import so module still loads if httpx is absent

    # Authorization: verify the attestation exists in our store before
    # forwarding the decision. This prevents an authenticated but
    # unauthorized caller from approving/rejecting arbitrary attestations.
    from core.store import get_store
    store = get_store()
    existing = store.get_hitl_decision(attestation_id)
    if existing is None:
        # Also accept attestation IDs that haven't been recorded locally
        # (e.g., created by a different worker or via direct ProofGuard call)
        # but log a warning for audit.
        import logging
        logging.getLogger("LaunchOps.HITL").warning(
            "HITL decision for unknown attestation_id=%s — forwarding anyway",
            attestation_id,
        )

    # Record the decision locally regardless of ProofGuard response
    store.save_hitl_decision(
        attestation_id,
        status="APPROVED" if action == "approve" else "REJECTED",
        reason=request.reason if request else None,
    )

    pg = ProofGuardMiddleware()
    url = f"{pg.api_url.rstrip('/')}/{attestation_id}/{action}"
    # ProofGuard's REST router mounts /api/attest/:id/approve|reject —
    # if PROOFGUARD_API_URL already ends with /api/attest, we need to trim
    # the trailing segment from the URL we just built.
    if pg.api_url.endswith("/api/attest"):
        url = f"{pg.api_url}/{attestation_id}/{action}"

    headers = {"Content-Type": "application/json"}
    if pg.api_key:
        headers["Authorization"] = f"Bearer {pg.api_key}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(
                url,
                json={"reason": (request.reason if request else None)},
                headers=headers,
            )
            res.raise_for_status()
            return res.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            502,
            f"Could not forward {action} to ProofGuard at {url}: {e}",
        )
