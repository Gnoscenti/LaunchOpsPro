"""Health and system info endpoints."""

from datetime import datetime
from fastapi import APIRouter

from api.state import get_atlas, get_context
from core.orchestrator import STAGES
from core.permissions import ENABLE_HUMAN_APPROVAL

router = APIRouter()


@router.get("/")
async def root():
    """System info."""
    return {
        "name": "LaunchOps Founder Edition",
        "version": "3.0.0",
        "engine": "Atlas Orchestrator",
        "mode": "Tier 3 — No Guardrails",
        "human_approval": ENABLE_HUMAN_APPROVAL,
        "status": "online",
    }


@router.get("/health")
async def health():
    """Health check with Atlas initialization status."""
    atlas = get_atlas()
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "atlas_initialized": atlas is not None,
        "stages": len(STAGES),
        "agents_loaded": len(atlas.agents) if atlas else 0,
        "handlers_registered": len(atlas._stage_handlers) if atlas else 0,
    }
