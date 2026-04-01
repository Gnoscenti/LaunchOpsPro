"""Pipeline execution, stage listing, and run history endpoints."""

import asyncio
import json
import traceback
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.state import get_atlas, get_context, run_store
from api.models.pipeline import (
    ExecuteRequest,
    ExecuteStageRequest,
    StageInfo,
    PipelineStatus,
    RunRecord,
)
from core.orchestrator import STAGES
from core.permissions import permission_manager, ENABLE_HUMAN_APPROVAL

router = APIRouter(prefix="/atlas", tags=["pipeline"])

# ── Stage-to-agent mapping (for display purposes) ──────────────────────
STAGE_AGENTS = {
    "init": ["execai_coach"],
    "intake": ["business_builder", "dynexecutiv"],
    "formation": ["paralegal_bot", "paperwork_agent"],
    "infrastructure": ["wordpress_agent", "security_agent"],
    "legal": ["paperwork_agent", "paralegal_bot"],
    "payments": ["stripe_agent"],
    "funding": ["funding_intelligence"],
    "coaching": ["execai_coach", "founder_os"],
    "growth": ["growth_agent", "content_engine", "mautic_agent"],
    "done": ["documentary_tracker", "metrics_agent"],
}


def sse_event(event: str, data: Any) -> str:
    """Format a Server-Sent Event."""
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


@router.get("/status")
async def atlas_status():
    """Current orchestrator status and context summary."""
    atlas = get_atlas()
    ctx = get_context()
    return {
        "orchestrator": atlas.status(),
        "context_summary": ctx.summary(),
        "current_stage": ctx.stage,
        "stages": STAGES,
        "agents_loaded": len(atlas.agents),
        "handlers_registered": len(atlas._stage_handlers),
        "human_approval_enabled": ENABLE_HUMAN_APPROVAL,
    }


@router.get("/stages")
async def atlas_stages():
    """List all pipeline stages with status and assigned agents."""
    ctx = get_context()
    current = ctx.stage
    current_idx = STAGES.index(current) if current in STAGES else -1

    stages_list = []
    for i, stage in enumerate(STAGES):
        if i < current_idx:
            status = "completed"
        elif i == current_idx:
            status = "current"
        else:
            status = "pending"

        has_output = ctx.get_agent_output(f"stage_{stage}") is not None
        stages_list.append(
            StageInfo(
                index=i,
                name=stage,
                status=status,
                has_output=has_output,
                agents=STAGE_AGENTS.get(stage, []),
            ).dict()
        )

    return PipelineStatus(
        stages=stages_list,
        total=len(STAGES),
        current_stage=current,
        run_id=getattr(ctx, "run_id", None),
        human_approval_enabled=ENABLE_HUMAN_APPROVAL,
    ).dict()


@router.post("/execute")
async def atlas_execute(request: ExecuteRequest):
    """Execute the full pipeline (or a range of stages) via SSE stream."""
    atlas = get_atlas()

    if request.start_stage and request.start_stage not in STAGES:
        raise HTTPException(400, f"Unknown start_stage: {request.start_stage}")
    if request.end_stage and request.end_stage not in STAGES:
        raise HTTPException(400, f"Unknown end_stage: {request.end_stage}")

    if ENABLE_HUMAN_APPROVAL:
        if permission_manager.requires_human_approval("pipeline_execute"):
            raise HTTPException(
                403,
                "Human approval required for pipeline execution. "
                "Set ENABLE_HUMAN_APPROVAL=false or approve via CLI.",
            )

    async def event_stream():
        start_idx = STAGES.index(request.start_stage) if request.start_stage else 0
        end_idx = (STAGES.index(request.end_stage) + 1) if request.end_stage else len(STAGES)
        stages_to_run = STAGES[start_idx:end_idx]

        run_id = getattr(atlas.context, "run_id", datetime.utcnow().isoformat())
        run = RunRecord(
            run_id=run_id,
            started_at=datetime.utcnow().isoformat(),
            status="running",
            stages_total=len(stages_to_run),
        )
        run_store.append(run.dict())

        yield sse_event("pipeline_start", {
            "run_id": run_id,
            "stages": stages_to_run,
            "total": len(stages_to_run),
            "timestamp": datetime.utcnow().isoformat(),
        })

        errors = []
        for i, stage in enumerate(stages_to_run):
            yield sse_event("stage_start", {
                "stage": stage,
                "index": i,
                "total": len(stages_to_run),
                "agents": STAGE_AGENTS.get(stage, []),
            })

            try:
                result = await asyncio.to_thread(atlas.run_stage, stage)
                yield sse_event("stage_complete", {
                    "stage": stage,
                    "index": i,
                    "status": "completed",
                    "context_stage": atlas.context.stage,
                })
            except Exception as e:
                err = {"stage": stage, "error": str(e), "traceback": traceback.format_exc()}
                errors.append(err)
                yield sse_event("stage_error", {
                    "stage": stage,
                    "index": i,
                    "error": str(e),
                })

            await asyncio.sleep(0.1)

        # Update run record
        run_store[-1]["completed_at"] = datetime.utcnow().isoformat()
        run_store[-1]["status"] = "failed" if errors else "completed"
        run_store[-1]["stages_completed"] = len(stages_to_run) - len(errors)
        run_store[-1]["errors"] = errors

        yield sse_event("pipeline_complete", {
            "run_id": run_id,
            "final_stage": atlas.context.stage,
            "stages_completed": len(stages_to_run) - len(errors),
            "errors": len(errors),
            "timestamp": datetime.utcnow().isoformat(),
        })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/execute/stage")
async def atlas_execute_stage(request: ExecuteStageRequest):
    """Execute a single named stage and return the result."""
    atlas = get_atlas()

    if request.stage not in STAGES:
        raise HTTPException(400, f"Unknown stage: {request.stage}. Valid: {STAGES}")

    if ENABLE_HUMAN_APPROVAL:
        if permission_manager.requires_human_approval(f"stage_{request.stage}"):
            raise HTTPException(403, f"Human approval required for stage '{request.stage}'.")

    try:
        await asyncio.to_thread(atlas.run_stage, request.stage)
        return {
            "stage": request.stage,
            "status": "completed",
            "context_stage": atlas.context.stage,
            "run_id": getattr(atlas.context, "run_id", None),
        }
    except Exception as e:
        raise HTTPException(500, f"Stage '{request.stage}' failed: {str(e)}")


@router.get("/runs")
async def list_runs(limit: int = 20):
    """List recent pipeline execution runs."""
    return {
        "runs": run_store[-limit:][::-1],
        "total": len(run_store),
    }


@router.post("/reset")
async def reset_pipeline():
    """Reset the pipeline state."""
    ctx = get_context()
    ctx.stage = STAGES[0]
    return {"status": "reset", "current_stage": STAGES[0]}
