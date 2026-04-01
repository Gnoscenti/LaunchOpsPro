"""Configuration, context, agents, logs, and permissions endpoints."""

import json
from typing import Optional

from fastapi import APIRouter, HTTPException

from api.state import get_atlas, get_context
from core.permissions import ENABLE_HUMAN_APPROVAL, REQUIRES_HUMAN_APPROVAL

router = APIRouter(tags=["config"])


@router.get("/atlas/context")
async def atlas_context():
    """Full shared context dump — the single source of truth."""
    ctx = get_context()
    return ctx.to_dict()


@router.get("/atlas/context/{key:path}")
async def atlas_context_key(key: str):
    """Get a specific key from the shared context using dot notation."""
    ctx = get_context()
    value = ctx.get(key)
    if value is None:
        raise HTTPException(404, f"Key not found: {key}")
    return {"key": key, "value": value}


@router.get("/atlas/logs")
async def atlas_logs(limit: int = 100, level: Optional[str] = None):
    """Audit log from shared context."""
    ctx = get_context()
    logs = ctx._data.get("audit_log", [])

    if level:
        logs = [entry for entry in logs if entry.get("level") == level]

    return {"logs": logs[-limit:][::-1], "total": len(logs)}


@router.get("/atlas/agents")
async def atlas_agents():
    """List registered agents and their stage assignments."""
    atlas = get_atlas()
    agents_info = {}
    for name, agent in atlas.agents.items():
        agents_info[name] = {
            "class": agent.__class__.__name__,
            "has_execute": hasattr(agent, "execute"),
            "methods": [m for m in dir(agent) if not m.startswith("_") and callable(getattr(agent, m, None))],
        }
    return {
        "agents": agents_info,
        "count": len(agents_info),
        "stage_handlers": list(atlas._stage_handlers.keys()),
    }


@router.get("/permissions")
async def list_permissions():
    """Permission matrix and human approval status."""
    return {
        "human_approval_enabled": ENABLE_HUMAN_APPROVAL,
        "operations_requiring_approval": list(REQUIRES_HUMAN_APPROVAL),
    }


@router.get("/prompts")
async def list_prompts():
    """List all available prompt templates."""
    from pathlib import Path
    templates_dir = Path(__file__).resolve().parent.parent.parent / "templates"
    prompts = {}
    if templates_dir.exists():
        for f in templates_dir.glob("*.md"):
            prompts[f.stem] = str(f)
    return {"prompts": prompts, "count": len(prompts)}


@router.get("/prompts/{prompt_id}")
async def get_prompt(prompt_id: str):
    """Get a specific prompt template content."""
    from pathlib import Path
    templates_dir = Path(__file__).resolve().parent.parent.parent / "templates"
    prompt_file = templates_dir / f"{prompt_id}.md"
    if not prompt_file.exists():
        raise HTTPException(404, f"Prompt not found: {prompt_id}")
    return {"id": prompt_id, "content": prompt_file.read_text()}
